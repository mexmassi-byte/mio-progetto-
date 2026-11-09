"""Phone calls to the owner for genuinely important, verified events (Twilio).

Calls cost money, so they happen only when *all* of these hold:
  1. the owner enabled calls explicitly (phone_calls_enabled, set with the
     confirmation phrase in Settings);
  2. Twilio is configured;
  3. the event is of an allowed type and is verified in code against the data
     (not on the model's word);
  4. caps: max calls per day, quiet hours (except critical/security), and the
     same event is never called twice.
Outgoing calls speak a short message (inline TwiML, no public URL needed).
Two-way voice conversations need Twilio Media Streams + a public WebSocket:
planned, not enabled.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from xml.sax.saxutils import escape

import httpx

from ..db.database import now_iso
from .vault import secret
from .whatsapp import digits

EVENTS = {
    "payment": "pagamento verificato di un nuovo cliente",
    "contract": "contratto firmato",
    "critical_failure": "guasto tecnico critico",
    "security": "incidente di sicurezza",
    "opportunity": "opportunità di business eccezionale",
}
URGENT = {"critical_failure", "security"}
LANG = {"it": ("it-IT", "Polly.Giorgio"), "de": ("de-DE", "Polly.Hans"), "en": ("en-GB", "Polly.Brian")}


class Phone:
    def __init__(self, services: Any, transport: httpx.AsyncBaseTransport | None = None,
                 now: Any = None):
        self.s = services
        self._transport = transport
        self._now = now or (lambda: datetime.now())

    def configured(self) -> bool:
        return bool(secret(self.s, "twilio_account_sid") and secret(self.s, "twilio_auth_token")
                    and secret(self.s, "twilio_from_number") and self._owner())

    def enabled(self) -> bool:
        return bool(self.s.settings.phone_calls_enabled or self.s.vault.get("phone_calls_enabled"))

    def _owner(self) -> str | None:
        owners = secret(self.s, "owner_phone_numbers") or []
        return digits(owners[0]) if owners else None

    def status(self) -> dict[str, Any]:
        return {"configured": self.configured(), "enabled": self.enabled(),
                "calls_today": self._calls_today(), "max_per_day": self.s.settings.phone_max_calls_per_day,
                "quiet_hours": self.s.settings.phone_quiet_hours, "two_way": False}

    # ------------------------------------------------------ verification
    def verify(self, event: str, evidence: dict[str, Any]) -> tuple[bool, str]:
        db = self.s.db
        since = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat(timespec="seconds")
        if event == "payment":
            deal = db.one("SELECT * FROM deals WHERE id = ?", (evidence.get("deal_id"),))
            if not deal or not deal["verified_at"]:
                return False, "payment not verified in the CRM"
            if (deal["amount_eur"] or 0) < self.s.settings.phone_min_payment_eur:
                return False, "amount below the call threshold"
            return True, f"deal {deal['id']} paid {deal['amount_eur']} EUR"
        if event == "contract":
            deal = db.one("SELECT * FROM deals WHERE id = ? AND status = 'signed'", (evidence.get("deal_id"),))
            return (True, "contract signed") if deal else (False, "no signed contract in the CRM")
        if event == "critical_failure":
            n = db.scalar("SELECT COUNT(*) FROM events WHERE type = 'system.error' AND ts >= ?", (since,)) or 0
            return (n >= 3, f"{n} system errors in 15 minutes")
        if event == "security":
            n = db.scalar("SELECT COUNT(*) FROM events WHERE type = 'security.auth_failed' AND ts >= ?",
                          (since,)) or 0
            return (n >= 10, f"{n} failed access attempts in 15 minutes")
        if event == "opportunity":
            lead = db.one("SELECT * FROM leads WHERE id = ?", (evidence.get("lead_id"),))
            ok = bool(lead and (lead["score"] or 0) >= 90 and lead["audit"])
            return ok, "lead score >= 90 with audit" if ok else "opportunity not exceptional enough"
        return False, f"event type not allowed: {event}"

    def _calls_today(self) -> int:
        start = self._now().replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        return int(self.s.db.scalar("SELECT COUNT(*) FROM comms_log WHERE channel = 'phone' AND status = 'queued' "
                                    "AND ts >= ?", (start.isoformat(timespec="seconds"),)) or 0)

    def _quiet(self) -> bool:
        try:
            a, b = (int(x) for x in self.s.settings.phone_quiet_hours.split("-"))
        except ValueError:
            return False
        h = self._now().hour
        return (a <= h or h < b) if a > b else (a <= h < b)

    def decide(self, event: str, evidence: dict[str, Any]) -> tuple[bool, str]:
        if not self.enabled():
            return False, "phone calls are not enabled"
        if not self.configured():
            return False, "Twilio is not configured"
        ok, why = self.verify(event, evidence)
        if not ok:
            return False, why
        key = f"{event}:{evidence.get('deal_id') or evidence.get('lead_id') or ''}"
        if self.s.db.scalar("SELECT 1 FROM comms_log WHERE channel = 'phone' AND external_id = ?", (key,)):
            return False, "already called for this event"
        if self._calls_today() >= self.s.settings.phone_max_calls_per_day:
            return False, "daily call limit reached"
        if self._quiet() and event not in URGENT:
            return False, "quiet hours"
        return True, why

    # ------------------------------------------------------------ calling
    async def alert(self, event: str, title: str, message: str, evidence: dict[str, Any] | None = None) -> dict:
        evidence = evidence or {}
        ok, why = self.decide(event, evidence)
        self.s.audit.record("jarvis", "phone:alert", "allowed" if ok else "not_called", target=event,
                            permission="explicit", reason=why)
        if not ok:
            return {"called": False, "reason": why}
        key = f"{event}:{evidence.get('deal_id') or evidence.get('lead_id') or ''}"
        return await self.call(f"{title}. {message}", external_id=key)

    async def call(self, text: str, external_id: str | None = None, language: str | None = None) -> dict:
        sid = secret(self.s, "twilio_account_sid")
        token = secret(self.s, "twilio_auth_token")
        from_number = secret(self.s, "twilio_from_number")
        to = self._owner()
        lang, voice = LANG.get(language or self.s.settings.language, LANG["it"])
        title = {"it": self.s.settings.title_it, "de": self.s.settings.title_de,
                 "en": self.s.settings.title_en}.get(language or self.s.settings.language, "")
        intro = {"it-IT": f"{title}, qui JARVIS.", "de-DE": f"{title}, hier ist JARVIS.",
                 "en-GB": f"{title}, this is JARVIS."}[lang]
        twiml = (f'<Response><Say language="{lang}" voice="{voice}">{escape(intro)} {escape(text[:900])}</Say>'
                 f'<Pause length="1"/><Say language="{lang}" voice="{voice}">{escape(text[:900])}</Say></Response>')
        url = f"{self.s.settings.twilio_api_url.rstrip('/')}/2010-04-01/Accounts/{sid}/Calls.json"
        async with httpx.AsyncClient(timeout=30, transport=self._transport) as client:
            r = await client.post(url, auth=(sid or "", token or ""),
                                  data={"To": f"+{to}", "From": from_number, "Twiml": twiml})
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        status = "queued" if r.status_code < 300 else "failed"
        self.s.db.insert("comms_log", {"ts": now_iso(), "channel": "phone", "direction": "out", "contact": to,
                                       "kind": "call", "summary": text[:300],
                                       "external_id": external_id or data.get("sid"), "status": status})
        self.s.audit.record("jarvis", "phone:call", status, target=to, permission="explicit",
                            call_sid=data.get("sid"), http=r.status_code)
        if r.status_code >= 300:
            return {"called": False, "reason": f"Twilio {r.status_code}: {data.get('message') or r.text[:200]}"}
        return {"called": True, "sid": data.get("sid")}
