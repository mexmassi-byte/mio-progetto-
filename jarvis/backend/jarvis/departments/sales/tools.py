"""Sales department tools (registered in the tool registry)."""

from __future__ import annotations

import asyncio
import smtplib
from email.message import EmailMessage
from typing import Any

from ...db.database import now_iso
from ...security.permissions import Permission
from ...tools.registry import ToolContext, ToolError, ToolRegistry
from .audit import audit_url
from .crm import DRAFT_KINDS, LEAD_STATUSES
from .discovery import SECTOR_TAGS, overpass_search
from .geo import canonical_city, city_coords
from .outreach import generate_draft
from .quality import CONTACT_PATHS, contact_links, extract_contacts
from .scoring import score_lead


def register(reg: ToolRegistry) -> None:
    @reg.tool(
        "sales_find_businesses",
        "Find real businesses of a sector in one or more cities using OpenStreetMap, and save them "
        "to the CRM as new leads (public business listings only).",
        {"type": "object", "properties": {
            "sector": {"type": "string", "enum": list(SECTOR_TAGS)},
            "country": {"type": "string", "maxLength": 2},
            "cities": {"type": "array", "items": {"type": "string"}},
            "limit": {"type": "integer", "default": 30, "minimum": 1, "maximum": 300},
        }, "required": ["sector", "cities"]},
        external=True, category="sales", timeout_s=900,
    )
    async def sales_find_businesses(ctx: ToolContext, sector: str, cities: list[str],
                                    country: str = "DE", limit: int = 30) -> dict:
        s = ctx.services.settings
        crm = ctx.services.crm
        done_cities: list[str] = list(ctx.checkpoint.get("done_cities", []))
        created = int(ctx.checkpoint.get("created", 0))
        found_total = int(ctx.checkpoint.get("found", 0))
        errors: list[str] = []
        per_city = max(10, limit)
        cities = [canonical_city(c) or c for c in cities]
        for city in cities[:10]:
            if city in done_cities:
                continue
            if created >= limit:
                break
            coords = city_coords(city)
            ctx.emit("research.location", city=city, country=country,
                     lat=coords[0] if coords else None, lon=coords[1] if coords else None, stage="search")
            ctx.emit("research.search", query=f"{sector} @ {city}", source="openstreetmap")
            try:
                items = await overpass_search([s.overpass_url, *s.overpass_fallback_urls], s.http_user_agent,
                                              sector, city, country, per_city * 3)
            except Exception as exc:  # network/rate limit: keep progress, report
                errors.append(f"{city}: {exc}")
                continue
            # Businesses with a website first: they can be audited.
            items.sort(key=lambda x: (x["website"] is None, x["email"] is None))
            found_total += len(items)
            for it in items:
                if created >= limit:
                    break
                lead, is_new = crm.upsert_from_source(it, ctx.mission_id)
                if is_new:
                    created += 1
                    if it.get("lat") and it.get("lon"):
                        ctx.emit("research.location", city=city, lat=it["lat"], lon=it["lon"],
                                 name=it["name"], stage="found")
            done_cities.append(city)
            ctx.checkpoint.update({"done_cities": done_cities, "created": created, "found": found_total})
            await asyncio.sleep(1.0)  # be gentle with the public Overpass server
        if created == 0 and errors:
            raise ToolError("Business search failed: " + "; ".join(errors)[:500])
        if found_total == 0:
            # Stop the mission here instead of auditing and drafting for nobody.
            raise ToolError(f"No '{sector}' businesses found in OpenStreetMap for: {', '.join(cities)}. "
                            "Check the city name or choose another city.", retryable=False)
        return {"created": created, "found": found_total, "cities": done_cities, "errors": errors,
                "source": "OpenStreetMap contributors (ODbL)"}

    @reg.tool(
        "sales_audit_leads",
        "Analyze the websites of this mission's leads that have not been audited yet.",
        {"type": "object", "properties": {
            "limit": {"type": "integer", "default": 20, "minimum": 1, "maximum": 200},
        }},
        external=True, category="sales", timeout_s=3600,
    )
    async def sales_audit_leads(ctx: ToolContext, limit: int = 20) -> dict:
        crm = ctx.services.crm
        leads = [l for l in crm.list(mission_id=ctx.mission_id) if l["website"] and not l["audit"]][:limit]
        ok, failed = 0, 0
        for lead in leads:
            ctx.emit("research.analyze", url=lead["website"], name=lead["name"],
                     lat=lead["lat"], lon=lead["lon"])
            try:
                result = await audit_url(lead["website"], ctx)
                ok += 1
            except ToolError as exc:
                result = {"error": str(exc)}
                failed += 1
            crm.update(lead["id"], actor="jarvis", audit=result, audited_at=now_iso(), status="audited",
                       next_action="calcolare punteggio")
            if result.get("contacts", {}).get("emails") and not lead["email"]:
                crm.update(lead["id"], actor="jarvis", email=result["contacts"]["emails"][0])
            ctx.emit("lead.audited", lead_id=lead["id"], opportunity=result.get("opportunity_score"))
        return {"audited": ok, "unreachable": failed, "remaining_without_audit":
                sum(1 for l in crm.list(mission_id=ctx.mission_id) if l["website"] and not l["audit"])}

    @reg.tool(
        "sales_audit_url",
        "Analyze one website (design, mobile, speed, calls to action, legal pages) and store the "
        "audit on the matching CRM lead if there is one.",
        {"type": "object", "properties": {"url": {"type": "string", "maxLength": 2000}}, "required": ["url"]},
        external=True, category="sales", timeout_s=180,
    )
    async def sales_audit_url(ctx: ToolContext, url: str) -> dict:
        ctx.emit("research.analyze", url=url)
        result = await audit_url(url, ctx)
        lead = ctx.services.crm.find_by_website(url)
        if lead:
            ctx.services.crm.update(lead["id"], actor="jarvis", audit=result, audited_at=now_iso())
        return {**result, "lead_id": lead["id"] if lead else None}

    @reg.tool(
        "sales_score_leads",
        "Compute the transparent 0–100 score for this mission's leads (or all unscored leads).",
        {"type": "object", "properties": {}},
        category="sales",
    )
    async def sales_score_leads(ctx: ToolContext) -> dict:
        crm = ctx.services.crm
        leads = crm.list(mission_id=ctx.mission_id) if ctx.mission_id else [l for l in crm.list() if l["score"] is None]
        ctx.emit("research.evaluate", count=len(leads))
        scores = []
        for lead in leads:
            total, parts = score_lead(lead)
            status = lead["status"] if lead["status"] not in ("new", "audited") else "scored"
            crm.update(lead["id"], actor="jarvis", score=total, score_breakdown=parts, status=status)
            scores.append(total)
        return {"scored": len(scores), "max": max(scores) if scores else None,
                "avg": round(sum(scores) / len(scores), 1) if scores else None}

    @reg.tool(
        "sales_qualify_top",
        "Mark the best-scoring leads of this mission as 'qualified' (needs a website audit).",
        {"type": "object", "properties": {
            "count": {"type": "integer", "default": 5, "minimum": 1, "maximum": 100},
            "min_score": {"type": "number", "default": 45},
        }},
        category="sales",
    )
    async def sales_qualify_top(ctx: ToolContext, count: int = 5, min_score: float = 45) -> dict:
        crm = ctx.services.crm
        candidates = [l for l in crm.list(mission_id=ctx.mission_id)
                      if l["score"] is not None and l["audit"] and not (l["audit"] or {}).get("error")
                      and l["status"] in ("scored", "audited", "new")]
        candidates.sort(key=lambda l: l["score"], reverse=True)
        chosen = [l for l in candidates if l["score"] >= min_score][:count]
        for l in chosen:
            crm.update(l["id"], actor="jarvis", status="qualified", next_action="rivedere bozze outreach")
        ctx.emit("research.done", qualified=len(chosen), target=count)
        return {"qualified": [{"id": l["id"], "name": l["name"], "score": l["score"]} for l in chosen],
                "target": count, "below_threshold": max(0, count - len(chosen)),
                "note": None if len(chosen) >= count else
                f"only {len(chosen)} leads reached the minimum score {min_score}"}

    @reg.tool(
        "sales_enrich_leads",
        "For this mission's qualified leads, read the public Impressum / contact page and add the "
        "business email, phone and the person responsible (legally required public information).",
        {"type": "object", "properties": {"max_pages": {"type": "integer", "default": 2, "minimum": 1, "maximum": 4}}},
        external=True, category="sales", timeout_s=1200,
    )
    async def sales_enrich_leads(ctx: ToolContext, max_pages: int = 2) -> dict:
        from urllib.parse import urljoin

        from ...tools.web import http_get, page_text
        crm = ctx.services.crm
        enriched = 0
        for lead in crm.list(status="qualified", mission_id=ctx.mission_id):
            if not lead["website"]:
                continue
            audit = lead["audit"] or {}
            pages: list[str] = []
            try:  # follow the site's own links: Impressum URLs are not predictable
                home = await http_get(lead["website"], ctx)
                from urllib.parse import urlparse
                pages = contact_links(page_text(home.text, str(home.url))["links"], urlparse(str(home.url)).netloc)
            except ToolError:
                pass
            pages += [p for p in [(audit.get("contacts") or {}).get("contact_page")] if p]
            pages += [urljoin(lead["website"].rstrip("/") + "/", path) for path in CONTACT_PATHS]
            found: dict = {"emails": [], "phones": [], "owner": None}
            for url in list(dict.fromkeys(pages))[: max_pages + 1]:
                try:
                    resp = await http_get(url, ctx)
                except ToolError:
                    continue
                if resp.status_code >= 400:
                    continue
                c = extract_contacts(page_text(resp.text, str(resp.url), 20000)["text"])
                found["emails"] += [e for e in c["emails"] if e not in found["emails"]]
                found["phones"] += [p for p in c["phones"] if p not in found["phones"]]
                found["owner"] = found["owner"] or c["owner"]
                if found["emails"] and found["owner"]:
                    break
            updates: dict = {}
            if found["emails"] and not lead["email"]:
                updates["email"] = found["emails"][0]
            if found["phones"] and not lead["phone"]:
                updates["phone"] = found["phones"][0]
            if found["owner"]:
                note = f"Responsabile (Impressum): {found['owner']}"
                if note not in (lead["notes"] or ""):
                    updates["notes"] = ((lead["notes"] or "") + "\n" + note).strip()
            if updates:
                crm.update(lead["id"], actor="jarvis", **updates)
                enriched += 1
                ctx.emit("lead.enriched", lead_id=lead["id"], fields=sorted(updates))
        return {"enriched": enriched}

    @reg.tool(
        "sales_draft_outreach",
        "Write personalized outreach DRAFTS (email, LinkedIn, call script, follow-up, audit report, "
        "proposal) for qualified leads. Nothing is sent.",
        {"type": "object", "properties": {
            "kinds": {"type": "array", "items": {"type": "string", "enum": list(DRAFT_KINDS)}},
            "language": {"type": "string", "default": "de"},
            "lead_ids": {"type": "array", "items": {"type": "string"}},
        }},
        category="sales", timeout_s=3600,
    )
    async def sales_draft_outreach(ctx: ToolContext, kinds: list[str] | None = None, language: str = "de",
                                   lead_ids: list[str] | None = None) -> dict:
        svc = ctx.services
        kinds = [k for k in (kinds or ["email"]) if k in DRAFT_KINDS]
        if lead_ids:
            leads = [l for l in (svc.crm.get(i) for i in lead_ids) if l]
        else:
            leads = svc.crm.list(status="qualified", mission_id=ctx.mission_id)
        knowledge = svc.knowledge.all_text(3000)
        made, by = 0, set()
        done_ids = set(ctx.checkpoint.get("done", []))
        for lead in leads:
            if lead["id"] in done_ids:
                continue
            for kind in kinds:
                subject, body, gen = await generate_draft(svc.llm, lead, kind, language, knowledge,
                                                          svc.settings.user_name, svc.settings.company_name)
                svc.crm.add_draft(lead["id"], kind, language, body, subject, gen)
                made += 1
                by.add(gen)
            done_ids.add(lead["id"])
            ctx.checkpoint["done"] = sorted(done_ids)
        return {"drafts_created": made, "leads": len(leads), "generated_by": sorted(by), "sent": 0}

    @reg.tool(
        "crm_list_leads",
        "List CRM leads with score and status.",
        {"type": "object", "properties": {
            "status": {"type": "string", "enum": list(LEAD_STATUSES)},
            "limit": {"type": "integer", "default": 20, "minimum": 1, "maximum": 100},
        }},
        category="sales", plannable=False,
    )
    async def crm_list_leads(ctx: ToolContext, status: str | None = None, limit: int = 20) -> dict:
        leads = ctx.services.crm.list(status=status, limit=limit)
        return {"leads": [{"id": l["id"], "name": l["name"], "city": l["city"], "sector": l["sector"],
                           "score": l["score"], "status": l["status"], "website": l["website"]} for l in leads],
                "stats": ctx.services.crm.stats()}

    @reg.tool(
        "send_email",
        "Send an approved outreach draft by email through the user's own SMTP mailbox. Always requires "
        "the user's approval. The user must have confirmed a legal basis for contacting this lead.",
        {"type": "object", "properties": {"draft_id": {"type": "string"}, "to": {"type": "string"}},
         "required": ["draft_id", "to"]},
        permission=Permission.APPROVAL, external=True, category="sales", plannable=False, timeout_s=60,
    )
    async def send_email(ctx: ToolContext, draft_id: str, to: str) -> dict:
        s = ctx.services.settings
        if not (s.smtp_host and s.smtp_from):
            raise ToolError("Email sending is not configured (JARVIS_SMTP_HOST / JARVIS_SMTP_FROM)", retryable=False)
        draft = ctx.services.crm.draft(draft_id)
        if not draft:
            raise ToolError("Draft not found", retryable=False)
        if "[VORLAGE" in draft["body"] or "[BOZZA DA MODELLO" in draft["body"]:
            raise ToolError("This is an unedited template: review it before sending", retryable=False)
        msg = EmailMessage()
        msg["From"] = s.smtp_from
        msg["To"] = to
        msg["Subject"] = draft["subject"] or ""
        msg.set_content(draft["body"])

        def _send() -> None:
            with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=30) as smtp:
                smtp.starttls()
                if s.smtp_user and s.smtp_password:
                    smtp.login(s.smtp_user, s.smtp_password)
                smtp.send_message(msg)

        try:
            await asyncio.to_thread(_send)
        except (smtplib.SMTPException, OSError) as exc:
            raise ToolError(f"SMTP error: {exc}") from exc
        ctx.services.crm.update_draft(draft_id, status="sent")
        if draft["lead_id"]:
            ctx.services.crm.add_interaction(draft["lead_id"], "email", "out", draft["subject"] or "(email)", draft_id)
            ctx.services.crm.update(draft["lead_id"], actor=ctx.actor, status="contacted",
                                    next_action="attendere risposta / follow-up tra 5 giorni")
        return {"sent": True, "to": to}
