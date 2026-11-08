"""Deterministic provider for tests and for running the UI without a model.

It never pretends to be intelligent: answers are scripted, or a fixed notice
that no model is configured.
"""

from __future__ import annotations

import json
from collections import deque
from typing import Any, AsyncIterator, Callable

from .base import ChatChunk, LLMProvider, Message, ToolCall, ToolSpec

Responder = Callable[[list[Message], list[ToolSpec] | None, dict | None], "str | dict | list | ToolCall"]


class FakeProvider(LLMProvider):
    name = "fake"

    def __init__(self, model: str = "fake", embed_model: str | None = "fake-embed"):
        super().__init__(model, embed_model)
        self.script: deque = deque()
        self.responder: Responder | None = None
        self.calls: list[list[Message]] = []

    def queue(self, *answers: Any) -> None:
        """Queue answers: str (text), dict/list (JSON) or ToolCall."""
        self.script.extend(answers)

    async def stream_chat(self, messages: list[Message], tools: list[ToolSpec] | None = None,
                          json_schema: dict[str, Any] | None = None,
                          model: str | None = None) -> AsyncIterator[ChatChunk]:
        self.calls.append(messages)
        if self.script:
            answer = self.script.popleft()
        elif self.responder:
            answer = self.responder(messages, tools, json_schema)
        else:
            answer = (
                "[Nessun modello AI configurato] JARVIS sta usando il provider di prova. "
                "Installa Ollama e un modello, poi imposta JARVIS_LLM_PROVIDER=ollama."
            )
        if isinstance(answer, ToolCall):
            yield ChatChunk(tool_calls=[answer], done=True, stats={"fake": True})
            return
        if isinstance(answer, (dict, list)):
            answer = json.dumps(answer, ensure_ascii=False)
        words = str(answer).split(" ")
        for i, w in enumerate(words):
            yield ChatChunk(text=w + (" " if i < len(words) - 1 else ""))
        yield ChatChunk(done=True, stats={"fake": True})

    async def health(self) -> dict[str, Any]:
        return {"ok": True, "provider": self.name, "model": self.model, "model_installed": True,
                "note": "Test provider: no real AI model is running."}

    async def list_models(self) -> list[dict[str, Any]]:
        return [{"name": self.model}]

    async def embed(self, texts: list[str]) -> list[list[float]] | None:
        # Bag-of-letters vectors: deterministic, good enough to test ranking code.
        out = []
        for t in texts:
            v = [0.0] * 26
            for ch in t.lower():
                if "a" <= ch <= "z":
                    v[ord(ch) - 97] += 1.0
            out.append(v)
        return out
