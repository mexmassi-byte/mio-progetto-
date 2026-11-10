"""Provider-independent LLM interface.

The rest of JARVIS only talks to ``LLMProvider``. Swapping Ollama for another
local runtime means writing one new provider class, nothing else.
"""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Literal

Role = Literal["system", "user", "assistant", "tool"]


@dataclass
class ToolSpec:
    name: str
    description: str
    parameters: dict[str, Any]  # JSON schema

    def as_openai(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {"name": self.name, "description": self.description, "parameters": self.parameters},
        }


@dataclass
class ToolCall:
    name: str
    arguments: dict[str, Any]
    id: str | None = None


@dataclass
class Message:
    role: Role
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    tool_name: str | None = None

    def as_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"role": self.role, "content": self.content}
        if self.tool_calls:
            d["tool_calls"] = [
                {"function": {"name": c.name, "arguments": c.arguments}} for c in self.tool_calls
            ]
        if self.tool_name:
            d["tool_name"] = self.tool_name
        return d


@dataclass
class ChatChunk:
    """A streamed piece of the answer. The final chunk has ``done=True``."""

    text: str = ""
    thinking: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    done: bool = False
    stats: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatResult:
    text: str
    tool_calls: list[ToolCall]
    stats: dict[str, Any]


class LLMError(RuntimeError):
    pass


class LLMUnavailable(LLMError):
    """The runtime is not reachable or the model is not installed."""


class LLMProvider(ABC):
    name: str = "base"

    def __init__(self, model: str, embed_model: str | None = None, temperature: float = 0.3,
                 max_tokens: int = 1500):
        self.model = model
        self.embed_model = embed_model
        self.temperature = temperature
        self.max_tokens = max_tokens

    @abstractmethod
    def stream_chat(
        self,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
        json_schema: dict[str, Any] | None = None,
        model: str | None = None,
    ) -> AsyncIterator[ChatChunk]: ...

    async def chat(
        self,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
        json_schema: dict[str, Any] | None = None,
        model: str | None = None,
    ) -> ChatResult:
        text: list[str] = []
        calls: list[ToolCall] = []
        stats: dict[str, Any] = {}
        async for chunk in self.stream_chat(messages, tools=tools, json_schema=json_schema, model=model):
            text.append(chunk.text)
            calls.extend(chunk.tool_calls)
            if chunk.done:
                stats = chunk.stats
        return ChatResult(text=strip_thinking("".join(text)), tool_calls=calls, stats=stats)

    async def chat_json(
        self, messages: list[Message], schema: dict[str, Any], model: str | None = None
    ) -> Any:
        """Ask for a JSON answer matching ``schema`` and parse it."""
        result = await self.chat(messages, json_schema=schema, model=model)
        return extract_json(result.text)

    @abstractmethod
    async def health(self) -> dict[str, Any]: ...

    @abstractmethod
    async def list_models(self) -> list[dict[str, Any]]: ...

    async def embed(self, texts: list[str]) -> list[list[float]] | None:
        """Return embeddings, or None when no embedding model is available."""
        return None


_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def visible_text(text: str) -> str:
    """The part of a (possibly partial) answer meant for the user.

    Removes <think>…</think> blocks, an unfinished <think> at the end, and the
    reasoning of "thinking" models that emit only the closing </think> tag
    (e.g. Qwen3-*-thinking-2507, which ignore the think switch)."""
    t = _THINK_RE.sub("", text)
    if "</think>" in t:
        t = t.rsplit("</think>", 1)[1]
    i = t.find("<think>")
    if i >= 0:
        t = t[:i]
    return t.lstrip()


def strip_thinking(text: str) -> str:
    return visible_text(text).strip()


def extract_json(text: str) -> Any:
    """Parse JSON from a model answer, tolerating code fences and prose."""
    text = strip_thinking(text)
    try:
        return json.loads(text)
    except ValueError:
        pass
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except ValueError:
            pass
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        end = text.rfind(closer)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except ValueError:
                continue
    raise LLMError("The model did not return valid JSON")
