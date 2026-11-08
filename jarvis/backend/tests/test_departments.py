"""Sales (audit, scoring, CRM, discovery parsing) and development workspaces."""

from __future__ import annotations

import shutil

import pytest

from jarvis.departments.dev.workspace import WorkspaceError, check_command
from jarvis.departments.sales.audit import analyze_html
from jarvis.departments.sales.discovery import build_query, parse_elements
from jarvis.departments.sales.outreach import template_draft
from jarvis.departments.sales.scoring import score_lead

from .conftest import BAD_SITE, GOOD_SITE


def test_audit_detects_real_problems():
    bad = analyze_html(BAD_SITE, "http://kanzlei-mueller.de", elapsed_ms=4200, now_year=2026)
    good = analyze_html(GOOD_SITE, "https://kanzlei-schmidt.de", elapsed_ms=350, now_year=2026)
    ids = {c["id"]: c["status"] for c in bad["checks"]}
    assert ids["https"] == "fail" and ids["viewport"] == "fail" and ids["legacy"] == "fail"
    assert ids["copyright"] == "fail" and ids["jquery"] == "warn" and ids["speed"] == "fail"
    assert bad["opportunity_score"] > 60
    assert good["opportunity_score"] < 10
    assert good["contacts"]["emails"] == ["info@schmidt.de"]
    assert good["contacts"]["phones"] == ["+49301234"]


def test_scoring_is_transparent():
    bad = {"name": "Kanzlei Müller", "sector": "lawyer", "website": "http://x.de", "address": "Berlin",
           "audit": analyze_html(BAD_SITE, "http://x.de", elapsed_ms=4000, now_year=2026)}
    good = {**bad, "audit": analyze_html(GOOD_SITE, "https://x.de", elapsed_ms=200, now_year=2026)}
    s_bad, parts = score_lead(bad)
    s_good, _ = score_lead(good)
    assert s_bad > s_good
    assert {p["criterion"] for p in parts} == {"need", "sector", "contact", "data"}
    assert all(p["reason"] for p in parts)
    assert round(sum(p["points"] for p in parts), 1) == s_bad


def test_overpass_query_and_parsing():
    q = build_query("dentist", 'Mün"chen', 50)
    assert '"amenity"="dentist"' in q and 'Mün"chen' not in q and "out center tags 50" in q
    data = {"elements": [
        {"type": "node", "id": 1, "lat": 48.1, "lon": 11.5,
         "tags": {"name": "Zahnarzt A", "website": "zahnarzt-a.de", "addr:city": "München"}},
        {"type": "way", "id": 2, "center": {"lat": 48.2, "lon": 11.6}, "tags": {"name": "Praxis B"}},
        {"type": "node", "id": 3, "tags": {}},
    ]}
    items = parse_elements(data, "dentist", "München", "DE")
    assert [i["name"] for i in items] == ["Zahnarzt A", "Praxis B"]
    assert items[0]["website"] == "https://zahnarzt-a.de" and items[1]["lat"] == 48.2
    assert items[1]["source_ref"] == "way/2"


def test_crm_won_requires_verified_payment(services):
    crm = services.crm
    lead = crm.create_manual({"name": "Studio Rossi", "city": "Genova"})
    with pytest.raises(PermissionError):
        crm.update(lead["id"], status="won")
    deal = crm.add_deal(lead["id"], "Sito vetrina", 1800)
    with pytest.raises(ValueError):
        crm.verify_payment(deal["id"], "  ")
    crm.verify_payment(deal["id"], "Fattura 2026/014")
    assert crm.get(lead["id"])["status"] == "won"
    assert crm.stats()["verified_revenue_eur"] == 1800


def test_template_drafts_are_marked():
    lead = {"name": "Kanzlei X", "audit": {"problems": ["HTTPS: assente"]}}
    _, body = template_draft(lead, "email", "de", "Max", "VEYRO Web")
    assert body.startswith("[VORLAGE") and "HTTPS" in body
    _, body = template_draft(lead, "email", "it", "Max", "VEYRO Web")
    assert body.startswith("[BOZZA DA MODELLO")


@pytest.mark.parametrize("argv", [
    ["rm", "-rf", "/"], ["git", "push"], ["npm", "install", "-g", "x"], ["git", "status", ";", "ls"],
    ["python", "-c", "print(1)"], ["git", "add", "../../etc"], ["bash"],
])
def test_command_allowlist_refuses(argv):
    with pytest.raises(WorkspaceError):
        check_command(argv)


def test_command_allowlist_accepts():
    for argv in (["git", "status"], ["npm", "test"], ["python", "-m", "pytest"], ["git", "commit", "-m", "x"]):
        check_command(argv)


async def test_workspace_isolation_and_git(services):
    ws = services.workspaces
    p = ws.create("Sito Studio Rossi", "Sito vetrina")
    ws.write(p["id"], "src/index.html", "<h1>Ciao</h1>")
    assert ws.read(p["id"], "src/index.html") == "<h1>Ciao</h1>"
    for bad in ("../outside.txt", "/etc/passwd", ".git/config"):
        with pytest.raises(WorkspaceError):
            ws.write(p["id"], bad, "x")
    if shutil.which("git"):
        r = await ws.run(p["id"], ["git", "init"])
        assert r["exit_code"] == 0
        r = await ws.run(p["id"], ["git", "status"])
        assert r["exit_code"] == 0 and "src/" in r["output"]
    assert {f["path"] for f in ws.files(p["id"])} >= {"README.md", "src/index.html"}


def test_overpass_radius_query_when_city_known():
    q = build_query("lawyer", "München", 30, (48.137, 11.575))
    assert "around:9000,48.13700,11.57500" in q and "area" not in q


def test_city_names_are_normalized():
    from jarvis.departments.sales.geo import canonical_city, city_coords
    assert canonical_city("Munich") == "München" and canonical_city("monaco di baviera") == "München"
    assert canonical_city("Milan") == "Milano" and canonical_city("Kleinstadt") == "Kleinstadt"
    assert city_coords("Cologne") == city_coords("Köln") is not None


def test_outreach_facts_are_language_neutral():
    from jarvis.departments.sales.outreach import facts_for
    lead = {"name": "Praxis X", "sector": "dentist", "city": "München", "website": "http://x.de",
            "audit": analyze_html(BAD_SITE, "http://x.de", elapsed_ms=4000, now_year=2026)}
    facts = facts_for(lead)
    assert "not optimized for mobile" in facts and "HTTPS" in facts
    assert "Ottimizzato" not in facts
