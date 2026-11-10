"""Conversation service: persistent chats with memory, knowledge and tools."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, AsyncIterator

from .db.database import dumps, loads, new_id, now_iso
from .llm.base import LLMError, LLMUnavailable, Message, ToolCall, strip_thinking, visible_text
from .prompts import chat_system_prompt
from .security.permissions import Permission
from .tools.registry import ToolContext, ToolError

if TYPE_CHECKING:  # pragma: no cover
    from .services import Services

CHAT_TOOLS = [
    "memory_search", "memory_save", "knowledge_read", "create_mission", "mission_status", "set_daily_goals", "business_summary",
    "crm_list_leads", "sales_audit_url", "fetch_page", "web_search", "request_action",
    "dev_list_files", "dev_read_file",
    # Google / WhatsApp (write tools appear only when the owner made them autonomous)
    "gmail_search", "gmail_read", "gmail_triage", "gmail_followups", "gmail_draft", "email_owner",
    "calendar_list", "calendar_create", "tasks_list", "tasks_create", "drive_search", "drive_read",
    "docs_create", "contacts_search", "whatsapp_to_owner",
]
MAX_TOOL_ROUNDS = 4
# Tools whose output is internet content (untrusted).
UNTRUSTED_TOOLS = {"web_search", "fetch_page", "sales_audit_url", "gmail_search", "gmail_read", "gmail_triage",
                   "gmail_followups", "drive_search", "drive_read"}
# Tools a web page must never be able to trigger: after untrusted content was
# read in the same turn they are refused, whatever the model decides.
TAINT_BLOCKED = {"request_action", "create_mission", "set_daily_goals"}
HISTORY_CHARS = 12000


class ChatService:
    def __init__(self, services: "Services"):
        self.s = services

    # -------------------------------------------------------- conversations
    def create(self, title: str = "Nuova conversazione") -> dict[str, Any]:
        cid = new_id("conv")
        ts = now_iso()
        self.s.db.insert("conversations", {"id": cid, "title": title[:120], "created_at": ts, "updated_at": ts})
        return self.s.db.one("SELECT * FROM conversations WHERE id = ?", (cid,))  # type: ignore[return-value]

    def list(self, limit: int = 100) -> list[dict]:
        return self.s.db.query(
            "SELECT c.*, (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messages "
            "FROM conversations c ORDER BY updated_at DESC LIMIT ?", (limit,))

    def messages(self, conversation_id: str) -> list[dict]:
        rows = self.s.db.query("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id", (conversation_id,))
        return [{**r, "meta": loads(r["meta"], {})} for r in rows]

    def rename(self, conversation_id: str, title: str) -> None:
        self.s.db.update("conversations", "id", conversation_id, {"title": title[:120], "updated_at": now_iso()})

    def delete(self, conversation_id: str) -> None:
        self.s.db.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))

    def _add(self, conversation_id: str, role: str, content: str, meta: dict | None = None) -> int:
        mid = self.s.db.insert("messages", {"conversation_id": conversation_id, "role": role, "content": content,
                                            "meta": dumps(meta or {}), "created_at": now_iso()})
        self.s.db.update("conversations", "id", conversation_id, {"updated_at": now_iso()})
        return mid

    # ------------------------------------------------------------------ send
    async def send(self, conversation_id: str | None, text: str, mode: str = "text") -> AsyncIterator[dict[str, Any]]:
        """Stream the answer as events: conversation, token, tool, done, error."""
        text = text.strip()
        if not text:
            yield {"type": "error", "error": "Messaggio vuoto"}
            return
        if not conversation_id or not self.s.db.one("SELECT id FROM conversations WHERE id = ?", (conversation_id,)):
            conversation_id = self.create(_title_from(text))["id"]
        yield {"type": "conversation", "conversation_id": conversation_id}
        self._add(conversation_id, "user", text, {"channel": mode})
        self.s.bus.emit("chat.started", conversation_id=conversation_id)

        memories = await self.s.memory.search(text, limit=6)
        mem_text = "\n".join(f"- [{m['category']}/{m['reliability']}] {m['title']}: {m['content'][:400]}"
                             for m in memories)
        system = chat_system_prompt(self.s.settings, mem_text, self.s.knowledge.all_text(2500), voice=mode == "voice", channel=mode)
        msgs = [Message("system", system)] + self._history(conversation_id)
        tools = self.s.tools.specs(max_permission=Permission.AUTONOMOUS, names=CHAT_TOOLS)
        tainted = "UNTRUSTED_WEB_CONTENT" in text
        used_tools: list[dict[str, Any]] = []
        answer = ""
        stats: dict[str, Any] = {}
        try:
            for _round in range(MAX_TOOL_ROUNDS + 1):
                calls: list[ToolCall] = []
                chunk_text = []
                sent = ""  # what the user has seen of this round (reasoning never shown)
                offer_tools = tools if _round < MAX_TOOL_ROUNDS else None
                async for chunk in self.s.llm.stream_chat(msgs, tools=offer_tools):
                    if chunk.text:
                        chunk_text.append(chunk.text)
                        visible = visible_text("".join(chunk_text))
                        if visible.startswith(sent):
                            if len(visible) > len(sent):
                                yield {"type": "token", "text": visible[len(sent):]}
                        else:  # reasoning turned out to be reasoning: replace what was shown
                            yield {"type": "reset", "text": visible}
                        sent = visible
                    if chunk.thinking:
                        yield {"type": "thinking", "text": chunk.thinking}
                    calls.extend(chunk.tool_calls)
                    if chunk.done:
                        stats = chunk.stats
                answer = strip_thinking("".join(chunk_text))
                if not calls:
                    break
                msgs.append(Message("assistant", answer, tool_calls=calls))
                for call in calls:
                    yield {"type": "tool", "name": call.name, "args": call.arguments, "status": "running"}
                    self.s.bus.emit("chat.tool", conversation_id=conversation_id, name=call.name)
                    result = await self._run_tool(call, tainted)
                    if call.name in UNTRUSTED_TOOLS:
                        tainted = True
                    used_tools.append({"name": call.name, "args": call.arguments,
                                       "ok": "error" not in result})
                    yield {"type": "tool", "name": call.name, "status": "done", "ok": "error" not in result,
                           "result": _short(result)}
                    msgs.append(Message("tool", json.dumps(result, ensure_ascii=False, default=str)[:8000],
                                        tool_name=call.name))
        except LLMUnavailable as exc:
            err = f"Modello locale non disponibile: {exc}"
            self._add(conversation_id, "assistant", err, {"error": True})
            self.s.bus.emit("chat.finished", conversation_id=conversation_id, error=True)
            yield {"type": "error", "error": err}
            return
        except LLMError as exc:
            err = f"Errore del modello: {exc}"
            self._add(conversation_id, "assistant", err, {"error": True})
            self.s.bus.emit("chat.finished", conversation_id=conversation_id, error=True)
            yield {"type": "error", "error": err}
            return
        message_id = self._add(conversation_id, "assistant", answer,
                               {"tools": used_tools, "stats": stats, "model": self.s.llm.model,
                                "memories": [m["id"] for m in memories]})
        self.s.bus.emit("chat.finished", conversation_id=conversation_id, tools=len(used_tools))
        yield {"type": "done", "message_id": message_id, "conversation_id": conversation_id,
               "stats": stats, "tools": used_tools, "text": answer}

    async def ask(self, conversation_id: str | None, text: str, mode: str = "text") -> dict[str, Any]:
        """Non-streaming helper: returns the final answer."""
        out: dict[str, Any] = {"text": "", "tools": []}
        async for ev in self.send(conversation_id, text, mode):
            if ev["type"] == "conversation":
                out["conversation_id"] = ev["conversation_id"]
            elif ev["type"] == "token":
                out["text"] += ev["text"]
            elif ev["type"] == "reset":
                out["text"] = ev["text"]
            elif ev["type"] == "error":
                out["error"] = ev["error"]
            elif ev["type"] == "done":
                out["tools"] = ev["tools"]
                out["text"] = ev.get("text", out["text"])
        out["text"] = strip_thinking(out["text"])
        return out

    async def _run_tool(self, call: ToolCall, tainted: bool = False) -> dict[str, Any]:
        if call.name not in CHAT_TOOLS or not self.s.tools.has(call.name):
            return {"error": f"tool '{call.name}' is not available in chat"}
        if tainted and call.name in TAINT_BLOCKED:
            self.s.audit.record("jarvis-chat", f"tool:{call.name}", "blocked_after_untrusted_content",
                                args=call.arguments)
            return {"error": "Blocked: web content was read in this turn, so actions cannot start now. "
                             "Ask the user to request it explicitly in a new message."}
        if tainted and call.name == "memory_save":
            call.arguments["reliability"] = "assumption"
            call.arguments["source"] = (call.arguments.get("source") or "") + " [from web content, unverified]"
        ctx = ToolContext(services=self.s, actor="jarvis-chat")
        try:
            result = await self.s.tools.execute(call.name, call.arguments, ctx)
        except ToolError as exc:
            return {"error": str(exc)}
        except Exception as exc:  # tool bug: report, never crash the chat
            return {"error": f"{type(exc).__name__}: {exc}"}
        return result if isinstance(result, dict) else {"result": result}

    def _history(self, conversation_id: str) -> list[Message]:
        rows = self.s.db.query(
            "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 40",
            (conversation_id,))
        out: list[Message] = []
        total = 0
        for r in rows:
            total += len(r["content"])
            if total > HISTORY_CHARS and out:
                break
            if r["role"] in ("user", "assistant"):
                out.append(Message(r["role"], r["content"]))
        return list(reversed(out))


def _title_from(text: str) -> str:
    first = text.strip().splitlines()[0]
    return first[:60] + ("…" if len(first) > 60 else "")


def _short(result: dict[str, Any]) -> Any:
    raw = json.dumps(result, ensure_ascii=False, default=str)
    return result if len(raw) < 1500 else {"summary": raw[:1500] + "…"}
