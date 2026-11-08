"""Audit log: every external operation and every permission decision."""

from __future__ import annotations

from typing import Any

from ..db.database import Database, dumps, loads, now_iso


class AuditLog:
    def __init__(self, db: Database):
        self.db = db

    def record(
        self,
        actor: str,
        action: str,
        decision: str,
        target: str | None = None,
        permission: str | None = None,
        **details: Any,
    ) -> None:
        self.db.insert(
            "audit_log",
            {
                "ts": now_iso(),
                "actor": actor,
                "action": action,
                "target": target,
                "permission": permission,
                "decision": decision,
                "details": dumps(details),
            },
        )

    def list(self, limit: int = 200) -> list[dict]:
        rows = self.db.query("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,))
        return [{**r, "details": loads(r["details"], {})} for r in rows]
