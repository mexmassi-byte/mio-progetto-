from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jarvis.config import Settings
from jarvis.llm.fake import FakeProvider
from jarvis.main import create_app
from jarvis.services import build_services


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(data_dir=tmp_path / "data", llm_provider="fake", engine_enabled=False,
                    default_task_max_attempts=2, searxng_url="http://127.0.0.1:9")


@pytest.fixture
def llm() -> FakeProvider:
    return FakeProvider()


@pytest.fixture
def services(settings: Settings, llm: FakeProvider):
    s = build_services(settings, llm)
    yield s
    s.db.close()


@pytest.fixture
def client(settings: Settings, llm: FakeProvider):
    app = create_app(settings, llm, start_engine=False)
    with TestClient(app) as c:
        c.headers["Authorization"] = f"Bearer {app.state.services.token}"
        c.app_services = app.state.services  # type: ignore[attr-defined]
        yield c


BAD_SITE = """<html><head><title>Kanzlei</title></head><body>
<font face="Arial">Willkommen</font><table><tr><td>Rechtsanwalt Müller</td></tr></table>
<img src="a.jpg"><img src="b.jpg"><p>© 2014 Kanzlei Müller</p>
<script src="/js/jquery-1.8.3.min.js"></script></body></html>"""

GOOD_SITE = """<!doctype html><html lang="de"><head><title>Kanzlei Schmidt – Rechtsanwälte in Berlin</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Fachanwälte für Arbeitsrecht in Berlin. Termin online buchen.">
<meta property="og:title" content="Kanzlei Schmidt">
<script type="application/ld+json">{"@type":"LegalService"}</script></head><body>
<h1>Kanzlei Schmidt</h1><a href="tel:+49301234">Anrufen</a><a href="mailto:info@schmidt.de">E-Mail</a>
<a href="/kontakt">Kontakt</a><form><input name="x"></form><p>Online-Termin buchen</p>
<a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a><p>Cookie-Einstellungen</p>
<img src="x.jpg" alt="Team"><footer>© 2026 Kanzlei Schmidt</footer></body></html>"""
