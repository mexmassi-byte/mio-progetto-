"""Unified communication: one JARVIS across dashboard, voice, WhatsApp, email
and phone.

* All owner conversations go to the same *primary conversation*, so a mission
  started on WhatsApp can be continued by voice and checked in the dashboard
  (shared memory, missions and history).
* Notifications are routed by importance: dashboard always; WhatsApp for
  results and decisions; a phone call only for verified critical events
  (see phone.py).
* Messages from non-owners are logged and reported, never executed.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from ..db.database import dumps, loads, now_iso
from .whatsapp import WhatsApp, WhatsAppError, digits

log = logging.getLogger("jarvis.channels")

WHATSAPP_LEVELS = {"success", "decision", "warning", "critical"}


class Channels:
    def __init__(self, services: Any):
        self.s = services
        self.whatsapp = WhatsApp(services)
        from .google import Google
        from .phone import Phone
        self.phone = Phone(services)
        self.google = Google(services)
        self._tasks: set[asyncio.Task] = set()

    # ------------------------------------------------- shared conversation
    def primary_conversation(self) -> str:
        row = self.s.db.one("SELECT value FROM settings WHERE key = 'primary_conversation'")
        cid = loads(row["value"]) if row else None
        if cid and self.s.db.one("SELECT id FROM conversations WHERE id = ?", (cid,)):
            return cid
        cid = self.s.chat.create("Conversazione principale")["id"]
        self.s.db.execute("INSERT INTO settings (key, value, updated_at) VALUES ('primary_conversation', ?, ?) "
                          "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                          (dumps(cid), now_iso()))
        return cid

    async def owner_says(self, channel: str, text: str) -> dict[str, Any]:
        """An owner message from any channel, answered in the shared conversation."""
        return await self.s.chat.ask(self.primary_conversation(), text, mode=channel)

    # ------------------------------------------------- WhatsApp inbound
    async def whatsapp_inbound(self, msg: dict[str, Any]) -> None:
        wa = self.whatsapp
        if not wa._log("in", msg["from"], msg["type"] or "unknown", (msg.get("text") or "")[:300], msg["id"],
                       "received"):
            return  # duplicate delivery
        if not wa.is_owner(msg["from"]):
            await self._stranger(msg)
            return
        await wa.mark_read(msg["id"])
        text = msg.get("text") or ""
        voice_reply = False
        if msg["type"] == "audio" and msg.get("media_id"):
            try:
                audio, mime = await wa.download_media(msg["media_id"])
                suffix = ".ogg" if "ogg" in (mime or "") else ".mp3" if "mpeg" in (mime or "") else ".m4a"
                stt = await self.s.voice.transcribe(audio, suffix, None)
                text, voice_reply = stt["text"], True
            except Exception as exc:  # STT not installed or download failed
                await wa.send_text(msg["from"], f"Non riesco ad ascoltare il vocale ({exc}). Scrivimi pure.")
                return
        elif msg["type"] in ("document", "image", "video") and msg.get("media_id"):
            saved = await self._save_media(msg)
            text = (text + "\n" if text else "") + f"[Ho ricevuto il file {saved.name}, salvato in {saved}]"
        if not text.strip():
            return
        result = await self.owner_says("whatsapp", text)
        reply = result.get("text") or result.get("error") or "…"
        await wa.send_text(msg["from"], reply)
        if voice_reply:
            try:
                audio, mime = await self.s.voice.speak(reply[:1500])
                await wa.send_audio(msg["from"], audio, mime if "mpeg" in mime else "audio/ogg")
            except Exception:
                pass  # the text reply is already there

    async def _save_media(self, msg: dict[str, Any]) -> Path:
        content, _ = await self.whatsapp.download_media(msg["media_id"])
        inbox = self.s.settings.data_dir / "inbox"
        inbox.mkdir(parents=True, exist_ok=True)
        name = Path(msg.get("filename") or f"whatsapp-{msg['id'][-10:]}.{msg['type']}").name
        path = inbox / name
        path.write_bytes(content)
        return path

    async def _stranger(self, msg: dict[str, Any]) -> None:
        """Someone else wrote to JARVIS's number: log, link to CRM, tell the owners. No reply."""
        number = msg["from"]
        lead = None
        for row in self.s.db.query("SELECT id, name, phone FROM leads WHERE phone IS NOT NULL"):
            if digits(row["phone"]).endswith(number[-9:]):
                lead = row
                break
        if lead:
            self.s.crm.add_interaction(lead["id"], "whatsapp", "in", (msg.get("text") or msg["type"])[:500])
        who = f"{lead['name']} (lead)" if lead else f"+{number}" + (f" ({msg['name']})" if msg.get("name") else "")
        from ..tools.builtin import notify
        notify(self.s, f"Messaggio WhatsApp da {who}", (msg.get("text") or f"[{msg['type']}]")[:500], "decision")

    # ------------------------------------------------- outbound routing
    def route(self, notification: dict[str, Any]) -> None:
        """Called for every notification (sync); delivery happens in background."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        task = loop.create_task(self._route(notification))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _route(self, n: dict[str, Any]) -> None:
        level = n.get("level", "info")
        text = f"*{n.get('title', '')}*\n{n.get('body') or ''}".strip()
        if level in WHATSAPP_LEVELS and self.whatsapp.configured() and self.whatsapp.owners():
            try:
                await self.whatsapp.notify_owners(text)
            except WhatsAppError as exc:
                log.warning("WhatsApp notification failed: %s", exc)
        if n.get("call_event"):
            await self.phone.alert(n["call_event"], n.get("title", ""), n.get("body") or "", n.get("evidence"))

    async def send_report(self, title: str, body: str, path: Path | None = None) -> dict[str, Any]:
        """Final reports: WhatsApp (text + optional file) to the owners."""
        sent = await self.whatsapp.notify_owners(f"*{title}*\n{body}")
        if path and sent:
            for owner in sent:
                if self.whatsapp.window_open(owner):
                    await self.whatsapp.send_document(owner, path, title)
        return {"whatsapp": sent}

    def email_report(self, title: str, body: str) -> None:
        """Copy of a report to the founders' own Gmail (never to anyone else)."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return
        task = loop.create_task(self._email_report(title, body))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _email_report(self, title: str, body: str) -> bool:
        from .google import GoogleError
        from .vault import secret
        if not self.s.settings.email_reports or not self.google.status()["connected"]:
            return False
        owners = {e.lower() for e in (secret(self.s, "owner_emails") or [])}
        account = self.google.status().get("account")
        if account:
            owners.add(account.lower())
        if not owners:
            return False
        to = ", ".join(sorted(owners))
        try:
            r = await self.google.gmail_send(to, f"JARVIS — {title}", body)
        except GoogleError as exc:
            log.warning("Email report failed: %s", exc)
            return False
        self.s.db.insert("comms_log", {"ts": now_iso(), "channel": "email", "direction": "out", "contact": to,
                                       "kind": "report", "summary": title[:200],
                                       "external_id": r.get("message_id"), "status": "sent"})
        self.s.audit.record("jarvis", "email:report", "sent", target=to)
        return True

    def status(self) -> dict[str, Any]:
        return {"whatsapp": self.whatsapp.status(), "phone": self.phone.status(), "google": self.google.status(),
                "primary_conversation": self.primary_conversation()}
