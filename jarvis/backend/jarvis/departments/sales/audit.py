"""Website audit.

``analyze_html`` is a pure function (fully testable offline). ``audit_url``
fetches the page, measures timing, and optionally adds a real-browser mobile
check through Playwright when it is installed.

Each check has: id, label, status (pass / warn / fail / info), detail and the
weight it adds to the *opportunity score* (0–100, higher = the site needs
VEYRO Web more). Only observed facts are reported.
"""

from __future__ import annotations

import re
import time
from datetime import datetime
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

BOOKING_WORDS = ("termin", "buchen", "booking", "prenota", "appuntamento", "doctolib", "jameda",
                 "miodottore", "online-termin", "book now", "reserve")
CONTACT_WORDS = ("kontakt", "contact", "contatt", "anfrage", "richiedi", "get in touch")
GENERATORS = ("wordpress", "wix", "jimdo", "joomla", "drupal", "typo3", "squarespace", "webflow",
              "shopify", "weebly", "ionos", "strato", "1&1")
PLATFORM_MARKERS = (("wordpress", "wp-content"), ("wix", "static.wixstatic.com"), ("jimdo", "jimdo"),
                    ("squarespace", "squarespace"), ("webflow", "webflow"), ("shopify", "cdn.shopify"),
                    ("joomla", "/media/jui/"), ("typo3", "typo3"))

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}")
YEAR_RE = re.compile(r"(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})", re.IGNORECASE)
JQUERY_RE = re.compile(r"jquery[.-]?(\d)\.(\d+)", re.IGNORECASE)


def _check(cid: str, label: str, status: str, detail: str, weight: int = 0) -> dict[str, Any]:
    return {"id": cid, "label": label, "status": status, "detail": detail, "weight": weight}


def analyze_html(html: str, url: str, *, status_code: int = 200, elapsed_ms: int | None = None,
                 size_bytes: int | None = None, headers: dict[str, str] | None = None,
                 now_year: int | None = None) -> dict[str, Any]:
    now_year = now_year or datetime.now().year
    headers = {k.lower(): v for k, v in (headers or {}).items()}
    soup = BeautifulSoup(html, "html.parser")
    low = html.lower()
    text = " ".join(soup.get_text(" ").split())
    checks: list[dict[str, Any]] = []

    # --- reachability / transport
    if status_code >= 400:
        checks.append(_check("status", "Pagina raggiungibile", "fail", f"HTTP {status_code}", 30))
    https = urlparse(url).scheme == "https"
    checks.append(_check("https", "HTTPS", "pass" if https else "fail",
                         "connessione cifrata" if https else "il sito non usa HTTPS", 0 if https else 15))
    if elapsed_ms is not None:
        st, w = ("pass", 0) if elapsed_ms < 1500 else ("warn", 5) if elapsed_ms < 3500 else ("fail", 12)
        checks.append(_check("speed", "Tempo di risposta", st, f"{elapsed_ms} ms (HTML iniziale)", w))
    if size_bytes is not None:
        kb = size_bytes / 1024
        st, w = ("pass", 0) if kb < 600 else ("warn", 3) if kb < 2000 else ("fail", 6)
        checks.append(_check("weight", "Peso HTML", st, f"{kb:.0f} KB", w))

    # --- mobile
    viewport = soup.find("meta", attrs={"name": re.compile("^viewport$", re.I)})
    checks.append(_check("viewport", "Ottimizzato per mobile (meta viewport)",
                         "pass" if viewport else "fail",
                         viewport.get("content", "") if viewport else "manca: probabilmente non responsive",
                         0 if viewport else 18))

    # --- content basics / SEO
    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    checks.append(_check("title", "Titolo pagina", "pass" if 10 <= len(title) <= 70 else "warn",
                         title[:90] or "assente", 0 if 10 <= len(title) <= 70 else 3))
    desc = soup.find("meta", attrs={"name": re.compile("^description$", re.I)})
    desc_text = (desc.get("content") or "").strip() if desc else ""
    checks.append(_check("meta_description", "Meta description", "pass" if desc_text else "warn",
                         desc_text[:140] or "assente", 0 if desc_text else 4))
    h1 = soup.find_all("h1")
    checks.append(_check("h1", "Titolo principale (H1)", "pass" if len(h1) == 1 else "warn",
                         f"{len(h1)} H1 trovati", 0 if len(h1) == 1 else 3))
    lang = (soup.html.get("lang") if soup.html else None) or ""
    checks.append(_check("lang", "Lingua dichiarata", "pass" if lang else "warn", lang or "assente",
                         0 if lang else 1))
    imgs = soup.find_all("img")
    no_alt = [i for i in imgs if not (i.get("alt") or "").strip()]
    if imgs:
        ratio = len(no_alt) / len(imgs)
        checks.append(_check("img_alt", "Immagini con testo alternativo",
                             "pass" if ratio < 0.2 else "warn",
                             f"{len(no_alt)}/{len(imgs)} senza alt", 0 if ratio < 0.2 else 3))
    ld = soup.find_all("script", attrs={"type": "application/ld+json"})
    checks.append(_check("schema", "Dati strutturati (schema.org)", "pass" if ld else "warn",
                         f"{len(ld)} blocchi" if ld else "assenti", 0 if ld else 3))
    og = soup.find("meta", attrs={"property": "og:title"})
    checks.append(_check("og", "Anteprima social (Open Graph)", "pass" if og else "warn",
                         "presente" if og else "assente", 0 if og else 2))

    # --- conversion
    links = [a.get("href", "") for a in soup.find_all("a", href=True)]
    tel = [h for h in links if h.lower().startswith("tel:")]
    mailto = [h for h in links if h.lower().startswith("mailto:")]
    forms = soup.find_all("form")
    booking = any(w in low for w in BOOKING_WORDS)
    contact_link = any(any(w in (a.get_text(" ") + " " + a.get("href", "")).lower() for w in CONTACT_WORDS)
                       for a in soup.find_all("a", href=True))
    cta_score = sum([bool(tel), bool(mailto), bool(forms), booking, contact_link])
    checks.append(_check("cta", "Inviti all'azione (telefono, email, modulo, prenotazione)",
                         "pass" if cta_score >= 3 else "warn" if cta_score >= 1 else "fail",
                         f"tel:{len(tel)} mailto:{len(mailto)} moduli:{len(forms)} "
                         f"prenotazione:{'sì' if booking else 'no'} contatti:{'sì' if contact_link else 'no'}",
                         0 if cta_score >= 3 else 6 if cta_score >= 1 else 12))

    # --- legal (DE/IT)
    impressum = "impressum" in low
    privacy = any(w in low for w in ("datenschutz", "privacy", "informativa"))
    cookie = "cookie" in low
    checks.append(_check("legal", "Pagine legali (Impressum / Privacy)",
                         "pass" if privacy else "warn",
                         f"impressum:{'sì' if impressum else 'no'} privacy:{'sì' if privacy else 'no'}",
                         0 if privacy else 4))
    checks.append(_check("cookie", "Gestione cookie", "pass" if cookie else "info",
                         "riferimenti ai cookie presenti" if cookie else "nessun riferimento trovato", 0))

    # --- freshness / technology
    years = [int(y) for y in YEAR_RE.findall(html) if 1995 <= int(y) <= now_year + 1]
    if years:
        latest = max(years)
        age = now_year - latest
        checks.append(_check("copyright", "Anno nel footer", "pass" if age <= 1 else "warn" if age <= 3 else "fail",
                             f"© {latest}", 0 if age <= 1 else 4 if age <= 3 else 8))
    gen_meta = soup.find("meta", attrs={"name": re.compile("^generator$", re.I)})
    generator = (gen_meta.get("content") or "") if gen_meta else ""
    platform = next((g for g in GENERATORS if g in generator.lower()), None) if generator else None
    if not platform:
        platform = next((name for name, marker in PLATFORM_MARKERS if marker in low), None)
    checks.append(_check("platform", "Piattaforma", "info", generator or platform or "non identificata", 0))
    jq = JQUERY_RE.search(low)
    if jq and int(jq.group(1)) < 3:
        checks.append(_check("jquery", "Librerie obsolete", "warn", f"jQuery {jq.group(1)}.{jq.group(2)}", 3))
    legacy = [t for t in ("<font", "<marquee", "<center>", "<frameset", ".swf") if t in low]
    if legacy:
        checks.append(_check("legacy", "Codice HTML datato", "fail", ", ".join(legacy), 8))
    if https:
        mixed = [s for s in re.findall(r'(?:src|href)=["\'](http://[^"\']+)', html, re.I)
                 if not s.startswith("http://www.w3.org")]
        if mixed:
            checks.append(_check("mixed", "Contenuti non sicuri su HTTPS", "warn",
                                 f"{len(mixed)} risorse http://", 3))
    if "strict-transport-security" not in headers and https:
        checks.append(_check("hsts", "Header di sicurezza (HSTS)", "info", "assente", 0))

    # --- contacts (public, from the site itself)
    emails = sorted({m.lower() for m in EMAIL_RE.findall(" ".join(mailto) + " " + text)
                     if not m.lower().endswith((".png", ".jpg", ".gif", ".webp", ".svg"))})[:5]
    phones = sorted({t[4:].strip() for t in tel})[:3]
    contact_page = None
    for a in soup.find_all("a", href=True):
        label = (a.get_text(" ") + " " + a["href"]).lower()
        if any(w in label for w in CONTACT_WORDS + ("impressum",)):
            contact_page = urljoin(url, a["href"])
            break

    opportunity = min(100, sum(c["weight"] for c in checks))
    problems = [c for c in checks if c["status"] in ("fail", "warn")]
    return {
        "url": url,
        "title": title,
        "checks": checks,
        "problems": [f"{c['label']}: {c['detail']}" for c in problems],
        "fail_count": sum(1 for c in checks if c["status"] == "fail"),
        "warn_count": sum(1 for c in checks if c["status"] == "warn"),
        "opportunity_score": opportunity,
        "contacts": {"emails": emails, "phones": phones, "contact_page": contact_page},
        "platform": generator or platform,
        "metrics": {"elapsed_ms": elapsed_ms, "size_bytes": size_bytes, "status_code": status_code,
                    "images": len(imgs), "links": len(links)},
        "analyzed_at": datetime.now().isoformat(timespec="seconds"),
        "method": "html",
    }


async def audit_url(url: str, ctx: Any) -> dict[str, Any]:
    from ...tools.web import http_get

    start = time.perf_counter()
    resp = await http_get(url, ctx)
    elapsed = int((time.perf_counter() - start) * 1000)
    result = analyze_html(resp.text, str(resp.url), status_code=resp.status_code, elapsed_ms=elapsed,
                          size_bytes=len(resp.content), headers=dict(resp.headers))
    result["requested_url"] = url
    browser = await browser_mobile_check(str(resp.url), ctx)
    if browser:
        result["browser"] = browser
        result["method"] = "html+browser"
        if browser.get("horizontal_overflow"):
            result["checks"].append(_check("overflow", "Layout mobile (390px)", "fail",
                                           f"la pagina è larga {browser['scroll_width']}px su uno schermo di 390px", 10))
            result["opportunity_score"] = min(100, result["opportunity_score"] + 10)
            result["problems"].append("Layout mobile: contenuto più largo dello schermo")
    return result


async def browser_mobile_check(url: str, ctx: Any) -> dict[str, Any] | None:
    """Real-browser check (Playwright). Returns None if Playwright is not installed."""
    try:
        from playwright.async_api import async_playwright  # type: ignore
    except ImportError:
        return None
    shots = ctx.services.settings.data_dir / "screenshots"
    shots.mkdir(parents=True, exist_ok=True)
    name = re.sub(r"[^a-z0-9]+", "-", urlparse(url).netloc.lower()).strip("-") or "site"
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            try:
                page = await browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1,
                                              user_agent=ctx.services.settings.http_user_agent)
                t0 = time.perf_counter()
                await page.goto(url, wait_until="load", timeout=30000)
                load_ms = int((time.perf_counter() - t0) * 1000)
                sw = await page.evaluate("document.documentElement.scrollWidth")
                path = shots / f"{name}-mobile.png"
                await page.screenshot(path=str(path))
            finally:
                await browser.close()
    except Exception as exc:  # browser problems must not fail the audit
        return {"error": str(exc)[:200]}
    return {"load_ms": load_ms, "scroll_width": sw, "horizontal_overflow": sw > 400,
            "screenshot": str(path.relative_to(ctx.services.settings.data_dir))}
