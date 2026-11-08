import { useEffect, useMemo, useRef } from "react";
import type { Dashboard, SystemStatus } from "../api/types";
import { DotBars } from "../components/DotBars";
import { Visual } from "../components/Visual";
import { usePoll } from "../state/events";
import { CATEGORIES, DataLandscape, Series } from "../visuals/dataLandscape";
import { describeEvent, hhmm, STATUS_LABEL } from "../util";

const CAT_LABEL: Record<string, string> = { tasks: "TASK", research: "RICERCA", leads: "LEAD", chat: "DIALOGO", dev: "SVILUPPO" };

export function Overview({ status }: { status: SystemStatus | null }) {
  const { data, error } = usePoll<Dashboard>("/dashboard?hours=48", 30000, ["task.", "research.", "lead.", "mission.", "chat.finished"]);
  const sceneRef = useRef<DataLandscape | null>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  // Adaptive window: start shortly before the first activity (at least 12 h),
  // so recent work spreads across the terrain instead of one edge.
  const window = useMemo(() => {
    if (!data) return null;
    const first = data.activity.findIndex((a) => a.total > 0);
    const start = first < 0 ? 0 : Math.max(0, Math.min(first - 2, data.activity.length - 12));
    return data.activity.slice(start);
  }, [data]);

  const series: Series | null = useMemo(() => {
    if (!window) return null;
    const s = {} as Series;
    for (const c of CATEGORIES) s[c] = window.map((a) => a[c]);
    return s;
  }, [window]);

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
            {u === 1 ? "ORA" : `-${Math.round((window?.length ?? 48) * (1 - u))}H`}
          </span>
        ))}
      </div>

      {/* top-left: system readout */}
      <div className="overlay" style={{ left: 22, top: 18, width: 300 }}>
        <div className="h1">Command Center</div>
        <div className="label" style={{ marginBottom: 14 }}>VEYRO WEB · OPERATIONAL INTELLIGENCE</div>
        <div className="kv">
          <span>Eventi 48h</span><span className="num">{total48}</span>
          <span>Passi completati</span><span className="num">{tasksOk}{tasksFail ? ` · falliti ${tasksFail}` : ""}</span>
          <span>Memorie</span><span className="num">{Object.values(data?.memory ?? {}).reduce((a, b) => a + b, 0)}</span>
          <span>Bozze outreach</span><span className="num">{data?.sales.drafts ?? 0}</span>
          <span>Modello</span><span>{status?.llm.model ?? "…"} {status && !status.llm.ok && <span className="error">· offline</span>}</span>
        </div>
        {error && <p className="error">{error}</p>}
      </div>

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
            {(data?.recent_events ?? []).slice(-14).reverse().map((e) => (
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

      {/* bottom: dotted histograms from real data */}
      <div className="overlay" style={{ left: 22, right: 22, bottom: 74, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 30 }}>
        <DotBars title="Attività per ora · 48h" values={data?.activity.map((a) => a.total) ?? []} labels={hours} height={86} />
        <DotBars title="Nuovi lead per giorno" values={data?.sales.per_day.map((d) => d.n) ?? []}
          labels={data?.sales.per_day.map((d) => d.day.slice(5)) ?? []} height={86} />
      </div>
    </>
  );
}
