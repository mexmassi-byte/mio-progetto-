import { FormEvent, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api/client";
import type { JEvent, SystemStatus } from "./api/types";
import { CommandBar } from "./components/CommandBar";
import { Nav, PageId } from "./components/Nav";
import { DevPage } from "./pages/Dev";
import { MemoryPage } from "./pages/Memory";
import { MissionsPage } from "./pages/Missions";
import { Overview } from "./pages/Overview";
import { ResearchPage } from "./pages/Research";
import { SalesPage } from "./pages/Sales";
import { SettingsPage } from "./pages/Settings";
import { VoicePage } from "./pages/Voice";
import { events, useEventListener, usePoll } from "./state/events";

const PAGES: PageId[] = ["overview", "research", "voice", "missions", "sales", "dev", "memory", "settings"];

function pageFromHash(): PageId {
  const h = location.hash.replace("#", "") as PageId;
  return PAGES.includes(h) ? h : "overview";
}

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  useEffect(() => {
    const off = () => setAuthed(false);
    window.addEventListener("jarvis:unauthorized", off);
    return () => window.removeEventListener("jarvis:unauthorized", off);
  }, []);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  return <Shell />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setToken(value.trim());
    try {
      await api.get("/system/status");
      onDone();
    } catch {
      setToken(null);
      setError("Token non valido. Lo trovi nel terminale all'avvio di JARVIS o con il comando: jarvis token");
    }
  }
  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <div className="h1">J·A·R·V·I·S</div>
        <p className="sub">Accesso locale. Incolla il token mostrato all'avvio del server.</p>
        <input className="input mono" autoFocus value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="token" aria-label="Token di accesso" />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" type="submit" disabled={!value.trim()}>Entra</button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}

interface Toast { id: number; title: string; body: string; level: string }

function Shell() {
  const [page, setPage] = useState<PageId>(pageFromHash());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clock, setClock] = useState(new Date());
  const { data: status } = usePoll<SystemStatus>("/system/status", 20000, ["mission.", "approval.", "system."]);

  useEffect(() => {
    events.start();
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.clearInterval(t);
      events.stop();
    };
  }, []);

  useEventListener(["notify"], (e: JEvent) => {
    const toast = { id: e.id, title: e.payload.title, body: e.payload.body ?? "", level: e.payload.level ?? "info" };
    setToasts((ts) => [...ts.slice(-3), toast]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== toast.id)), 9000);
    try {
      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification(`JARVIS — ${toast.title}`, { body: toast.body.slice(0, 200) });
      }
    } catch {
      /* notifications unavailable */
    }
  });

  const go = (p: PageId) => {
    location.hash = p;
    setPage(p);
  };
  const llmOk = status?.llm.ok;
  const counts = status?.counts ?? {};

  return (
    <div className="shell">
      <Nav page={page} onChange={go} badges={{ missions: counts.approvals_pending || 0 }} />
      <div className="main">
        <div className="topbar">
          <span><span className={`dot ${events.connected ? "on" : "bad"}`} />{events.connected ? "LINK" : "OFFLINE"}</span>
          <span><span className={`dot ${llmOk ? "on" : llmOk === false ? "bad" : ""}`} />
            MODEL <b>{status?.llm.model ?? "…"}</b>{status && !llmOk ? " — non disponibile" : ""}</span>
          <span>ENGINE <b>{status?.engine.running ? "ON" : "OFF"}</b></span>
          <span>MISSIONI <b className="num">{counts.missions_active ?? 0}</b></span>
          <span>APPROVAZIONI <b className="num">{counts.approvals_pending ?? 0}</b></span>
          <span>LEAD <b className="num">{counts.leads ?? 0}</b></span>
          <span className="grow" />
          <span className="num">{clock.toLocaleDateString("it-IT")} <b>{clock.toLocaleTimeString("it-IT")}</b></span>
        </div>
        <div className={`page ${["overview", "research", "voice"].includes(page) ? "full" : ""}`}>
          {page === "overview" && <Overview status={status} />}
          {page === "research" && <ResearchPage />}
          {page === "voice" && <VoicePage status={status} />}
          {page === "missions" && <MissionsPage />}
          {page === "sales" && <SalesPage />}
          {page === "dev" && <DevPage />}
          {page === "memory" && <MemoryPage />}
          {page === "settings" && <SettingsPage status={status} />}
        </div>
        {page !== "voice" && <CommandBar />}
        <div className="toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="toast" role="status">
              <span className="label">{t.level === "decision" ? "Decisione richiesta" : t.level}</span>
              <b>{t.title}</b>
              {t.body && <div className="dim2">{t.body}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
