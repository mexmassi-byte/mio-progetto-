import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { usePoll } from "../state/events";
import { timeAgo } from "../util";

interface Project { id: string; name: string; slug: string; description: string; path: string; updated_at: string }
interface Run { id: number; command: string; exit_code: number; output: string; duration_ms: number; ts: string }

const QUICK = [["git", "status"], ["git", "log", "--oneline", "-n", "15"], ["npm", "install"], ["npm", "test"], ["npm", "run", "build"], ["python", "-m", "pytest", "-q"]];

export function DevPage() {
  const { data: projects, reload } = usePoll<Project[]>("/projects", 30000, ["dev."]);
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const current = sel ?? projects?.[0]?.id ?? null;

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const p = await api.post<Project>("/projects", { name, description: desc });
      setName("");
      setDesc("");
      setSel(p.id);
      reload();
    } catch (ex) {
      setErr(String((ex as Error).message));
    }
  }

  return (
    <div className="pad">
      <div className="h1">Sviluppo</div>
      <p className="sub">Workspace isolati in <span className="mono">data/workspaces</span>. JARVIS può leggere e scrivere solo qui dentro ed eseguire
        solo comandi consentiti (git, npm, pytest). Per lavori complessi chiedi una missione: "Crea il sito vetrina per Studio Rossi…".</p>
      <form onSubmit={create} className="row" style={{ flexWrap: "nowrap" }}>
        <input className="input" placeholder="Nome progetto" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome progetto" />
        <input className="input" placeholder="Descrizione" value={desc} onChange={(e) => setDesc(e.target.value)} aria-label="Descrizione" />
        <button className="btn primary" disabled={!name.trim()}>Crea</button>
      </form>
      {err && <p className="error">{err}</p>}
      <div className="split" style={{ marginTop: 20 }}>
        <div>
          <div className="h2">Progetti</div>
          {!projects?.length && <div className="empty">Nessun progetto.</div>}
          <table className="t"><tbody>
            {projects?.map((p) => (
              <tr key={p.id} className={`click ${p.id === current ? "sel" : ""}`} onClick={() => setSel(p.id)}>
                <td>{p.name}<div className="dim mono" style={{ fontSize: 10 }}>{p.slug}</div></td>
                <td className="dim">{timeAgo(p.updated_at)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div>{current && <ProjectDetail id={current} />}</div>
      </div>
    </div>
  );
}

function ProjectDetail({ id }: { id: string }) {
  const { data: files, reload } = usePoll<{ path: string; size: number }[]>(`/projects/${id}/files`, 30000, ["dev."]);
  const { data: runs, reload: reloadRuns } = usePoll<Run[]>(`/projects/${id}/runs`, 30000, ["dev."]);
  const [path, setPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [cmd, setCmd] = useState("git status");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function open(p: string) {
    const r = await api.get<{ content: string }>(`/projects/${id}/file?path=${encodeURIComponent(p)}`);
    setPath(p);
    setContent(r.content);
  }
  async function save() {
    if (!path) return;
    await api.put(`/projects/${id}/file`, { path, content });
    reload();
  }
  async function run(argv: string[]) {
    setBusy(true);
    setErr(null);
    try {
      await api.post(`/projects/${id}/run`, { argv });
      reloadRuns();
      reload();
    } catch (ex) {
      setErr(String((ex as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="h2">File</div>
      <div style={{ maxHeight: 180, overflow: "auto" }}>
        {files?.map((f) => (
          <div key={f.path} className="row" style={{ justifyContent: "space-between", cursor: "pointer", fontSize: 12 }} onClick={() => open(f.path)}>
            <span className="mono" style={{ color: f.path === path ? "var(--fg)" : "var(--fg-2)" }}>{f.path}</span>
            <span className="dim num">{f.size} B</span>
          </div>
        ))}
      </div>
      {path && (
        <>
          <div className="label" style={{ marginTop: 10 }}>{path}</div>
          <textarea className="textarea" style={{ minHeight: 220 }} value={content} onChange={(e) => setContent(e.target.value)} aria-label="Contenuto file" />
          <button className="btn" style={{ marginTop: 6 }} onClick={save}>Salva file</button>
        </>
      )}
      <div className="h2">Comandi</div>
      <div className="row">
        {QUICK.map((q) => <button key={q.join(" ")} className="btn ghost" disabled={busy} onClick={() => run(q)}>{q.join(" ")}</button>)}
      </div>
      <form className="row" style={{ marginTop: 6, flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); void run(cmd.trim().split(/\s+/)); }}>
        <input className="input mono" value={cmd} onChange={(e) => setCmd(e.target.value)} aria-label="Comando" />
        <button className="btn" disabled={busy}>{busy ? "…" : "Esegui"}</button>
      </form>
      {err && <p className="error">{err}</p>}
      {runs?.slice(0, 5).map((r) => (
        <div key={r.id} style={{ marginTop: 10 }}>
          <div className="label">{r.command} · exit {r.exit_code} · {r.duration_ms} ms · {timeAgo(r.ts)}</div>
          <pre className="code" style={{ maxHeight: 200 }}>{r.output || "(nessun output)"}</pre>
        </div>
      ))}
    </div>
  );
}
