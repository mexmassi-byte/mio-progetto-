"""CRM: leads, interactions, outreach drafts and deals.

A lead can only become a paying customer ('won') through a deal whose
payment has been verified by the user (payment reference + date). JARVIS
cannot mark payments itself.
"""

from __future__ import annotations

from typing import Any

from ...db.database import Database, dumps, loads, new_id, now_iso
from ...events import EventBus

LEAD_STATUSES = ("new", "audited", "scored", "qualified", "contacted", "negotiating", "won", "lost", "discarded")
DRAFT_KINDS = ("email", "linkedin", "call_script", "followup", "audit_report", "proposal")

DEFAULT_LEGAL_NOTE = (
    "not_assessed: cold B2B email/calls need prior consent in DE (UWG §7) and IT (art. 130 "
    "Codice Privacy / RPO). Record the legal basis before any contact."
)


class CRM:
    def __init__(self, db: Database, bus: EventBus):
        self.db = db
        self.bus = bus

    # ----------------------------------------------------------------- leads
    def upsert_from_source(self, item: dict[str, Any], mission_id: str | None) -> tuple[dict[str, Any], bool]:
        existing = self.db.one("SELECT * FROM leads WHERE source = ? AND source_ref = ?",
                               (item["source"], item["source_ref"]))
        if existing:
            if existing["status"] == "new" and mission_id and existing["mission_id"] != mission_id:
                self.db.update("leads", "id", existing["id"], {"mission_id": mission_id, "updated_at": now_iso()})
            return self.get(existing["id"]), False  # type: ignore[return-value]
        lid = new_id("lead")
        ts = now_iso()
        self.db.insert("leads", {
            "id": lid, "name": item["name"], "website": item.get("website"), "sector": item.get("sector"),
            "city": item.get("city"), "country": item.get("country"), "address": item.get("address"),
            "lat": item.get("lat"), "lon": item.get("lon"), "email": item.get("email"), "phone": item.get("phone"),
            "source": item["source"], "source_ref": item["source_ref"], "audit": None, "audited_at": None,
            "score": None, "score_breakdown": None, "status": "new", "next_action": "analizzare il sito",
            "legal_basis": DEFAULT_LEGAL_NOTE, "notes": None, "mission_id": mission_id,
            "created_at": ts, "updated_at": ts,
        })
        self.bus.emit("lead.created", lead_id=lid, name=item["name"], city=item.get("city"),
                      lat=item.get("lat"), lon=item.get("lon"), mission_id=mission_id)
        return self.get(lid), True  # type: ignore[return-value]

    def create_manual(self, data: dict[str, Any]) -> dict[str, Any]:
        item = {**data, "source": "manual", "source_ref": new_id("man")}
        lead, _ = self.upsert_from_source(item, data.get("mission_id"))
        return lead

    def get(self, lead_id: str) -> dict[str, Any] | None:
        row = self.db.one("SELECT * FROM leads WHERE id = ?", (lead_id,))
        return _lead(row) if row else None

    def find_by_website(self, url: str) -> dict[str, Any] | None:
        host = url.lower().split("://")[-1].split("/")[0].removeprefix("www.")
        for r in self.db.query("SELECT * FROM leads WHERE website LIKE ?", (f"%{host}%",)):
            return _lead(r)
        return None

    def list(self, status: str | None = None, mission_id: str | None = None, limit: int = 500) -> list[dict]:
        where, params = [], []
        if status:
            where.append("status = ?")
            params.append(status)
        if mission_id:
            where.append("mission_id = ?")
            params.append(mission_id)
        sql = "SELECT * FROM leads" + (" WHERE " + " AND ".join(where) if where else "")
        sql += " ORDER BY COALESCE(score, -1) DESC, created_at DESC LIMIT ?"
        params.append(limit)
        return [_lead(r) for r in self.db.query(sql, tuple(params))]

    def update(self, lead_id: str, actor: str = "user", **fields: Any) -> dict[str, Any]:
        lead = self.get(lead_id)
        if not lead:
            raise KeyError(lead_id)
        status = fields.get("status")
        if status:
            if status not in LEAD_STATUSES:
                raise ValueError(f"Invalid status {status}")
            if status == "won" and not self.has_verified_deal(lead_id):
                raise PermissionError("A lead becomes 'won' only with a deal whose payment is verified")
        for k in ("audit", "score_breakdown"):
            if k in fields and fields[k] is not None and not isinstance(fields[k], str):
                fields[k] = dumps(fields[k])
        allowed = {"name", "website", "sector", "city", "country", "address", "email", "phone", "status",
                   "next_action", "legal_basis", "notes", "audit", "audited_at", "score", "score_breakdown",
                   "mission_id"}
        values = {k: v for k, v in fields.items() if k in allowed}
        values["updated_at"] = now_iso()
        self.db.update("leads", "id", lead_id, values)
        if status and status != lead["status"]:
            self.bus.emit("lead.status", lead_id=lead_id, status=status, previous=lead["status"], actor=actor)
        return self.get(lead_id)  # type: ignore[return-value]

    def stats(self) -> dict[str, Any]:
        by_status = {r["status"]: r["n"] for r in self.db.query(
            "SELECT status, COUNT(*) AS n FROM leads GROUP BY status")}
        by_sector = {r["sector"] or "other": r["n"] for r in self.db.query(
            "SELECT sector, COUNT(*) AS n FROM leads GROUP BY sector")}
        per_day = self.db.query(
            "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM leads "
            "GROUP BY day ORDER BY day DESC LIMIT 30")
        revenue = self.db.scalar("SELECT COALESCE(SUM(amount_eur), 0) FROM deals WHERE verified_at IS NOT NULL")
        return {"total": sum(by_status.values()), "by_status": by_status, "by_sector": by_sector,
                "per_day": list(reversed(per_day)), "verified_revenue_eur": revenue,
                "drafts": self.db.scalar("SELECT COUNT(*) FROM drafts") or 0}

    # ------------------------------------------------------------ interactions
    def add_interaction(self, lead_id: str, channel: str, direction: str, summary: str,
                        draft_id: str | None = None) -> None:
        self.db.insert("lead_interactions", {"lead_id": lead_id, "ts": now_iso(), "channel": channel,
                                             "direction": direction, "summary": summary, "draft_id": draft_id})

    def interactions(self, lead_id: str) -> list[dict]:
        return self.db.query("SELECT * FROM lead_interactions WHERE lead_id = ? ORDER BY ts DESC", (lead_id,))

    # ----------------------------------------------------------------- drafts
    def add_draft(self, lead_id: str | None, kind: str, language: str, body: str,
                  subject: str | None, generated_by: str) -> dict[str, Any]:
        if kind not in DRAFT_KINDS:
            raise ValueError(f"Invalid draft kind {kind}")
        did = new_id("drf")
        ts = now_iso()
        self.db.insert("drafts", {"id": did, "lead_id": lead_id, "kind": kind, "language": language,
                                  "subject": subject, "body": body, "status": "draft",
                                  "generated_by": generated_by, "created_at": ts, "updated_at": ts})
        return self.db.one("SELECT * FROM drafts WHERE id = ?", (did,))  # type: ignore[return-value]

    def drafts(self, lead_id: str | None = None, status: str | None = None) -> list[dict]:
        where, params = [], []
        if lead_id:
            where.append("lead_id = ?")
            params.append(lead_id)
        if status:
            where.append("status = ?")
            params.append(status)
        sql = "SELECT d.*, l.name AS lead_name FROM drafts d LEFT JOIN leads l ON l.id = d.lead_id"
        if where:
            sql += " WHERE " + " AND ".join("d." + w for w in where)
        return self.db.query(sql + " ORDER BY d.created_at DESC LIMIT 500", tuple(params))

    def draft(self, draft_id: str) -> dict | None:
        return self.db.one("SELECT * FROM drafts WHERE id = ?", (draft_id,))

    def update_draft(self, draft_id: str, **fields: Any) -> dict | None:
        allowed = {k: v for k, v in fields.items() if k in ("subject", "body", "status")}
        if "status" in allowed and allowed["status"] not in ("draft", "approved", "sent", "discarded"):
            raise ValueError("Invalid draft status")
        allowed["updated_at"] = now_iso()
        self.db.update("drafts", "id", draft_id, allowed)
        return self.draft(draft_id)

    # ------------------------------------------------------------------ deals
    def add_deal(self, lead_id: str, title: str, amount_eur: float | None) -> dict:
        did = new_id("deal")
        ts = now_iso()
        self.db.insert("deals", {"id": did, "lead_id": lead_id, "title": title, "amount_eur": amount_eur,
                                 "status": "open", "payment_reference": None, "verified_at": None,
                                 "created_at": ts, "updated_at": ts})
        return self.db.one("SELECT * FROM deals WHERE id = ?", (did,))  # type: ignore[return-value]

    def verify_payment(self, deal_id: str, payment_reference: str) -> dict:
        """Called only from the user-facing API: the user confirms a real payment."""
        if not payment_reference.strip():
            raise ValueError("A payment reference (invoice / transaction id) is required")
        ts = now_iso()
        self.db.update("deals", "id", deal_id, {"status": "paid", "payment_reference": payment_reference.strip(),
                                                "verified_at": ts, "updated_at": ts})
        deal = self.db.one("SELECT * FROM deals WHERE id = ?", (deal_id,))
        if not deal:
            raise KeyError(deal_id)
        self.update(deal["lead_id"], status="won")
        self.bus.emit("lead.won", lead_id=deal["lead_id"], deal_id=deal_id, amount_eur=deal["amount_eur"])
        return deal

    def deals(self, lead_id: str | None = None) -> list[dict]:
        if lead_id:
            return self.db.query("SELECT * FROM deals WHERE lead_id = ? ORDER BY created_at DESC", (lead_id,))
        return self.db.query("SELECT d.*, l.name AS lead_name FROM deals d JOIN leads l ON l.id = d.lead_id "
                             "ORDER BY d.created_at DESC")

    def has_verified_deal(self, lead_id: str) -> bool:
        return bool(self.db.scalar(
            "SELECT 1 FROM deals WHERE lead_id = ? AND verified_at IS NOT NULL LIMIT 1", (lead_id,)))


def _lead(row: dict[str, Any]) -> dict[str, Any]:
    return {**row, "audit": loads(row.get("audit")), "score_breakdown": loads(row.get("score_breakdown"), [])}
