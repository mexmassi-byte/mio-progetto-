"""Personalized outreach drafts, based only on observed audit facts.

Drafts are never sent automatically. If no language model is available, a
clearly marked template is used instead of pretending.
"""

from __future__ import annotations

from typing import Any

from ...llm.base import LLMError, LLMProvider, Message
from ...prompts import POLICY

KIND_INSTRUCTIONS = {
    "email": "A short first-contact email (max 140 words) with a subject line. Mention 2-3 concrete "
             "observations from the audit, one clear benefit, and a soft call to action (a short call). "
             "No exaggerations, no fake urgency.",
    "linkedin": "A LinkedIn connection message (max 300 characters). Friendly, one observation.",
    "call_script": "A phone call script: opener (who we are, why we call), 2 questions, 2 observations "
                   "from the audit, how to handle 'not interested', and the closing. Bullet points.",
    "followup": "A polite follow-up email (max 90 words) referring to the previous message.",
    "audit_report": "A one-page website audit report for the business owner: summary, top problems "
                    "with their impact, prioritized recommendations.",
    "proposal": "A commercial proposal outline: situation, goals, proposed solution, phases, what is "
                "included, next step. Leave prices as [DA DEFINIRE] unless provided in the knowledge.",
}

LANG_NAMES = {"de": "German", "it": "Italian", "en": "English"}

DRAFT_SCHEMA = {"type": "object", "properties": {"subject": {"type": "string"}, "body": {"type": "string"}},
                "required": ["body"]}


def facts_for(lead: dict[str, Any]) -> str:
    audit = lead.get("audit") or {}
    lines = [
        f"Business: {lead.get('name')}", f"Sector: {lead.get('sector')}", f"City: {lead.get('city')}",
        f"Website: {lead.get('website') or 'none'}",
    ]
    if audit and not audit.get("error"):
        lines.append("Observed website problems (verified by automatic audit):")
        lines += [f"- {p}" for p in audit.get("problems", [])[:8]] or ["- none significant"]
        lines.append(f"Platform: {audit.get('platform') or 'unknown'}")
    elif audit.get("error"):
        lines.append(f"Website could not be loaded: {audit['error']}")
    return "\n".join(lines)


async def generate_draft(llm: LLMProvider | None, lead: dict[str, Any], kind: str, language: str,
                         company_knowledge: str, sender: str, company: str) -> tuple[str | None, str, str]:
    """Return (subject, body, generated_by)."""
    if llm is not None:
        msgs = [
            Message("system",
                    f"You write sales outreach for {company}, a web design and development agency. "
                    f"Sender: {sender}. Write in {LANG_NAMES.get(language, language)}. "
                    "Use ONLY the facts given; never invent numbers, results or customer names. "
                    "Return JSON with 'subject' (may be empty) and 'body'.\n" + POLICY),
            Message("user", f"Draft type: {kind}\nInstructions: {KIND_INSTRUCTIONS[kind]}\n\n"
                            f"FACTS\n{facts_for(lead)}\n\nCOMPANY KNOWLEDGE\n{company_knowledge[:2500]}"),
        ]
        try:
            data = await llm.chat_json(msgs, DRAFT_SCHEMA)
            if isinstance(data, dict) and str(data.get("body", "")).strip():
                return (str(data.get("subject") or "") or None), str(data["body"]).strip(), f"llm:{llm.model}"
        except LLMError:
            pass
    subject, body = template_draft(lead, kind, language, sender, company)
    return subject, body, "template"


def template_draft(lead: dict[str, Any], kind: str, language: str, sender: str, company: str) -> tuple[str | None, str]:
    problems = ((lead.get("audit") or {}).get("problems") or [])[:3]
    name = lead.get("name") or ""
    if language == "de":
        obs = "\n".join(f"- {p}" for p in problems) or "- (keine automatischen Beobachtungen)"
        subject = f"Kurze Beobachtung zur Website von {name}"
        body = (f"[VORLAGE – bitte prüfen und anpassen]\n\nGuten Tag,\n\nbei einem Blick auf Ihre Website "
                f"sind uns folgende Punkte aufgefallen:\n{obs}\n\nWir von {company} helfen Kanzleien und Praxen, "
                f"ihre Website moderner und mobilfreundlicher zu machen. Hätten Sie Interesse an einem kurzen "
                f"Gespräch von 15 Minuten?\n\nMit freundlichen Grüßen\n{sender}\n{company}")
    else:
        obs = "\n".join(f"- {p}" for p in problems) or "- (nessuna osservazione automatica)"
        subject = f"Una breve osservazione sul sito di {name}"
        body = (f"[BOZZA DA MODELLO – da rivedere]\n\nBuongiorno,\n\nguardando il vostro sito abbiamo notato:\n"
                f"{obs}\n\nCon {company} aiutiamo studi e attività professionali a rendere il sito più moderno, "
                f"veloce e adatto al mobile. Avreste 15 minuti per una breve chiamata?\n\nCordiali saluti\n"
                f"{sender}\n{company}")
    if kind == "call_script":
        subject = None
        body = ("[BOZZA DA MODELLO]\n1. Presentazione: chi siamo e perché chiamiamo.\n"
                "2. Domanda: il sito vi porta richieste di clienti?\n"
                "3. Osservazioni:\n" + "\n".join(f"   - {p}" for p in problems) +
                "\n4. Se non interessati: ringraziare, chiedere se possiamo inviare l'audit via email.\n"
                "5. Chiusura: proporre 15 minuti di call.")
    return subject, body
