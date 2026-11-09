"""Always-on activation phrases, fully local.

Pipeline: microphone (in memory, never stored or sent) -> energy-based speech
segmenter -> local Whisper (tiny) on short segments only -> matcher for the
nine activation phrases (three per language) -> activation.

Why not only openWakeWord: its ready-made model covers English "hey jarvis";
the required phrases include Italian and German sentences ("JARVIS, sono
tornato"), which a transcribe-and-match stage handles locally for all three
languages.

On activation JARVIS greets in the detected language and listens for the next
instruction. If the dashboard is open it takes over (voice visualization);
otherwise the conversation runs headless through the computer's speakers.
"""

from __future__ import annotations

import asyncio
import io
import logging
import random
import re
import subprocess
import sys
import tempfile
import threading
import unicodedata
import wave
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any, Callable

log = logging.getLogger("jarvis.wake")

RATE = 16000

PHRASES: dict[str, list[str]] = {
    "it": ["JARVIS, sono a casa.", "Hey JARVIS, sono a casa.", "JARVIS, sono tornato."],
    "en": ["JARVIS, I'm home.", "Hey JARVIS, I'm home.", "JARVIS, I'm back."],
    "de": ["JARVIS, ich bin zu Hause.", "Hey JARVIS, ich bin zu Hause.", "JARVIS, ich bin zurück."],
}
# General power-on, the same in every language. JARVIS answers in his main language.
UNIVERSAL: list[str] = ["JARVIS, wake up."]
UNIVERSAL_GREETINGS: dict[str, list[str]] = {
    "it": ["Sono qui, {t}. Tutti i sistemi sono operativi.", "Ai suoi ordini, {t}. Tutti i sistemi sono operativi."],
    "en": ["At your service, {t}. All systems are online.", "Good to see you, {t}. All systems are online."],
    "de": ["Zu Ihren Diensten, {t}. Alle Systeme sind bereit.", "Ich bin da, {t}. Alle Systeme sind bereit."],
}
GREETINGS: dict[str, list[str]] = {
    "it": ["Bentornato, {t}.", "Bentornato a casa, {t}."],
    "en": ["Welcome back, {t}.", "Welcome home, {t}."],
    "de": ["Willkommen zurück, {t}.", "Willkommen zu Hause, {t}."],
}
_NAME_VARIANTS = (r"\b(?:jarvis|jarviz|jarvi|javis|jervis|jarves|jarwis|giarvis|giarvi|charvis|dzharvis|jar vis|"
                  r"jarbis|yarvis|jarvys|jarvice)\b")


def normalize(text: str) -> str:
    t = unicodedata.normalize("NFKD", text.lower())
    t = "".join(ch for ch in t if not unicodedata.combining(ch))
    t = t.replace("'", "").replace("’", "")
    t = re.sub(r"[^a-z0-9 ]+", " ", t)
    t = re.sub(_NAME_VARIANTS, "jarvis", t)
    t = re.sub(r"\bzuhause\b", "zu hause", t)
    t = re.sub(r"\bhi jarvis\b|\bhei jarvis\b|\bei jarvis\b", "hey jarvis", t)
    t = re.sub(r"\bi am\b", "im", t)
    t = re.sub(r"\bwakeup\b|\bwake-up\b|\bwakup\b", "wake up", t)
    return " ".join(t.split())


def _content(norm: str) -> str:
    return " ".join(w for w in norm.split() if w not in ("hey", "jarvis"))


_NORM_PHRASES = [(lang, i, normalize(p).startswith("hey "), _content(normalize(p)))
                 for lang, ps in {**PHRASES, "any": UNIVERSAL}.items() for i, p in enumerate(ps)]


def match_phrase(text: str, sensitivity: float = 0.6) -> dict[str, Any] | None:
    """Activation phrase in `text`, or None.

    The name JARVIS must be heard; then only the words after it are compared
    with the second part of each phrase ("sono a casa", "I'm back"...), so
    ordinary requests like "JARVIS, che ore sono?" never activate.
    """
    words = normalize(text).split()
    if "jarvis" not in words:
        return None
    pos = len(words) - 1 - words[::-1].index("jarvis")
    said_hey = pos > 0 and words[pos - 1] == "hey"
    after = words[pos + 1:]
    if not after:
        return None
    threshold = 0.9 - 0.25 * max(0.0, min(1.0, sensitivity))
    best = None
    for lang, idx, has_hey, content in _NORM_PHRASES:
        n = len(content.split())
        score = max(SequenceMatcher(None, " ".join(after[:k]), content).ratio()
                    for k in range(max(1, n - 1), n + 2))
        score += 0.01 if has_hey == said_hey else 0.0  # pick the "Hey" variant when "hey" was said
        if best is None or score > best["score"]:
            phrase = UNIVERSAL[idx] if lang == "any" else PHRASES[lang][idx]
            best = {"lang": lang, "index": idx, "phrase": phrase, "score": round(score, 3)}
    return best if best and best["score"] >= threshold else None


def looks_like_activation(text: str) -> bool:
    """Cheap screen: the name, 'hey', or something close to a phrase ending."""
    norm = normalize(text)
    words = norm.split()
    if not words:
        return False
    if "jarvis" in words or words[0] in ("hey", "ja", "ciao", "hei") or norm.startswith(("jar", "gia", "ya")):
        return True
    contents = {c for _, _, _, c in _NORM_PHRASES}
    for c in contents:
        n = len(c.split())
        for start in range(len(words)):
            if SequenceMatcher(None, " ".join(words[start:start + n]), c).ratio() >= 0.6:
                return True
    return False


def greeting(lang: str, title: str, rnd: random.Random | None = None, universal: bool = False) -> str:
    table = UNIVERSAL_GREETINGS if universal else GREETINGS
    return (rnd or random).choice(table.get(lang, table["it"])).format(t=title)


class Segmenter:
    """Energy-based speech segmentation with an adaptive noise floor."""

    def __init__(self, sensitivity: float = 0.6, frame_ms: int = 30):
        self.frame = int(RATE * frame_ms / 1000)
        self.ratio = 3.2 - 1.6 * max(0.0, min(1.0, sensitivity))  # speech if rms > floor * ratio
        self.floor = 0.004
        self.min_speech = int(0.45 * RATE)
        self.max_len = int(5.0 * RATE)
        self.hangover = int(0.7 * RATE)  # tolerate the pause after "JARVIS,"
        self._buf: list[Any] = []
        self._len = 0
        self._silence = 0
        self._active = False
        self._pending: Any = None

    def feed(self, samples: Any) -> list[Any]:
        """Feed float32 mono samples; returns finished speech segments."""
        import numpy as np
        if self._pending is not None:
            samples = np.concatenate([self._pending, samples])
            self._pending = None
        out = []
        n = len(samples) // self.frame * self.frame
        if n < len(samples):
            self._pending = samples[n:]
        for i in range(0, n, self.frame):
            fr = samples[i:i + self.frame]
            rms = float(np.sqrt(np.mean(fr * fr)) + 1e-9)
            speech = rms > max(self.floor * self.ratio, 0.006)
            if not self._active:
                self.floor = 0.97 * self.floor + 0.03 * min(rms, 0.05)
                if speech:
                    self._active, self._buf, self._len, self._silence = True, [fr], len(fr), 0
                continue
            self._buf.append(fr)
            self._len += len(fr)
            self._silence = 0 if speech else self._silence + len(fr)
            if self._silence >= self.hangover or self._len >= self.max_len:
                seg = np.concatenate(self._buf)
                self._active, self._buf, self._len = False, [], 0
                if len(seg) - self._silence >= self.min_speech:
                    out.append(seg)
        return out


def to_wav(samples: Any) -> bytes:
    import numpy as np
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2").tobytes()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm)
    return buf.getvalue()


def chime() -> bytes:
    """Subtle two-tone activation sound (generated, no asset)."""
    import numpy as np
    t1 = np.arange(int(0.09 * RATE)) / RATE
    t2 = np.arange(int(0.14 * RATE)) / RATE
    env1 = np.sin(np.pi * t1 / t1[-1]) ** 2
    env2 = np.sin(np.pi * t2 / t2[-1]) ** 2
    tone = np.concatenate([0.18 * env1 * np.sin(2 * np.pi * 880 * t1), np.zeros(int(0.03 * RATE)),
                           0.18 * env2 * np.sin(2 * np.pi * 1320 * t2)])
    return to_wav(tone.astype("float32"))


def play_audio(data: bytes, suffix: str = ".wav") -> None:
    """Blocking playback through the computer's speakers."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        path = f.name
    try:
        if sys.platform == "darwin":
            cmd = ["afplay", path]
        else:
            cmd = ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", path]
        subprocess.run(cmd, check=False, timeout=120)
    except (OSError, subprocess.TimeoutExpired) as exc:
        log.warning("audio playback failed: %s", exc)
    finally:
        Path(path).unlink(missing_ok=True)


class WakeService:
    """Background listener. `source` yields float32 chunks (microphone by default)."""

    def __init__(self, services: Any, recognizer: Callable[[Any], tuple[str, str]] | None = None,
                 player: Callable[[bytes, str], None] | None = None):
        self.s = services
        self._recognizer = recognizer
        self._player = player or play_audio
        self._model = None
        self._task: asyncio.Task | None = None
        self._stream = None
        self._queue: asyncio.Queue | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._caffeinate: subprocess.Popen | None = None
        self.state = "off"
        self.error: str | None = None
        self.last: dict[str, Any] | None = None
        self.follow_up_s = 8.0
        self._awaiting_instruction_until = 0.0
        self._lang = "it"

    # ------------------------------------------------------------ settings
    def _cfg(self) -> dict[str, Any]:
        saved = self.s.vault.get("wake_settings") or {}
        st = self.s.settings
        return {"enabled": saved.get("enabled", st.wake_enabled), "muted": saved.get("muted", False),
                "sensitivity": float(saved.get("sensitivity", st.wake_sensitivity))}

    def configure(self, **changes: Any) -> dict[str, Any]:
        cfg = {**self._cfg(), **{k: v for k, v in changes.items() if v is not None}}
        cfg["sensitivity"] = max(0.0, min(1.0, float(cfg["sensitivity"])))
        self.s.vault.set("wake_settings", cfg)
        self.s.audit.record("user", "wake:settings", "changed", **cfg)
        return cfg

    @staticmethod
    def dependencies() -> str | None:
        try:
            import numpy  # noqa: F401
            import sounddevice  # noqa: F401
        except (ImportError, OSError) as exc:
            return f"microphone library not available ({exc.__class__.__name__}): pip install -e \"backend[wake]\""
        try:
            import faster_whisper  # noqa: F401
        except ImportError:
            return "local speech recognition not installed: pip install -e \"backend[wake]\""
        return None

    def status(self) -> dict[str, Any]:
        cfg = self._cfg()
        return {"available": self.dependencies() is None, "hint": self.dependencies(), "state": self.state,
                "error": self.error, **cfg, "phrases": PHRASES, "universal": UNIVERSAL,
                "last": self.last}

    def _set_state(self, state: str) -> None:
        if state != self.state:
            self.state = state
            self.s.bus.emit("mic.state", state=state)

    # ------------------------------------------------------------ lifecycle
    async def apply(self) -> dict[str, Any]:
        """Start/stop according to the settings (enabled, muted)."""
        cfg = self._cfg()
        want = cfg["enabled"] and not cfg["muted"]
        if want and self._task is None:
            problem = self.dependencies()
            if problem:
                self.error = problem
                self._set_state("unavailable")
                return self.status()
            self._start()
        elif not want and self._task is not None:
            await self.stop()
        if not cfg["enabled"]:
            self._set_state("off")
        elif cfg["muted"]:
            self._set_state("muted")
        return self.status()

    def _start(self) -> None:
        import numpy as np
        import sounddevice as sd

        self._loop = asyncio.get_running_loop()
        self._queue = asyncio.Queue(maxsize=200)

        def callback(indata, frames, time_info, status):  # audio thread
            data = np.copy(indata[:, 0]).astype("float32")
            if self._loop and self._queue:
                self._loop.call_soon_threadsafe(self._put, data)

        try:
            self._stream = sd.InputStream(samplerate=RATE, channels=1, dtype="float32", blocksize=int(RATE * 0.1),
                                          callback=callback)
            self._stream.start()
        except Exception as exc:  # no microphone / permission denied
            self.error = f"microphone not accessible: {exc}"
            self._set_state("unavailable")
            self._stream = None
            return
        self.error = None
        self._task = asyncio.create_task(self._run())
        self._keep_awake(True)
        self._set_state("listening")

    def _put(self, data: Any) -> None:
        try:
            self._queue.put_nowait(data)  # type: ignore[union-attr]
        except asyncio.QueueFull:
            pass

    async def stop(self) -> None:
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
            self._task = None
        self._keep_awake(False)

    def _keep_awake(self, on: bool) -> None:
        """macOS: prevent idle sleep while listening (the lid must stay open)."""
        if sys.platform != "darwin":
            return
        if on and self._caffeinate is None:
            try:
                import os
                self._caffeinate = subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())])
            except OSError:
                self._caffeinate = None
        elif not on and self._caffeinate is not None:
            self._caffeinate.terminate()
            self._caffeinate = None

    # ------------------------------------------------------------ processing
    async def _run(self) -> None:
        seg = Segmenter(self._cfg()["sensitivity"])
        while True:
            chunk = await self._queue.get()  # type: ignore[union-attr]
            for segment in seg.feed(chunk):
                await self.process_segment(segment)

    def _recognize(self, samples: Any, language: str | None = None, stage: str = "screen") -> tuple[str, str]:
        if self._recognizer:
            return self._recognizer(samples, language, stage)
        name = self.s.settings.wake_whisper_model if stage == "screen" else self.s.settings.wake_confirm_model
        models = self.__dict__.setdefault("_models", {})
        if name not in models:
            from faster_whisper import WhisperModel
            models[name] = WhisperModel(name, device="auto", compute_type="int8")
        segments, info = models[name].transcribe(samples, beam_size=1, vad_filter=False, language=language,
                                                 initial_prompt="JARVIS.", condition_on_previous_text=False)
        return " ".join(x.text for x in segments).strip(), info.language

    def detect(self, samples: Any) -> tuple[str, dict[str, Any] | None]:
        """Two stages, measured on real speech: the light model screens every
        segment; the accurate one checks only segments that look like an
        activation (13/13 phrases, 0 false activations in the test set).
        Short clips often get the language wrong, so the check retries with
        each language forced when the name is heard."""
        sensitivity = self._cfg()["sensitivity"]
        text, _ = self._recognize(samples, None, "screen")
        hit = match_phrase(text, sensitivity)
        if hit or not looks_like_activation(text):
            return text, hit
        text, _ = self._recognize(samples, None, "confirm")
        hit = match_phrase(text, sensitivity)
        if hit or "jarvis" not in normalize(text).split():
            return text, hit
        best_text, best = text, None
        for lang in ("it", "de", "en"):
            t, _ = self._recognize(samples, lang, "confirm")
            h = match_phrase(t, sensitivity)
            if h and (best is None or h["score"] > best["score"]):
                best_text, best = t, h
        return best_text, best

    def _dashboard_busy(self) -> bool:
        row = self.s.db.one("SELECT payload FROM events WHERE type = 'voice.state' ORDER BY id DESC LIMIT 1")
        return bool(row and '"idle"' not in (row["payload"] or ""))

    async def process_segment(self, samples: Any) -> dict[str, Any] | None:
        """One speech segment: activation phrase, or the instruction after it."""
        import time
        if self._dashboard_busy():
            return None  # the dashboard is talking/listening: do not interfere
        if time.monotonic() < self._awaiting_instruction_until:
            # The instruction after the greeting: the more accurate model of the voice engine.
            try:
                stt = await self.s.voice.transcribe(to_wav(samples), ".wav", None)
                text, lang = stt["text"], stt.get("language") or self._lang
            except Exception:
                text, lang = await asyncio.to_thread(self._recognize, samples)
            if text.strip():
                self._awaiting_instruction_until = 0.0
                await self._instruction(text, lang if lang in PHRASES else self._lang)
                return {"instruction": text}
            return None
        text, hit = await asyncio.to_thread(self.detect, samples)
        if not hit:
            return None
        universal = hit["lang"] == "any"
        # "JARVIS, wake up." is the same in every language: he answers in his main language.
        lang = (self.s.settings.language if self.s.settings.language in PHRASES else "it") if universal else hit["lang"]
        self._lang = lang
        title = {"it": self.s.settings.title_it, "en": self.s.settings.title_en, "de": self.s.settings.title_de}[lang]
        hello = greeting(lang, title, universal=universal)
        hit = {**hit, "lang": lang, "universal": universal}
        self.last = {**hit, "heard": text, "greeting": hello}
        self.s.bus.emit("voice.wake", lang=lang, phrase=hit["phrase"], greeting=hello, score=hit["score"],
                        universal=universal)
        if len(self.s.bus._subscribers) == 0:  # no dashboard open: talk through the speakers
            await self._headless_greeting(hello)
        return self.last

    async def _headless_greeting(self, hello: str) -> None:
        import time
        self._set_state("speaking")
        await asyncio.to_thread(self._player, chime(), ".wav")
        await self._say(hello)
        self._awaiting_instruction_until = time.monotonic() + self.follow_up_s
        self._set_state("listening")

    async def _say(self, text: str) -> None:
        try:
            audio, mime = await self.s.voice.speak(text)
            await asyncio.to_thread(self._player, audio, ".mp3" if "mpeg" in mime else ".wav")
        except Exception as exc:
            log.warning("cannot speak: %s", exc)

    async def _instruction(self, text: str, lang: str) -> None:
        import time
        self._set_state("thinking")
        result = await self.s.channels.owner_says("voice", text)
        reply = result.get("text") or result.get("error") or ""
        self._set_state("speaking")
        await self._say(reply[:1500])
        self._awaiting_instruction_until = time.monotonic() + self.follow_up_s  # natural follow-up
        self._set_state("listening")
