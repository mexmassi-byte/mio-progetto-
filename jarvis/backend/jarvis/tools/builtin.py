"""General-purpose tools: memory, knowledge, notes, notifications."""

from __future__ import annotations

import json
from typing import Any

from ..db.database import now_iso
from ..llm.base import Message
from ..memory.store import Category, Reliability
from ..prompts import POLICY
from .registry import ToolContext, ToolError, ToolRegistry


def _compact(value: Any, limit: int = 6000) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False, default=str)
    return text[:limit]


def register(reg: ToolRegistry) -> None:
    @reg.tool(
        "memory_search",
        "Search JARVIS's persistent memory (preferences, company, customers, decisions, procedures).",
        {"type": "object", "properties": {
            "query": {"type": "string", "maxLength": 300},
            "category": {"type": "string", "enum": [c.value for c in Category]},
            "limit": {"type": "integer", "default": 6, "minimum": 1, "maximum": 20},
        }, "required": ["query"]},
        category="memory",
    )
    async def memory_search(ctx: ToolContext, query: str, category: str | None = None, limit: int = 6) -> dict:
        items = await ctx.services.memory.search(query, limit=limit, category=category)
        return {"results": [
            {"id": m["id"], "category": m["category"], "title": m["title"], "content": m["content"][:800],
             "reliability": m["reliability"], "updated_at": m["updated_at"]} for m in items
        ]}

    @reg.tool(
        "memory_save",
        "Save a new memory. Use reliability 'user_provided' for facts the user told you, "
        "'verified' only when checked against a reliable source, otherwise 'estimate' or 'assumption'.",
        {"type": "object", "properties": {
            "category": {"type": "string", "enum": [c.value for c in Category]},
            "title": {"type": "string", "maxLength": 200},
            "content": {"type": "string", "maxLength": 5000},
            "reliability": {"type": "string", "enum": [r.value for r in Reliability]},
            "source": {"type": "string", "maxLength": 500},
        }, "required": ["category", "title", "content", "reliability"]},
        category="memory",
    )
    async def memory_save(ctx: ToolContext, category: str, title: str, content: str,
                          reliability: str, source: str | None = None) -> dict:
        m = await ctx.services.memory.create(category, title, content, reliability,
                                             source=source, actor=ctx.actor)
        return {"saved": True, "id": m["id"]}

    @reg.tool(
        "knowledge_read",
        "Read the user's editable company knowledge files (Markdown).",
        {"type": "object", "properties": {"name": {"type": "string"}}},
        category="memory",
    )
    async def knowledge_read(ctx: ToolContext, name: str | None = None) -> dict:
        kb = ctx.services.knowledge
        if name:
            try:
                return {"name": name, "content": kb.read(name)}
            except (ValueError, FileNotFoundError) as exc:
                raise ToolError(str(exc), retryable=False) from exc
        return {"files": kb.list(), "content": kb.all_text(4000)}

    @reg.tool(
        "write_document",
        "Use the language model to write or analyze text (summary, report, plan, proposal, "
        "specification) from instructions and the results of previous steps. Saves it as a note.",
        {"type": "object", "properties": {
            "title": {"type": "string", "maxLength": 200},
            "instructions": {"type": "string", "maxLength": 4000},
            "language": {"type": "string", "default": "it"},
        }, "required": ["title", "instructions"]},
        category="analysis", timeout_s=900,
    )
    async def write_document(ctx: ToolContext, title: str, instructions: str, language: str = "it") -> dict:
        previous = "\n\n".join(f"Step {k} result:\n{_compact(v, 3000)}" for k, v in sorted(ctx.previous.items()))
        msgs = [
            Message("system", "You are the writing module of JARVIS for VEYRO Web. Write in "
                    f"language '{language}'. Use only facts present in the inputs; mark "
                    "anything else as an assumption.\n" + POLICY),
            Message("user", f"Title: {title}\nInstructions: {instructions}\n\nInputs:\n{previous or '(none)'}"),
        ]
        result = await ctx.services.llm.chat(msgs)
        if not result.text.strip():
            raise ToolError("The model returned an empty document")
        note = await ctx.services.memory.create(
            "task", title, result.text, "assumption" if not previous else "estimate",
            source=f"mission:{ctx.mission_id}" if ctx.mission_id else "chat", actor=ctx.actor,
        )
        return {"title": title, "memory_id": note["id"], "text": result.text[:4000],
                "chars": len(result.text)}

    @reg.tool(
        "notify_user",
        "Send a notification to the user inside JARVIS (desktop notification if enabled).",
        {"type": "object", "properties": {
            "title": {"type": "string", "maxLength": 140},
            "body": {"type": "string", "maxLength": 1000},
            "level": {"type": "string", "enum": ["info", "success", "warning", "decision"], "default": "info"},
        }, "required": ["title"]},
        category="system",
    )
    async def notify_user(ctx: ToolContext, title: str, body: str = "", level: str = "info") -> dict:
        notify(ctx.services, title, body, level, ctx.mission_id)
        return {"notified": True}


def notify(services: Any, title: str, body: str = "", level: str = "info", mission_id: str | None = None,
           call_event: str | None = None, evidence: dict | None = None) -> None:
    """Dashboard notification, routed also to WhatsApp (results, decisions) and,
    for verified critical events, to a phone call (see integrations/phone.py)."""
    nid = services.db.insert("notifications", {
        "ts": now_iso(), "level": level, "title": title, "body": body, "mission_id": mission_id, "read_at": None,
    })
    services.bus.emit("notify", id=nid, title=title, body=body, level=level, mission_id=mission_id)
    channels = getattr(services, "channels", None)
    if channels is not None:
        channels.route({"id": nid, "title": title, "body": body, "level": level, "mission_id": mission_id,
                        "call_event": call_event, "evidence": evidence or {}})
