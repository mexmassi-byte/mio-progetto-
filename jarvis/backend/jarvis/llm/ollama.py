"""Ollama provider (http://127.0.0.1:11434)."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .base import ChatChunk, LLMError, LLMProvider, LLMUnavailable, Message, ToolCall, ToolSpec


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(
        self,
        base_url: str,
        model: str,
        embed_model: str | None = None,
        temperature: float = 0.3,
        timeout_s: float = 300.0,
        context_tokens: int = 8192,
        think: bool | None = False,
    ):
        super().__init__(model, embed_model, temperature)
        self.think = think
        self._think_supported = True
        self.base_url = base_url.rstrip("/")
        self.timeout = httpx.Timeout(timeout_s, connect=5.0)
        self.context_tokens = context_tokens

    async def stream_chat(
        self,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
        json_schema: dict[str, Any] | None = None,
        model: str | None = None,
    ) -> AsyncIterator[ChatChunk]:
        body: dict[str, Any] = {
            "model": model or self.model,
            "messages": [m.as_dict() for m in messages],
            "stream": True,
            "options": {"temperature": self.temperature, "num_ctx": self.context_tokens,
                        "num_predict": self.max_tokens},
        }
        if tools:
            body["tools"] = [t.as_openai() for t in tools]
        if json_schema is not None:
            body["format"] = json_schema or "json"
        if self.think is not None and self._think_supported:
            body["think"] = self.think
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", f"{self.base_url}/api/chat", json=body) as resp:
                    if resp.status_code == 404:
                        detail = (await resp.aread()).decode(errors="replace")
                        raise LLMUnavailable(f"Model not found in Ollama: {detail}")
                    if resp.status_code >= 400:
                        detail = (await resp.aread()).decode(errors="replace")
                        if "think" in body and "think" in detail.lower():
                            # This model has no thinking switch: retry without it.
                            self._think_supported = False
                            async for chunk in self.stream_chat(messages, tools, json_schema, model):
                                yield chunk
                            return
                        raise LLMError(f"Ollama error {resp.status_code}: {detail}")
                    async for line in resp.aiter_lines():
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        if "error" in data:
                            raise LLMError(str(data["error"]))
                        msg = data.get("message") or {}
                        calls = [
                            ToolCall(
                                name=c.get("function", {}).get("name", ""),
                                arguments=_args(c.get("function", {}).get("arguments")),
                            )
                            for c in msg.get("tool_calls") or []
                        ]
                        done = bool(data.get("done"))
                        stats = {}
                        if done:
                            stats = {
                                k: data.get(k)
                                for k in ("total_duration", "prompt_eval_count", "eval_count", "eval_duration")
                            }
                            if data.get("eval_count") and data.get("eval_duration"):
                                stats["tokens_per_s"] = round(
                                    data["eval_count"] / (data["eval_duration"] / 1e9), 1
                                )
                        yield ChatChunk(
                            text=msg.get("content") or "",
                            thinking=msg.get("thinking") or "",
                            tool_calls=calls,
                            done=done,
                            stats=stats,
                        )
        except httpx.ConnectError as exc:
            raise LLMUnavailable(
                f"Ollama is not reachable at {self.base_url}. Is it running? ({exc})"
            ) from exc
        except httpx.TimeoutException as exc:
            raise LLMError(f"Ollama timed out: {exc}") from exc

    async def health(self) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                v = (await client.get(f"{self.base_url}/api/version")).json()
                tags = (await client.get(f"{self.base_url}/api/tags")).json()
        except httpx.HTTPError as exc:
            return {"ok": False, "provider": self.name, "error": f"Ollama not reachable: {exc}"}
        names = [m.get("name", "") for m in tags.get("models", [])]
        installed = _model_installed(self.model, names)
        return {
            "ok": installed,
            "provider": self.name,
            "version": v.get("version"),
            "model": self.model,
            "model_installed": installed,
            "embed_model": self.embed_model,
            "embed_installed": bool(self.embed_model) and _model_installed(self.embed_model or "", names),
            "error": None if installed else f"Model '{self.model}' is not installed (ollama pull {self.model})",
        }

    async def list_models(self) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            tags = (await client.get(f"{self.base_url}/api/tags")).json()
        return [
            {
                "name": m.get("name"),
                "size_gb": round((m.get("size") or 0) / 1e9, 2),
                "family": (m.get("details") or {}).get("family"),
                "parameters": (m.get("details") or {}).get("parameter_size"),
                "quantization": (m.get("details") or {}).get("quantization_level"),
            }
            for m in tags.get("models", [])
        ]

    async def embed(self, texts: list[str]) -> list[list[float]] | None:
        if not self.embed_model or not texts:
            return None
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(
                    f"{self.base_url}/api/embed", json={"model": self.embed_model, "input": texts}
                )
            if resp.status_code >= 400:
                return None
            return resp.json().get("embeddings")
        except httpx.HTTPError:
            return None


def _args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except ValueError:
            return {}
    return {}


def _model_installed(model: str, names: list[str]) -> bool:
    if model in names:
        return True
    if ":" not in model:
        return f"{model}:latest" in names
    return False
