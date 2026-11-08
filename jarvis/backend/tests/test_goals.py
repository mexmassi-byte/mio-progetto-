"""Daily briefing: goals, continuous missions, retries with new strategy, report."""

from __future__ import annotations

from jarvis.core.goals import split_objectives
from jarvis.core.planner import heuristic_classification

from .test_engine import fake_sales  # noqa: F401  (fixture)


def test_split_and_classify_briefing():
    parts = split_objectives("Oggi trova 10 dentisti a Monaco e 5 avvocati a Berlino. Analizza il sito https://x.de")
    assert len(parts) == 3
    c = heuristic_classification(parts[0])
    assert (c["playbook"], c["sector"], c["count"], c["city"], c["country"]) == ("lead_acquisition", "dentist", 10, "München", "DE")
    c = heuristic_classification(parts[1])
    assert (c["sector"], c["count"], c["city"]) == ("lawyer", 5, "Berlin")


async def drive(services, max_rounds=30):
    """Run the goal engine the way the background loop does."""
    for _ in range(max_rounds):
        services.goals.tick()
        active = services.missions.runnable(limit=10)
        if not active and not services.goals.list() or all(g["status"] != "active" for g in services.goals.list()):
            break
        for m in active:
            await services.engine.run_until_idle(m["id"])


async def test_goal_reached_and_daily_report(services, fake_sales):  # noqa: F811
    b = await services.goals.brief("Trova 3 studi legali a Berlino per VEYRO Web")
    assert [g["target"] for g in b["goals"]] == [3]
    await drive(services)
    g = services.goals.list()[0]
    assert g["status"] == "achieved" and g["progress"] >= 3 and g["attempts"] == 1
    latest = services.goals.latest_briefing()
    assert latest["finished_at"] and "1/1 obiettivi raggiunti" in latest["report"]
    assert any(m["title"].startswith("Rapporto giornaliero") for m in services.memory.list("task"))


async def test_named_city_is_never_replaced(services, fake_sales):  # noqa: F811
    await services.goals.brief("Trova 3 avvocati a Colonia")  # the fake has no businesses in Köln
    await drive(services)
    g = services.goals.list()[0]
    assert g["status"] == "exhausted" and g["attempts"] == 2
    cities = {c for r in services.db.query("SELECT params FROM missions WHERE goal_id = ?", (g["id"],))
              for c in __import__("json").loads(r["params"])["cities"]}
    assert cities == {"Köln"}
    assert "altre città" in g["note"]


async def test_without_city_jarvis_moves_to_new_cities(services, fake_sales):  # noqa: F811
    await services.goals.brief("Trova 20 studi legali in Germania")  # more than the 8 the fake has
    await drive(services, max_rounds=40)
    g = services.goals.list()[0]
    rows = services.db.query("SELECT params FROM missions WHERE goal_id = ? ORDER BY created_at", (g["id"],))
    batches = [__import__("json").loads(r["params"])["cities"] for r in rows]
    flat = [c for b in batches for c in b]
    assert len(flat) == len(set(flat)) and len(batches) >= 2  # never the same city twice
    assert g["status"] == "exhausted" and g["attempts"] <= g["max_attempts"]


async def test_goal_cancel(services):
    await services.goals.brief("Trova 5 dentisti a Milano")
    services.goals.tick()
    g = services.goals.list()[0]
    assert g["last_mission_id"]
    assert services.goals.cancel(g["id"])
    assert services.goals.get(g["id"])["status"] == "cancelled"
    assert services.missions.get(g["last_mission_id"])["status"] == "cancelled"
