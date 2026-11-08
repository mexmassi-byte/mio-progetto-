"""Business discovery from OpenStreetMap (Overpass API).

OSM data is public and openly licensed (ODbL: attribution required, which
the CRM keeps in the ``source`` field). Only business listings are used, no
private individuals. The public Overpass servers are a shared resource: keep
requests small and infrequent.
"""

from __future__ import annotations

from typing import Any

import httpx

SECTOR_TAGS: dict[str, list[tuple[str, str]]] = {
    "lawyer": [("office", "lawyer")],
    "dentist": [("amenity", "dentist"), ("healthcare", "dentist")],
    "clinic": [("amenity", "clinic"), ("healthcare", "clinic"), ("amenity", "doctors")],
    "aesthetic": [("shop", "beauty"), ("healthcare", "cosmetic_surgery")],
    "tax_advisor": [("office", "tax_advisor"), ("office", "accountant")],
    "physiotherapist": [("healthcare", "physiotherapist")],
    "architect": [("office", "architect")],
    "notary": [("office", "notary")],
    "other": [("office", "company")],
}


def build_query(sector: str, city: str, limit: int) -> str:
    tags = SECTOR_TAGS.get(sector, SECTOR_TAGS["other"])
    safe_city = city.replace('"', "").replace("\\", "")
    selectors = "\n".join(f'  nwr["{k}"="{v}"](area.a);' for k, v in tags)
    return (
        "[out:json][timeout:90];\n"
        f'area["name"="{safe_city}"]["boundary"="administrative"]["admin_level"~"^(4|5|6|7|8)$"]->.a;\n'
        f"(\n{selectors}\n);\n"
        f"out center tags {int(limit)};"
    )


def parse_elements(data: dict[str, Any], sector: str, city: str, country: str) -> list[dict[str, Any]]:
    out = []
    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name")
        if not name:
            continue
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        website = tags.get("website") or tags.get("contact:website") or tags.get("url")
        if website and not website.startswith("http"):
            website = "https://" + website.lstrip("/")
        street = " ".join(x for x in (tags.get("addr:street"), tags.get("addr:housenumber")) if x)
        town = " ".join(x for x in (tags.get("addr:postcode"), tags.get("addr:city") or city) if x)
        out.append({
            "name": name.strip()[:200],
            "website": website,
            "email": tags.get("email") or tags.get("contact:email"),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "address": ", ".join(x for x in (street, town) if x) or None,
            "city": tags.get("addr:city") or city,
            "country": (tags.get("addr:country") or country or "").upper() or None,
            "sector": sector,
            "lat": lat, "lon": lon,
            "source": "osm",
            "source_ref": f"{el.get('type')}/{el.get('id')}",
        })
    return out


async def overpass_search(overpass_url: str, user_agent: str, sector: str, city: str,
                          country: str, limit: int, timeout_s: float = 120.0) -> list[dict[str, Any]]:
    query = build_query(sector, city, limit)
    async with httpx.AsyncClient(timeout=timeout_s, headers={"User-Agent": user_agent}) as client:
        resp = await client.post(overpass_url, data={"data": query})
    if resp.status_code == 429:
        raise RuntimeError("Overpass rate limit reached (429): retry later")
    resp.raise_for_status()
    return parse_elements(resp.json(), sector, city, country)
