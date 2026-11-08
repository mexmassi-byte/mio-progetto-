"""Code checks on outreach drafts and contact extraction from Impressum pages.

Small local models make predictable mistakes (wrong language, placeholders,
forgetting who they write to). These checks catch them without another model.
"""

from __future__ import annotations

import re
from typing import Any

STOPWORDS = {
    "de": {"und", "der", "die", "das", "sie", "ihre", "ihr", "mit", "für", "nicht", "wir", "ist", "eine", "auf",
           "zu", "den", "von", "ich", "gerne", "grüßen", "website"},
    "it": {"il", "la", "che", "di", "per", "con", "non", "un", "una", "sono", "vostro", "suo", "del", "della",
           "cordiali", "saluti", "sito"},
    "en": {"the", "and", "you", "your", "with", "for", "not", "we", "is", "our", "this", "that", "regards"},
}
LENGTH = {"email": (250, 1800), "followup": (120, 1100), "linkedin": (60, 400), "call_script": (200, 3500),
          "audit_report": (300, 8000), "proposal": (300, 8000)}
PLACEHOLDER = re.compile(r"\[(?!DA DEFINIRE)[^\]]{0,40}\]|\{[^}]{0,40}\}|\bTODO\b|lorem ipsum|XXX|<[a-z]+>", re.I)


def detect_language(text: str) -> str | None:
    words = re.findall(r"[a-zäöüßàèéìòù]+", text.lower())
    if not words:
        return None
    scores = {lang: sum(1 for w in words if w in sw) for lang, sw in STOPWORDS.items()}
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] >= 3 else None


def check_draft(kind: str, language: str, subject: str | None, body: str, lead: dict[str, Any]) -> list[str]:
    """Problems found in a draft (empty list = acceptable)."""
    problems: list[str] = []
    text = f"{subject or ''}\n{body}"
    lo, hi = LENGTH.get(kind, (100, 6000))
    if len(body) < lo:
        problems.append(f"too short ({len(body)} characters, minimum {lo})")
    if len(body) > hi:
        problems.append(f"too long ({len(body)} characters, maximum {hi})")
    lang = detect_language(body)
    if lang and lang != language:
        problems.append(f"written in '{lang}' but must be entirely in '{language}'")
    if PLACEHOLDER.search(text):
        problems.append(f"contains a placeholder: {PLACEHOLDER.search(text).group(0)!r}")
    name = (lead.get("name") or "").strip()
    if kind in ("email", "linkedin", "proposal", "audit_report") and name:
        key_words = [w for w in re.findall(r"[\wäöüß]{4,}", name.lower())
                     if w not in {"praxis", "zahnarzt", "zahnarztpraxis", "kanzlei", "studio", "dent", "med"}]
        if key_words and not any(w in text.lower() for w in key_words):
            problems.append(f"does not mention the business ('{name}')")
    if lead.get("website") and lead["website"].split("//")[-1].strip("/") in body and "our website" in body.lower():
        problems.append("confuses the recipient's website with ours")
    return problems


# ------------------------------------------------------------ contact pages
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}")
PHONE_RE = re.compile(r"(?:Tel(?:efon)?|Phone|Telefono|Fon)\.?\s*:?\s*(\+?[\d][\d\s/().-]{6,20}\d)", re.I)
OWNER_RE = re.compile(
    r"(?:Inhaber(?:in)?|Vertreten durch|Geschäftsführer(?:in)?|Praxisinhaber(?:in)?|Verantwortlich[^:]{0,40}"
    r"|Titolare|Legale rappresentante)\s*:?\s*((?:Dr\.\s*(?:med\.\s*(?:dent\.\s*)?)?)?[A-ZÄÖÜ][\w.\- äöüß]{2,60}?)"
    r"(?=\s+(?:Tel|Telefon|E-?Mail|Anschrift|Adresse|Straße|Str\.|USt|Kammer|Zuständige|Berufs)|[,;|]|$)")
CONTACT_PATHS = ("impressum", "kontakt", "contact", "contatti", "imprint")
CONTACT_LINK_RE = re.compile(r"impressum|imprint|kontakt|contact|contatti|chi-siamo|team|ueber-uns|uber-uns", re.I)
DOCTOR_RE = re.compile(r"\bDr\.\s*(?:med\.\s*)?(?:dent\.\s*)?(?:univ\.\s*)?[A-ZÄÖÜ][a-zäöüß]+(?:[\s-]+[A-ZÄÖÜ][a-zäöüß]+)")


def contact_links(links: list[dict[str, str]], base_host: str) -> list[str]:
    """Same-site links to Impressum / contact pages, Impressum first."""
    from urllib.parse import urlparse
    found = []
    for link in links:
        url = link.get("url", "")
        if urlparse(url).netloc.removeprefix("www.") != base_host.removeprefix("www."):
            continue
        if CONTACT_LINK_RE.search(url) or CONTACT_LINK_RE.search(link.get("text", "")):
            if url not in found:
                found.append(url)
    return sorted(found, key=lambda u: (0 if re.search("impressum|imprint", u, re.I) else 1, len(u)))
IGNORED_EMAIL_DOMAINS = ("example.com", "sentry.io", "wixpress.com", "domain.de", "email.de")


def extract_contacts(text: str) -> dict[str, Any]:
    emails = sorted({e.lower() for e in EMAIL_RE.findall(text)
                     if not e.lower().endswith((".png", ".jpg", ".svg", ".webp"))
                     and not any(e.lower().endswith(d) for d in IGNORED_EMAIL_DOMAINS)})[:5]
    phones = []
    for p in PHONE_RE.findall(text):
        p = " ".join(p.split())
        if p not in phones:
            phones.append(p)
    owner = None
    m = OWNER_RE.search(text)
    if m:
        owner = " ".join(m.group(1).split()).strip(" .,-")
    else:  # no label: the first doctor's full name on an Impressum page is usually the owner
        d = DOCTOR_RE.search(text)
        if d:
            owner = " ".join(d.group(0).split())
    return {"emails": emails, "phones": phones[:3], "owner": owner}
