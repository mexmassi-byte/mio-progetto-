"""Spoken business summary: numbers come from the database, never from the model."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jarvis.core.report import spoken_summary, weekly_numbers


def _ago(days: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")


def _lead(db, i, days):
    db.insert("leads", {"id": f"l{i}", "name": f"Studio {i}", "source": "t", "source_ref": f"r{i}",
                        "status": "new", "created_at": _ago(days), "updated_at": _ago(days)})


def test_weekly_numbers_and_italian_phrasing(services):
    db = services.db
    for i in range(8):
        _lead(db, i, 1)        # this week: 8
    for i in range(8, 11):
        _lead(db, i, 10)       # previous week: 3
    db.insert("deals", {"id": "d1", "lead_id": "l1", "title": "Sito", "amount_eur": 1800.0, "status": "paid",
                        "payment_reference": "F1", "verified_at": _ago(2), "created_at": _ago(3), "updated_at": _ago(2)})
    n = weekly_numbers(db)
    assert n["new_leads"] == {"current": 8, "previous": 3}
    assert n["customers"]["current"] == 1 and n["revenue_eur"]["current"] == 1800.0
    text = spoken_summary(n, "it", "Signore", hour=9)
    assert text.startswith("Buongiorno, Signore")
    assert "Ho trovato 8 nuovi potenziali clienti, 5 in più della settimana precedente." in text
    assert "Fatturato verificato: 1.800 euro, 1.800 in più della settimana precedente." in text


def test_other_languages_and_empty_week(services):
    n = weekly_numbers(services.db)
    assert spoken_summary(n, "it", "Signore", hour=20) == \
        "Buonasera, Signore, negli ultimi sette giorni non ho ancora registrato attività."
    _lead(services.db, 1, 1)
    n = weekly_numbers(services.db)
    assert spoken_summary(n, "de", "Master", hour=9).startswith("Guten Tag, Master, hier ist der Stand")
    assert "I found one new potential client, 1 more than the week before." in spoken_summary(n, "en", "Sir", 9)
    assert "Ho trovato un nuovo potenziale cliente" in spoken_summary(n, "it", "Signore", 9)


def test_summary_endpoint(client):
    r = client.get("/api/summary?lang=en").json()
    assert r["lang"] == "en" and r["text"].endswith("no activity in the last seven days yet.")
