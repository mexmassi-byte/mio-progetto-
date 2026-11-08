"""Missions (objectives) and their tasks (steps), persisted in SQLite.

Mission lifecycle:
  queued -> planning -> running -> verifying -> completed
                              \\-> awaiting_approval (waiting for the user)
                              \\-> blocked (budget exhausted / needs a decision)
  any -> failed | cancelled
  'completed'            the completion condition was checked by code
  'completed_unverified' all steps succeeded but no automatic check exists
  'incomplete'           steps finished but the completion condition is not met
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from ..db.database import Database, dumps, loads, new_id, now_iso
from ..events import EventBus
from ..security.permissions import Permission

ACTIVE = ("queued", "planning", "running", "verifying")
WAITING = ("awaiting_approval", "blocked")
FINAL = ("completed", "completed_unverified", "incomplete", "failed", "cancelled")
TASK_FINAL = ("succeeded", "failed", "rejected", "skipped", "cancelled")


class MissionService:
    def __init__(self, db: Database, bus: EventBus, settings: Any):
        self.db = db
        self.bus = bus
        self.settings = settings

    # -------------------------------------------------------------- missions
    def create(self, objective: str, *, kind: str = "auto", params: dict | None = None,
               priority: int = 5, max_steps: int | None = None, max_seconds: int | None = None,
               permission_level: str = Permission.APPROVAL.value,
               completion_condition: str = "") -> dict[str, Any]:
        objective = objective.strip()
        if not objective:
            raise ValueError("Objective is empty")
        mid = new_id("mis")
        ts = now_iso()
        self.db.insert("missions", {
            "id": mid, "objective": objective[:4000], "kind": kind, "params": dumps(params or {}),
            "status": "queued", "priority": max(1, min(10, priority)),
            "permission_level": Permission(permission_level).value,
            "max_steps": max_steps or self.settings.default_mission_max_steps,
            "max_seconds": max_seconds or self.settings.default_mission_max_seconds,
            "steps_used": 0, "completion_condition": completion_condition or "(set by the planner)",
            "verification": None, "result": None, "error": None,
            "created_at": ts, "updated_at": ts, "started_at": None, "finished_at": None,
        })
        self.bus.emit("mission.created", mission_id=mid, objective=objective[:200])
        return self.get(mid)  # type: ignore[return-value]

    def get(self, mission_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM missions WHERE id = ?", (mission_id,))
        return _mission(row) if row else None

    def detail(self, mission_id: str) -> dict[str, Any] | None:
        m = self.get(mission_id)
        if not m:
            return None
        m["tasks"] = self.tasks(mission_id)
        m["approvals"] = [_approval(r) for r in self.db.query(
            "SELECT * FROM approvals WHERE mission_id = ? ORDER BY created_at", (mission_id,))]
        m["progress"] = progress(m["tasks"])
        return m

    def list(self, status: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        if status == "active":
            rows = self.db.query(
                f"SELECT * FROM missions WHERE status IN ({','.join('?' * len(ACTIVE + WAITING))}) "
                "ORDER BY priority DESC, created_at LIMIT ?", (*ACTIVE, *WAITING, limit))
        elif status:
            rows = self.db.query("SELECT * FROM missions WHERE status = ? ORDER BY created_at DESC LIMIT ?",
                                 (status, limit))
        else:
            rows = self.db.query("SELECT * FROM missions ORDER BY created_at DESC LIMIT ?", (limit,))
        out = []
        for r in rows:
            m = _mission(r)
            m["progress"] = progress(self.tasks(m["id"]))
            out.append(m)
        return out

    def runnable(self, limit: int) -> list[dict[str, Any]]:
        rows = self.db.query(
            "SELECT * FROM missions WHERE status IN ('queued','planning','running','verifying') "
            "ORDER BY priority DESC, created_at LIMIT ?", (limit,))
        return [_mission(r) for r in rows]

    def set_status(self, mission_id: str, status: str, **fields: Any) -> None:
        values: dict[str, Any] = {"status": status, "updated_at": now_iso(), **fields}
        if status == "planning" and "started_at" not in fields:
            m = self.get(mission_id)
            if m and not m["started_at"]:
                values["started_at"] = now_iso()
        if status in FINAL:
            values.setdefault("finished_at", now_iso())
        for k in ("params", "verification", "result"):
            if k in values and values[k] is not None and not isinstance(values[k], str):
                values[k] = dumps(values[k])
        self.db.update("missions", "id", mission_id, values)
        self.bus.emit(f"mission.{status}", mission_id=mission_id,
                      **({"error": fields["error"]} if fields.get("error") else {}))

    def cancel(self, mission_id: str) -> bool:
        m = self.get(mission_id)
        if not m or m["status"] in FINAL:
            return False
        with self.db.tx():
            self.db.execute(
                "UPDATE tasks SET status='cancelled', updated_at=? WHERE mission_id=? AND status NOT IN "
                "('succeeded','failed','rejected','skipped')", (now_iso(), mission_id))
            self.db.execute("UPDATE approvals SET status='cancelled' WHERE mission_id=? AND status='pending'",
                            (mission_id,))
        self.set_status(mission_id, "cancelled")
        return True

    def resume(self, mission_id: str, extra_steps: int = 0) -> bool:
        """Resume a blocked mission (optionally granting more step budget)."""
        m = self.get(mission_id)
        if not m or m["status"] not in WAITING:
            return False
        fields: dict[str, Any] = {}
        if extra_steps:
            fields["max_steps"] = m["max_steps"] + extra_steps
        if m["status"] == "blocked":
            fields["max_seconds"] = m["max_seconds"] + self.settings.default_mission_max_seconds
        self.set_status(mission_id, "running", error=None, **fields)
        return True

    # ----------------------------------------------------------------- tasks
    def add_tasks(self, mission_id: str, steps: list[dict[str, Any]]) -> None:
        ts = now_iso()
        with self.db.tx():
            for i, step in enumerate(steps, start=1):
                self.db.insert("tasks", {
                    "id": new_id("tsk"), "mission_id": mission_id, "seq": i,
                    "title": step.get("title") or step["tool"], "tool": step["tool"],
                    "args": dumps(step.get("args") or {}), "depends_on": dumps(step.get("depends_on") or []),
                    "optional": 1 if step.get("optional") else 0,
                    "status": "pending", "attempts": 0,
                    "max_attempts": step.get("max_attempts") or self.settings.default_task_max_attempts,
                    "timeout_s": step.get("timeout_s") or self.settings.default_task_timeout_s,
                    "result": None, "error": None, "checkpoint": None, "next_attempt_at": None,
                    "created_at": ts, "updated_at": ts, "started_at": None, "finished_at": None,
                })

    def tasks(self, mission_id: str) -> list[dict[str, Any]]:
        return [_task(r) for r in self.db.query(
            "SELECT * FROM tasks WHERE mission_id = ? ORDER BY seq", (mission_id,))]

    def task(self, task_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM tasks WHERE id = ?", (task_id,))
        return _task(row) if row else None

    def update_task(self, task_id: str, **fields: Any) -> None:
        for k in ("args", "result", "checkpoint", "depends_on"):
            if k in fields and fields[k] is not None and not isinstance(fields[k], str):
                fields[k] = dumps(fields[k])
        fields["updated_at"] = now_iso()
        self.db.update("tasks", "id", task_id, fields)

    def next_task(self, mission_id: str) -> dict[str, Any] | None:
        tasks = self.tasks(mission_id)
        # An optional step that failed does not block the steps after it.
        done = {t["seq"] for t in tasks
                if t["status"] in ("succeeded", "skipped") or (t["optional"] and t["status"] in TASK_FINAL)}
        now = datetime.now(timezone.utc)
        for t in tasks:
            if t["status"] != "pending":
                continue
            if t["next_attempt_at"] and datetime.fromisoformat(t["next_attempt_at"]) > now:
                continue
            if all(d in done for d in t["depends_on"]):
                return t
        return None

    def results_by_seq(self, mission_id: str) -> dict[int, Any]:
        return {t["seq"]: t["result"] for t in self.tasks(mission_id) if t["status"] == "succeeded"}

    def recover_interrupted(self) -> int:
        """After a crash or restart, tasks left 'running' go back to the queue."""
        cur = self.db.execute(
            "UPDATE tasks SET status='pending', updated_at=?, error='interrupted by restart' "
            "WHERE status='running'", (now_iso(),))
        return cur.rowcount

    # ------------------------------------------------------------- approvals
    def request_approval(self, *, tool: str, args: dict, permission: str, reason: str,
                         mission_id: str | None = None, task_id: str | None = None) -> dict[str, Any]:
        existing = None
        if task_id:
            existing = self.db.one("SELECT * FROM approvals WHERE task_id = ? AND status = 'pending'", (task_id,))
        if existing:
            return _approval(existing)
        aid = new_id("apr")
        self.db.insert("approvals", {
            "id": aid, "mission_id": mission_id, "task_id": task_id, "tool": tool, "args": dumps(args),
            "permission": permission, "reason": reason, "status": "pending", "decided_note": None,
            "created_at": now_iso(), "decided_at": None,
        })
        self.bus.emit("approval.requested", approval_id=aid, tool=tool, mission_id=mission_id, reason=reason)
        return _approval(self.db.one("SELECT * FROM approvals WHERE id = ?", (aid,)))  # type: ignore[arg-type]

    def approvals(self, status: str | None = "pending") -> list[dict[str, Any]]:
        if status:
            rows = self.db.query("SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            rows = self.db.query("SELECT * FROM approvals ORDER BY created_at DESC LIMIT 200")
        return [_approval(r) for r in rows]

    def approval(self, approval_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM approvals WHERE id = ?", (approval_id,))
        return _approval(row) if row else None

    def task_is_approved(self, task_id: str) -> bool:
        return bool(self.db.scalar(
            "SELECT 1 FROM approvals WHERE task_id = ? AND status = 'approved' LIMIT 1", (task_id,)))

    # -------------------------------------------------------------- schedules
    def add_schedule(self, objective: str, interval_seconds: int, first_run_in_s: int = 0) -> dict:
        sid = new_id("sch")
        nxt = (datetime.now(timezone.utc) + timedelta(seconds=first_run_in_s)).isoformat(timespec="seconds")
        self.db.insert("schedules", {
            "id": sid, "objective": objective, "interval_seconds": max(3600, interval_seconds),
            "next_run_at": nxt, "enabled": 1, "last_mission_id": None, "created_at": now_iso(),
        })
        return self.db.one("SELECT * FROM schedules WHERE id = ?", (sid,))  # type: ignore[return-value]

    def schedules(self) -> list[dict]:
        return self.db.query("SELECT * FROM schedules ORDER BY created_at")


def progress(tasks: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(tasks)
    counts: dict[str, int] = {}
    for t in tasks:
        counts[t["status"]] = counts.get(t["status"], 0) + 1
    finished = sum(counts.get(s, 0) for s in TASK_FINAL)
    return {"total": total, "finished": finished, "counts": counts,
            "ratio": round(finished / total, 3) if total else 0.0}


def _mission(row: dict[str, Any]) -> dict[str, Any]:
    return {**row, "params": loads(row.get("params"), {}), "verification": loads(row.get("verification")),
            "result": loads(row.get("result"), row.get("result"))}


def _task(row: dict[str, Any]) -> dict[str, Any]:
    return {**row, "args": loads(row.get("args"), {}), "depends_on": loads(row.get("depends_on"), []),
            "result": loads(row.get("result")), "checkpoint": loads(row.get("checkpoint"), {}),
            "optional": bool(row.get("optional"))}


def _approval(row: dict[str, Any]) -> dict[str, Any]:
    return {**row, "args": loads(row.get("args"), {})}
