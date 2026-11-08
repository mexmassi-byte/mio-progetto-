import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { JEvent, Lead, Mission } from "../api/types";
import { Visual } from "../components/Visual";
import { useEventListener, useEvents, usePoll } from "../state/events";
import { describeEvent, hhmm, STATUS_LABEL } from "../util";
import { ParticleGlobe } from "../visuals/particleGlobe";

const STAGES: { key: string; label: string }[] = [
  { key: "organize", label: "Pianificazione" },
  { key: "search", label: "Ricerca" },
  { key: "source", label: "Fonti" },
  { key: "analyze", label: "Analisi siti" },
  { key: "evaluate", label: "Valutazione" },
  { key: "done", label: "Organizzazione" },
];

const SECTORS = [
  ["lawyer", "Studi legali"], ["dentist", "Dentisti"], ["clinic", "Cliniche private"], ["aesthetic", "Estetica"],
  ["tax_advisor", "Commercialisti"], ["physiotherapist", "Fisioterapisti"], ["notary", "Notai"], ["architect", "Architetti"],
];

export function ResearchPage() {
  const globe = useRef<ParticleGlobe | null>(null);
  const { events } = useEvents();
  const research = events.filter((e) => e.type.startsWith("research.") || e.type === "lead.created");
  const [now, setNow] = useState(Date.now());
  const { data: missions } = usePoll<Mission[]>("/missions?status=active", 15000, ["mission."]);
  const [form, setForm] = useState({ sector: "dentist", country: "DE", city: "", count: 5 });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 2000);
    return () => window.clearInterval(t);
  }, []);

  const recent = research.filter((e) => now - new Date(e.ts).getTime() < 30000);
  const activity = Math.min(1, recent.length / 12);
  useEffect(() => globe.current?.setActivity(activity), [activity]);
  const last = research[research.length - 1];
  const stage = last && now - new Date(last.ts).getTime() < 60000 ? last.type.split(".")[1] : null;

  const apply = (e: JEvent, live: boolean) => {
    const g = globe.current;
    if (!g) return;
    const p = e.payload;
    if (typeof p.lat === "number" && typeof p.lon === "number") {
      const searched = e.type === "research.location" && p.stage === "search";
      g.addMarker({ lat: p.lat, lon: p.lon, kind: searched ? 1 : 0 });
      if (live && searched) {
        g.addArc(p.lat, p.lon);
        g.focus(p.lat, p.lon);
      } else if (live && e.type === "research.analyze") {
        g.focus(p.lat, p.lon);
      }
    }
  };
  useEventListener(["research.", "lead.created"], (e) => apply(e, true));

  async function onReady(g: ParticleGlobe) {
    globe.current = g;
    await g.ready;
    g.addMarker({ lat: g.base.lat, lon: g.base.lon, kind: 2 });
    // Show where JARVIS has already found businesses (real CRM data).
    try {
      const leads = await api.get<Lead[]>("/leads");
      leads.filter((l) => l.lat != null && l.lon != null).slice(0, 200)
        .forEach((l) => g.addMarker({ lat: l.lat!, lon: l.lon!, kind: l.status === "qualified" ? 1 : 0 }));
    } catch {
      /* offline: the globe still renders */
    }
  }

  async function start(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const label = SECTORS.find((s) => s[0] === form.sector)?.[1] ?? form.sector;
    try {
      const m = await api.post<Mission>("/missions", {
        objective: `Trova ${form.count} ${label.toLowerCase()} qualificati ${form.city ? "a " + form.city : "in " + form.country} come potenziali clienti di VEYRO Web`,
        kind: "lead_acquisition",
        params: { sector: form.sector, country: form.country, city: form.city || null, count: form.count },
      });
      setMsg(`Missione avviata (${m.id}). Il globo mostrerà la ricerca in tempo reale.`);
    } catch (err) {
      setMsg(String((err as Error).message));
    }
  }

  const researchMissions = (missions ?? []).filter((m) => m.kind === "lead_acquisition" || m.kind === "website_audit" || m.kind === "auto");

  return (
    <>
      <Visual<ParticleGlobe> create={(s) => new ParticleGlobe(s)} onReady={(g) => void onReady(g)}
        fallback="WebGL non disponibile: il globo non può essere disegnato. L'attività di ricerca è elencata a destra." />
      <div className="overlay" style={{ left: 22, top: 18, width: 300 }}>
        <div className="h1">Global Research</div>
        <div className="label">Ricerca e navigazione · dati pubblici</div>
        <div style={{ marginTop: 16 }}>
          {STAGES.map((s) => (
            <div key={s.key} className="row" style={{ gap: 8, color: stage === s.key ? "var(--fg)" : "var(--fg-4)", fontSize: 10 }}>
              <span className={`dot ${stage === s.key ? "on" : ""}`} />{s.label.toUpperCase()}
            </div>
          ))}
          <div className="label" style={{ marginTop: 10 }}>
            {stage ? `attività: ${recent.length} eventi / 30 s` : "nessuna ricerca in corso"}
          </div>
        </div>
        <form onSubmit={start} className="panel" style={{ marginTop: 22, display: "grid", gap: 8 }}>
          <span className="label">Nuova ricerca clienti</span>
          <select className="select" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} aria-label="Settore">
            {SECTORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <select className="select" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} aria-label="Paese">
              <option value="DE">Germania</option><option value="IT">Italia</option>
              <option value="AT">Austria</option><option value="CH">Svizzera</option>
            </select>
            <input className="input" type="number" min={1} max={50} value={form.count} aria-label="Quanti"
              onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} style={{ width: 80 }} />
          </div>
          <input className="input" placeholder="Città (vuoto = principali città)" value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })} aria-label="Città" />
          <button className="btn primary" type="submit">Avvia missione</button>
          {msg && <span className="dim2" style={{ fontSize: 11 }}>{msg}</span>}
        </form>
      </div>
      <div className="overlay" style={{ right: 22, top: 18, width: 330, bottom: 80, display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel">
          <span className="label">Missioni di ricerca</span>
          {researchMissions.slice(0, 4).map((m) => (
            <div key={m.id} style={{ margin: "8px 0" }}>
              <div style={{ color: "var(--fg)", fontSize: 10.5 }}>{m.objective}</div>
              <div className="dim">{STATUS_LABEL[m.status] ?? m.status} · {m.progress.finished}/{m.progress.total} passi</div>
            </div>
          ))}
          {researchMissions.length === 0 && <div className="dim" style={{ marginTop: 6 }}>Nessuna.</div>}
        </div>
        <div className="panel" style={{ flex: 1, overflow: "auto" }}>
          <span className="label">Attività di ricerca (eventi reali)</span>
          <div className="feed" style={{ marginTop: 6 }}>
            {research.slice(-40).reverse().map((e) => (
              <div key={e.id} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span className="ts">{hhmm(e.ts)}</span>{describeEvent(e.type, e.payload)}
              </div>
            ))}
            {research.length === 0 && <div className="dim">In attesa di eventi. Avvia una ricerca per vedere il globo lavorare.</div>}
          </div>
        </div>
        <div className="label">Dati: © OpenStreetMap contributors · Natural Earth</div>
      </div>
    </>
  );
}
