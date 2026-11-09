import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { speakText } from "../state/speech";
import { CelebrationScene, T } from "../visuals/celebration";
import { playCelebration, toWav } from "../visuals/celebrationSound";
import { Stage, prefersReducedMotion } from "../visuals/stage";

interface Mission {
  id: string;
  kind: string;
  status: string;
  objective: string;
  started_at: string | null;
  finished_at: string | null;
  verification: { passed?: boolean | null; check?: string } | null;
  tasks: { status: string }[];
}

const KIND: Record<string, string> = {
  lead_acquisition: "ACQUISIZIONE CLIENTI", website_audit: "AUDIT SITI WEB", dev_project: "SVILUPPO",
  freeform: "MISSIONE", auto: "MISSIONE",
};

declare global {
  interface Window {
    /** Frame-exact capture for the demo video: the timeline follows this clock. */
    __celebrationClock?: number;
    __celebrationCapture?: boolean;
    __celebrationAudio?: () => Promise<string>;
  }
}

const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp(x), 3);

function duration(m: Mission): string | null {
  if (!m.started_at || !m.finished_at) return null;
  const s = Math.max(0, Math.round((Date.parse(m.finished_at) - Date.parse(m.started_at)) / 1000));
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The verification check, e.g. "lead qualificati con audit e bozza: 3 / 3". */
function parseCheck(check: string | undefined): { label: string; n: number; m: number } | null {
  const r = /^(.*?):\s*(\d+)\s*\/\s*(\d+)/.exec(check ?? "");
  return r ? { label: r[1].trim(), n: +r[2], m: +r[3] } : null;
}

/** Full-screen "mission accomplished" sequence, with the mission's real numbers. */
export function Celebration({ mission, title, onDone }: { mission: Mission; title: string; onDone: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [t, setT] = useState(0);
  const [closing, setClosing] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const done = useRef(onDone);
  done.current = onDone;
  const capture = !!window.__celebrationCapture;

  const check = parseCheck(mission.verification?.check);
  const ok = mission.tasks.filter((x) => x.status === "succeeded").length;
  const dur = duration(mission);

  useEffect(() => {
    let stage: Stage | null = null;
    let scene: CelebrationScene | null = null;
    try {
      stage = new Stage(canvas.current!, 40);
      stage.fixed = capture;
      scene = new CelebrationScene(stage, "Missione compiuta");
      stage.mount(scene);
    } catch {
      setNoGL(true);
    }
    if (capture) {
      // Demo export: the same sound, rendered offline as a WAV (base64).
      window.__celebrationAudio = async () => {
        const off = new OfflineAudioContext(2, Math.ceil(44100 * (T.end + 1)), 44100);
        playCelebration(off, 0);
        const wav = toWav(await off.startRendering());
        const bytes = new Uint8Array(await wav.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      };
    }
    const skip = prefersReducedMotion() ? T.form + 2 : 0;
    const t0 = performance.now();
    let raf = 0;
    let audio: AudioContext | null = null;
    let spoke = false;
    if (!capture && !skip) {
      try {
        audio = new AudioContext();
        void audio.resume();
        playCelebration(audio, audio.currentTime + 0.05);
      } catch {
        audio = null;
      }
    }
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = capture ? window.__celebrationClock ?? 0 : skip + (performance.now() - t0) / 1000;
      scene?.setTime(now);
      setT(now);
      if (!capture && !spoke && now > T.info + 0.4) {
        spoke = true;
        const extra = check ? ` Verifica superata: ${check.n} su ${check.m}.` : "";
        void speakText(`Missione compiuta, ${title}.${extra}`, "it");
      }
      if (!capture && now > T.end) done.current();
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      stage?.dispose();
      void audio?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const close = () => {
      setClosing(true);
      window.setTimeout(() => done.current(), 450);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const el = canvas.current?.parentElement;
    el?.addEventListener("click", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      el?.removeEventListener("click", close);
    };
  }, []);

  const info = ease((t - T.info) / 0.8);
  const out = 1 - clamp((t - T.dissolve - 0.2) / 0.9);
  const fade = (delay: number) => ({
    opacity: ease((t - T.info - delay) / 0.7) * out,
    transform: `translateY(${(1 - ease((t - T.info - delay) / 0.7)) * 14}px)`,
  });
  const count = (n: number, delay: number) => Math.round(n * ease((t - T.info - delay) / 1.1));
  const flash = t > T.detonate ? 0.85 * Math.exp(-(t - T.detonate) * 5) : 0;
  const bars = ease(t / 0.6) * (1 - clamp((t - T.dissolve - 0.6) / 1.0));

  return (
    <div className={`celebrate ${closing ? "closing" : ""}`} style={{ opacity: closing ? 0 : ease(t / 0.35) }} role="dialog" aria-label="Missione compiuta">
      <canvas ref={canvas} />
      <div className="celebrate-vignette" />
      <div className="celebrate-bar top" style={{ transform: `scaleY(${bars})` }} />
      <div className="celebrate-bar bottom" style={{ transform: `scaleY(${bars})` }} />
      <div className="celebrate-flash" style={{ opacity: flash }} />
      {noGL && t > T.form && <div className="celebrate-fallback" style={{ opacity: out }}>MISSIONE COMPIUTA</div>}

      <div className="celebrate-top" style={{ opacity: info * out }}>
        <span><span className="dot on" />MISSIONE COMPLETATA · VERIFICATA</span>
        <span className="mono">{mission.id.toUpperCase()}</span>
      </div>

      <div className="celebrate-info">
        <div className="celebrate-kind" style={fade(0)}>{KIND[mission.kind] ?? "MISSIONE"}</div>
        <div className="celebrate-objective" style={fade(0.12)}>{mission.objective}</div>
        <div className="celebrate-stats">
          {check && (
            <div style={fade(0.3)}>
              <b className="num">{count(check.n, 0.3)}<i>/{check.m}</i></b>
              <span>{check.label}</span>
            </div>
          )}
          {dur && (
            <div style={fade(0.42)}>
              <b className="num">{dur}</b>
              <span>durata</span>
            </div>
          )}
          <div style={fade(0.54)}>
            <b className="num">{count(ok, 0.54)}<i>/{mission.tasks.length}</i></b>
            <span>passi riusciti</span>
          </div>
        </div>
      </div>
      {!capture && <div className="celebrate-hint" style={{ opacity: info * out * 0.6 }}>Esc per chiudere</div>}
    </div>
  );
}

/** Listens for completed missions (and replays) and shows the sequence. */
export function CelebrationHost({ title }: { title: string }) {
  const [queue, setQueue] = useState<Mission[]>([]);
  useEffect(() => {
    const on = async (e: Event) => {
      const id = (e as CustomEvent).detail?.missionId;
      if (!id) return;
      try {
        const m = await api.get<Mission>(`/missions/${id}`);
        if (m.status === "completed") setQueue((q) => (q.some((x) => x.id === m.id) ? q : [...q, m]));
      } catch {
        /* mission not readable: nothing to celebrate */
      }
    };
    window.addEventListener("jarvis:celebrate", on);
    return () => window.removeEventListener("jarvis:celebrate", on);
  }, []);
  if (!queue.length) return null;
  return <Celebration key={queue[0].id} mission={queue[0]} title={title} onDone={() => setQueue((q) => q.slice(1))} />;
}
