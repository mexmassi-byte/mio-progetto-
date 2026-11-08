import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import type { Memory } from "../api/types";
import { usePoll } from "../state/events";
import { timeAgo } from "../util";

const CATEGORIES: [string, string][] = [
  ["user_preference", "Preferenze"], ["company", "Azienda"], ["strategy", "Strategia"], ["customer", "Clienti"],
  ["project", "Progetti"], ["task", "Task e documenti"], ["decision", "Decisioni"], ["procedure", "Procedure"], ["lesson", "Lezioni"],
];
const RELIABILITY: [string, string][] = [
  ["verified", "Verificato"], ["user_provided", "Fornito da te"], ["estimate", "Stima"], ["assumption", "Ipotesi"], ["outdated", "Superato"],
];
const REL = Object.fromEntries(RELIABILITY);
const CAT = Object.fromEntries(CATEGORIES);

export function MemoryPage() {
  const [cat, setCat] = useState("");
  const [tab, setTab] = useState<"memories" | "files">("memories");
  const { data: items, reload } = usePoll<Memory[]>(`/memories${cat ? `?category=${cat}` : ""}`, 30000, ["memory."]);
  const [sel, setSel] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="pad">
      <div className="h1">Memoria</div>
      <p className="sub">Tutto quello che JARVIS ricorda, con il grado di affidabilità. Ogni modifica crea una revisione; le informazioni aziendali
        importanti non vengono mai sovrascritte automaticamente: JARVIS può solo proporre una modifica.</p>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn ghost" style={{ color: tab === "memories" ? "var(--fg)" : undefined }} onClick={() => setTab("memories")}>Memorie</button>
        <button className="btn ghost" style={{ color: tab === "files" ? "var(--fg)" : undefined }} onClick={() => setTab("files")}>File di conoscenza</button>
      </div>
      {tab === "files" ? <Knowledge /> : (
        <div className="split">
          <div>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <select className="select" style={{ maxWidth: 240 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Categoria">
                <option value="">Tutte le categorie</option>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="btn" onClick={() => { setCreating(true); setSel(null); }}>Nuova memoria</button>
            </div>
            {!items?.length && <div className="empty" style={{ marginTop: 12 }}>Nessuna memoria in questa categoria.</div>}
            <table className="t" style={{ marginTop: 10 }}><tbody>
              {items?.map((m) => (
                <tr key={m.id} className={`click ${m.id === sel ? "sel" : ""}`} onClick={() => { setSel(m.id); setCreating(false); }}>
                  <td>{m.title}<div className="dim" style={{ fontSize: 11 }}>{m.content.slice(0, 110)}</div></td>
                  <td><span className="pill">{CAT[m.category] ?? m.category}</span></td>
                  <td><span className={m.reliability === "verified" ? "pill ok" : m.reliability === "outdated" ? "pill bad" : "pill"}>{REL[m.reliability]}</span></td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div>
            {creating && <MemoryForm onSaved={(id) => { setCreating(false); setSel(id); reload(); }} />}
            {sel && !creating && <MemoryDetail id={sel} onChange={reload} onDeleted={() => { setSel(null); reload(); }} />}
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryForm({ onSaved }: { onSaved: (id: string) => void }) {
  const [f, setF] = useState({ category: "company", title: "", content: "", reliability: "user_provided", source: "" });
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const m = await api.post<Memory>("/memories", { ...f, source: f.source || null });
      onSaved(m.id);
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }
  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
      <div className="h2">Nuova memoria</div>
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <select className="select" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Categoria">
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="select" value={f.reliability} onChange={(e) => setF({ ...f, reliability: e.target.value })} aria-label="Affidabilità">
          {RELIABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <input className="input" placeholder="Titolo" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-label="Titolo" />
      <textarea className="textarea" placeholder="Contenuto" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} aria-label="Contenuto" />
      <input className="input" placeholder="Fonte (facoltativa)" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} aria-label="Fonte" />
      <div><button className="btn primary" disabled={!f.title.trim() || !f.content.trim()}>Salva</button></div>
      {err && <p className="error">{err}</p>}
    </form>
  );
}

function MemoryDetail({ id, onChange, onDeleted }: { id: string; onChange: () => void; onDeleted: () => void }) {
  const [m, setM] = useState<Memory | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [rel, setRel] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const load = () => api.get<Memory>(`/memories/${id}`).then((x) => {
    setM(x);
    setContent(x.content);
    setTitle(x.title);
    setRel(x.reliability);
  });
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  if (!m) return null;
  async function save() {
    setErr(null);
    try {
      await api.patch(`/memories/${id}`, { title, content, reliability: rel, change_note: note || null, expected_version: m!.version });
      setNote("");
      await load();
      onChange();
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="h2">{CAT[m.category]} · v{m.version} · aggiornata {timeAgo(m.updated_at)}</div>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titolo" />
      <textarea className="textarea" style={{ minHeight: 180 }} value={content} onChange={(e) => setContent(e.target.value)} aria-label="Contenuto" />
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <select className="select" value={rel} onChange={(e) => setRel(e.target.value)} aria-label="Affidabilità">
          {RELIABILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input" placeholder="nota della modifica" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Nota modifica" />
      </div>
      <div className="row">
        <button className="btn primary" onClick={save}>Salva revisione</button>
        <button className="btn danger" onClick={async () => { await api.del(`/memories/${id}`); onDeleted(); }}>Elimina</button>
      </div>
      {m.source && <div className="dim" style={{ fontSize: 11 }}>Fonte: {m.source}</div>}
      {err && <p className="error">{err}</p>}
      <div className="h2">Revisioni</div>
      {m.revisions?.map((r) => (
        <div key={r.id} style={{ borderBottom: "1px solid var(--line)", padding: "6px 0", fontSize: 12 }}>
          <div className="label">v{r.version} · {r.changed_by} · {new Date(r.changed_at).toLocaleString("it-IT")} · {r.change_note}</div>
          <div className="dim2" style={{ whiteSpace: "pre-wrap" }}>{r.content.slice(0, 400)}</div>
        </div>
      ))}
    </div>
  );
}

function Knowledge() {
  const { data: files, reload } = usePoll<{ name: string; size: number; modified: string }[]>("/knowledge", 60000);
  const [name, setName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  async function open(n: string) {
    const r = await api.get<{ content: string }>(`/knowledge/${encodeURIComponent(n)}`);
    setName(n);
    setContent(r.content);
    setMsg(null);
  }
  return (
    <div className="split">
      <div>
        <p className="dim" style={{ fontSize: 12 }}>File Markdown in <span className="mono">data/knowledge</span>: puoi modificarli anche con qualsiasi editor.
          JARVIS li usa come conoscenza fornita da te (servizi, prezzi, tono, regole).</p>
        {files?.map((f) => (
          <div key={f.name} className="row" style={{ justifyContent: "space-between", cursor: "pointer", padding: "5px 0", borderBottom: "1px solid var(--line)" }} onClick={() => open(f.name)}>
            <span className="mono" style={{ color: f.name === name ? "var(--fg)" : "var(--fg-2)" }}>{f.name}</span>
            <span className="dim">{timeAgo(f.modified)}</span>
          </div>
        ))}
        <form className="row" style={{ marginTop: 10, flexWrap: "nowrap" }} onSubmit={async (e) => {
          e.preventDefault();
          const n = newName.endsWith(".md") ? newName : `${newName}.md`;
          await api.put(`/knowledge/${encodeURIComponent(n)}`, { content: `# ${newName}\n` });
          setNewName("");
          reload();
          void open(n);
        }}>
          <input className="input" placeholder="nuovo-file" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Nome nuovo file" />
          <button className="btn" disabled={!newName.trim()}>Crea</button>
        </form>
      </div>
      <div>
        {name && (
          <>
            <div className="label">{name}</div>
            <textarea className="textarea" style={{ minHeight: 420 }} value={content} onChange={(e) => setContent(e.target.value)} aria-label="Contenuto file" />
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn primary" onClick={async () => { await api.put(`/knowledge/${encodeURIComponent(name)}`, { content }); setMsg("Salvato (versione precedente conservata)."); reload(); }}>Salva</button>
              <button className="btn danger" onClick={async () => { await api.del(`/knowledge/${encodeURIComponent(name)}`); setName(null); reload(); }}>Elimina</button>
              {msg && <span className="dim">{msg}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
