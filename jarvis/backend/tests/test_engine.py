"""Planner and autonomous engine, end to end with the fake model."""

from __future__ import annotations

import pytest

from jarvis.core.planner import heuristic_classification
from jarvis.departments.sales import tools as sales_tools
from jarvis.departments.sales.audit import analyze_html
from jarvis.security.permissions import Permission
from jarvis.tools.registry import Tool, ToolError

from .conftest import BAD_SITE, GOOD_SITE


def test_heuristic_classification():
    c = heuristic_classification("JARVIS, trova cinque nuovi clienti dentisti in Germania questa settimana")
    assert c["playbook"] == "lead_acquisition"
    assert c["sector"] == "dentist" and c["country"] == "DE" and c["count"] == 5
    c = heuristic_classification("Analizza il sito https://example.de e dimmi cosa migliorare")
    assert c["playbook"] == "website_audit" and c["urls"] == ["https://example.de"]
    assert heuristic_classification("Scrivi una poesia")["playbook"] == "freeform"


@pytest.fixture
def fake_sales(monkeypatch):
    """Replace network access with deterministic fixtures."""
    businesses = [
        {"name": f"Kanzlei {i}", "website": f"https://kanzlei{i}.de", "email": None, "phone": "+49 30 1",
         "address": f"Straße {i}, 10115 Berlin", "city": "Berlin", "country": "DE", "sector": "lawyer",
         "lat": 52.5 + i / 100, "lon": 13.4, "source": "osm", "source_ref": f"node/{i}"}
        for i in range(8)
    ]

    async def fake_overpass(url, ua, sector, city, country, limit, timeout_s=120.0):
        return [dict(b, city=city) for b in businesses if city == "Berlin"]
    # (any other city returns nothing)

    async def fake_audit(url, ctx):
        n = int(url.rstrip("/").split("kanzlei")[-1].split(".")[0])
        return analyze_html(BAD_SITE if n % 2 == 0 else GOOD_SITE, url, elapsed_ms=4000 if n % 2 == 0 else 300)

    monkeypatch.setattr(sales_tools, "overpass_search", fake_overpass)
    monkeypatch.setattr(sales_tools, "audit_url", fake_audit)
    return businesses


async def test_lead_acquisition_mission_completes_and_is_verified(services, llm, fake_sales):
    # The fake model classifies the objective; drafts fall back to verified-fact templates.
    llm.queue({"playbook": "lead_acquisition", "sector": "lawyer", "country": "DE", "city": "Berlin", "count": 3})
    llm.responder = lambda msgs, tools, schema: {"subject": "Ihre Website", "body": "Guten Tag, ..."} \
        if schema and "body" in str(schema) else "Report: 3 prospects qualified. Nothing was sent."
    m = services.missions.create("Trova 3 studi legali a Berlino come clienti per VEYRO Web")
    done = await services.engine.run_until_idle(m["id"])
    assert done["status"] == "completed", (done["error"], [(t["title"], t["status"], t["error"]) for t in done["tasks"]])
    assert done["verification"]["passed"] is True
    qualified = services.crm.list(status="qualified", mission_id=m["id"])
    assert len(qualified) == 3
    # The worst websites (even numbers: bad HTML, slow) must rank first.
    assert all(int(l["name"].split()[-1]) % 2 == 0 for l in qualified)
    assert all(services.crm.drafts(l["id"]) for l in qualified)
    assert services.db.scalar("SELECT COUNT(*) FROM drafts WHERE status = 'sent'") == 0
    types = {e["type"] for e in services.bus.recent(limit=500)}
    assert {"research.location", "research.analyze", "lead.created", "mission.completed"} <= types


async def test_mission_incomplete_when_not_enough_good_leads(services, llm, fake_sales):
    m = services.missions.create("Trova clienti", kind="lead_acquisition",
                                 params={"sector": "lawyer", "country": "DE", "city": "Berlin", "count": 20})
    done = await services.engine.run_until_idle(m["id"])
    assert done["status"] == "incomplete"
    assert done["verification"]["passed"] is False


async def test_freeform_plan_is_validated(services, llm):
    llm.queue({"playbook": "freeform"},
              {"steps": [{"title": "Boom", "tool": "rm_rf", "args": {}}], "completion_condition": "x"},
              {"steps": [{"title": "Scrivi", "tool": "write_document",
                          "args": {"title": "Piano", "instructions": "Scrivi un piano marketing"}}],
               "completion_condition": "documento scritto"},
              "Piano marketing: ...")
    m = services.missions.create("Prepara un piano marketing per gennaio")
    done = await services.engine.run_until_idle(m["id"])
    assert done["status"] == "completed_unverified"
    assert [t["tool"] for t in done["tasks"]] == ["write_document"]


async def test_planning_failure_fails_mission(services, llm):
    llm.queue({"playbook": "freeform"}, "not json", "still not json")
    m = services.missions.create("Fai qualcosa di vago")
    done = await services.engine.run_until_idle(m["id"])
    assert done["status"] == "failed" and "Planning failed" in done["error"]


def _register(services, name, fn, permission=Permission.AUTONOMOUS):
    services.tools.register(Tool(name, name, {"type": "object", "properties": {}}, fn, permission))


async def test_approval_flow(services):
    calls = []

    async def publish(ctx):
        calls.append(ctx.approved)
        return {"published": True}

    _register(services, "publish_site", publish, Permission.APPROVAL)
    m = services.missions.create("Pubblica", kind="freeform")
    services.missions.add_tasks(m["id"], [{"title": "Pubblica", "tool": "publish_site"}])
    services.missions.set_status(m["id"], "running")
    d = await services.engine.run_until_idle(m["id"])
    assert d["status"] == "awaiting_approval" and calls == []
    approval = services.missions.approvals("pending")[0]
    await services.engine.decide(approval["id"], True, "ok")
    d = await services.engine.run_until_idle(m["id"])
    assert calls == [True] and d["status"] == "completed_unverified"


async def test_explicit_permission_needs_confirmation(services):
    async def pay(ctx):
        return "paid"

    _register(services, "pay", pay, Permission.EXPLICIT)
    a = services.missions.request_approval(tool="pay", args={}, permission="explicit", reason="test")
    with pytest.raises(PermissionError):
        await services.engine.decide(a["id"], True)
    res = await services.engine.decide(a["id"], True, confirmation="CONFERMO")
    assert res["result"] == "paid"


async def test_retry_then_success(services):
    attempts = {"n": 0}

    async def flaky(ctx):
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise ToolError("temporary")
        return "ok"

    _register(services, "flaky", flaky)
    m = services.missions.create("x", kind="freeform")
    services.missions.add_tasks(m["id"], [{"title": "flaky", "tool": "flaky"}])
    services.missions.set_status(m["id"], "running")
    await services.engine.step(m["id"])
    t = services.missions.tasks(m["id"])[0]
    assert t["status"] == "pending" and t["next_attempt_at"]
    services.missions.update_task(t["id"], next_attempt_at=None)  # skip the backoff wait
    d = await services.engine.run_until_idle(m["id"])
    assert d["status"] == "completed_unverified" and attempts["n"] == 2


async def test_budget_blocks_and_resume(services):
    async def ok(ctx):
        return 1

    _register(services, "ok", ok)
    m = services.missions.create("x", kind="freeform", max_steps=1)
    services.missions.add_tasks(m["id"], [{"title": "a", "tool": "ok"}, {"title": "b", "tool": "ok"}])
    services.missions.set_status(m["id"], "running")
    d = await services.engine.run_until_idle(m["id"])
    assert d["status"] == "blocked" and "budget" in d["error"]
    assert services.missions.resume(m["id"], extra_steps=5)
    d = await services.engine.run_until_idle(m["id"])
    assert d["status"] == "completed_unverified"


async def test_recovery_after_restart(services):
    m = services.missions.create("x", kind="freeform")
    services.missions.add_tasks(m["id"], [{"title": "a", "tool": "notify_user", "args": {"title": "hi"}}])
    t = services.missions.tasks(m["id"])[0]
    services.missions.update_task(t["id"], status="running")
    assert services.missions.recover_interrupted() == 1
    assert services.missions.tasks(m["id"])[0]["status"] == "pending"


async def test_cancel(services):
    m = services.missions.create("x", kind="freeform")
    services.missions.add_tasks(m["id"], [{"title": "a", "tool": "notify_user", "args": {"title": "hi"}}])
    assert services.missions.cancel(m["id"])
    assert services.missions.get(m["id"])["status"] == "cancelled"
    assert services.missions.tasks(m["id"])[0]["status"] == "cancelled"


async def test_mission_stops_when_no_business_is_found(services, llm, fake_sales):
    m = services.missions.create("Trova clienti", kind="lead_acquisition",
                                 params={"sector": "lawyer", "country": "DE", "city": "Munich", "count": 3})
    done = await services.engine.run_until_idle(m["id"])
    assert done["params"]["cities"] == ["München"]
    assert done["status"] == "failed" and "No 'lawyer' businesses found" in done["error"]
    assert [t["status"] for t in done["tasks"]][:2] == ["failed", "skipped"]
