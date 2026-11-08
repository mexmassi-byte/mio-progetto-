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


def build_query(sector: str, city: str, limit: int, coords: tuple[float, float] | None = None,
                radius_m: int = 9000) -> str:
    """Overpass query. With known city coordinates a radius search is used: much
    lighter for the server than resolving the administrative area, and it cannot
    confuse two cities with the same name."""
    tags = SECTOR_TAGS.get(sector, SECTOR_TAGS["other"])
    if coords:
        lat, lon = coords
        selectors = "\n".join(f'  nwr["{k}"="{v}"](around:{int(radius_m)},{lat:.5f},{lon:.5f});' for k, v in tags)
        return f"[out:json][timeout:90];\n(\n{selectors}\n);\nout center tags {int(limit)};"
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


async def overpass_search(overpass_url: str | list[str], user_agent: str, sector: str, city: str,
                          country: str, limit: int, timeout_s: float = 120.0) -> list[dict[str, Any]]:
    """Query Overpass, trying each server in turn until one answers."""
    from .geo import city_coords

    urls = [overpass_url] if isinstance(overpass_url, str) else list(overpass_url)
    query = build_query(sector, city, limit, city_coords(city))
    errors: list[str] = []
    async with httpx.AsyncClient(timeout=timeout_s, headers={"User-Agent": user_agent}) as client:
        for url in urls:
            try:
                resp = await client.post(url, data={"data": query})
            except httpx.HTTPError as exc:
                errors.append(f"{url}: {exc.__class__.__name__}")
                continue
            if resp.status_code in (429, 502, 503, 504):
                errors.append(f"{url}: HTTP {resp.status_code}")
                continue
            if resp.status_code >= 400:
                errors.append(f"{url}: HTTP {resp.status_code}")
                continue
            try:
                return parse_elements(resp.json(), sector, city, country)
            except ValueError:
                errors.append(f"{url}: invalid JSON")
    raise RuntimeError("No Overpass server answered: " + "; ".join(errors))
