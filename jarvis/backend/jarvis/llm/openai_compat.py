"""Provider for any local OpenAI-compatible server (LM Studio, llama.cpp
server, vLLM, LocalAI). Uses /v1/chat/completions with SSE streaming."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .base import ChatChunk, LLMError, LLMProvider, LLMUnavailable, Message, ToolCall, ToolSpec


class OpenAICompatProvider(LLMProvider):
    name = "openai"

    def __init__(self, base_url: str, model: str, embed_model: str | None = None,
                 temperature: float = 0.3, timeout_s: float = 300.0, api_key: str = "local"):
        super().__init__(model, embed_model, temperature)
        self.base_url = base_url.rstrip("/")
        if not self.base_url.endswith("/v1"):
            self.base_url += "/v1"
        self.timeout = httpx.Timeout(timeout_s, connect=5.0)
        self.headers = {"Authorization": f"Bearer {api_key}"}

    async def stream_chat(self, messages: list[Message], tools: list[ToolSpec] | None = None,
                          json_schema: dict[str, Any] | None = None,
                          model: str | None = None) -> AsyncIterator[ChatChunk]:
        body: dict[str, Any] = {
            "model": model or self.model,
            "messages": [_oa_message(m) for m in messages],
            "stream": True,
            "temperature": self.temperature,
        }
        if tools:
            body["tools"] = [t.as_openai() for t in tools]
        if json_schema is not None:
            body["response_format"] = (
                {"type": "json_schema", "json_schema": {"name": "answer", "schema": json_schema}}
                if json_schema else {"type": "json_object"}
            )
        partial: dict[int, dict[str, str]] = {}
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                async with client.stream("POST", f"{self.base_url}/chat/completions", json=body) as resp:
                    if resp.status_code >= 400:
                        raise LLMError(f"Server error {resp.status_code}: {(await resp.aread()).decode(errors='replace')}")
                    async for line in resp.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line[5:].strip()
                        if data == "[DONE]":
                            break
                        obj = json.loads(data)
                        choice = (obj.get("choices") or [{}])[0]
                        delta = choice.get("delta") or {}
                        for tc in delta.get("tool_calls") or []:
                            slot = partial.setdefault(tc.get("index", 0), {"name": "", "args": ""})
                            fn = tc.get("function") or {}
                            slot["name"] += fn.get("name") or ""
                            slot["args"] += fn.get("arguments") or ""
                        if delta.get("content"):
                            yield ChatChunk(text=delta["content"])
        except httpx.ConnectError as exc:
            raise LLMUnavailable(f"Local AI server not reachable at {self.base_url} ({exc})") from exc
        calls = []
        for slot in partial.values():
            try:
                args = json.loads(slot["args"] or "{}")
            except ValueError:
                args = {}
            calls.append(ToolCall(name=slot["name"], arguments=args if isinstance(args, dict) else {}))
        yield ChatChunk(tool_calls=calls, done=True)

    async def health(self) -> dict[str, Any]:
        try:
            models = await self.list_models()
        except httpx.HTTPError as exc:
            return {"ok": False, "provider": self.name, "error": f"Server not reachable: {exc}"}
        names = [m["name"] for m in models]
        ok = self.model in names
        return {"ok": ok, "provider": self.name, "model": self.model, "model_installed": ok,
                "error": None if ok else f"Model '{self.model}' not loaded on the server"}

    async def list_models(self) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=5.0, headers=self.headers) as client:
            data = (await client.get(f"{self.base_url}/models")).json()
        return [{"name": m.get("id")} for m in data.get("data", [])]

    async def embed(self, texts: list[str]) -> list[list[float]] | None:
        if not self.embed_model:
            return None
        try:
            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                r = await client.post(f"{self.base_url}/embeddings", json={"model": self.embed_model, "input": texts})
            if r.status_code >= 400:
                return None
            return [d["embedding"] for d in r.json().get("data", [])]
        except httpx.HTTPError:
            return None


def _oa_message(m: Message) -> dict[str, Any]:
    if m.role == "tool":
        return {"role": "tool", "content": m.content, "name": m.tool_name or "tool"}
    d: dict[str, Any] = {"role": m.role, "content": m.content}
    if m.tool_calls:
        d["tool_calls"] = [
            {"id": c.id or f"call_{i}", "type": "function",
             "function": {"name": c.name, "arguments": json.dumps(c.arguments)}}
            for i, c in enumerate(m.tool_calls)
        ]
    return d
