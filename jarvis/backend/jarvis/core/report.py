"""Spoken business summary: real numbers from the database, phrased in code.

The language model is deliberately not used here: numbers about the business
must never be invented or rounded by a model. Periods are rolling: the last 7
days compared with the 7 days before.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

PERIOD_DAYS = 7


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds")


def weekly_numbers(db: Any, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    cur_start = now - timedelta(days=PERIOD_DAYS)
    prev_start = now - timedelta(days=2 * PERIOD_DAYS)

    def count(sql: str, start: datetime, end: datetime) -> int:
        return int(db.scalar(sql, (_iso(start), _iso(end))) or 0)

    def pair(sql: str) -> dict[str, int]:
        return {"current": count(sql, cur_start, now), "previous": count(sql, prev_start, cur_start)}

    revenue_sql = "SELECT COALESCE(SUM(amount_eur), 0) FROM deals WHERE verified_at >= ? AND verified_at < ?"
    return {
        "period_days": PERIOD_DAYS,
        "new_leads": pair("SELECT COUNT(*) FROM leads WHERE created_at >= ? AND created_at < ?"),
        "qualified": pair("SELECT COUNT(*) FROM events WHERE type = 'lead.status' AND ts >= ? AND ts < ? "
                          "AND json_extract(payload, '$.status') = 'qualified'"),
        "audited": pair("SELECT COUNT(*) FROM leads WHERE audited_at >= ? AND audited_at < ?"),
        "drafts": pair("SELECT COUNT(*) FROM drafts WHERE created_at >= ? AND created_at < ?"),
        "missions_done": pair("SELECT COUNT(*) FROM missions WHERE status IN ('completed','completed_unverified') "
                              "AND finished_at >= ? AND finished_at < ?"),
        "customers": pair("SELECT COUNT(*) FROM deals WHERE verified_at >= ? AND verified_at < ?"),
        "revenue_eur": {"current": float(db.scalar(revenue_sql, (_iso(cur_start), _iso(now))) or 0),
                        "previous": float(db.scalar(revenue_sql, (_iso(prev_start), _iso(cur_start))) or 0)},
        "approvals_pending": int(db.scalar("SELECT COUNT(*) FROM approvals WHERE status = 'pending'") or 0),
        "goals_active": int(db.scalar("SELECT COUNT(*) FROM goals WHERE status = 'active'") or 0),
    }


def _n(x: float, lang: str) -> str:
    s = f"{int(x):,}" if float(x).is_integer() else f"{x:,.2f}"
    if lang in ("it", "de"):  # 1,800.50 -> 1.800,50
        s = s.replace(",", "\0").replace(".", ",").replace("\0", ".")
    return s


TEXT = {
    "it": {
        "hello": ("Buongiorno", "Buonasera"), "none": "negli ultimi sette giorni non ho ancora registrato attività.",
        "intro": "ecco la situazione degli ultimi sette giorni.",
        "new_leads": "Ho trovato {c} nuovi potenziali clienti{d}.",
        "new_leads_1": "Ho trovato un nuovo potenziale cliente{d}.",
        "qualified": "{c} sono stati qualificati{d}.",
        "qualified_1": "Uno è stato qualificato{d}.",
        "audited": "Ho analizzato {c} siti web.",
        "audited_1": "Ho analizzato un sito web.",
        "drafts": "Ho preparato {c} bozze di contatto, in attesa della tua approvazione.",
        "drafts_1": "Ho preparato una bozza di contatto, in attesa della tua approvazione.",
        "missions_done": "Missioni completate: {c}.",
        "customers": "Nuovi clienti con pagamento verificato: {c}{d}.",
        "revenue": "Fatturato verificato: {c} euro{d}.",
        "no_customers": "Nessun nuovo cliente con pagamento verificato in questo periodo.",
        "approvals": "Hai {c} approvazioni in attesa.",
        "goals": "Sto lavorando su {c} obiettivi.",
        "up": ", {d} in più della settimana precedente", "down": ", {d} in meno della settimana precedente",
        "same": ", come la settimana precedente",
    },
    "de": {
        "hello": ("Guten Tag", "Guten Abend"), "none": "in den letzten sieben Tagen gab es noch keine Aktivität.",
        "intro": "hier ist der Stand der letzten sieben Tage.",
        "new_leads": "Ich habe {c} neue potenzielle Kunden gefunden{d}.",
        "new_leads_1": "Ich habe einen neuen potenziellen Kunden gefunden{d}.",
        "qualified": "{c} davon wurden qualifiziert{d}.",
        "qualified_1": "Einer davon wurde qualifiziert{d}.",
        "audited": "Ich habe {c} Websites analysiert.",
        "audited_1": "Ich habe eine Website analysiert.",
        "drafts": "Ich habe {c} Kontaktentwürfe vorbereitet, die auf Ihre Freigabe warten.",
        "drafts_1": "Ich habe einen Kontaktentwurf vorbereitet, der auf Ihre Freigabe wartet.",
        "missions_done": "Abgeschlossene Missionen: {c}.",
        "customers": "Neue Kunden mit bestätigter Zahlung: {c}{d}.",
        "revenue": "Bestätigter Umsatz: {c} Euro{d}.",
        "no_customers": "In diesem Zeitraum gab es keine neuen Kunden mit bestätigter Zahlung.",
        "approvals": "{c} Freigaben warten auf Sie.",
        "goals": "Ich arbeite an {c} Zielen.",
        "up": ", {d} mehr als in der Vorwoche", "down": ", {d} weniger als in der Vorwoche",
        "same": ", genauso viele wie in der Vorwoche",
    },
    "en": {
        "hello": ("Good morning", "Good evening"), "none": "there has been no activity in the last seven days yet.",
        "intro": "here is the situation for the last seven days.",
        "new_leads": "I found {c} new potential clients{d}.",
        "new_leads_1": "I found one new potential client{d}.",
        "qualified": "{c} of them were qualified{d}.",
        "qualified_1": "One of them was qualified{d}.",
        "audited": "I analysed {c} websites.",
        "audited_1": "I analysed one website.",
        "drafts": "I prepared {c} outreach drafts, waiting for your approval.",
        "drafts_1": "I prepared one outreach draft, waiting for your approval.",
        "missions_done": "Missions completed: {c}.",
        "customers": "New customers with verified payment: {c}{d}.",
        "revenue": "Verified revenue: {c} euros{d}.",
        "no_customers": "No new customers with verified payment in this period.",
        "approvals": "You have {c} approvals pending.",
        "goals": "I am working on {c} goals.",
        "up": ", {d} more than the week before", "down": ", {d} fewer than the week before",
        "same": ", the same as the week before",
    },
}


def spoken_summary(numbers: dict[str, Any], lang: str, title: str, hour: int | None = None) -> str:
    t = TEXT.get(lang, TEXT["it"])
    lang = lang if lang in TEXT else "it"
    hour = datetime.now().hour if hour is None else hour
    greeting = f"{t['hello'][0 if hour < 18 else 1]}, {title}"

    def delta(pair: dict[str, float]) -> str:
        cur, prev = pair["current"], pair["previous"]
        if cur == prev:
            return t["same"] if cur else ""
        diff = abs(cur - prev)
        return (t["up"] if cur > prev else t["down"]).format(d=_n(diff, lang))

    def say(key: str, with_delta: bool = False) -> None:
        c = numbers[key]["current"]
        if not c:
            return
        tpl = t.get(f"{key}_1") if c == 1 else None
        parts.append((tpl or t[key]).format(c=_n(c, lang), d=delta(numbers[key]) if with_delta else ""))

    parts: list[str] = []
    say("new_leads", True)
    say("qualified", True)
    say("audited")
    say("drafts")
    if numbers["missions_done"]["current"]:
        parts.append(t["missions_done"].format(c=_n(numbers["missions_done"]["current"], lang)))
    if numbers["customers"]["current"]:
        parts.append(t["customers"].format(c=_n(numbers["customers"]["current"], lang), d=delta(numbers["customers"])))
        parts.append(t["revenue"].format(c=_n(numbers["revenue_eur"]["current"], lang), d=delta(numbers["revenue_eur"])))
    elif parts:
        parts.append(t["no_customers"])
    if numbers["goals_active"]:
        parts.append(t["goals"].format(c=numbers["goals_active"]))
    if numbers["approvals_pending"]:
        parts.append(t["approvals"].format(c=numbers["approvals_pending"]))
    if not parts:
        return f"{greeting}, {t['none']}"
    return f"{greeting}, {t['intro']} " + " ".join(parts)
