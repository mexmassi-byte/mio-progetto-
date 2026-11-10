import { useCallback, useEffect, useRef, useState } from "react";
import { api, streamChat, synthesize, uploadAudio } from "../api/client";
import { takeWake } from "../state/wake";
import type { SystemStatus } from "../api/types";
import { Visual } from "../components/Visual";
import { events, useEventListener } from "../state/events";
import { VoiceSphere, VoiceState } from "../visuals/voiceSphere";

const SILENCE_MS = 1300;
const SPEECH_RMS = 0.035;

/** RMS level (0..1) of an analyser's current time-domain buffer. */
function rms(an: AnalyserNode, buf: Float32Array): number {
  an.getFloatTimeDomainData(buf);
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.min(1, Math.sqrt(s / buf.length) * 4);
}

export function VoicePage({ status }: { status: SystemStatus | null }) {
  const sphere = useRef<VoiceSphere | null>(null);
  const [state, setStateRaw] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [amplitudeSource, setAmplitudeSource] = useState<"mic" | "tts" | "none">("none");
  const conv = useRef<string | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const abort = useRef<AbortController | null>(null);
  const meter = useRef(0);
  const stateRef = useRef<VoiceState>("idle");

  const sttOk = status?.voice.stt.available ?? false;
  const ttsOk = status?.voice.tts.available ?? false;

  const setState = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setStateRaw(s);
    sphere.current?.setState(s);
    api.post("/events/voice", { state: s }).catch(() => undefined);
  }, []);

  // Audio level loop: only real measured audio reaches the sphere.
  useEffect(() => {
    const buf = new Float32Array(1024);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const an = analyser.current;
      const level = an ? rms(an, buf) : 0;
      meter.current = level;
      sphere.current?.setAudioLevel(level);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    player.current?.pause();
    audioCtx.current?.close();
    abort.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  function ctx(): AudioContext {
    if (!audioCtx.current) audioCtx.current = new AudioContext();
    return audioCtx.current;
  }

  async function listen() {
    if (stateRef.current === "speaking" || stateRef.current === "thinking") {
      interrupt();
      return;
    }
    if (!sttOk) {
      setNote("Riconoscimento vocale locale non installato: usa la tastiera qui sotto. " + (status?.voice.stt.hint ?? ""));
      return;
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = media;
      const c = ctx();
      const src = c.createMediaStreamSource(media);
      const an = c.createAnalyser();
      an.fftSize = 2048;
      src.connect(an);
      analyser.current = an;
      setAmplitudeSource("mic");
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(media);
      recorder.current = rec;
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        media.getTracks().forEach((t) => t.stop());
        analyser.current = null;
        setAmplitudeSource("none");
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 2000) {
          setState("idle");
          return;
        }
        setState("thinking");
        try {
          const r = await uploadAudio(blob);
          setTranscript(r.text);
          if (r.text.trim()) await ask(r.text);
          else setState("idle");
        } catch (err) {
          setNote(String((err as Error).message));
          setState("idle");
        }
      };
      rec.start(250);
      setState("listening");
      // Simple voice-activity detection: stop after a pause once speech was heard.
      let heard = false;
      let silentSince = performance.now();
      const started = performance.now();
      const check = () => {
        if (rec.state !== "recording") return;
        const lvl = meter.current;
        const t = performance.now();
        if (lvl > SPEECH_RMS) {
          heard = true;
          silentSince = t;
        }
        if ((heard && t - silentSince > SILENCE_MS) || t - started > 30000) rec.stop();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    } catch (err) {
      setNote(`Microfono non disponibile: ${(err as Error).message}`);
      setState("idle");
    }
  }

  function interrupt() {
    turn.current++; // stops the sentences still queued
    presenting.current = false;
    abort.current?.abort();
    player.current?.pause();
    window.speechSynthesis?.cancel();
    if (recorder.current?.state === "recording") recorder.current.stop();
    analyser.current = null;
    setAmplitudeSource("none");
    setState("idle");
  }

  /** Each answer is a "turn": interrupting or asking again stops the old one. */
  const turn = useRef(0);

  async function ask(text: string) {
    const my = ++turn.current;
    const alive = () => turn.current === my;
    setState("thinking");
    setAnswer("");
    let full = "";
    let cut = 0; // characters already sent to the voice
    // JARVIS starts talking at the first complete sentence, while the rest is
    // still being written: one sentence is synthesized while the previous plays.
    let synth: Promise<unknown> = Promise.resolve();
    let playing: Promise<void> = Promise.resolve();
    const enqueue = (sentence: string) => {
      const clean = sentence.replace(/[*#`_>]/g, "").trim();
      if (!clean) return;
      if (!ttsOk) {
        playing = playing.then(() => (alive() ? speakSystem(clean) : undefined));
        return;
      }
      const clip = synth.then(() => synthesize(clean)).catch((err) => {
        setNote(`Sintesi vocale non riuscita: ${(err as Error).message}`);
        return null;
      });
      synth = clip;
      playing = playing.then(async () => {
        const blob = await clip;
        if (!alive()) return;
        if (blob) await playBlob(blob);
        else await speakSystem(clean);
      });
    };
    const flush = (final: boolean) => {
      const rest = full.slice(cut);
      let end = final ? rest.length : -1;
      if (!final) {
        const min = cut === 0 ? 12 : 60; // short first sentence = fast start; then fewer, longer pieces
        for (const m of rest.matchAll(/[.!?…](?=\s)/g)) if ((m.index ?? 0) + 1 >= min) end = (m.index ?? 0) + 1;
      }
      if (end > 0) {
        enqueue(rest.slice(0, end));
        cut += end;
      }
    };
    abort.current = new AbortController();
    try {
      await streamChat(text, conv.current, (ev) => {
        if (ev.type === "conversation") conv.current = ev.conversation_id;
        if (ev.type === "token" || ev.type === "reset") {
          full = ev.type === "reset" ? ev.text : full + ev.text;
          if (ev.type === "reset") cut = Math.min(cut, full.length);
          setAnswer(full);
          flush(false);
        }
        if (ev.type === "error") setNote(ev.error);
      }, abort.current.signal, "voice");
    } catch {
      if (alive()) setState("idle");
      return;
    }
    if (!alive()) return;
    flush(true);
    if (!full.trim()) {
      setState("idle");
      return;
    }
    await playing;
    if (alive()) setState("idle");
  }

  /** Play one synthesized clip (measured amplitude drives the sphere). */
  async function playBlob(blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob);
    const el = new Audio(url);
    player.current = el;
    const c = ctx();
    const src = c.createMediaElementSource(el);
    const an = c.createAnalyser();
    an.fftSize = 2048;
    src.connect(an);
    an.connect(c.destination);
    analyser.current = an;
    setAmplitudeSource("tts");
    setState("speaking");
    await new Promise<void>((resolve) => {
      const done = () => {
        URL.revokeObjectURL(url);
        analyser.current = null;
        setAmplitudeSource("none");
        resolve();
      };
      el.onended = done;
      el.onpause = () => { if (!el.ended) done(); };
      el.play().catch(done);
    });
  }

  /** The operating system's voice: its audio cannot be measured, so the
   *  sphere shows the speaking state without fake amplitude. */
  function speakSystem(clean: string): Promise<void> {
    if (!("speechSynthesis" in window)) return Promise.resolve();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "it-IT";
    setAmplitudeSource("none");
    setState("speaking");
    return new Promise<void>((resolve) => {
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  /** Speak and resolve when playback has finished. */
  async function speak(text: string): Promise<void> {
    const clean = text.replace(/[*#`_>]/g, "").slice(0, 1500);
    if (ttsOk) {
      try {
        await playBlob(await synthesize(clean));
        setState("idle");
        return;
      } catch (err) {
        setNote(`Sintesi vocale locale non riuscita: ${(err as Error).message}`);
      }
    }
    await speakSystem(clean);
    setState("idle");
  }

  // Shared conversation with WhatsApp and the dashboard.
  useEffect(() => {
    api.get<{ conversation_id: string }>("/conversations/primary")
      .then((r) => { if (!conv.current) conv.current = r.conversation_id; }).catch(() => undefined);
  }, []);

  /** Subtle two-tone activation sound. */
  function chime() {
    try {
      const c = ctx();
      [880, 1320].forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = f;
        const t = c.currentTime + i * 0.12;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.02);
        g.gain.linearRampToValueAtTime(0, t + 0.11);
        o.connect(g).connect(c.destination);
        o.start(t);
        o.stop(t + 0.12);
      });
    } catch {
      /* audio unavailable */
    }
  }

  // Activation phrase heard (by the always-on listener): greet, then listen.
  // The handler is refreshed every render so it sees the current voice status.
  const onWake = useRef<() => void>(() => undefined);
  onWake.current = async () => {
    const w = takeWake();
    if (!w || stateRef.current !== "idle") return;
    chime();
    await new Promise((r) => window.setTimeout(r, 300));
    if (w.greeting) {
      setTranscript("");
      setAnswer(w.greeting);
      await speak(w.greeting);
    }
    void listen();
  };
  useEffect(() => {
    const handler = () => onWake.current();
    window.addEventListener("jarvis:wake", handler);
    const t = window.setTimeout(handler, 400); // activation that arrived while this screen was loading
    return () => {
      window.removeEventListener("jarvis:wake", handler);
      window.clearTimeout(t);
    };
  }, []);

  const presenting = useRef(false);
  /** JARVIS introduces himself in the three languages (voice test). */
  async function present() {
    if (presenting.current) return;
    presenting.current = true;
    const t = status?.settings.titles ?? { it: "Signore", en: "Sir", de: "Master" };
    const lines = [
      { lang: "it", text: `Buongiorno, ${t.it}. Sono JARVIS, il sistema operativo di VEYRO Web. Tutti i sistemi sono operativi.` },
      { lang: "de", text: `Guten Tag, ${t.de}. Ich bin JARVIS. Ich finde neue Kunden, analysiere Websites und bereite jede Nachricht zu Ihrer Freigabe vor.` },
      { lang: "en", text: `Good evening, ${t.en}. JARVIS is online, and ready to work for you.` },
    ];
    try {
      for (const l of lines) {
        if (!presenting.current) break;
        setTranscript("");
        setAnswer(l.text);
        console.info("JARVIS_SPEAK", l.lang, Date.now());
        await speak(l.text);
        await new Promise((r) => window.setTimeout(r, 450));
      }
    } finally {
      presenting.current = false;
      console.info("JARVIS_SPEAK_END", Date.now());
    }
  }

  // A conversation typed in the command bar also animates the sphere.
  useEventListener(["chat.started", "chat.finished"], (e) => {
    if (stateRef.current !== "idle" && stateRef.current !== "thinking") return;
    if (e.type === "chat.started" && stateRef.current === "idle") sphere.current?.setState("thinking");
    if (e.type === "chat.finished" && stateRef.current === "idle") sphere.current?.setState("idle");
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && (e.target as HTMLElement).tagName !== "INPUT") {
        e.preventDefault();
        if (stateRef.current === "listening") recorder.current?.stop();
        else void listen();
      }
      if (e.key === "Escape") interrupt();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  const STATE_LABEL: Record<VoiceState, string> = { idle: "In attesa", listening: "Ascolto", thinking: "Elaborazione", speaking: "Risposta" };

  return (
    <>
      <Visual<VoiceSphere> create={(s) => new VoiceSphere(s)} onReady={(s) => (sphere.current = s)}
        fallback="WebGL non disponibile: la sfera vocale non può essere disegnata." />
      <div className="overlay" style={{ left: 0, right: 0, top: 26, textAlign: "center" }}>
        <div className="label" style={{ color: "var(--fg)", letterSpacing: ".4em" }}>{STATE_LABEL[state].toUpperCase()}</div>
        <div className="label" style={{ marginTop: 6 }}>
          <span className={`dot ${events.connected ? "on" : "bad"}`} />{events.connected ? "connesso" : "offline"}
          {" · "}audio: {amplitudeSource === "mic" ? "microfono (misurato)" : amplitudeSource === "tts" ? "voce JARVIS (misurata)" :
            state === "speaking" ? "voce di sistema (ampiezza non misurabile)" : "—"}
        </div>
      </div>
      <div className="overlay" style={{ left: "50%", bottom: 84, transform: "translateX(-50%)", width: "min(640px, 90%)", textAlign: "center" }}>
        {transcript && <div className="dim2" style={{ fontFamily: "var(--sans)", fontSize: 13, marginBottom: 6 }}>“{transcript}”</div>}
        {answer && <div style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--fg)", maxHeight: 140, overflow: "auto", marginBottom: 12, whiteSpace: "pre-wrap" }}><span className="subtitle">{answer}</span></div>}
        <div className="row" style={{ justifyContent: "center", marginBottom: 10 }}>
          <button className="btn primary" onClick={() => (state === "listening" ? recorder.current?.stop() : void listen())}>
            {state === "listening" ? "Fine" : state === "idle" ? "Parla (spazio)" : "Interrompi"}
          </button>
          {state === "idle" && <button className="btn" onClick={() => void present()}>Presentati</button>}
        </div>

        {note && <div className="error" style={{ marginTop: 8 }}>{note}</div>}
        {!ttsOk && status && <div className="label" style={{ marginTop: 8 }}>voce di JARVIS non configurata: uso la voce del sistema</div>}
        {ttsOk && status?.voice.tts.engine === "elevenlabs" && <div className="label" style={{ marginTop: 8 }}>voce: Brian · ElevenLabs</div>}
      </div>
    </>
  );
}
