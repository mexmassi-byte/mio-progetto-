import { useState } from "react";
import { api, setToken } from "../api/client";
import type { SystemStatus } from "../api/types";
import { usePoll } from "../state/events";
import { Integrations } from "../components/Integrations";

export function SettingsPage({ status }: { status: SystemStatus | null }) {
  const { data: models } = usePoll<{ models: { name: string; size_gb?: number; parameters?: string; quantization?: string }[]; current: string; error?: string }>("/system/models", 60000);
  const { data: audit } = usePoll<any[]>("/system/audit?limit=60", 30000, ["approval.", "task."]);
  const { data: tools } = usePoll<{ name: string; permission: string; external: boolean; category: string; description: string }[]>("/tools", 300000);
  const [msg, setMsg] = useState<string | null>(null);
  const [quality, setQuality] = useState(() => {
    try {
      return localStorage.getItem("jarvis.quality") ?? "auto";
    } catch {
      return "auto";
    }
  });

  async function chooseModel(model: string) {
    setMsg(null);
    try {
      const r = await api.post<{ model: string; health: { ok: boolean; error?: string } }>("/system/model", { model });
      setMsg(r.health.ok ? `Modello attivo: ${r.model}` : `Impostato ${r.model}, ma: ${r.health.error}`);
    } catch (e) {
      setMsg(String((e as Error).message));
    }
  }

  return (
    <div className="pad">
      <div className="h1">Sistema</div>
      <p className="sub">Modello AI locale, stato dei componenti, permessi e registro delle operazioni.</p>
      <div className="grid2">
        <div>
          <div className="h2">Modello AI</div>
          <div className="kv">
            <span>Provider</span><span className="mono">{status?.settings.provider}</span>
            <span>Indirizzo</span><span className="mono">{status?.settings.base_url}</span>
            <span>Modello</span><span className="mono">{status?.llm.model} {status?.llm.ok ? "· pronto" : <span className="error">· {status?.llm.error}</span>}</span>
            <span>Embedding</span><span className="mono">{status?.settings.embed_model}</span>
          </div>
          <div className="h2">Modelli installati</div>
          {models?.error && <p className="error">{models.error}</p>}
          {!models?.models.length && !models?.error && <div className="empty">Nessun modello trovato. Esempio: <span className="mono">ollama pull qwen3:8b</span></div>}
          <table className="t"><tbody>
            {models?.models.map((m) => (
              <tr key={m.name}>
                <td className="mono">{m.name}</td>
                <td className="dim num">{m.parameters ?? ""} {m.quantization ?? ""} {m.size_gb ? `· ${m.size_gb} GB` : ""}</td>
                <td>{m.name === models.current ? <span className="pill ok">attivo</span> :
                  <button className="btn ghost" onClick={() => chooseModel(m.name)}>Usa</button>}</td>
              </tr>
            ))}
          </tbody></table>
          {msg && <p className="dim2">{msg}</p>}
          <p className="dim" style={{ fontSize: 11 }}>Prima di scegliere, confronta i modelli con <span className="mono">jarvis eval</span>: misura le capacità reali sul tuo PC.</p>
        </div>
        <div>
          <div className="h2">Componenti</div>
          <div className="kv">
            <span>Motore missioni</span><span>{status?.engine.running ? "attivo" : "fermo"}</span>
            <span>Voce → testo</span><span>{status?.voice.stt.available ? "faster-whisper" : <span className="dim">{status?.voice.stt.hint}</span>}</span>
            <span>Testo → voce</span><span>{!status?.voice.tts.available ? <span className="dim">{status?.voice.tts.hint}</span>
              : status.voice.tts.engine === "elevenlabs"
                ? <>ElevenLabs · Brian <span className="dim num">· {status.voice.tts.chars_used_month ?? 0}/{status.voice.tts.chars_budget_month} caratteri questo mese{status.voice.tts.fallback ? " · riserva locale: Piper" : " · nessuna voce locale di riserva"}</span></>
                : "Piper (locale)"}</span>
            <span>Ricerca web</span><span className="mono">{status?.settings.searxng_url}</span>
            <span>Email (SMTP)</span><span>{status?.settings.smtp_configured ? "configurata (invio solo con approvazione)" : "non configurata"}</span>
            <span>Dati</span><span className="mono" style={{ fontSize: 11 }}>{status?.settings.data_dir}</span>
            <span>Versione</span><span className="mono">{status?.version}</span>
          </div>
          <div className="h2">Interfaccia</div>
          <div className="row">
            <span className="dim">Qualità grafica</span>
            <select className="select" style={{ maxWidth: 160 }} value={quality} aria-label="Qualità grafica" onChange={(e) => {
              setQuality(e.target.value);
              try {
                if (e.target.value === "auto") localStorage.removeItem("jarvis.quality");
                else localStorage.setItem("jarvis.quality", e.target.value);
              } catch {
                /* ignore */
              }
            }}>
              <option value="auto">automatica</option><option value="low">bassa</option><option value="medium">media</option><option value="high">alta</option>
            </select>
            <span className="dim" style={{ fontSize: 11 }}>(si applica cambiando pagina)</span>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => "Notification" in window && Notification.requestPermission()}>Attiva notifiche desktop</button>
            <button className="btn" onClick={async () => { const r = await api.post<{ file: string }>("/system/backup"); setMsg(`Backup creato: ${r.file}`); }}>Backup ora</button>
            <button className="btn danger" onClick={() => { setToken(null); location.reload(); }}>Esci</button>
          </div>
        </div>
      </div>

      <Integrations />

      <div className="h2">Permessi degli strumenti</div>
      <table className="t">
        <thead><tr><th>Strumento</th><th>Livello</th><th>Descrizione</th></tr></thead>
        <tbody>
          {tools?.map((t) => (
            <tr key={t.name}>
              <td className="mono">{t.name}</td>
              <td><span className={t.permission === "autonomous" ? "pill" : t.permission === "approval" ? "pill warn" : "pill bad"}>
                {t.permission === "autonomous" ? "autonomo" : t.permission === "approval" ? "approvazione" : "esplicito"}</span>
                {t.external && <span className="dim"> · esterno</span>}</td>
              <td className="dim2">{t.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="h2">Registro operazioni (audit)</div>
      {!audit?.length && <div className="empty">Nessuna operazione esterna registrata.</div>}
      <table className="t"><tbody>
        {audit?.map((a) => (
          <tr key={a.id}>
            <td className="mono dim" style={{ width: 170 }}>{new Date(a.ts).toLocaleString("it-IT")}</td>
            <td className="mono">{a.action}</td>
            <td>{a.decision}</td>
            <td className="dim" style={{ fontSize: 11 }}>{a.target}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}
