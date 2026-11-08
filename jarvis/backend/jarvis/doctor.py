"""`jarvis doctor`: checks what actually works on this computer."""

from __future__ import annotations

import shutil

import httpx

from .config import Settings
from .llm.factory import build_provider
from .voice.engine import VoiceEngine


def _line(ok: bool | None, label: str, detail: str = "") -> None:
    mark = {True: "OK ", False: "NO ", None: "-- "}[ok]
    print(f"  [{mark}] {label}{(' — ' + detail) if detail else ''}")


async def doctor(settings: Settings) -> None:
    print("\nJARVIS doctor\n")
    llm = build_provider(settings)
    h = await llm.health()
    _line(h.get("ok"), f"AI model ({settings.llm_provider}: {llm.model})", h.get("error") or h.get("version") or "")
    if settings.llm_embed_model:
        _line(h.get("embed_installed"), f"Embedding model ({settings.llm_embed_model})",
              "" if h.get("embed_installed") else f"ollama pull {settings.llm_embed_model} (optional)")
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"{settings.searxng_url}/search", params={"q": "test", "format": "json"})
        _line(r.status_code == 200, f"Web search (SearXNG {settings.searxng_url})",
              "" if r.status_code == 200 else f"HTTP {r.status_code}")
    except httpx.HTTPError as exc:
        _line(False, f"Web search (SearXNG {settings.searxng_url})", f"not running ({exc.__class__.__name__})")
    try:
        import playwright  # type: ignore  # noqa: F401
        _line(True, "Browser audits (Playwright)")
    except ImportError:
        _line(None, "Browser audits (Playwright)", "optional: pip install playwright && playwright install chromium")
    v = VoiceEngine(settings).status()
    if v["tts"]["engine"] == "elevenlabs":
        _line(True, f"Speech synthesis (ElevenLabs, voice {settings.elevenlabs_voice_id})",
              "local fallback: Piper" if v["tts"].get("fallback") else "no local fallback (Piper not set)")
    _line(v["stt"]["available"], "Speech recognition (faster-whisper)", v["stt"]["hint"] or "")
    if v["tts"]["engine"] != "elevenlabs":
        _line(v["tts"]["available"], "Speech synthesis (Piper)", v["tts"]["hint"] or "")
    for exe in ("git", "node", "npm"):
        _line(shutil.which(exe) is not None, f"{exe}")
    _line(bool(settings.smtp_host), "Email sending (SMTP)", "" if settings.smtp_host else "not configured (optional)")
    print(f"\n  Data folder: {settings.data_dir}\n")
