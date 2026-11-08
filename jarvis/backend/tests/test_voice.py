"""Speech synthesis: ElevenLabs first, local fallback, monthly budget, audit."""

from __future__ import annotations

import json

import httpx
import pytest

from jarvis.voice.engine import VoiceEngine, VoiceUnavailable


def _engine(services, handler, **overrides):
    s = services.settings.model_copy(update={"tts_provider": "elevenlabs", "elevenlabs_api_key": "test-key",
                                             "piper_voice": None, **overrides})
    return VoiceEngine(s, services.db, services.audit, transport=httpx.MockTransport(handler))


async def test_elevenlabs_success_counts_chars_and_audits(services):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers["xi-api-key"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, content=b"ID3fake-mp3")

    v = _engine(services, handler)
    audio, media = await v.speak("Buongiorno Massimiliano.")
    assert (audio, media) == (b"ID3fake-mp3", "audio/mpeg") and v.last_engine == "elevenlabs"
    assert "nPczCjzI2devNBz1zQrb" in seen["url"] and seen["key"] == "test-key"
    assert seen["body"]["model_id"] == "eleven_multilingual_v2"
    assert v.chars_used() == len("Buongiorno Massimiliano.")
    entry = next(a for a in services.audit.list() if a["action"] == "tts:elevenlabs")
    assert entry["decision"] == "succeeded" and "Massimiliano" not in json.dumps(entry)  # text never logged


async def test_refusal_without_local_voice_explains_why(services):
    def handler(request):
        return httpx.Response(402, json={"detail": {"message": "paid plan required"}})

    with pytest.raises(VoiceUnavailable, match="402: paid plan required"):
        await _engine(services, handler).speak("Ciao")


async def test_fallback_to_local_voice(services, monkeypatch):
    def handler(request):
        raise httpx.ConnectError("offline")

    v = _engine(services, handler)
    monkeypatch.setattr(v, "_piper_ready", lambda: True)

    async def fake_piper(text):
        return b"RIFFlocal"

    monkeypatch.setattr(v, "synthesize", fake_piper)
    audio, media = await v.speak("Ciao")
    assert (audio, media, v.last_engine) == (b"RIFFlocal", "audio/wav", "piper")


async def test_monthly_budget_switches_to_local(services, monkeypatch):
    calls = []

    def handler(request):
        calls.append(1)
        return httpx.Response(200, content=b"mp3")

    v = _engine(services, handler, elevenlabs_monthly_chars=10)
    monkeypatch.setattr(v, "_piper_ready", lambda: True)

    async def fake_piper(text):
        return b"RIFF"

    monkeypatch.setattr(v, "synthesize", fake_piper)
    assert (await v.speak("12345"))[1] == "audio/mpeg"
    assert (await v.speak("123456"))[1] == "audio/wav"  # 5 + 6 > 10
    assert len(calls) == 1


def test_status_reports_engine(services):
    v = _engine(services, lambda r: httpx.Response(200))
    st = v.status()["tts"]
    assert st["available"] and st["engine"] == "elevenlabs" and st["chars_budget_month"] == 10000
