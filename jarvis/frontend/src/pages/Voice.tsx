import { useCallback, useEffect, useRef, useState } from "react";
import { api, streamChat, synthesize, uploadAudio } from "../api/client";
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
    abort.current?.abort();
    player.current?.pause();
    window.speechSynthesis?.cancel();
    if (recorder.current?.state === "recording") recorder.current.stop();
    analyser.current = null;
    setAmplitudeSource("none");
    setState("idle");
  }

  async function ask(text: string) {
    setState("thinking");
    setAnswer("");
    let full = "";
    abort.current = new AbortController();
    try {
      await streamChat(text, conv.current, (ev) => {
        if (ev.type === "conversation") conv.current = ev.conversation_id;
        if (ev.type === "token") {
          full += ev.text;
          setAnswer(full);
        }
        if (ev.type === "error") setNote(ev.error);
      }, abort.current.signal, "voice");
    } catch {
      setState("idle");
      return;
    }
    if (stateRef.current !== "thinking" || !full.trim()) {
      setState("idle");
      return;
    }
    await speak(full);
  }

  async function speak(text: string) {
    const clean = text.replace(/[*#`_>]/g, "").slice(0, 1500);
    if (ttsOk) {
      try {
        const wav = await synthesize(clean);
        const url = URL.createObjectURL(wav);
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
        el.onended = () => {
          URL.revokeObjectURL(url);
          analyser.current = null;
          setAmplitudeSource("none");
          setState("idle");
        };
        await el.play();
        return;
      } catch (err) {
        setNote(`Sintesi vocale locale non riuscita: ${(err as Error).message}`);
      }
    }
    // Fallback: the operating system's voice. Its audio cannot be measured,
    // so the sphere shows the speaking state without fake amplitude.
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = "it-IT";
      u.onend = () => setState("idle");
      setAmplitudeSource("none");
      setState("speaking");
      window.speechSynthesis.speak(u);
    } else setState("idle");
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
        {answer && <div style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--fg)", maxHeight: 140, overflow: "auto", marginBottom: 12, whiteSpace: "pre-wrap" }}>{answer}</div>}
        <div className="row" style={{ justifyContent: "center", marginBottom: 10 }}>
          <button className="btn primary" onClick={() => (state === "listening" ? recorder.current?.stop() : void listen())}>
            {state === "listening" ? "Fine" : state === "idle" ? "Parla (spazio)" : "Interrompi"}
          </button>
        </div>

        {note && <div className="error" style={{ marginTop: 8 }}>{note}</div>}
        {!ttsOk && status && <div className="label" style={{ marginTop: 8 }}>voce locale (Piper) non installata: uso la voce del sistema</div>}
      </div>
    </>
  );
}
