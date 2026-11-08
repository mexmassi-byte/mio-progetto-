"""Playbooks: fixed, tested step sequences for recurring business objectives,
plus code-based verifiers for their completion conditions."""

from __future__ import annotations

from typing import Any, Callable

from ..departments.sales.geo import canonical_city

SECTORS = ("lawyer", "dentist", "clinic", "aesthetic", "tax_advisor", "physiotherapist",
           "architect", "notary", "other")

DEFAULT_CITIES = {
    "DE": ["Berlin", "München", "Hamburg", "Frankfurt am Main", "Köln", "Stuttgart", "Düsseldorf"],
    "IT": ["Milano", "Roma", "Torino", "Genova", "Bologna", "Firenze", "Napoli"],
    "AT": ["Wien", "Graz", "Linz", "Salzburg"],
    "CH": ["Zürich", "Genève", "Basel", "Bern"],
}

COUNTRY_LANGUAGE = {"DE": "de", "AT": "de", "CH": "de", "IT": "it"}


def lead_acquisition(params: dict[str, Any]) -> tuple[list[dict], str]:
    count = int(params.get("count") or 5)
    count = max(1, min(count, 50))
    country = (params.get("country") or "DE").upper()
    sector = params.get("sector") or "lawyer"
    if sector not in SECTORS:
        sector = "other"
    city = canonical_city(params.get("city"))
    cities = [city] if city else DEFAULT_CITIES.get(country, DEFAULT_CITIES["DE"])[:4]
    params.pop("urls", None)  # not used by this playbook (models sometimes invent some)
    params.update({"count": count, "country": country, "sector": sector, "city": city, "cities": cities})
    lang = COUNTRY_LANGUAGE.get(country, "en")
    steps = [
        {"title": f"Cerca attività ({sector}, {country}: {', '.join(cities)})",
         "tool": "sales_find_businesses",
         "args": {"sector": sector, "country": country, "cities": cities, "limit": count * 6}},
        {"title": "Analizza i siti web dei candidati", "tool": "sales_audit_leads",
         "args": {"limit": count * 4}, "depends_on": [1], "timeout_s": 3600},
        {"title": "Calcola il punteggio dei lead", "tool": "sales_score_leads", "args": {}, "depends_on": [2]},
        {"title": f"Seleziona i {count} migliori", "tool": "sales_qualify_top",
         "args": {"count": count}, "depends_on": [3]},
        {"title": "Prepara outreach personalizzato (bozze, nessun invio)", "tool": "sales_draft_outreach",
         "args": {"kinds": ["email", "call_script"], "language": lang}, "depends_on": [4], "timeout_s": 3600},
        {"title": "Scrivi il report della missione", "tool": "write_document",
         "args": {"title": f"Report acquisizione clienti — {sector} {country}",
                  "instructions": "Summarize the qualified prospects found, why each one is a fit "
                                  "(based only on the audit facts), and the recommended next actions. "
                                  "State clearly that no message has been sent.",
                  "language": "it"},
         "depends_on": [5], "optional": True},
        {"title": "Avvisa l'utente", "tool": "notify_user",
         "args": {"title": "Missione lead completata: bozze pronte da approvare", "level": "decision"},
         "depends_on": [5]},
    ]
    cond = (f"Almeno {count} lead di questa missione qualificati, con audit del sito "
            f"e almeno una bozza di contatto.")
    return steps, cond


def website_audit(params: dict[str, Any]) -> tuple[list[dict], str]:
    urls = [u for u in params.get("urls") or [] if u][:20]
    if not urls:
        raise ValueError("No website given to analyze")
    steps: list[dict] = [
        {"title": f"Analizza {u}", "tool": "sales_audit_url", "args": {"url": u}, "optional": len(urls) > 1}
        for u in urls
    ]
    steps.append({"title": "Scrivi il report di audit", "tool": "write_document",
                  "args": {"title": "Report audit siti web",
                           "instructions": "Write a clear website audit report for each analyzed site: "
                                           "main problems, opportunities, and a prioritized list of "
                                           "improvements VEYRO Web could offer. Use only the audit data.",
                           "language": "it"},
                  "depends_on": list(range(1, len(urls) + 1))})
    return steps, f"Esiste un audit per ciascuno dei {len(urls)} siti."


def dev_project(params: dict[str, Any], objective: str) -> tuple[list[dict], str]:
    name = (params.get("project_name") or "").strip() or "Nuovo progetto"
    files = [f for f in params.get("files") or [] if isinstance(f, str) and f.strip()][:8] or ["index.html"]
    params.update({"project_name": name, "files": files})
    steps: list[dict] = [{"title": f"Crea il progetto '{name}'", "tool": "dev_create_project",
                          "args": {"name": name, "description": objective[:2000]}}]
    for path in files:
        steps.append({"title": f"Scrivi {path}", "tool": "dev_generate_code", "depends_on": [1],
                      "args": {"project": name, "path": path,
                               "specification": f"{objective}\n\nWrite the complete content of {path}."},
                      "timeout_s": 1800})
    steps.append({"title": "Controlla i file del progetto", "tool": "dev_list_files", "args": {"project": name},
                  "depends_on": list(range(2, len(files) + 2))})
    return steps, f"Il progetto '{name}' contiene {', '.join(files)} non vuoti."


# ---------------------------------------------------------------- verifiers
def verify_lead_acquisition(services: Any, mission: dict[str, Any]) -> dict[str, Any]:
    target = int((mission.get("params") or {}).get("count") or 5)
    rows = services.db.query(
        "SELECT l.id, l.name, (SELECT COUNT(*) FROM drafts d WHERE d.lead_id = l.id) AS drafts "
        "FROM leads l WHERE l.mission_id = ? AND l.status = 'qualified' AND l.audit IS NOT NULL",
        (mission["id"],))
    ready = [r for r in rows if r["drafts"] > 0]
    return {"passed": len(ready) >= target,
            "check": f"lead qualificati con audit e bozza: {len(ready)} / {target}",
            "lead_ids": [r["id"] for r in ready]}


def verify_website_audit(services: Any, mission: dict[str, Any]) -> dict[str, Any]:
    urls = (mission.get("params") or {}).get("urls") or []
    tasks = services.missions.tasks(mission["id"])
    ok = [t for t in tasks if t["tool"] == "sales_audit_url" and t["status"] == "succeeded"]
    return {"passed": len(ok) == len(urls) and len(urls) > 0,
            "check": f"audit completati: {len(ok)} / {len(urls)}"}


def verify_dev_project(services: Any, mission: dict[str, Any]) -> dict[str, Any]:
    params = mission.get("params") or {}
    ws = services.workspaces
    try:
        present = {f["path"]: f["size"] for f in ws.files(params.get("project_name", ""))}
    except Exception:
        present = {}
    wanted = params.get("files") or []
    ok = [f for f in wanted if present.get(f, 0) > 0]
    return {"passed": len(ok) == len(wanted) and bool(wanted),
            "check": f"file presenti e non vuoti: {len(ok)} / {len(wanted)} (non è una verifica funzionale del codice)"}


VERIFIERS: dict[str, Callable[[Any, dict[str, Any]], dict[str, Any]]] = {
    "dev_project": verify_dev_project,
    "lead_acquisition": verify_lead_acquisition,
    "website_audit": verify_website_audit,
}
