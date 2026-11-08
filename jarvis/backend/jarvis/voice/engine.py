"""Local speech: recognition (faster-whisper) and synthesis (Piper).

Both are optional. ``status()`` reports exactly what is available so the UI
never claims a capability that is not installed.
"""

from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path
from typing import Any

from ..config import Settings


class VoiceUnavailable(RuntimeError):
    pass


class VoiceEngine:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._whisper = None
        self._lock = asyncio.Lock()

    def status(self) -> dict[str, Any]:
        try:
            import faster_whisper  # type: ignore  # noqa: F401
            stt = True
        except ImportError:
            stt = False
        piper = shutil.which(self.settings.piper_binary) is not None
        voice_ok = bool(self.settings.piper_voice and Path(self.settings.piper_voice).exists())
        return {
            "stt": {"available": stt, "engine": "faster-whisper", "model": self.settings.whisper_model,
                    "hint": None if stt else "pip install faster-whisper"},
            "tts": {"available": piper and voice_ok, "engine": "piper",
                    "hint": None if piper and voice_ok else
                    "install Piper and set JARVIS_PIPER_VOICE to an .onnx voice (see docs/SETUP.md)"},
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

    async def synthesize(self, text: str) -> bytes:
        exe = shutil.which(self.settings.piper_binary)
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
