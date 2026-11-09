import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import { speakText, stopSpeaking } from "../state/speech";
import type { Dashboard, SystemStatus } from "../api/types";
import { DotBars } from "../components/DotBars";
import { Visual } from "../components/Visual";
import { usePoll } from "../state/events";
import { CATEGORIES, DataLandscape, Series } from "../visuals/dataLandscape";
import { describeEvent, hhmm, STATUS_LABEL } from "../util";

const CAT_LABEL: Record<string, string> = { tasks: "TASK", research: "RICERCA", leads: "LEAD", chat: "DIALOGO", dev: "SVILUPPO" };

/** Technical events not worth showing in the activity feed. */
const HIDDEN_EVENTS = new Set(["voice.state", "chat.tool", "chat.finished", "goals.update", "dev.file_written"]);

const ROW_LABEL: Record<string, string> = { ...STATUS_LABEL, user_preference: "preferenze", company: "azienda",
  strategy: "strategia", customer: "clienti", project: "progetti", task: "documenti", decision: "decisioni",
  procedure: "procedure", lesson: "lezioni" };

/** Tiny monospace table of real counts (empty categories are shown as "—"). */
function TinyTable({ title, rows }: { title: string; rows: Record<string, number> }) {
  const entries = Object.entries(rows).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = entries.reduce((a, [, n]) => a + n, 0);
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: 2, marginBottom: 3 }}>
        <span className="label" style={{ fontSize: 8.5 }}>{title}</span>
        <span className="label num" style={{ fontSize: 8.5 }}>{total}</span>
      </div>
      {entries.length === 0 && <div style={{ fontSize: 9, color: "var(--fg-4)" }}>—</div>}
      {entries.map(([k, n]) => (
        <div key={k} className="row" style={{ justifyContent: "space-between", fontSize: 9, lineHeight: 1.6, gap: 6, flexWrap: "nowrap" }}>
          <span style={{ color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(ROW_LABEL[k] ?? k).toUpperCase()}</span>
          <span className="num" style={{ color: "var(--fg-2)" }}>{n}</span>
        </div>
      ))}
    </div>
  );
}

export function Overview({ status }: { status: SystemStatus | null }) {
  const { data, error } = usePoll<Dashboard>("/dashboard?hours=48", 30000, ["task.", "research.", "lead.", "mission.", "chat.finished"]);
  const sceneRef = useRef<DataLandscape | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);

  /** JARVIS reads the real numbers aloud (computed by the backend, never by the model). */
  async function explain(auto = false) {
    if (auto) {
      let last = 0;
      try {
        last = Number(localStorage.getItem("jarvis.lastSummary") || 0);
      } catch {
        /* ignore */
      }
      if (Date.now() - last < 10 * 60_000) return; // automatic summary at most every 10 minutes
    }
    try {
      localStorage.setItem("jarvis.lastSummary", String(Date.now()));
    } catch {
      /* ignore */
    }
    try {
      const r = await api.get<{ text: string; lang: string }>(`/summary?lang=${status?.settings.language ?? "it"}`);
      setSpeaking(r.text);
      await speakText(r.text, r.lang);
    } finally {
      setSpeaking(null);
    }
  }

  useEffect(() => {
    const onSummary = (e: Event) => void explain(!!(e as CustomEvent).detail?.auto);
    window.addEventListener("jarvis:summary", onSummary);
    return () => {
      window.removeEventListener("jarvis:summary", onSummary);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.settings.language]);
  const labelsRef = useRef<HTMLDivElement>(null);

  // Adaptive window: start shortly before the first activity (at least 12 h),
  // so recent work spreads across the terrain instead of one edge.
  const span = useMemo(() => {
    if (!data) return null;
    const first = data.activity.findIndex((a) => a.total > 0);
    const start = first < 0 ? 0 : Math.max(0, Math.min(first - 2, data.activity.length - 12));
    return data.activity.slice(start);
  }, [data]);

  const series: Series | null = useMemo(() => {
    if (!span) return null;
    const s = {} as Series;
    for (const c of CATEGORIES) s[c] = span.map((a) => a[c]);
    return s;
  }, [span]);

  useEffect(() => {
    if (series && sceneRef.current) sceneRef.current.setData(series);
  }, [series]);

  // Keep the axis labels attached to the 3D ground plane.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const scene = sceneRef.current;
      const el = labelsRef.current;
      if (!scene || !el) return;
      el.querySelectorAll<HTMLElement>("[data-u]").forEach((node) => {
        const p = scene.project(Number(node.dataset.u), Number(node.dataset.v));
        node.style.transform = `translate(${p.x}px, ${p.y}px)`;
        node.style.opacity = p.visible ? "1" : "0";
      });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  const total48 = data?.activity.reduce((a, b) => a + b.total, 0) ?? 0;
  const qualified = data?.sales.by_status.qualified ?? 0;
  const tasksOk = data?.task_status.succeeded ?? 0;
  const tasksFail = data?.task_status.failed ?? 0;
  const hours = data?.activity.map((a) => a.hour.slice(11, 13) + "h") ?? [];

  return (
    <>
      <Visual<DataLandscape>
        create={(stage) => new DataLandscape(stage)}
        onReady={(scene) => {
          sceneRef.current = scene;
          if (series) scene.setData(series);
        }}
        fallback="WebGL non disponibile: il paesaggio dati non può essere disegnato. I dati restano nei pannelli."
      />
      <div className="overlay" ref={labelsRef} style={{ inset: 0 }}>
        {CATEGORIES.map((c, i) => (
          <span key={c} data-u="-0.01" data-v={(i + 0.5) / CATEGORIES.length}
            style={{ position: "absolute", left: 0, top: 0, marginLeft: -64, fontSize: 9, letterSpacing: ".14em", color: "var(--fg-3)" }}>
            {CAT_LABEL[c]}
          </span>
        ))}
        {[0, 0.5, 1].map((u) => (
          <span key={u} data-u={u} data-v="1.02"
            style={{ position: "absolute", left: 0, top: 0, fontSize: 9, color: "var(--fg-3)", marginLeft: -14 }}>
            {u === 1 ? "ORA" : `-${Math.round((span?.length ?? 48) * (1 - u))}H`}
          </span>
        ))}
      </div>

      {/* top-left: system readout */}
      <div className="overlay readout" style={{ left: 0, top: 0, padding: "18px 60px 30px 22px", width: 400 }}>
        <div className="h1">Command Center</div>
        <div className="label" style={{ marginBottom: 10 }}>VEYRO WEB · OPERATIONAL INTELLIGENCE</div>
        <button className="btn" style={{ marginBottom: 14 }} onClick={() => (speaking ? stopSpeaking() : void explain())}>
          {speaking ? "■ Interrompi" : "▶ Ascolta il riepilogo"}
        </button>
        <div className="kv">
          <span>Eventi 48h</span><span className="num">{total48}</span>
          <span>Passi completati</span><span className="num">{tasksOk}{tasksFail ? ` · falliti ${tasksFail}` : ""}</span>
          <span>Memorie</span><span className="num">{Object.values(data?.memory ?? {}).reduce((a, b) => a + b, 0)}</span>
          <span>Bozze outreach</span><span className="num">{data?.sales.drafts ?? 0}</span>
          <span>Modello</span><span>{status?.llm.model ?? "…"} {status && !status.llm.ok && <span className="error">· offline</span>}</span>
        </div>
        {error && <p className="error">{error}</p>}
        {data && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 22px", marginTop: 22 }}>
            <TinyTable title="Missioni" rows={data.mission_status} />
            <TinyTable title="Passi" rows={data.task_status} />
            <TinyTable title="Pipeline" rows={data.sales.by_status} />
            <TinyTable title="Memoria" rows={data.memory} />
          </div>
        )}
      </div>

      {/* thin technical strip, as in the reference */}
      {data && (
        <div className="overlay" style={{ left: 380, right: 400, top: 22, display: "flex", gap: 26, fontSize: 9, letterSpacing: ".1em", color: "var(--fg-3)", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span>EVT·TOT <b className="num" style={{ color: "var(--fg-2)", fontWeight: 400 }}>{data.events_total}</b></span>
          <span>FINESTRA <b className="num" style={{ color: "var(--fg-2)", fontWeight: 400 }}>{span?.length ?? 0}H</b></span>
          <span>PICCO/H <b className="num" style={{ color: "var(--fg-2)", fontWeight: 400 }}>{Math.max(0, ...(span ?? []).map((a) => a.total))}</b></span>
          <span>APPROV <b className="num" style={{ color: "var(--fg-2)", fontWeight: 400 }}>{data.approvals_pending}</b></span>
          <span>TICK <b className="num" style={{ color: "var(--fg-2)", fontWeight: 400 }}>{data.engine.last_tick ? data.engine.last_tick.slice(11, 19) : "—"}</b></span>
        </div>
      )}

      {/* right column: missions + events */}
      <div className="overlay" style={{ right: 22, top: 18, width: 340, bottom: 230, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ textAlign: "right" }}>
          <div className="bignum num">{qualified}<span style={{ color: "var(--fg-3)" }}>/{data?.sales.total ?? 0}</span></div>
          <div className="label">lead qualificati / totali</div>
          {data && data.sales.verified_revenue_eur > 0 && (
            <div className="label" style={{ marginTop: 6 }}>fatturato verificato € {data.sales.verified_revenue_eur.toLocaleString("it-IT")}</div>
          )}
        </div>
        <div className="panel">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="label">Missioni attive</span>
            <span className="label num">{data?.missions_active.length ?? 0}</span>
          </div>
          {(data?.missions_active ?? []).slice(0, 6).map((m) => (
            <a key={m.id} href="#missions" style={{ display: "block", textDecoration: "none", margin: "8px 0" }}>
              <div style={{ color: "var(--fg)", fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.objective}</div>
              <div className="row" style={{ gap: 8 }}>
                <div className="bar" style={{ flex: 1 }}><i style={{ width: `${Math.round(m.progress.ratio * 100)}%` }} /></div>
                <span className="dim num">{m.progress.finished}/{m.progress.total || "?"} · {STATUS_LABEL[m.status] ?? m.status}</span>
              </div>
            </a>
          ))}
          {data && data.missions_active.length === 0 && <div className="dim" style={{ marginTop: 6 }}>Nessuna missione in corso.</div>}
        </div>
        <div className="panel" style={{ flex: 1, overflow: "hidden" }}>
          <span className="label">Eventi</span>
          <div className="feed" style={{ marginTop: 6 }}>
            {(data?.recent_events ?? []).filter((e) => !HIDDEN_EVENTS.has(e.type)).slice(-14).reverse().map((e) => (
              <div key={e.id} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span className="ts">{hhmm(e.ts)}</span>{describeEvent(e.type, e.payload)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {data && total48 === 0 && (
        <div className="overlay" style={{ left: "50%", top: "38%", transform: "translate(-50%,-50%)", textAlign: "center", width: 420 }}>
          <div className="label" style={{ color: "var(--fg-2)" }}>Nessuna attività nelle ultime 48 ore</div>
          <div className="dim" style={{ marginTop: 6, fontFamily: "var(--sans)", fontSize: 12 }}>
            Il paesaggio si forma con il lavoro reale di JARVIS: ogni rilievo è un'ora di attività di una categoria.
          </div>
        </div>
      )}

      {speaking && (
        <div className="overlay" style={{ left: "50%", bottom: 182, transform: "translateX(-50%)", width: "min(760px, 80%)", textAlign: "center" }}>
          <div className="label" style={{ marginBottom: 6, color: "var(--fg)" }}><span className="dot on" />JARVIS · riepilogo</div>
          <span className="subtitle" style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--fg)", lineHeight: 1.6 }}>{speaking}</span>
        </div>
      )}

      {/* bottom: dotted histograms from real data */}
      <div className="overlay" style={{ left: 22, right: 22, bottom: 74, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
        <DotBars title="Attività per ora · 48h" values={data?.activity.map((a) => a.total) ?? []} labels={hours} height={86} />
        <DotBars title="Nuovi lead per giorno" values={data?.sales.per_day.map((d) => d.n) ?? []}
          labels={data?.sales.per_day.map((d) => d.day.slice(5)) ?? []} height={86} />
      </div>
    </>
  );
}
