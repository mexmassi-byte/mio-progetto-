from __future__ import annotations

from ..config import Settings
from .base import LLMProvider
from .fake import FakeProvider
from .ollama import OllamaProvider
from .openai_compat import OpenAICompatProvider


def build_provider(settings: Settings, model: str | None = None) -> LLMProvider:
    kind = settings.llm_provider.lower()
    model = model or settings.llm_model
    if kind == "ollama":
        provider: LLMProvider = OllamaProvider(
            settings.llm_base_url, model, settings.llm_embed_model,
            settings.llm_temperature, settings.llm_timeout_s, settings.llm_context_tokens,
            settings.llm_think,
        )
    elif kind in ("openai", "openai-compatible", "lmstudio", "llamacpp"):
        provider = OpenAICompatProvider(
            settings.llm_base_url, model, settings.llm_embed_model,
            settings.llm_temperature, settings.llm_timeout_s,
        )
    else:
        provider = None  # type: ignore[assignment]
    if provider is not None:
        provider.max_tokens = settings.llm_max_tokens
        return provider
    if kind == "fake":
        return FakeProvider(model)
    raise ValueError(f"Unknown LLM provider: {settings.llm_provider}")
