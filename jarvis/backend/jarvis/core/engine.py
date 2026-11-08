"""Autonomous execution engine.

A background loop that:
  * starts scheduled missions,
  * plans queued missions,
  * runs one step at a time per mission (with timeout, retries + backoff),
  * pauses on steps that need the user's approval,
  * enforces each mission's step and time budget,
  * verifies the completion condition in code before declaring success,
  * recovers interrupted work after a restart.

Every transition is persisted before and after it happens, so killing the
process at any moment loses at most the step that was running, which is
then retried.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, Any

from ..db.database import now_iso
from ..security.permissions import EXPLICIT_CONFIRMATION_PHRASE, Permission
from ..tools.builtin import notify
from ..tools.registry import PermissionDenied, ToolContext, ToolError
from .missions import FINAL, TASK_FINAL
from .planner import PlanningError
from .playbooks import VERIFIERS

if TYPE_CHECKING:  # pragma: no cover
    from ..services import Services

log = logging.getLogger("jarvis.engine")


class Engine:
    def __init__(self, services: "Services"):
        self.s = services
        self._loop_task: asyncio.Task | None = None
        self._running: dict[str, asyncio.Task] = {}
        self._stop = asyncio.Event()
        self.last_tick: str | None = None

    # ----------------------------------------------------------- lifecycle
    def start(self) -> None:
        recovered = self.s.missions.recover_interrupted()
        if recovered:
            self.s.bus.emit("system.recovered", tasks=recovered)
        self._stop.clear()
        self._loop_task = asyncio.create_task(self._run(), name="jarvis-engine")

    async def stop(self) -> None:
        self._stop.set()
        for t in list(self._running.values()):
            t.cancel()
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except (asyncio.CancelledError, Exception):
                pass

    def status(self) -> dict[str, Any]:
        return {"running": bool(self._loop_task and not self._loop_task.done()),
                "busy_missions": list(self._running), "last_tick": self.last_tick}

    async def _run(self) -> None:
        tick = self.s.settings.engine_tick_s
        while not self._stop.is_set():
            try:
                await self.tick()
            except Exception:  # never let the loop die
                log.exception("engine tick failed")
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=tick)
            except asyncio.TimeoutError:
                pass

    # ----------------------------------------------------------------- tick
    async def tick(self) -> None:
        self.last_tick = now_iso()
        self._start_due_schedules()
        try:
            self.s.goals.tick()  # daily objectives: launch / measure / retry missions
        except Exception:
            log.exception("goal tick failed")
        for mid, task in list(self._running.items()):
            if task.done():
                self._running.pop(mid, None)
        free = self.s.settings.engine_max_parallel_missions - len(self._running)
        if free <= 0:
            return
        for m in self.s.missions.runnable(limit=10):
            if free <= 0:
                break
            if m["id"] in self._running:
                continue
            self._running[m["id"]] = asyncio.create_task(self._step_guarded(m["id"]))
            free -= 1

    async def run_until_idle(self, mission_id: str, max_iterations: int = 200) -> dict[str, Any]:
        """Drive one mission synchronously (used by tests and the CLI)."""
        for _ in range(max_iterations):
            m = self.s.missions.get(mission_id)
            if not m or m["status"] in FINAL or m["status"] in ("awaiting_approval", "blocked"):
                break
            progressed = await self.step(mission_id)
            if not progressed:
                await asyncio.sleep(0.05)
        return self.s.missions.detail(mission_id)  # type: ignore[return-value]

    async def _step_guarded(self, mission_id: str) -> None:
        try:
            await self.step(mission_id)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # unexpected bug: fail the mission, keep the engine alive
            log.exception("mission %s crashed", mission_id)
            self.s.missions.set_status(mission_id, "failed", error=f"internal error: {exc}")
            notify(self.s, "Missione interrotta da un errore interno", str(exc)[:300], "warning", mission_id)

    # ----------------------------------------------------------------- step
    async def step(self, mission_id: str) -> bool:
        """Advance a mission by one unit of work. Returns True if something happened."""
        ms = self.s.missions
        m = ms.get(mission_id)
        if not m or m["status"] in FINAL:
            return False

        if m["status"] in ("queued", "planning"):
            await self._plan(m)
            return True

        if m["status"] == "verifying":
            self._verify(m)
            return True

        if self._budget_exceeded(m):
            return True

        task = ms.next_task(mission_id)
        if task is None:
            tasks = ms.tasks(mission_id)
            waiting = [t for t in tasks if t["status"] == "awaiting_approval"]
            pending = [t for t in tasks if t["status"] == "pending"]
            blocking_failure = [t for t in tasks if t["status"] in ("failed", "rejected") and not t["optional"]]
            if blocking_failure and not pending and not waiting:
                failed = blocking_failure[0]
                ms.set_status(mission_id, "failed",
                              error=f"Step {failed['seq']} '{failed['title']}': {failed['error'] or failed['status']}")
                notify(self.s, "Missione non riuscita", f"{m['objective'][:120]}\n{failed['error'] or ''}"[:500],
                       "warning", mission_id)
                return True
            if waiting and not pending:
                if m["status"] != "awaiting_approval":
                    ms.set_status(mission_id, "awaiting_approval")
                return False
            if pending:
                # Pending but not runnable: a dependency failed (skip it, which
                # cascades down the chain on the next steps) or waiting for backoff.
                dep_blocked = [t for t in pending if _deps_failed(t, tasks)]
                for t in dep_blocked:
                    ms.update_task(t["id"], status="skipped", error="a required earlier step failed")
                return bool(dep_blocked)
            ms.set_status(mission_id, "verifying")
            return True

        await self._execute(m, task)
        return True

    # ----------------------------------------------------------- planning
    async def _plan(self, m: dict[str, Any]) -> None:
        ms = self.s.missions
        ms.set_status(m["id"], "planning")
        self.s.bus.emit("research.organize", mission_id=m["id"], stage="planning")
        try:
            plan = await self.s.planner.plan(m["objective"], m["kind"], m["params"])
        except (PlanningError, ValueError, ToolError) as exc:
            ms.set_status(m["id"], "failed", error=f"Planning failed: {exc}")
            notify(self.s, "Non riesco a pianificare la missione", str(exc)[:400], "warning", m["id"])
            return
        ms.add_tasks(m["id"], plan.steps)
        ms.set_status(m["id"], "running", kind=plan.kind, params=plan.params,
                      completion_condition=plan.completion_condition)
        self.s.bus.emit("mission.planned", mission_id=m["id"], kind=plan.kind, steps=len(plan.steps),
                        notes=plan.notes)

    # ---------------------------------------------------------- execution
    async def _execute(self, m: dict[str, Any], task: dict[str, Any]) -> None:
        ms = self.s.missions
        tool = self.s.tools.get(task["tool"]) if self.s.tools.has(task["tool"]) else None
        if tool is None:
            ms.update_task(task["id"], status="failed", error=f"unknown tool {task['tool']}",
                           finished_at=now_iso())
            return

        approved = ms.task_is_approved(task["id"])
        if tool.permission is not Permission.AUTONOMOUS and not approved:
            ms.request_approval(tool=tool.name, args=task["args"], permission=tool.permission.value,
                                reason=task["title"], mission_id=m["id"], task_id=task["id"])
            ms.update_task(task["id"], status="awaiting_approval")
            self.s.bus.emit("task.awaiting_approval", mission_id=m["id"], task_id=task["id"], tool=tool.name)
            notify(self.s, "Serve la tua approvazione", f"{task['title']} ({tool.name})", "decision", m["id"])
            return

        attempt = task["attempts"] + 1
        ms.update_task(task["id"], status="running", attempts=attempt, started_at=now_iso())
        self.s.db.execute("UPDATE missions SET steps_used = steps_used + 1, updated_at = ? WHERE id = ?",
                          (now_iso(), m["id"]))
        self.s.bus.emit("task.started", mission_id=m["id"], task_id=task["id"], seq=task["seq"],
                        title=task["title"], tool=tool.name, attempt=attempt)

        ctx = ToolContext(services=self.s, actor="jarvis", mission_id=m["id"], task_id=task["id"],
                          approved=approved, previous=ms.results_by_seq(m["id"]),
                          checkpoint=task["checkpoint"] or {})
        timeout = max(tool.timeout_s, task["timeout_s"])
        try:
            result = await asyncio.wait_for(
                self.s.tools.execute(tool.name, task["args"], ctx, timeout_s=timeout), timeout=timeout + 5)
        except asyncio.TimeoutError:
            self._task_failed(m, task, attempt, f"timeout after {timeout}s", retryable=True, ctx=ctx)
            return
        except PermissionDenied as exc:
            self._task_failed(m, task, attempt, str(exc), retryable=False, ctx=ctx)
            return
        except ToolError as exc:
            self._task_failed(m, task, attempt, str(exc), retryable=exc.retryable, ctx=ctx)
            return
        except asyncio.CancelledError:
            ms.update_task(task["id"], status="pending", checkpoint=ctx.checkpoint)
            raise
        except Exception as exc:  # tool bug
            log.exception("tool %s crashed", tool.name)
            self._task_failed(m, task, attempt, f"{type(exc).__name__}: {exc}", retryable=True, ctx=ctx)
            return

        ms.update_task(task["id"], status="succeeded", result=_jsonable(result), error=None,
                       checkpoint=ctx.checkpoint, finished_at=now_iso())
        self.s.bus.emit("task.succeeded", mission_id=m["id"], task_id=task["id"], seq=task["seq"],
                        title=task["title"], tool=tool.name)

    def _task_failed(self, m: dict, task: dict, attempt: int, error: str, retryable: bool,
                     ctx: ToolContext) -> None:
        ms = self.s.missions
        if retryable and attempt < task["max_attempts"]:
            delay = min(600, 5 * (2 ** (attempt - 1)))
            nxt = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat(timespec="seconds")
            ms.update_task(task["id"], status="pending", error=error, next_attempt_at=nxt,
                           checkpoint=ctx.checkpoint)
            self.s.bus.emit("task.retrying", mission_id=m["id"], task_id=task["id"], attempt=attempt,
                            delay_s=delay, error=error[:300])
        else:
            ms.update_task(task["id"], status="failed", error=error, checkpoint=ctx.checkpoint,
                           finished_at=now_iso())
            self.s.bus.emit("task.failed", mission_id=m["id"], task_id=task["id"], seq=task["seq"],
                            error=error[:300], optional=task["optional"])

    def _budget_exceeded(self, m: dict[str, Any]) -> bool:
        reason = None
        if m["steps_used"] >= m["max_steps"]:
            reason = f"step budget exhausted ({m['steps_used']}/{m['max_steps']})"
        elif m["started_at"]:
            elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(m["started_at"])).total_seconds()
            if elapsed > m["max_seconds"]:
                reason = f"time budget exhausted ({int(elapsed)}s/{m['max_seconds']}s)"
        if reason:
            self.s.missions.set_status(m["id"], "blocked", error=reason)
            notify(self.s, "Missione in pausa: budget esaurito",
                   f"{m['objective'][:150]}\n{reason}. Puoi riprenderla concedendo altro budget.",
                   "decision", m["id"])
            return True
        return False

    # -------------------------------------------------------- verification
    def _verify(self, m: dict[str, Any]) -> None:
        ms = self.s.missions
        tasks = ms.tasks(m["id"])
        failed_required = [t for t in tasks if t["status"] in ("failed", "rejected", "skipped") and not t["optional"]]
        verifier = VERIFIERS.get(m["kind"])
        if verifier:
            verdict = verifier(self.s, m)
            status = "completed" if verdict["passed"] else "incomplete"
        else:
            verdict = {"passed": None, "check": "nessun controllo automatico per le missioni libere; "
                                                "tutti i passi richiesti sono riusciti" if not failed_required
                       else f"{len(failed_required)} passi richiesti non sono riusciti"}
            status = "completed_unverified" if not failed_required else "incomplete"
        summary = {
            "steps": {s: sum(1 for t in tasks if t["status"] == s) for s in TASK_FINAL},
            "outputs": [{"seq": t["seq"], "title": t["title"], "result": _summary(t["result"])}
                        for t in tasks if t["status"] == "succeeded"],
        }
        ms.set_status(m["id"], status, verification=verdict, result=summary)
        title = {"completed": "Missione completata e verificata",
                 "completed_unverified": "Missione completata (non verificabile automaticamente)",
                 "incomplete": "Missione terminata senza raggiungere l'obiettivo"}[status]
        notify(self.s, title, f"{m['objective'][:150]}\nVerifica: {verdict['check']}",
               "success" if status == "completed" else "warning", m["id"])

    # ------------------------------------------------------------ approvals
    async def decide(self, approval_id: str, approve: bool, note: str | None = None,
                     confirmation: str | None = None) -> dict[str, Any]:
        ms = self.s.missions
        a = ms.approval(approval_id)
        if not a or a["status"] != "pending":
            raise ValueError("Approval not found or already decided")
        if approve and a["permission"] == Permission.EXPLICIT.value and confirmation != EXPLICIT_CONFIRMATION_PHRASE:
            raise PermissionError(f"This action needs explicit authorization: type {EXPLICIT_CONFIRMATION_PHRASE}")
        status = "approved" if approve else "rejected"
        self.s.db.update("approvals", "id", approval_id,
                         {"status": status, "decided_note": note, "decided_at": now_iso()})
        self.s.audit.record("user", f"approval:{a['tool']}", status, target=a["task_id"] or a["id"],
                            permission=a["permission"], note=note)
        self.s.bus.emit("approval.decided", approval_id=approval_id, status=status, mission_id=a["mission_id"])
        result: Any = None
        if a["task_id"]:
            if approve:
                ms.update_task(a["task_id"], status="pending")
            else:
                ms.update_task(a["task_id"], status="rejected", error=f"rejected by user: {note or ''}",
                               finished_at=now_iso())
            if a["mission_id"]:
                m = ms.get(a["mission_id"])
                if m and m["status"] == "awaiting_approval":
                    ms.set_status(a["mission_id"], "running")
        elif approve:
            # Stand-alone action requested from the chat: run it now.
            ctx = ToolContext(services=self.s, actor="user-approved", approved=True)
            try:
                result = await self.s.tools.execute(a["tool"], a["args"], ctx)
            except ToolError as exc:
                result = {"error": str(exc)}
        return {"approval": ms.approval(approval_id), "result": result}

    # ------------------------------------------------------------ schedules
    def _start_due_schedules(self) -> None:
        now = datetime.now(timezone.utc)
        for sch in self.s.db.query("SELECT * FROM schedules WHERE enabled = 1"):
            if datetime.fromisoformat(sch["next_run_at"]) > now:
                continue
            last = self.s.missions.get(sch["last_mission_id"]) if sch["last_mission_id"] else None
            nxt = (now + timedelta(seconds=sch["interval_seconds"])).isoformat(timespec="seconds")
            if last and last["status"] not in FINAL:
                self.s.db.update("schedules", "id", sch["id"], {"next_run_at": nxt})
                continue  # never stack runs of the same schedule
            m = self.s.missions.create(sch["objective"])
            self.s.db.update("schedules", "id", sch["id"], {"next_run_at": nxt, "last_mission_id": m["id"]})


def _deps_failed(task: dict[str, Any], tasks: list[dict[str, Any]]) -> bool:
    by_seq = {t["seq"]: t for t in tasks}
    for d in task["depends_on"]:
        dep = by_seq.get(d)
        if dep and dep["status"] in ("failed", "rejected", "skipped", "cancelled") and not dep["optional"]:
            return True
    return False


def _jsonable(value: Any) -> Any:
    import json
    try:
        json.dumps(value, default=str)
        return value
    except (TypeError, ValueError):
        return str(value)


def _summary(result: Any) -> Any:
    if isinstance(result, dict):
        return {k: (v if not isinstance(v, (list, dict, str)) or len(str(v)) < 300 else f"({len(v)} items)"
                    if isinstance(v, (list, dict)) else str(v)[:300] + "…") for k, v in list(result.items())[:12]}
    return str(result)[:500] if result is not None else None
