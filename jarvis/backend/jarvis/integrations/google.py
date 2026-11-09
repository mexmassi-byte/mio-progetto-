"""Google APIs with OAuth 2.0 (desktop/installed-app flow with PKCE).

Gmail, Calendar, Drive (+ Docs created through Drive), Contacts (People API)
and Tasks. Tokens are kept in the encrypted vault and refreshed automatically.
Scopes are the minimum for the features below; content read from Gmail/Drive
is untrusted (it never gives orders to JARVIS).
"""

from __future__ import annotations

import base64
import hashlib
import re
import secrets
import time
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Any
from urllib.parse import urlencode

import httpx

from .vault import secret

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me"
CALENDAR = "https://www.googleapis.com/calendar/v3"
DRIVE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files"
PEOPLE = "https://people.googleapis.com/v1"
TASKS = "https://tasks.googleapis.com/tasks/v1"

SCOPES = {
    "openid": "identity", "email": "your Google address",
    "https://www.googleapis.com/auth/gmail.readonly": "read and search email",
    "https://www.googleapis.com/auth/gmail.compose": "create drafts and send (only after approval)",
    "https://www.googleapis.com/auth/calendar.events": "read and create calendar events",
    "https://www.googleapis.com/auth/drive.readonly": "search and read Drive files",
    "https://www.googleapis.com/auth/drive.file": "create documents (only the ones JARVIS creates)",
    "https://www.googleapis.com/auth/contacts.readonly": "read contacts",
    "https://www.googleapis.com/auth/tasks": "read and create tasks",
}


class GoogleError(RuntimeError):
    pass


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


class Google:
    def __init__(self, services: Any, transport: httpx.AsyncBaseTransport | None = None):
        self.s = services
        self._transport = transport

    # ---------------------------------------------------------- OAuth
    def redirect_uri(self) -> str:
        st = self.s.settings
        return f"http://127.0.0.1:{st.port}/api/integrations/google/callback"

    def client(self) -> tuple[str | None, str | None]:
        return secret(self.s, "google_client_id"), secret(self.s, "google_client_secret")

    def connected(self) -> bool:
        return bool((self.s.vault.get("google_token") or {}).get("refresh_token"))

    def status(self) -> dict[str, Any]:
        tok = self.s.vault.get("google_token") or {}
        cid, _ = self.client()
        return {"client_configured": bool(cid), "connected": bool(tok.get("refresh_token")),
                "account": tok.get("email"), "scopes": (tok.get("scope") or "").split(),
                "autonomous_writes": bool(self.s.settings.google_autonomous_writes)}

    def auth_url(self) -> str:
        cid, _ = self.client()
        if not cid:
            raise GoogleError("Google OAuth client not configured (client id + secret)")
        verifier = _b64url(secrets.token_bytes(48))
        state = secrets.token_urlsafe(24)
        self.s.vault.set("google_oauth_pending", {"state": state, "verifier": verifier, "at": time.time()})
        params = {"client_id": cid, "redirect_uri": self.redirect_uri(), "response_type": "code",
                  "scope": " ".join(SCOPES), "access_type": "offline", "prompt": "consent",
                  "include_granted_scopes": "true", "state": state, "code_challenge_method": "S256",
                  "code_challenge": _b64url(hashlib.sha256(verifier.encode()).digest())}
        return f"{AUTH_URL}?{urlencode(params)}"

    async def finish(self, code: str, state: str) -> dict[str, Any]:
        pending = self.s.vault.get("google_oauth_pending") or {}
        self.s.vault.delete("google_oauth_pending")  # single use
        if not pending or not secrets.compare_digest(pending.get("state", ""), state or ""):
            raise GoogleError("Invalid or expired login state: start the connection again")
        if time.time() - pending.get("at", 0) > 900:
            raise GoogleError("Login took too long: start the connection again")
        cid, csecret = self.client()
        async with httpx.AsyncClient(timeout=30, transport=self._transport) as c:
            r = await c.post(TOKEN_URL, data={"code": code, "client_id": cid, "client_secret": csecret,
                                              "redirect_uri": self.redirect_uri(), "grant_type": "authorization_code",
                                              "code_verifier": pending["verifier"]})
            data = r.json()
            if r.status_code >= 400 or "access_token" not in data:
                raise GoogleError(f"Token exchange failed: {data.get('error_description') or data.get('error')}")
            info = (await c.get(USERINFO_URL, headers={"Authorization": f"Bearer {data['access_token']}"})).json()
        token = {"access_token": data["access_token"], "refresh_token": data.get("refresh_token"),
                 "expires_at": time.time() + int(data.get("expires_in", 3600)) - 60,
                 "scope": data.get("scope", ""), "email": info.get("email")}
        if not token["refresh_token"]:
            raise GoogleError("Google did not return a refresh token: remove JARVIS's access and connect again")
        self.s.vault.set("google_token", token)
        self.s.audit.record("user", "google:connect", "connected", target=token["email"], scopes=token["scope"])
        return {"email": token["email"], "scopes": token["scope"].split()}

    def disconnect(self) -> None:
        self.s.vault.delete("google_token")
        self.s.audit.record("user", "google:disconnect", "done")

    async def _access_token(self, force: bool = False) -> str:
        tok = self.s.vault.get("google_token") or {}
        if not tok.get("refresh_token"):
            raise GoogleError("Google is not connected (Sistema → Integrazioni → Google)")
        if not force and tok.get("access_token") and tok.get("expires_at", 0) > time.time():
            return tok["access_token"]
        cid, csecret = self.client()
        async with httpx.AsyncClient(timeout=30, transport=self._transport) as c:
            r = await c.post(TOKEN_URL, data={"client_id": cid, "client_secret": csecret,
                                              "refresh_token": tok["refresh_token"], "grant_type": "refresh_token"})
        data = r.json()
        if r.status_code >= 400:
            raise GoogleError(f"Google token refresh failed ({data.get('error')}): connect Google again")
        tok.update(access_token=data["access_token"], expires_at=time.time() + int(data.get("expires_in", 3600)) - 60)
        self.s.vault.set("google_token", tok)
        return tok["access_token"]

    async def request(self, method: str, url: str, **kw: Any) -> Any:
        for attempt in range(2):
            token = await self._access_token(force=attempt == 1)
            headers = {**kw.pop("headers", {}), "Authorization": f"Bearer {token}"}
            async with httpx.AsyncClient(timeout=60, transport=self._transport) as c:
                r = await c.request(method, url, headers=headers, **kw)
            if r.status_code == 401 and attempt == 0:
                continue
            if r.status_code >= 400:
                try:
                    msg = r.json().get("error", {}).get("message")
                except ValueError:
                    msg = r.text[:200]
                raise GoogleError(f"Google API {r.status_code}: {msg}")
            return r.json() if r.content and "json" in r.headers.get("content-type", "") else r.content
        raise GoogleError("Google authorization failed")

    # ---------------------------------------------------------- Gmail
    async def gmail_search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        data = await self.request("GET", f"{GMAIL}/messages", params={"q": query, "maxResults": limit})
        out = []
        for ref in data.get("messages", []) or []:
            m = await self.request("GET", f"{GMAIL}/messages/{ref['id']}", params={
                "format": "metadata", "metadataHeaders": ["From", "To", "Subject", "Date", "List-Unsubscribe"]})
            h = {x["name"].lower(): x["value"] for x in (m.get("payload") or {}).get("headers", [])}
            out.append({"id": m["id"], "thread_id": m.get("threadId"), "from": h.get("from", ""),
                        "to": h.get("to", ""), "subject": h.get("subject", ""), "date": h.get("date", ""),
                        "snippet": m.get("snippet", ""), "labels": m.get("labelIds", []),
                        "newsletter": "list-unsubscribe" in h, "internal_ms": int(m.get("internalDate", 0))})
        return out

    async def gmail_thread(self, thread_id: str) -> list[dict[str, Any]]:
        t = await self.request("GET", f"{GMAIL}/threads/{thread_id}", params={"format": "full"})
        msgs = []
        for m in t.get("messages", []):
            h = {x["name"].lower(): x["value"] for x in (m.get("payload") or {}).get("headers", [])}
            msgs.append({"id": m["id"], "from": h.get("from", ""), "date": h.get("date", ""),
                         "subject": h.get("subject", ""), "text": _plain_text(m.get("payload") or {})[:6000],
                         "labels": m.get("labelIds", [])})
        return msgs

    async def gmail_draft(self, to: str, subject: str, body: str, thread_id: str | None = None) -> dict[str, Any]:
        msg = EmailMessage()
        msg["To"], msg["Subject"] = to, subject
        msg.set_content(body)
        payload: dict[str, Any] = {"message": {"raw": _b64url(msg.as_bytes())}}
        if thread_id:
            payload["message"]["threadId"] = thread_id
        d = await self.request("POST", f"{GMAIL}/drafts", json=payload)
        return {"draft_id": d.get("id"), "message_id": (d.get("message") or {}).get("id")}

    async def gmail_send_draft(self, draft_id: str) -> dict[str, Any]:
        d = await self.request("POST", f"{GMAIL}/drafts/send", json={"id": draft_id})
        return {"sent": True, "message_id": d.get("id"), "thread_id": d.get("threadId")}

    async def gmail_send(self, to: str, subject: str, body: str) -> dict[str, Any]:
        msg = EmailMessage()
        msg["To"], msg["Subject"] = to, subject
        msg.set_content(body)
        d = await self.request("POST", f"{GMAIL}/messages/send", json={"raw": _b64url(msg.as_bytes())})
        return {"sent": True, "message_id": d.get("id")}

    # ---------------------------------------------------------- Calendar / Tasks
    async def calendar_list(self, time_min: str, time_max: str, limit: int = 25) -> list[dict[str, Any]]:
        d = await self.request("GET", f"{CALENDAR}/calendars/primary/events", params={
            "timeMin": time_min, "timeMax": time_max, "singleEvents": "true", "orderBy": "startTime",
            "maxResults": limit})
        return [{"id": e.get("id"), "summary": e.get("summary"), "start": (e.get("start") or {}).get("dateTime")
                 or (e.get("start") or {}).get("date"), "end": (e.get("end") or {}).get("dateTime")
                 or (e.get("end") or {}).get("date"), "location": e.get("location"),
                 "attendees": [a.get("email") for a in e.get("attendees", []) or []]} for e in d.get("items", [])]

    async def calendar_create(self, summary: str, start: str, end: str, description: str = "",
                              attendees: list[str] | None = None, reminder_minutes: int = 30) -> dict[str, Any]:
        body: dict[str, Any] = {"summary": summary, "description": description,
                                "start": {"dateTime": start}, "end": {"dateTime": end},
                                "reminders": {"useDefault": False,
                                              "overrides": [{"method": "popup", "minutes": reminder_minutes}]}}
        if attendees:
            body["attendees"] = [{"email": a} for a in attendees]
        e = await self.request("POST", f"{CALENDAR}/calendars/primary/events",
                               params={"sendUpdates": "all" if attendees else "none"}, json=body)
        return {"id": e.get("id"), "link": e.get("htmlLink")}

    async def tasks_list(self, limit: int = 30) -> list[dict[str, Any]]:
        d = await self.request("GET", f"{TASKS}/lists/@default/tasks", params={"maxResults": limit,
                                                                               "showCompleted": "false"})
        return [{"id": t.get("id"), "title": t.get("title"), "due": t.get("due"), "notes": t.get("notes")}
                for t in d.get("items", []) or []]

    async def tasks_create(self, title: str, notes: str = "", due: str | None = None) -> dict[str, Any]:
        body = {"title": title, "notes": notes, **({"due": due} if due else {})}
        t = await self.request("POST", f"{TASKS}/lists/@default/tasks", json=body)
        return {"id": t.get("id"), "title": t.get("title")}

    # ---------------------------------------------------------- Drive / Docs / Contacts
    async def drive_search(self, query: str, limit: int = 15) -> list[dict[str, Any]]:
        safe = query.replace("\\", "").replace("'", "\\'")
        d = await self.request("GET", f"{DRIVE}/files", params={
            "q": f"fullText contains '{safe}' and trashed = false", "pageSize": limit,
            "fields": "files(id,name,mimeType,modifiedTime,webViewLink)"})
        return d.get("files", [])

    async def drive_read(self, file_id: str) -> dict[str, Any]:
        meta = await self.request("GET", f"{DRIVE}/files/{file_id}", params={"fields": "id,name,mimeType"})
        if meta["mimeType"].startswith("application/vnd.google-apps."):
            raw = await self.request("GET", f"{DRIVE}/files/{file_id}/export", params={"mimeType": "text/plain"})
        elif meta["mimeType"].startswith("text/"):
            raw = await self.request("GET", f"{DRIVE}/files/{file_id}", params={"alt": "media"})
        else:
            return {**meta, "text": None, "note": "binary file: not readable as text"}
        text = raw.decode("utf-8", errors="replace") if isinstance(raw, bytes) else str(raw)
        return {**meta, "text": text[:20000]}

    async def docs_create(self, title: str, content: str) -> dict[str, Any]:
        boundary = "jarvis" + secrets.token_hex(8)
        meta = '{"name": %s, "mimeType": "application/vnd.google-apps.document"}' % _json_str(title)
        body = (f"--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{meta}\r\n"
                f"--{boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{content}\r\n--{boundary}--")
        f = await self.request("POST", DRIVE_UPLOAD, params={"uploadType": "multipart", "fields": "id,name,webViewLink"},
                               content=body.encode(), headers={"Content-Type": f"multipart/related; boundary={boundary}"})
        return {"id": f.get("id"), "name": f.get("name"), "link": f.get("webViewLink")}

    async def contacts_search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        d = await self.request("GET", f"{PEOPLE}/people:searchContacts", params={
            "query": query, "pageSize": limit, "readMask": "names,emailAddresses,phoneNumbers,organizations"})
        out = []
        for r in d.get("results", []) or []:
            p = r.get("person") or {}
            out.append({"name": ((p.get("names") or [{}])[0]).get("displayName"),
                        "emails": [e.get("value") for e in p.get("emailAddresses", []) or []],
                        "phones": [x.get("value") for x in p.get("phoneNumbers", []) or []],
                        "company": ((p.get("organizations") or [{}])[0]).get("name")})
        return out


def _json_str(s: str) -> str:
    import json
    return json.dumps(s, ensure_ascii=False)


def _plain_text(payload: dict[str, Any]) -> str:
    """Text of a Gmail message: text/plain parts, else stripped HTML."""
    parts: list[str] = []
    html: list[str] = []

    def walk(p: dict[str, Any]) -> None:
        data = (p.get("body") or {}).get("data")
        mime = p.get("mimeType", "")
        if data:
            text = base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="replace")
            (parts if mime == "text/plain" else html if mime == "text/html" else []).append(text)
        for sub in p.get("parts", []) or []:
            walk(sub)

    walk(payload)
    if parts:
        return "\n".join(parts)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", "\n".join(html))).strip()


# ---------------------------------------------------------------- triage
OPPORTUNITY = re.compile(r"preventiv|offert|quote|angebot|anfrage|website|sito|webseite|homepage|landing|"
                         r"collabora|zusammenarbeit|partnership|projekt|progetto|budget|kosten|costo|prezzo|price",
                         re.I)
URGENT = re.compile(r"urgent|dringend|asap|subito|entro oggi|heute noch|scadenza|deadline|fattura|rechnung|invoice|"
                    r"pagamento|zahlung|payment|contratto|vertrag|contract", re.I)


def classify_email(m: dict[str, Any], known_emails: set[str], owner_emails: set[str]) -> dict[str, Any]:
    """Transparent rules: importance, business opportunity, reasons."""
    sender = parseaddr(m.get("from", ""))[1].lower()
    text = f"{m.get('subject', '')} {m.get('snippet', '')}"
    reasons, score = [], 0
    if sender in owner_emails:
        return {"importance": "low", "opportunity": False, "reasons": ["sent by you"], "sender": sender}
    if m.get("newsletter") or "CATEGORY_PROMOTIONS" in m.get("labels", []):
        return {"importance": "low", "opportunity": False, "reasons": ["newsletter / promotion"], "sender": sender}
    if sender in known_emails or (sender.split("@")[-1] in {e.split("@")[-1] for e in known_emails}):
        score += 2
        reasons.append("known contact / CRM lead")
    if URGENT.search(text):
        score += 2
        reasons.append("urgent or money-related")
    opp = bool(OPPORTUNITY.search(text))
    if opp:
        score += 2
        reasons.append("possible business opportunity")
    if "IMPORTANT" in m.get("labels", []):
        score += 1
        reasons.append("marked important by Gmail")
    importance = "high" if score >= 3 else "medium" if score >= 1 else "low"
    return {"importance": importance, "opportunity": opp, "reasons": reasons or ["no signal"], "sender": sender}
