// Speak a text with JARVIS's voice (ElevenLabs/Piper through the backend),
// falling back to the system voice. Used where JARVIS talks over a screen
// (e.g. the Command Center summary) without switching to the voice sphere.
import { synthesize } from "../api/client";

let current: HTMLAudioElement | null = null;

export function stopSpeaking() {
  current?.pause();
  current = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export async function speakText(text: string, lang: string): Promise<void> {
  stopSpeaking();
  try {
    const blob = await synthesize(text);
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    current = el;
    await new Promise<void>((resolve) => {
      const done = () => {
        URL.revokeObjectURL(url);
        if (current === el) current = null;
        resolve();
      };
      el.onended = done;
      el.onpause = () => { if (!el.ended) done(); };
      el.play().catch(done); // autoplay may be blocked before the first click: stay silent
    });
    return;
  } catch {
    /* JARVIS voice not available: system voice below */
  }
  if (!("speechSynthesis" in window)) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = { it: "it-IT", de: "de-DE", en: "en-GB" }[lang] ?? "it-IT";
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}
