"""Transparent lead scoring (0–100). Every point has a written reason."""

from __future__ import annotations

from typing import Any

SECTOR_VALUE = {
    "dentist": 20, "clinic": 20, "lawyer": 18, "aesthetic": 16, "tax_advisor": 16,
    "notary": 15, "physiotherapist": 12, "architect": 12, "other": 8,
}


def score_lead(lead: dict[str, Any]) -> tuple[float, list[dict[str, Any]]]:
    parts: list[dict[str, Any]] = []
    audit = lead.get("audit") or {}

    # 1) Website need (0–50): the worse the site, the bigger the opportunity.
    if not lead.get("website"):
        parts.append({"criterion": "need", "points": 40, "reason": "nessun sito web registrato"})
    elif audit.get("error"):
        parts.append({"criterion": "need", "points": 30, "reason": f"sito non raggiungibile: {audit['error'][:80]}"})
    elif audit:
        pts = round(min(50, audit.get("opportunity_score", 0) * 0.5), 1)
        parts.append({"criterion": "need", "points": pts,
                      "reason": f"opportunità audit {audit.get('opportunity_score', 0)}/100 "
                                f"({audit.get('fail_count', 0)} problemi gravi, {audit.get('warn_count', 0)} avvisi)"})
    else:
        parts.append({"criterion": "need", "points": 0, "reason": "sito non ancora analizzato"})

    # 2) Sector value (0–20)
    sector = lead.get("sector") or "other"
    parts.append({"criterion": "sector", "points": SECTOR_VALUE.get(sector, 8),
                  "reason": f"valore medio cliente nel settore '{sector}'"})

    # 3) Contactability via public business channels (0–15)
    contacts = audit.get("contacts") or {}
    pts, why = 0, []
    if lead.get("email") or contacts.get("emails"):
        pts += 8
        why.append("email pubblica")
    if lead.get("phone") or contacts.get("phones"):
        pts += 4
        why.append("telefono pubblico")
    if contacts.get("contact_page"):
        pts += 3
        why.append("pagina contatti/impressum")
    parts.append({"criterion": "contact", "points": pts, "reason": ", ".join(why) or "nessun contatto pubblico"})

    # 4) Data quality (0–15)
    pts, why = 0, []
    if lead.get("address"):
        pts += 5
        why.append("indirizzo")
    if audit and not audit.get("error") and (audit.get("metrics") or {}).get("status_code", 200) < 400:
        pts += 5
        why.append("sito verificato raggiungibile")
    if lead.get("name") and len(lead["name"]) > 2:
        pts += 5
        why.append("nome attività")
    parts.append({"criterion": "data", "points": pts, "reason": ", ".join(why) or "dati scarsi"})

    total = round(sum(p["points"] for p in parts), 1)
    return total, parts
