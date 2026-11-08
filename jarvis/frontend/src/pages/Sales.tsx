import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Draft, Lead } from "../api/types";
import { usePoll } from "../state/events";
import { STATUS_LABEL, statusClass } from "../util";

const PIPELINE = ["new", "audited", "scored", "qualified", "contacted", "negotiating", "won", "lost", "discarded"];

export function SalesPage() {
  const [filter, setFilter] = useState<string>("");
  const { data: leads, reload } = usePoll<Lead[]>(`/leads${filter ? `?status=${filter}` : ""}`, 15000, ["lead."]);
  const { data: stats } = usePoll<any>("/sales/stats", 15000, ["lead."]);
  const [sel, setSel] = useState<string | null>(null);

  return (
    <div className="pad">
      <div className="h1">Vendite</div>
      <p className="sub">CRM di VEYRO Web. I lead arrivano da fonti pubbliche (OpenStreetMap, siti aziendali). Le bozze non vengono mai inviate
        senza la tua approvazione, e un lead diventa "cliente" solo con un pagamento verificato da te.</p>
      <div className="row" style={{ gap: 0, borderBottom: "1px solid var(--line)" }}>
        <button className={`btn ghost`} style={{ color: !filter ? "var(--fg)" : undefined }} onClick={() => setFilter("")}>
          Tutti <span className="num">{stats?.total ?? 0}</span></button>
        {PIPELINE.map((s) => (
          <button key={s} className="btn ghost" style={{ color: filter === s ? "var(--fg)" : undefined }} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]} <span className="num">{stats?.by_status?.[s] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="split" style={{ marginTop: 18 }}>
        <div>
          {!leads?.length && <div className="empty">Nessun lead. Avvia una ricerca dalla pagina Ricerca o chiedi a JARVIS di trovare clienti.</div>}
          <table className="t">
            {!!leads?.length && <thead><tr><th>Attività</th><th>Città</th><th>Punti</th><th>Stato</th></tr></thead>}
            <tbody>
              {leads?.map((l) => (
                <tr key={l.id} className={`click ${l.id === sel ? "sel" : ""}`} onClick={() => setSel(l.id)}>
                  <td>{l.name}<div className="dim mono" style={{ fontSize: 10 }}>{l.sector} · {l.website?.replace(/^https?:\/\//, "") ?? "senza sito"}</div></td>
                  <td>{l.city}</td>
                  <td className="num">{l.score ?? "—"}</td>
                  <td><span className={statusClass(l.status)}>{STATUS_LABEL[l.status] ?? l.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>{sel && <LeadDetail id={sel} onChange={reload} />}</div>
      </div>
    </div>
  );
}

function LeadDetail({ id, onChange }: { id: string; onChange: () => void }) {
  const { data: lead, reload } = usePoll<Lead & { drafts: Draft[]; deals: any[]; interactions: any[] }>(`/leads/${id}`, 30000);
  const [legal, setLegal] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => setLegal(lead?.legal_basis ?? ""), [lead?.legal_basis]);
  if (!lead) return null;
  const patch = async (body: Record<string, unknown>) => {
    setErr(null);
    try {
      await api.patch(`/leads/${id}`, body);
      reload();
      onChange();
    } catch (e) {
      setErr(String((e as Error).message));
    }
  };
  const audit = lead.audit;
  return (
    <div>
      <div className="h2">{lead.name}</div>
      <div className="kv">
        <span>Sito</span><span>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer noopener">{lead.website}</a> : "—"}</span>
        <span>Indirizzo</span><span>{lead.address ?? "—"}</span>
        <span>Contatti</span><span className="mono" style={{ fontSize: 11 }}>{[lead.email, lead.phone].filter(Boolean).join(" · ") || "—"}</span>
        <span>Fonte</span><span className="dim">{lead.source === "osm" ? "OpenStreetMap (ODbL)" : lead.source}</span>
        <span>Prossima azione</span><span>{lead.next_action ?? "—"}</span>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <select className="select" style={{ maxWidth: 200 }} value={lead.status} onChange={(e) => patch({ status: e.target.value })} aria-label="Stato">
          {PIPELINE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {err && <p className="error">{err}</p>}

      <div className="h2">Base giuridica del contatto</div>
      <textarea className="textarea" style={{ minHeight: 60 }} value={legal} onChange={(e) => setLegal(e.target.value)} aria-label="Base giuridica" />
      <button className="btn" style={{ marginTop: 6 }} onClick={() => patch({ legal_basis: legal })}>Salva</button>

      {lead.score_breakdown?.length > 0 && (
        <>
          <div className="h2">Punteggio {lead.score}/100</div>
          {lead.score_breakdown.map((p) => (
            <div key={p.criterion} className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
              <span className="dim2">{p.reason}</span><span className="num">+{p.points}</span>
            </div>
          ))}
        </>
      )}

      {audit && (
        <>
          <div className="h2">Audit del sito {audit.error ? "" : `· opportunità ${audit.opportunity_score}/100`}</div>
          {audit.error && <p className="error">{audit.error}</p>}
          <table className="t"><tbody>
            {audit.checks?.map((c) => (
              <tr key={c.id}>
                <td style={{ width: 70 }}><span className={c.status === "pass" ? "pill ok" : c.status === "fail" ? "pill bad" : c.status === "warn" ? "pill warn" : "pill"}>{c.status}</span></td>
                <td>{c.label}<div className="dim" style={{ fontSize: 11 }}>{c.detail}</div></td>
              </tr>
            ))}
          </tbody></table>
        </>
      )}

      <div className="h2">Bozze · {lead.drafts.length}</div>
      {lead.drafts.length === 0 && <div className="empty">Nessuna bozza.</div>}
      {lead.drafts.map((d) => <DraftEditor key={d.id} d={d} onSaved={reload} />)}

      <Deals leadId={id} deals={lead.deals} onChange={() => { reload(); onChange(); }} />
    </div>
  );
}

function DraftEditor({ d, onSaved }: { d: Draft; onSaved: () => void }) {
  const [subject, setSubject] = useState(d.subject ?? "");
  const [body, setBody] = useState(d.body);
  const save = async (status?: string) => {
    await api.patch(`/drafts/${d.id}`, { subject, body, ...(status ? { status } : {}) });
    onSaved();
  };
  return (
    <div style={{ margin: "10px 0 18px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">{d.kind} · {d.language} · {d.generated_by}</span>
        <span className={statusClass(d.status)}>{STATUS_LABEL[d.status] ?? d.status}</span>
      </div>
      {d.kind !== "call_script" && <input className="input" style={{ margin: "6px 0" }} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Oggetto" />}
      <textarea className="textarea" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Testo bozza" />
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn" onClick={() => save()}>Salva</button>
        <button className="btn" onClick={() => save("approved")}>Segna come approvata</button>
        <button className="btn ghost" onClick={() => save("discarded")}>Scarta</button>
        <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(`${subject}\n\n${body}`).catch(() => undefined)}>Copia</button>
      </div>
    </div>
  );
}

function Deals({ leadId, deals, onChange }: { leadId: string; deals: any[]; onChange: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState<Record<string, string>>({});
  return (
    <>
      <div className="h2">Trattative e pagamenti</div>
      {deals.map((d) => (
        <div key={d.id} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--line)", padding: "6px 0" }}>
          <span>{d.title} <span className="num dim">€ {d.amount_eur ?? "—"}</span></span>
          {d.verified_at ? <span className="pill ok">pagato · {d.payment_reference}</span> : (
            <span className="row">
              <input className="input" style={{ width: 170 }} placeholder="n. fattura / transazione" value={ref[d.id] ?? ""}
                onChange={(e) => setRef({ ...ref, [d.id]: e.target.value })} aria-label="Riferimento pagamento" />
              <button className="btn" disabled={!ref[d.id]?.trim()} onClick={async () => {
                await api.post(`/deals/${d.id}/verify`, { payment_reference: ref[d.id] });
                onChange();
              }}>Conferma pagamento</button>
            </span>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 8, flexWrap: "nowrap" }}>
        <input className="input" placeholder="Nuova trattativa (es. sito vetrina)" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Titolo trattativa" />
        <input className="input" style={{ width: 110 }} placeholder="€" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Importo" />
        <button className="btn" disabled={!title.trim()} onClick={async () => {
          await api.post(`/leads/${leadId}/deals`, { title, amount_eur: amount ? Number(amount) : null });
          setTitle("");
          setAmount("");
          onChange();
        }}>Aggiungi</button>
      </div>
    </>
  );
}
