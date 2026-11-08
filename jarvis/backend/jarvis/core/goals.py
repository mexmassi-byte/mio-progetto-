"""Daily briefing and continuous goal pursuit.

The user gives the objectives of the day once ("trova 10 dentisti a Monaco e
5 avvocati a Berlino"). JARVIS splits them into goals with a measurable
target, launches missions, measures progress in code after each mission and
keeps launching new missions with a different strategy until each target is
reached or the attempts allowed for it are used up. Then it writes the daily
report. It never widens a request on its own in a way the user did not ask
for (an explicitly named city is not replaced by other cities).
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import TYPE_CHECKING, Any

from ..db.database import dumps, loads, new_id, now_iso
from ..tools.builtin import notify
from .missions import FINAL
from .playbooks import DEFAULT_CITIES

if TYPE_CHECKING:  # pragma: no cover
    from ..services import Services

GOAL_ACTIVE = "active"
GOAL_FINAL = ("achieved", "exhausted", "cancelled")
_SPLIT = re.compile(
    r"\n+|;\s*|(?<=[.!?])\s+|\s+(?:e poi|e|und|and|poi)\s+(?=(?:\d|trova|cerca|analizza|crea|prepara|scrivi|"
    r"costruisci|sviluppa|find|search|analy[sz]e|create|build|write|finde|suche|erstelle)\b)",
    re.IGNORECASE,
)
SECTOR_IT = {"dentist": "studi dentistici", "lawyer": "studi legali", "clinic": "cliniche", "aesthetic":
             "centri estetici", "tax_advisor": "commercialisti", "physiotherapist": "fisioterapisti",
             "architect": "studi di architettura", "notary": "notai", "other": "attività"}


def today() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def split_objectives(text: str) -> list[str]:
    parts = [p.strip(" ,.-•*\t") for p in _SPLIT.split(text or "")]
    return [p for p in parts if len(p) >= 8]


class GoalService:
    def __init__(self, services: "Services"):
        self.s = services

    # ------------------------------------------------------------ briefing
    async def brief(self, text: str) -> dict[str, Any]:
        text = text.strip()
        if not text:
            raise ValueError("Il briefing è vuoto")
        bid = new_id("brf")
        self.s.db.insert("briefings", {"id": bid, "day": today(), "text": text[:8000], "report": None,
                                       "created_at": now_iso(), "finished_at": None})
        created = []
        for objective in split_objectives(text) or [text]:
            cls = await self.s.planner.classify(objective)
            kind = cls.get("playbook") or "freeform"
            params = {k: v for k, v in cls.items() if k != "playbook" and v not in (None, [], "")}
            target = int(params.get("count") or 1) if kind == "lead_acquisition" else 1
            created.append(self._add_goal(bid, objective, kind, params, target))
        self.s.bus.emit("goals.briefing", briefing_id=bid, goals=len(created))
        notify(self.s, "Obiettivi del giorno ricevuti",
               "\n".join(f"• {g['objective']} (obiettivo: {g['target']})" for g in created), "info")
        return self.briefing(bid)  # type: ignore[return-value]

    def _add_goal(self, bid: str, objective: str, kind: str, params: dict, target: int) -> dict[str, Any]:
        gid = new_id("goal")
        ts = now_iso()
        max_attempts = 5 if kind == "lead_acquisition" else 2
        if kind == "lead_acquisition" and params.get("city"):
            max_attempts = 2  # a named city is not silently replaced by others
        self.s.db.insert("goals", {
            "id": gid, "briefing_id": bid, "day": today(), "objective": objective[:2000], "kind": kind,
            "params": dumps(params), "target": max(1, min(target, 200)), "progress": 0, "status": GOAL_ACTIVE,
            "attempts": 0, "max_attempts": max_attempts, "last_mission_id": None, "note": None,
            "created_at": ts, "updated_at": ts,
        })
        return self.get(gid)  # type: ignore[return-value]

    # --------------------------------------------------------------- reads
    def get(self, goal_id: str) -> dict[str, Any] | None:
        row = self.s.db.one("SELECT * FROM goals WHERE id = ?", (goal_id,))
        return _goal(row) if row else None

    def list(self, day: str | None = None) -> list[dict[str, Any]]:
        if day:
            rows = self.s.db.query("SELECT * FROM goals WHERE day = ? ORDER BY created_at", (day,))
        else:
            rows = self.s.db.query(
                "SELECT * FROM goals WHERE status = 'active' OR day = ? ORDER BY created_at", (today(),))
        return [_goal(r) for r in rows]

    def briefing(self, briefing_id: str) -> dict[str, Any] | None:
        row = self.s.db.one("SELECT * FROM briefings WHERE id = ?", (briefing_id,))
        if not row:
            return None
        goals = [_goal(r) for r in self.s.db.query(
            "SELECT * FROM goals WHERE briefing_id = ? ORDER BY created_at", (briefing_id,))]
        return {**row, "goals": goals}

    def latest_briefing(self) -> dict[str, Any] | None:
        row = self.s.db.one("SELECT id FROM briefings ORDER BY created_at DESC LIMIT 1")
        return self.briefing(row["id"]) if row else None

    def cancel(self, goal_id: str) -> bool:
        g = self.get(goal_id)
        if not g or g["status"] != GOAL_ACTIVE:
            return False
        if g["last_mission_id"]:
            self.s.missions.cancel(g["last_mission_id"])
        self._update(goal_id, status="cancelled", note="annullato dall'utente")
        return True

    # --------------------------------------------------------------- engine
    def tick(self) -> None:
        """Called by the engine loop: advance every active goal by one decision."""
        for g in [_goal(r) for r in self.s.db.query("SELECT * FROM goals WHERE status = 'active'")]:
            last = self.s.missions.get(g["last_mission_id"]) if g["last_mission_id"] else None
            if last and last["status"] not in FINAL:
                if last["status"] in ("awaiting_approval", "blocked") and g["note"] != "in attesa di una tua decisione":
                    self._update(g["id"], note="in attesa di una tua decisione")
                continue
            if last:
                g = self._measure(g)
                if g["progress"] >= g["target"]:
                    self._update(g["id"], status="achieved", note="obiettivo raggiunto e verificato")
                    notify(self.s, "Obiettivo raggiunto", f"{g['objective']}\n{g['progress']}/{g['target']}",
                           "success")
                    continue
                if g["attempts"] >= g["max_attempts"]:
                    self._exhaust(g)
                    continue
            self._launch(g)
        self._close_briefings()

    def _measure(self, g: dict[str, Any]) -> dict[str, Any]:
        mids = [r["id"] for r in self.s.db.query("SELECT id FROM missions WHERE goal_id = ?", (g["id"],))]
        if not mids:
            return g
        marks = ",".join("?" * len(mids))
        if g["kind"] == "lead_acquisition":
            progress = self.s.db.scalar(
                f"SELECT COUNT(*) FROM leads l WHERE l.mission_id IN ({marks}) AND l.status = 'qualified' "
                "AND l.audit IS NOT NULL AND EXISTS (SELECT 1 FROM drafts d WHERE d.lead_id = l.id)", tuple(mids))
        else:
            ok = ("completed",) if g["kind"] != "freeform" else ("completed", "completed_unverified")
            progress = self.s.db.scalar(
                f"SELECT COUNT(*) FROM missions WHERE id IN ({marks}) AND status IN ({','.join('?' * len(ok))})",
                (*mids, *ok))
        self._update(g["id"], progress=int(progress or 0))
        return {**g, "progress": int(progress or 0)}

    def _launch(self, g: dict[str, Any]) -> None:
        params = dict(g["params"])
        objective = g["objective"]
        if g["kind"] == "lead_acquisition":
            remaining = max(1, g["target"] - g["progress"])
            used = self._used_cities(g["id"])
            country = (params.get("country") or "DE").upper()
            if params.get("city"):
                cities = [params["city"]]
            else:
                pool = [c for c in DEFAULT_CITIES.get(country, DEFAULT_CITIES["DE"]) if c not in used]
                if not pool:
                    self._exhaust(g, "tutte le città principali di questo paese sono già state analizzate")
                    return
                cities = pool[:2]
            params.update({"count": remaining, "cities": cities})
            sector = SECTOR_IT.get(params.get("sector") or "other", "attività")
            objective = (f"[Obiettivo {g['progress']}/{g['target']}] Trova {remaining} {sector} qualificati a "
                         f"{', '.join(cities)} ({country}) per VEYRO Web")
        attempt = g["attempts"] + 1
        m = self.s.missions.create(objective, kind=g["kind"], params=params, goal_id=g["id"],
                                   priority=6)
        self._update(g["id"], attempts=attempt, last_mission_id=m["id"],
                     note=f"tentativo {attempt}/{g['max_attempts']} in corso")
        self.s.bus.emit("goals.mission", goal_id=g["id"], mission_id=m["id"], attempt=attempt)

    def _used_cities(self, goal_id: str) -> set[str]:
        used: set[str] = set()
        for r in self.s.db.query("SELECT params FROM missions WHERE goal_id = ?", (goal_id,)):
            used.update(loads(r["params"], {}).get("cities") or [])
        return used

    def _exhaust(self, g: dict[str, Any], why: str | None = None) -> None:
        last = self.s.missions.get(g["last_mission_id"]) if g["last_mission_id"] else None
        reason = why or (last or {}).get("error") or "tentativi esauriti"
        hint = ""
        if g["kind"] == "lead_acquisition" and g["params"].get("city"):
            hint = " Posso cercare anche in altre città: dimmelo e lo aggiungo agli obiettivi."
        self._update(g["id"], status="exhausted", note=f"{reason}.{hint}")
        notify(self.s, "Obiettivo non raggiunto",
               f"{g['objective']}\nRisultato: {g['progress']}/{g['target']}. {reason}.{hint}", "decision")

    def _close_briefings(self) -> None:
        for b in self.s.db.query("SELECT * FROM briefings WHERE finished_at IS NULL"):
            goals = [_goal(r) for r in self.s.db.query("SELECT * FROM goals WHERE briefing_id = ?", (b["id"],))]
            if not goals or any(g["status"] == GOAL_ACTIVE for g in goals):
                continue
            label = {"achieved": "raggiunto", "exhausted": "non raggiunto", "cancelled": "annullato"}
            lines = [f"- {g['objective']}: {g['progress']}/{g['target']} — {label[g['status']]}"
                     + (f" ({g['note']})" if g["status"] != "achieved" and g["note"] else "") for g in goals]
            done = sum(1 for g in goals if g["status"] == "achieved")
            report = (f"Rapporto della giornata {b['day']}: {done}/{len(goals)} obiettivi raggiunti.\n"
                      + "\n".join(lines) + "\nNessun messaggio è stato inviato senza la tua approvazione.")
            self.s.db.update("briefings", "id", b["id"], {"report": report, "finished_at": now_iso()})
            self.s.db.insert("memories", {
                "id": new_id("mem"), "category": "task", "title": f"Rapporto giornaliero {b['day']}",
                "content": report, "reliability": "verified", "source": "goal engine (misure dal database)",
                "tags": dumps(["rapporto"]), "version": 1, "embedding": None, "created_at": now_iso(),
                "updated_at": now_iso(), "deleted_at": None,
            })
            self.s.bus.emit("goals.report", briefing_id=b["id"], achieved=done, total=len(goals))
            notify(self.s, "Giornata conclusa", report[:900], "success" if done == len(goals) else "decision")

    def _update(self, goal_id: str, **fields: Any) -> None:
        fields["updated_at"] = now_iso()
        self.s.db.update("goals", "id", goal_id, fields)
        self.s.bus.emit("goals.update", goal_id=goal_id, **{k: v for k, v in fields.items() if k != "updated_at"})


def _goal(row: dict[str, Any]) -> dict[str, Any]:
    return {**row, "params": loads(row.get("params"), {})}
