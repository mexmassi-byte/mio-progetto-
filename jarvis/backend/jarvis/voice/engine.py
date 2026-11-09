"""Speech: recognition (faster-whisper, local) and synthesis.

Synthesis uses ElevenLabs when configured (cloud, best quality, one voice for
Italian, German and English) and falls back to Piper (local) when ElevenLabs
is not configured, unreachable, out of credit, or over the monthly budget.
Only the text to be spoken is sent to ElevenLabs; the AI model and memory
stay on the computer. ``status()`` reports exactly what is available.
"""

from __future__ import annotations

import asyncio
import logging
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Any

from datetime import datetime

import httpx

from ..config import Settings

log = logging.getLogger("jarvis.voice")


class VoiceUnavailable(RuntimeError):
    pass


def find_piper(name: str) -> str | None:
    """Piper from PATH, or installed with `pip install piper-tts` in JARVIS's venv."""
    found = shutil.which(name)
    if found:
        return found
    venv_bin = Path(sys.executable).parent
    for candidate in (venv_bin / name, venv_bin / f"{name}.exe"):
        if candidate.exists():
            return str(candidate)
    return None


class VoiceEngine:
    def __init__(self, settings: Settings, db: Any = None, audit: Any = None,
                 transport: httpx.AsyncBaseTransport | None = None):
        self.settings = settings
        self.db = db          # optional: monthly character budget
        self.audit = audit    # optional: audit log of cloud calls
        self._transport = transport  # tests inject a mock transport
        self._whisper = None
        self._lock = asyncio.Lock()
        self.last_engine: str | None = None

    # ------------------------------------------------------------ helpers
    def _piper_ready(self) -> bool:
        voice = self.settings.piper_voice
        return find_piper(self.settings.piper_binary) is not None and bool(voice and Path(voice).exists())

    def _elevenlabs_ready(self) -> bool:
        return self.settings.tts_provider == "elevenlabs" and bool(self.settings.elevenlabs_api_key)

    def _month_key(self) -> str:
        return f"elevenlabs_chars_{datetime.now().strftime('%Y-%m')}"

    def _cache_path(self, text: str) -> Path | None:
        """Cache of ElevenLabs audio by voice + model + text (repeated phrases cost nothing)."""
        if not self.db:
            return None
        import hashlib
        s = self.settings
        key = hashlib.sha256(f"{s.elevenlabs_voice_id}|{s.elevenlabs_model}|{text}".encode()).hexdigest()[:32]
        return s.data_dir / "tts-cache" / f"{key}.mp3"

    def chars_used(self) -> int:
        if not self.db:
            return 0
        row = self.db.one("SELECT value FROM settings WHERE key = ?", (self._month_key(),))
        return int(row["value"]) if row else 0

    def _add_chars(self, n: int) -> None:
        if not self.db:
            return
        from ..db.database import now_iso
        self.db.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + ?, updated_at = excluded.updated_at",
            (self._month_key(), str(n), now_iso(), n))

    def status(self) -> dict[str, Any]:
        try:
            import faster_whisper  # type: ignore  # noqa: F401
            stt = True
        except ImportError:
            stt = False
        piper = self._piper_ready()
        eleven = self._elevenlabs_ready()
        return {
            "stt": {"available": stt, "engine": "faster-whisper", "model": self.settings.whisper_model,
                    "hint": None if stt else "pip install faster-whisper"},
            "tts": {"available": piper or eleven,
                    "engine": "elevenlabs" if eleven else "piper",
                    "fallback": "piper" if eleven and piper else None,
                    "chars_used_month": self.chars_used() if eleven else None,
                    "chars_budget_month": self.settings.elevenlabs_monthly_chars if eleven else None,
                    "hint": None if piper or eleven else
                    "set ElevenLabs (JARVIS_TTS_PROVIDER + JARVIS_ELEVENLABS_API_KEY) or install Piper "
                    "and set JARVIS_PIPER_VOICE (see docs/SETUP.md)"},
        }

    async def transcribe(self, audio: bytes, suffix: str = ".webm", language: str | None = None) -> dict[str, Any]:
        try:
            from faster_whisper import WhisperModel  # type: ignore
        except ImportError as exc:
            raise VoiceUnavailable("Speech recognition not installed (pip install faster-whisper)") from exc
        async with self._lock:
            if self._whisper is None:
                self._whisper = await asyncio.to_thread(
                    WhisperModel, self.settings.whisper_model, device="auto", compute_type="int8")
            model = self._whisper
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(audio)
            path = f.name
        try:
            def _run() -> dict[str, Any]:
                segments, info = model.transcribe(path, language=language or self.settings.language,
                                                  vad_filter=True)
                text = " ".join(s.text.strip() for s in segments)
                return {"text": text.strip(), "language": info.language,
                        "duration_s": round(info.duration, 2)}
            return await asyncio.to_thread(_run)
        finally:
            Path(path).unlink(missing_ok=True)

    async def speak(self, text: str) -> tuple[bytes, str]:
        """Audio for ``text`` as (bytes, media type). ElevenLabs first, then Piper."""
        text = text.strip()[:4000]
        if not text:
            raise VoiceUnavailable("Nothing to say")
        problem = None
        if self._elevenlabs_ready():
            cached = self._cache_path(text)
            if cached and cached.exists():  # same sentence already spoken: no credit used
                self.last_engine = "elevenlabs"
                return cached.read_bytes(), "audio/mpeg"
            if self.chars_used() + len(text) > self.settings.elevenlabs_monthly_chars:
                problem = "monthly ElevenLabs budget reached"
            else:
                try:
                    audio = await self._elevenlabs(text)
                    self._add_chars(len(text))
                    if cached:
                        try:
                            cached.parent.mkdir(parents=True, exist_ok=True)
                            cached.write_bytes(audio)
                        except OSError:
                            pass
                    self.last_engine = "elevenlabs"
                    return audio, "audio/mpeg"
                except VoiceUnavailable as exc:
                    problem = str(exc)
            log.warning("ElevenLabs unavailable (%s): using the local voice", problem)
        if self._piper_ready():
            self.last_engine = "piper"
            return await self.synthesize(text), "audio/wav"
        raise VoiceUnavailable(problem or "Speech synthesis not configured (ElevenLabs or Piper)")

    async def _elevenlabs(self, text: str) -> bytes:
        s = self.settings
        url = f"{s.elevenlabs_base_url.rstrip('/')}/v1/text-to-speech/{s.elevenlabs_voice_id}"
        body = {"text": text, "model_id": s.elevenlabs_model,
                "voice_settings": {"stability": 0.6, "similarity_boost": 0.8, "style": 0.1}}
        headers = {"xi-api-key": s.elevenlabs_api_key or "", "Content-Type": "application/json",
                   "Accept": "audio/mpeg"}
        try:
            async with httpx.AsyncClient(timeout=60, transport=self._transport) as client:
                r = await client.post(url, params={"output_format": "mp3_44100_128"}, json=body, headers=headers)
        except httpx.HTTPError as exc:
            self._audit("failed", len(text), error=exc.__class__.__name__)
            raise VoiceUnavailable(f"ElevenLabs not reachable ({exc.__class__.__name__})") from exc
        if r.status_code != 200:
            try:
                detail = r.json().get("detail", {})
                msg = detail.get("message") if isinstance(detail, dict) else str(detail)
            except ValueError:
                msg = r.text[:200]
            self._audit("failed", len(text), status=r.status_code)
            raise VoiceUnavailable(f"ElevenLabs error {r.status_code}: {msg}")
        self._audit("succeeded", len(text))
        return r.content

    def _audit(self, decision: str, chars: int, **details: Any) -> None:
        # Only the size is logged, never the spoken text.
        if self.audit:
            self.audit.record("jarvis", "tts:elevenlabs", decision, target=self.settings.elevenlabs_voice_id,
                              permission="autonomous", chars=chars, **details)

    async def synthesize(self, text: str) -> bytes:
        """Local Piper synthesis (WAV)."""
        exe = find_piper(self.settings.piper_binary)
        voice = self.settings.piper_voice
        if not exe or not voice or not Path(voice).exists():
            raise VoiceUnavailable("Speech synthesis not installed (Piper + JARVIS_PIPER_VOICE)")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            out = f.name
        try:
            proc = await asyncio.create_subprocess_exec(
                exe, "--model", voice, "--output_file", out,
                stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE)
            _, err = await asyncio.wait_for(proc.communicate(text[:4000].encode("utf-8")), timeout=120)
            if proc.returncode != 0:
                raise VoiceUnavailable(f"Piper failed: {err.decode(errors='replace')[:300]}")
            return Path(out).read_bytes()
        finally:
            Path(out).unlink(missing_ok=True)
