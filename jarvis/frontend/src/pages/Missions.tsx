import { FormEvent, useState } from "react";
import { api } from "../api/client";
import type { Approval, Mission } from "../api/types";
import { usePoll } from "../state/events";
import { STATUS_LABEL, statusClass, timeAgo } from "../util";

export function MissionsPage() {
  const { data: missions, reload } = usePoll<Mission[]>("/missions", 10000, ["mission.", "task.", "approval."]);
  const { data: approvals, reload: reloadA } = usePoll<Approval[]>("/approvals", 10000, ["approval.", "task.awaiting"]);
  const [sel, setSel] = useState<string | null>(null);
  const [objective, setObjective] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const selected = sel ?? missions?.[0]?.id ?? null;

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const m = await api.post<Mission>("/missions", { objective });
      setObjective("");
      setSel(m.id);
      reload();
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  return (
    <div className="pad">
      <div className="h1">Missioni</div>
      <p className="sub">Obiettivi che JARVIS pianifica ed esegue in autonomia. Ogni azione esterna aspetta la tua approvazione;
        una missione è "completata" solo se la condizione finale è verificata dal codice.</p>
      <form onSubmit={create} className="row" style={{ flexWrap: "nowrap", marginBottom: 8 }}>
        <input className="input" value={objective} onChange={(e) => setObjective(e.target.value)} aria-label="Nuovo obiettivo"
          placeholder="Es.: Trova cinque studi legali a Monaco con un sito poco adatto al mobile e prepara le bozze" />
        <button className="btn primary" disabled={objective.trim().length < 3}>Avvia</button>
      </form>
      {err && <p className="error">{err}</p>}

      {approvals && approvals.length > 0 && (
        <>
          <div className="h2">Da approvare · {approvals.length}</div>
          {approvals.map((a) => <ApprovalCard key={a.id} a={a} onDone={() => { reloadA(); reload(); }} />)}
        </>
      )}

      <div className="split" style={{ marginTop: 22 }}>
        <div>
          <div className="h2">Tutte le missioni</div>
          {!missions?.length && <div className="empty">Nessuna missione. Scrivi un obiettivo qui sopra o nella barra in basso.</div>}
          <table className="t">
            <tbody>
              {missions?.map((m) => (
                <tr key={m.id} className={`click ${m.id === selected ? "sel" : ""}`} onClick={() => setSel(m.id)}>
                  <td style={{ width: "60%" }}>{m.objective}<div className="dim mono" style={{ fontSize: 10 }}>{m.kind} · {timeAgo(m.created_at)}</div></td>
                  <td><span className={statusClass(m.status)}>{STATUS_LABEL[m.status] ?? m.status}</span></td>
                  <td style={{ width: 90 }}>
                    <div className="bar"><i style={{ width: `${Math.round(m.progress.ratio * 100)}%` }} /></div>
                    <span className="dim num" style={{ fontSize: 10 }}>{m.progress.finished}/{m.progress.total}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Schedules />
        </div>
        <div>{selected && <MissionDetail id={selected} onChange={reload} />}</div>
      </div>
    </div>
  );
}

function ApprovalCard({ a, onDone }: { a: Approval; onDone: () => void }) {
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function decide(approve: boolean) {
    try {
      await api.post(`/approvals/${a.id}`, { approve, note: note || null, confirmation: confirm || null });
      onDone();
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }
  return (
    <div style={{ borderLeft: "1px solid var(--fg)", padding: "8px 14px", margin: "10px 0" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>{a.reason}</b>
        <span className={a.permission === "explicit" ? "pill bad" : "pill warn"}>{a.permission === "explicit" ? "autorizzazione esplicita" : "approvazione"}</span>
      </div>
      <div className="dim mono" style={{ fontSize: 11, margin: "4px 0 8px" }}>{a.tool}({JSON.stringify(a.args).slice(0, 300)})</div>
      <div className="row">
        <input className="input" style={{ maxWidth: 260 }} placeholder="nota (facoltativa)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nota" />
        {a.permission === "explicit" && (
          <input className="input mono" style={{ maxWidth: 160 }} placeholder="scrivi CONFERMO" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} aria-label="Conferma esplicita" />
        )}
        <button className="btn primary" onClick={() => decide(true)}>Approva</button>
        <button className="btn danger" onClick={() => decide(false)}>Rifiuta</button>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function MissionDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const { data: m, reload } = usePoll<Mission>(`/missions/${id}`, 8000, ["task.", "mission.", "approval."]);
  if (!m) return null;
  const act = async (path: string, body?: unknown) => {
    await api.post(`/missions/${id}/${path}`, body);
    reload();
    onChange();
  };
  const active = !["completed", "completed_unverified", "incomplete", "failed", "cancelled"].includes(m.status);
  return (
    <div>
      <div className="h2">Dettaglio</div>
      <div style={{ fontSize: 14, marginBottom: 10 }}>{m.objective}</div>
      <div className="kv">
        <span>Stato</span><span><span className={statusClass(m.status)}>{STATUS_LABEL[m.status] ?? m.status}</span></span>
        <span>Tipo</span><span className="mono">{m.kind}</span>
        <span>Budget</span><span className="num">{m.steps_used}/{m.max_steps} passi · {Math.round(m.max_seconds / 60)} min</span>
        <span>Condizione</span><span>{m.completion_condition}</span>
        {m.verification && (<><span>Verifica</span><span>{m.verification.passed === true ? "✓ " : m.verification.passed === false ? "✗ " : "— "}{m.verification.check}</span></>)}
        {m.error && (<><span>Errore</span><span className="error">{m.error}</span></>)}
      </div>
      <div className="row" style={{ margin: "12px 0" }}>
        {active && <button className="btn danger" onClick={() => act("cancel")}>Annulla</button>}
        {m.status === "blocked" && <button className="btn" onClick={() => act("resume", { extra_steps: 20 })}>Riprendi (+20 passi)</button>}
      </div>
      <div className="h2">Passi</div>
      {!m.tasks?.length && <div className="empty">{m.status === "queued" || m.status === "planning" ? "Pianificazione in corso…" : "Nessun passo."}</div>}
      <table className="t">
        <tbody>
          {m.tasks?.map((t) => (
            <tr key={t.id}>
              <td className="num dim" style={{ width: 24 }}>{t.seq}</td>
              <td>
                {t.title}{t.optional && <span className="dim"> · facoltativo</span>}
                <div className="dim mono" style={{ fontSize: 10 }}>{t.tool}{t.attempts > 1 ? ` · tentativi ${t.attempts}` : ""}</div>
                {t.error && <div className="error">{t.error}</div>}
                {t.status === "succeeded" && t.result && <ResultPreview r={t.result} />}
              </td>
              <td style={{ width: 120 }}><span className={statusClass(t.status)}>{STATUS_LABEL[t.status] ?? t.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultPreview({ r }: { r: any }) {
  const [open, setOpen] = useState(false);
  const text = typeof r === "string" ? r : r.text ?? JSON.stringify(r, null, 2);
  return (
    <div style={{ marginTop: 4 }}>
      <button className="btn ghost" style={{ padding: 0 }} onClick={() => setOpen(!open)}>{open ? "nascondi risultato" : "mostra risultato"}</button>
      {open && <pre className="code" style={{ marginTop: 4 }}>{String(text).slice(0, 6000)}</pre>}
    </div>
  );
}

function Schedules() {
  const { data, reload } = usePoll<{ id: string; objective: string; interval_seconds: number; next_run_at: string }[]>("/schedules", 60000);
  const [obj, setObj] = useState("");
  const [hours, setHours] = useState(24);
  async function add(e: FormEvent) {
    e.preventDefault();
    await api.post("/schedules", { objective: obj, interval_hours: hours });
    setObj("");
    reload();
  }
  return (
    <>
      <div className="h2">Missioni ricorrenti</div>
      {data?.map((s) => (
        <div key={s.id} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
          <span>{s.objective}<span className="dim"> · ogni {s.interval_seconds / 3600}h · prossima {new Date(s.next_run_at).toLocaleString("it-IT")}</span></span>
          <button className="btn ghost" onClick={async () => { await api.del(`/schedules/${s.id}`); reload(); }}>Elimina</button>
        </div>
      ))}
      <form onSubmit={add} className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
        <input className="input" value={obj} onChange={(e) => setObj(e.target.value)} placeholder="Obiettivo ricorrente" aria-label="Obiettivo ricorrente" />
        <input className="input" type="number" min={1} value={hours} onChange={(e) => setHours(Number(e.target.value))} style={{ width: 80 }} aria-label="Ore" />
        <span className="dim">ore</span>
        <button className="btn" disabled={obj.trim().length < 3}>Aggiungi</button>
      </form>
    </>
  );
}
