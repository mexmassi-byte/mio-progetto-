"""WhatsApp through the official Meta WhatsApp Business Platform (Cloud API).

Architecture: JARVIS has its own WhatsApp Business number (Cloud API). The
founders' personal numbers are the *owners*: only they can give orders. A
message from any other number is logged and reported, never executed and
never answered automatically.

Webhooks are verified with Meta's X-Hub-Signature-256 (HMAC-SHA256 of the raw
body with the app secret) and deduplicated by message id.
"""

from __future__ import annotations

import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

from ..db.database import now_iso
from .vault import secret

MAX_TEXT = 4000  # WhatsApp limit is 4096


class WhatsAppError(RuntimeError):
    pass


def digits(number: str) -> str:
    return re.sub(r"\D", "", number or "")


def verify_signature(raw_body: bytes, header: str | None, app_secret: str | None) -> bool:
    if not header or not app_secret or not header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header[7:])


def parse_webhook(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Inbound user messages from a webhook payload (statuses are ignored)."""
    out = []
    for entry in payload.get("entry", []) or []:
        for change in entry.get("changes", []) or []:
            value = change.get("value") or {}
            names = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in value.get("contacts", []) or []}
            for m in value.get("messages", []) or []:
                kind = m.get("type")
                item = {"id": m.get("id"), "from": digits(m.get("from", "")), "type": kind,
                        "timestamp": m.get("timestamp"), "name": names.get(m.get("from")), "text": None,
                        "media_id": None, "mime": None, "filename": None}
                if kind == "text":
                    item["text"] = (m.get("text") or {}).get("body", "")
                elif kind in ("audio", "document", "image", "video"):
                    media = m.get(kind) or {}
                    item.update(media_id=media.get("id"), mime=media.get("mime_type"),
                                filename=media.get("filename"), text=media.get("caption"))
                elif kind == "button":
                    item["text"] = (m.get("button") or {}).get("text")
                elif kind == "interactive":
                    inter = m.get("interactive") or {}
                    item["text"] = ((inter.get("button_reply") or inter.get("list_reply") or {}).get("title"))
                out.append(item)
    return out


def split_text(text: str, size: int = MAX_TEXT) -> list[str]:
    text = text.strip() or "…"
    parts = []
    while len(text) > size:
        cut = text.rfind("\n", 0, size)
        cut = cut if cut > size // 2 else size
        parts.append(text[:cut].strip())
        text = text[cut:].strip()
    parts.append(text)
    return parts


class WhatsApp:
    def __init__(self, services: Any, transport: httpx.AsyncBaseTransport | None = None):
        self.s = services
        self._transport = transport

    # ------------------------------------------------------------ config
    def _cfg(self) -> tuple[str | None, str | None]:
        return secret(self.s, "whatsapp_phone_number_id"), secret(self.s, "whatsapp_access_token")

    def configured(self) -> bool:
        pid, token = self._cfg()
        return bool(pid and token)

    def owners(self) -> list[str]:
        return [digits(n) for n in (secret(self.s, "owner_phone_numbers") or []) if digits(n)]

    def is_owner(self, number: str) -> bool:
        return digits(number) in self.owners()

    def status(self) -> dict[str, Any]:
        return {"configured": self.configured(), "owners": len(self.owners()),
                "app_secret": bool(secret(self.s, "whatsapp_app_secret")),
                "verify_token": bool(secret(self.s, "whatsapp_verify_token")),
                "template": self.s.settings.whatsapp_notify_template}

    def _url(self, path: str) -> str:
        st = self.s.settings
        return f"{st.whatsapp_graph_url.rstrip('/')}/{st.whatsapp_api_version}/{path.lstrip('/')}"

    async def _post(self, path: str, **kw: Any) -> dict[str, Any]:
        pid, token = self._cfg()
        if not (pid and token):
            raise WhatsAppError("WhatsApp is not configured (phone number id + access token)")
        async with httpx.AsyncClient(timeout=30, transport=self._transport) as client:
            r = await client.post(self._url(path.format(pid=pid)), headers={"Authorization": f"Bearer {token}"}, **kw)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        if r.status_code >= 400:
            err = (data.get("error") or {})
            raise WhatsAppError(f"WhatsApp API {r.status_code}: {err.get('message') or r.text[:200]}")
        return data

    # ------------------------------------------------------------ sending
    def window_open(self, number: str) -> bool:
        """Inside the 24 h customer-service window (free-form messages allowed)."""
        row = self.s.db.one("SELECT MAX(ts) AS ts FROM comms_log WHERE channel = 'whatsapp' AND direction = 'in' "
                            "AND contact = ?", (digits(number),))
        if not row or not row["ts"]:
            return False
        return datetime.fromisoformat(row["ts"]) > datetime.now(timezone.utc) - timedelta(hours=23, minutes=50)

    async def send_text(self, to: str, text: str) -> list[str]:
        ids = []
        for part in split_text(text):
            data = await self._post("{pid}/messages", json={
                "messaging_product": "whatsapp", "recipient_type": "individual", "to": digits(to),
                "type": "text", "text": {"body": part, "preview_url": True}})
            mid = ((data.get("messages") or [{}])[0]).get("id")
            ids.append(mid)
            self._log("out", to, "text", part[:300], mid, "sent")
        return ids

    async def send_template(self, to: str, name: str, language: str, params: list[str]) -> str | None:
        data = await self._post("{pid}/messages", json={
            "messaging_product": "whatsapp", "to": digits(to), "type": "template",
            "template": {"name": name, "language": {"code": language},
                         "components": [{"type": "body", "parameters": [{"type": "text", "text": p[:1000]}
                                                                         for p in params]}]}})
        mid = ((data.get("messages") or [{}])[0]).get("id")
        self._log("out", to, "template", f"{name}: {' | '.join(params)[:280]}", mid, "sent")
        return mid

    async def upload_media(self, content: bytes, mime: str, filename: str) -> str:
        data = await self._post("{pid}/media", data={"messaging_product": "whatsapp", "type": mime},
                                files={"file": (filename, content, mime)})
        if not data.get("id"):
            raise WhatsAppError("Media upload returned no id")
        return data["id"]

    async def send_document(self, to: str, path: Path, caption: str = "") -> str | None:
        mime = {".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/plain", ".csv": "text/csv",
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".zip": "application/zip"}.get(path.suffix.lower(), "application/octet-stream")
        media_id = await self.upload_media(path.read_bytes(), mime, path.name)
        data = await self._post("{pid}/messages", json={
            "messaging_product": "whatsapp", "to": digits(to), "type": "document",
            "document": {"id": media_id, "filename": path.name, "caption": caption[:1000]}})
        mid = ((data.get("messages") or [{}])[0]).get("id")
        self._log("out", to, "document", f"{path.name} {caption[:200]}", mid, "sent")
        return mid

    async def send_audio(self, to: str, audio: bytes, mime: str = "audio/mpeg") -> str | None:
        media_id = await self.upload_media(audio, mime, "jarvis.mp3" if "mpeg" in mime else "jarvis.ogg")
        data = await self._post("{pid}/messages", json={
            "messaging_product": "whatsapp", "to": digits(to), "type": "audio", "audio": {"id": media_id}})
        mid = ((data.get("messages") or [{}])[0]).get("id")
        self._log("out", to, "audio", "voice reply", mid, "sent")
        return mid

    async def mark_read(self, message_id: str) -> None:
        try:
            await self._post("{pid}/messages", json={"messaging_product": "whatsapp", "status": "read",
                                                     "message_id": message_id})
        except WhatsAppError:
            pass

    async def download_media(self, media_id: str) -> tuple[bytes, str]:
        _, token = self._cfg()
        async with httpx.AsyncClient(timeout=60, transport=self._transport) as client:
            meta = await client.get(self._url(media_id), headers={"Authorization": f"Bearer {token}"})
            if meta.status_code >= 400:
                raise WhatsAppError(f"Media lookup failed: {meta.status_code}")
            info = meta.json()
            r = await client.get(info["url"], headers={"Authorization": f"Bearer {token}"})
            if r.status_code >= 400:
                raise WhatsAppError(f"Media download failed: {r.status_code}")
            return r.content, info.get("mime_type") or r.headers.get("content-type", "")

    async def notify_owners(self, text: str) -> list[str]:
        """Text the owners. Free-form inside the 24 h window, otherwise the approved
        template (if configured); otherwise skipped and reported."""
        sent, skipped = [], []
        for owner in self.owners():
            try:
                if self.window_open(owner):
                    await self.send_text(owner, text)
                    sent.append(owner)
                elif self.s.settings.whatsapp_notify_template:
                    await self.send_template(owner, self.s.settings.whatsapp_notify_template,
                                             self.s.settings.whatsapp_template_language, [text[:900]])
                    sent.append(owner)
                else:
                    skipped.append(owner)
            except WhatsAppError as exc:
                self._log("out", owner, "error", str(exc)[:300], None, "failed")
        if skipped:
            self._log("out", ",".join(skipped), "skipped",
                      "outside the 24 h window and no approved template configured", None, "skipped")
        return sent

    # ------------------------------------------------------------ log
    def _log(self, direction: str, contact: str, kind: str, summary: str, external_id: str | None,
             status: str) -> bool:
        try:
            self.s.db.insert("comms_log", {"ts": now_iso(), "channel": "whatsapp", "direction": direction,
                                           "contact": digits(contact) if "," not in contact else contact,
                                           "kind": kind, "summary": summary, "external_id": external_id,
                                           "status": status})
            return True
        except Exception:  # duplicate external id (Meta retries webhooks)
            return False
