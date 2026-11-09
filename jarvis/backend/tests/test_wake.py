"""Activation phrases: matcher, segmenter and the activation flow."""

from __future__ import annotations

import numpy as np
import pytest

from jarvis.voice.wake import PHRASES, RATE, Segmenter, WakeService, match_phrase

ALL = [(lang, p) for lang, ps in PHRASES.items() for p in ps]


@pytest.mark.parametrize("lang,phrase", ALL)
def test_all_nine_phrases(lang, phrase):
    hit = match_phrase(phrase)
    assert hit and hit["lang"] == lang and hit["phrase"] == phrase


@pytest.mark.parametrize("heard,lang", [
    ("Giarvis, sono a casa!", "it"), ("hey jarvis sono a casa", "it"), ("Jarvis... sono tornato", "it"),
    ("Hey, Jarvis, I'm home.", "en"), ("Jarvis I am back", "en"), ("Jervis, I'm home", "en"),
    ("Jarvis, ich bin zuhause.", "de"), ("Hey Jarvis, ich bin zu Hause", "de"), ("Jarvis, ich bin zurueck", "de"),
])
def test_tolerates_transcription_variants(heard, lang):
    hit = match_phrase(heard)
    assert hit and hit["lang"] == lang


@pytest.mark.parametrize("heard", [
    "sono a casa", "I'm home", "Jarvis, che ore sono?", "Jarvis, apri il calendario", "Hallo, ich bin Markus",
    "la casa è in ordine", "",
])
def test_ignores_other_speech(heard):
    assert match_phrase(heard) is None


def test_segmenter_finds_speech_between_silences():
    rng = np.random.default_rng(1)
    noise = lambda s: (rng.standard_normal(int(s * RATE)) * 0.002).astype("float32")  # noqa: E731
    t = np.arange(int(1.2 * RATE)) / RATE
    voice = (0.2 * np.sin(2 * np.pi * 220 * t)).astype("float32")
    audio = np.concatenate([noise(1.0), voice, noise(1.0), voice[: int(0.2 * RATE)], noise(1.0)])
    seg = Segmenter(0.6)
    out = []
    for i in range(0, len(audio), 1600):
        out += seg.feed(audio[i:i + 1600])
    assert len(out) == 1  # the 0.2 s click is too short to count
    assert 1.1 * RATE < len(out[0]) < 2.2 * RATE


async def test_activation_greets_and_runs_the_next_instruction(services, llm):
    heard = iter([("Hey Jarvis, sono a casa.", "it"), ("Com'è andata oggi?", "it")])
    played = []

    async def fake_transcribe(audio, suffix, language):
        text, lang = next(heard)
        return {"text": text, "language": lang}

    async def fake_speak(text):
        return text.encode(), "audio/mpeg"

    services.voice.transcribe = fake_transcribe
    services.voice.speak = fake_speak
    wake = WakeService(services, recognizer=lambda s, language=None, stage="screen": next(heard), player=lambda data, suffix: played.append(data))
    llm.queue("Oggi ho trovato tre potenziali clienti, Signore.")
    hit = await wake.process_segment(np.zeros(RATE, dtype="float32"))
    assert hit["lang"] == "it" and hit["greeting"] in ("Bentornato, Signore.", "Bentornato a casa, Signore.")
    assert played[0][:4] == b"RIFF" and played[1].decode() == hit["greeting"]  # chime, then greeting
    r = await wake.process_segment(np.zeros(RATE, dtype="float32"))
    assert r == {"instruction": "Com'è andata oggi?"}
    assert played[-1].decode() == "Oggi ho trovato tre potenziali clienti, Signore."
    conv = services.channels.primary_conversation()
    assert services.chat.messages(conv)[0]["meta"]["channel"] == "voice"  # shared conversation
    assert any(e["type"] == "voice.wake" for e in services.bus.recent(50))


def test_settings_and_unavailable_microphone_are_reported(services):
    wake = WakeService(services)
    cfg = wake.configure(enabled=True, sensitivity=0.8)
    assert cfg["enabled"] and cfg["sensitivity"] == 0.8 and not cfg["muted"]
    st = wake.status()
    assert set(st["phrases"]) == {"it", "en", "de"} and all(len(v) == 3 for v in st["phrases"].values())
