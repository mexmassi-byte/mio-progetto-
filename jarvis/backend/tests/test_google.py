"""Google integration against a simulated Google API (OAuth, Gmail, Calendar, Docs, Contacts)."""

from __future__ import annotations

import base64
import json
import time
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from jarvis.integrations.google import Google, GoogleError, classify_email
from jarvis.tools.registry import PermissionDenied, ToolContext


def _b64(s: str) -> str:
    return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")


class FakeGoogle:
    def __init__(self):
        self.calls = []
        self.sent = []
        self.refreshes = 0

    def __call__(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        self.calls.append((request.method, url, request.content))
        if url.startswith("https://oauth2.googleapis.com/token"):
            form = parse_qs(request.content.decode())
            if form["grant_type"][0] == "authorization_code":
                assert form["code_verifier"][0] and form["code"][0] == "CODE"
                return httpx.Response(200, json={"access_token": "A1", "refresh_token": "R1", "expires_in": 3600,
                                                 "scope": "openid email https://www.googleapis.com/auth/gmail.readonly"})
            self.refreshes += 1
            return httpx.Response(200, json={"access_token": f"A{self.refreshes + 1}", "expires_in": 3600})
        auth = request.headers.get("authorization")
        if "userinfo" in url:
            return httpx.Response(200, json={"email": "max@veyroweb.com"})
        assert auth and auth.startswith("Bearer ")
        if "/gmail/v1/users/me/messages?" in url:
            return httpx.Response(200, json={"messages": [{"id": "m1"}, {"id": "m2"}]})
        if "/gmail/v1/users/me/messages/m1" in url:
            return httpx.Response(200, json={"id": "m1", "threadId": "t1", "snippet": "Vorremmo un preventivo per il sito",
                                             "labelIds": ["INBOX"], "internalDate": "1000", "payload": {"headers": [
                                                 {"name": "From", "value": "Anna Bianchi <anna@studiobianchi.it>"},
                                                 {"name": "Subject", "value": "Richiesta preventivo sito web"}]}})
        if "/gmail/v1/users/me/messages/m2" in url:
            return httpx.Response(200, json={"id": "m2", "threadId": "t2", "snippet": "Offerte della settimana",
                                             "labelIds": ["INBOX", "CATEGORY_PROMOTIONS"], "internalDate": "2000",
                                             "payload": {"headers": [{"name": "From", "value": "shop@news.com"},
                                                                     {"name": "Subject", "value": "Saldi"},
                                                                     {"name": "List-Unsubscribe", "value": "<x>"}]}})
        if url.endswith("/gmail/v1/users/me/drafts"):
            raw = json.loads(request.content)["message"]["raw"]
            decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode()
            assert "To: anna@studiobianchi.it" in decoded and "Gentile Anna" in decoded
            return httpx.Response(200, json={"id": "d1", "message": {"id": "m9"}})
        if url.endswith("/gmail/v1/users/me/messages/send"):
            raw = json.loads(request.content)["raw"]
            decoded = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode()
            self.sent.append(decoded)
            return httpx.Response(200, json={"id": "m11"})
        if url.endswith("/drafts/send"):
            return httpx.Response(200, json={"id": "m10", "threadId": "t1"})
        if "/calendar/v3/calendars/primary/events" in url and request.method == "POST":
            body = json.loads(request.content)
            return httpx.Response(200, json={"id": "e1", "htmlLink": "https://calendar/e1", "summary": body["summary"]})
        if "upload/drive/v3/files" in url:
            assert b"application/vnd.google-apps.document" in request.content
            return httpx.Response(200, json={"id": "doc1", "name": "Report", "webViewLink": "https://docs/doc1"})
        if "people:searchContacts" in url:
            return httpx.Response(200, json={"results": [{"person": {"names": [{"displayName": "Anna Bianchi"}],
                                                                       "emailAddresses": [{"value": "anna@studiobianchi.it"}]}}]})
        return httpx.Response(404, json={"error": {"message": "not mocked"}})


@pytest.fixture
def google(services):
    services.vault.set("google_client_id", "cid.apps.googleusercontent.com")
    services.vault.set("google_client_secret", "csecret")
    fake = FakeGoogle()
    services.channels.google = Google(services, transport=httpx.MockTransport(fake))
    return services.channels.google, fake


async def test_oauth_flow_with_pkce_and_state(services, google):
    g, fake = google
    url = g.auth_url()
    q = parse_qs(urlparse(url).query)
    assert q["code_challenge_method"] == ["S256"] and q["access_type"] == ["offline"]
    assert q["redirect_uri"] == ["http://127.0.0.1:8765/api/integrations/google/callback"]
    with pytest.raises(GoogleError, match="Invalid or expired"):
        await g.finish("CODE", "forged-state")
    g.auth_url()
    state = services.vault.get("google_oauth_pending")["state"]
    info = await g.finish("CODE", state)
    assert info["email"] == "max@veyroweb.com" and g.connected()
    assert services.vault.get("google_oauth_pending") is None  # single use
    raw = services.db.one("SELECT ciphertext FROM credentials WHERE name = 'google_token'")["ciphertext"]
    assert b"R1" not in raw  # refresh token stored encrypted


async def _connect(services, g):
    g.auth_url()
    await g.finish("CODE", services.vault.get("google_oauth_pending")["state"])


async def test_token_refresh_and_triage_creates_lead(services, google):
    g, fake = google
    await _connect(services, g)
    tok = services.vault.get("google_token")
    tok["expires_at"] = time.time() - 1
    services.vault.set("google_token", tok)
    ctx = ToolContext(services=services)
    r = await services.tools.execute("gmail_triage", {}, ctx)
    assert fake.refreshes == 1
    first = r["emails"][0]
    assert first["importance"] in ("high", "medium") and first["opportunity"] and first["lead_id"]
    assert r["emails"][-1]["importance"] == "low"  # newsletter
    assert r["new_leads"] == 1 and services.crm.get(first["lead_id"])["email"] == "anna@studiobianchi.it"
    again = await services.tools.execute("gmail_triage", {}, ctx)  # same emails: no duplicate lead
    assert again["new_leads"] == 0


async def test_draft_is_autonomous_but_sending_needs_approval(services, google):
    g, _ = google
    await _connect(services, g)
    ctx = ToolContext(services=services)
    d = await services.tools.execute("gmail_draft", {"to": "anna@studiobianchi.it", "subject": "Re: preventivo",
                                                     "body": "Gentile Anna, grazie per la richiesta."}, ctx)
    assert d["draft_id"] == "d1" and d["sent"] is False
    with pytest.raises(PermissionDenied):
        await services.tools.execute("gmail_send", {"draft_id": "d1"}, ctx)
    sent = await services.tools.execute("gmail_send", {"draft_id": "d1"}, ToolContext(services=services, approved=True))
    assert sent["sent"] is True


async def test_calendar_docs_contacts(services, google):
    g, _ = google
    await _connect(services, g)
    ok = ToolContext(services=services, approved=True)
    e = await services.tools.execute("calendar_create", {"summary": "Call Studio Bianchi",
                                                         "start": "2026-11-10T10:00:00+01:00",
                                                         "end": "2026-11-10T10:30:00+01:00"}, ok)
    assert e["id"] == "e1"
    with pytest.raises(PermissionDenied):
        await services.tools.execute("docs_create", {"title": "Report", "content": "x"}, ToolContext(services=services))
    d = await services.tools.execute("docs_create", {"title": "Report", "content": "Contenuto"}, ok)
    assert d["link"] == "https://docs/doc1"
    c = await services.tools.execute("contacts_search", {"query": "Anna"}, ToolContext(services=services))
    assert c["contacts"][0]["emails"] == ["anna@studiobianchi.it"]


def test_not_connected_is_reported_clearly(services):
    with pytest.raises(GoogleError, match="not configured"):
        Google(services).auth_url()


def test_classifier_rules():
    owners = {"max@veyroweb.com"}
    m = {"from": "Dr. Weber <praxis@weber.de>", "subject": "Angebot für neue Webseite", "snippet": "dringend",
         "labels": ["INBOX"]}
    c = classify_email(m, set(), owners)
    assert c["importance"] == "high" and c["opportunity"]
    assert classify_email({**m, "from": "max@veyroweb.com"}, set(), owners)["importance"] == "low"


async def test_daily_report_email_goes_only_to_the_owner(services, google):
    g, fake = google
    assert await services.channels._email_report("Rapporto", "3/3 obiettivi") is False  # not connected yet
    await _connect(services, g)
    assert await services.channels._email_report("Rapporto", "3/3 obiettivi") is True
    assert len(fake.sent) == 1 and "To: max@veyroweb.com" in fake.sent[0] and "3/3 obiettivi" in fake.sent[0]
    row = services.db.one("SELECT * FROM comms_log WHERE channel = 'email' AND kind = 'report'")
    assert row["contact"] == "max@veyroweb.com" and row["status"] == "sent"
