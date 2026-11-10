"""Conversation service: persistent chats with memory, knowledge and tools."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any, AsyncIterator

from .db.database import dumps, loads, new_id, now_iso
from .llm.base import LLMError, LLMUnavailable, Message, ToolCall, strip_thinking, visible_text
from .prompts import chat_system_prompt, turn_context
from .security.permissions import Permission
from .tools.registry import ToolContext, ToolError

log = logging.getLogger("jarvis.chat")

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
GOOGLE_CHAT_TOOLS = {"gmail_search", "gmail_read", "gmail_triage", "gmail_followups", "gmail_draft", "email_owner",
                     "calendar_list", "calendar_create", "tasks_list", "tasks_create", "drive_search", "drive_read",
                     "docs_create", "contacts_search"}
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
        msgs = [Message("system", self.system_prompt())] + self._history(conversation_id)
        # The context travels with the current message, so everything before it
        # stays identical and the model can reuse what it already read.
        msgs[-1] = Message("user", turn_context(mem_text, voice=mode == "voice", channel=mode) + msgs[-1].content)
        tools = self.chat_tools()
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

    async def warm_up(self) -> bool:
        """Load the model and let it read instructions and tools once, at start:
        the first real question then starts from the cached part."""
        if self.s.llm.name != "ollama":
            return False
        msgs = [Message("system", self.system_prompt()), Message("user", turn_context("") + "ok")]
        try:
            async for _chunk in self.s.llm.stream_chat(msgs, tools=self.chat_tools()):
                break  # the first token means the prompt has been processed
            return True
        except Exception as exc:  # the model may still be downloading: not fatal
            log.info("warm-up skipped: %s", exc)
            return False

    def system_prompt(self) -> str:
        return chat_system_prompt(self.s.settings, self.s.knowledge.all_text(2500))

    def chat_tools(self) -> list:
        """Tools offered in chat: integrations only once they are connected
        (fewer tools = shorter prompt = faster answers)."""
        names = list(CHAT_TOOLS)
        ch = getattr(self.s, "channels", None)
        if not (ch and ch.google.connected()):
            names = [n for n in names if n not in GOOGLE_CHAT_TOOLS]
        if not (ch and ch.whatsapp.configured()):
            names = [n for n in names if n != "whatsapp_to_owner"]
        return self.s.tools.specs(max_permission=Permission.AUTONOMOUS, names=names)

    def _history(self, conversation_id: str) -> list[Message]:
        rows = self.s.db.query(
            "SELECT role, content FROM (SELECT id, role, content FROM messages WHERE conversation_id = ? "
            "AND role IN ('user', 'assistant') ORDER BY id DESC LIMIT 200) ORDER BY id", (conversation_id,))
        if not rows:
            return []
        # Oldest message that fits; the start then moves in steps of 8 messages,
        # so the beginning of the conversation stays the same between turns.
        start, total = len(rows) - 1, len(rows[-1]["content"])
        for i in range(len(rows) - 2, -1, -1):
            total += len(rows[i]["content"])
            if total > HISTORY_CHARS:
                break
            start = i
        start = max(start, len(rows) - 40)
        if start > 0:
            start = min(len(rows) - 1, (start + 7) // 8 * 8)
        return [Message(r["role"], r["content"]) for r in rows[start:]]


def _title_from(text: str) -> str:
    first = text.strip().splitlines()[0]
    return first[:60] + ("…" if len(first) > 60 else "")


def _short(result: dict[str, Any]) -> Any:
    raw = json.dumps(result, ensure_ascii=False, default=str)
    return result if len(raw) < 1500 else {"summary": raw[:1500] + "…"}
