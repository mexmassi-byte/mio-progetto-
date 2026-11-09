import { useState } from "react";
import { api } from "../api/client";
import { usePoll } from "../state/events";

interface Status {
  whatsapp: { configured: boolean; owners: number; app_secret: boolean; verify_token: boolean; template: string | null };
  google: { client_configured: boolean; connected: boolean; account: string | null; scopes: string[]; autonomous_writes: boolean };
  phone: { configured: boolean; enabled: boolean; calls_today: number; max_per_day: number; quiet_hours: string; two_way: boolean };
  wake: { available: boolean; hint?: string | null; state?: string; error?: string | null; enabled?: boolean; muted?: boolean;
    sensitivity?: number; phrases?: Record<string, string[]>; last?: { phrase?: string; lang?: string; at?: string } | null };
  vault: string[];
  webhook: { host: string; port: number; path: string };
}

const Ok = ({ on, yes = "ok", no = "manca" }: { on: boolean; yes?: string; no?: string }) =>
  <span className={on ? "pill ok" : "pill warn"}>{on ? yes : no}</span>;

/** A write-only secret field: values go to the encrypted vault and never come back. */
function Secret({ name, label, stored, placeholder, plain, onSaved }:
  { name: string; label: string; stored: boolean; placeholder?: string; plain?: boolean; onSaved: (m: string) => void }) {
  const [v, setV] = useState("");
  async function save() {
    if (!v.trim()) return;
    try {
      await api.post("/integrations/credentials", { name, value: v.trim() });
      setV("");
      onSaved(`${label}: salvato (cifrato).`);
    } catch (e) {
      onSaved(`${label}: ${(e as Error).message}`);
    }
  }
  return (
    <>
      <span>{label}</span>
      <span className="row" style={{ gap: 6 }}>
        <input className="input" style={{ maxWidth: 260 }} type={plain ? "text" : "password"} autoComplete="off" value={v}
          aria-label={label} placeholder={stored ? "•••••• salvato — scrivi per sostituire" : placeholder ?? ""}
          onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
        <button className="btn ghost" onClick={save} disabled={!v.trim()}>Salva</button>
        {stored && <span className="pill ok">salvato</span>}
      </span>
    </>
  );
}

export function Integrations() {
  const { data: st, reload } = usePoll<Status>("/integrations", 20000, ["integration.", "mic.", "voice.wake"]);
  const { data: log } = usePoll<any[]>("/integrations/log?limit=40", 30000, ["whatsapp.", "email.", "phone."]);
  const [msg, setMsg] = useState<string | null>(null);
  const [verify, setVerify] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const saved = (m: string) => { setMsg(m); reload(); };
  const has = (n: string) => !!st?.vault.includes(n);
  const run = async (fn: () => Promise<unknown>, ok: (r: any) => string) => {
    setMsg(null);
    try {
      setMsg(ok(await fn()));
    } catch (e) {
      setMsg((e as Error).message);
    }
    reload();
  };
  if (!st) return null;
  const wake = st.wake;

  return (
    <>
      <div className="h2">Integrazioni</div>
      <p className="dim" style={{ fontSize: 11 }}>
        Le chiavi vengono cifrate sul tuo computer e non tornano mai nel browser. Leggere è automatico; inviare, creare
        eventi, chiamare o spendere richiede la tua approvazione.
      </p>
      {msg && <p className="dim2">{msg}</p>}
      <div className="grid2">
        <div>
          <div className="h2">WhatsApp (API ufficiale Meta)</div>
          <div className="kv">
            <span>Stato</span><span><Ok on={st.whatsapp.configured} yes="collegato" no="da configurare" />
              <span className="dim"> · {st.whatsapp.owners} numeri proprietario</span></span>
            <Secret name="whatsapp_phone_number_id" label="Phone number ID" stored={has("whatsapp_phone_number_id")} plain onSaved={saved} />
            <Secret name="whatsapp_access_token" label="Access token" stored={has("whatsapp_access_token")} onSaved={saved} />
            <Secret name="whatsapp_app_secret" label="App secret" stored={st.whatsapp.app_secret} onSaved={saved} />
            <Secret name="owner_phone_numbers" label="Numeri proprietario" stored={st.whatsapp.owners > 0} plain
              placeholder="+39 …, +49 …" onSaved={saved} />
            <span>Webhook</span>
            <span className="mono" style={{ fontSize: 11 }}>
              http://{st.webhook.host}:{st.webhook.port}{st.webhook.path} <span className="dim">(esposto con un tunnel HTTPS)</span>
            </span>
            <span>Verify token</span>
            <span className="row" style={{ gap: 6 }}>
              {verify ? <span className="mono" style={{ fontSize: 11, userSelect: "all" }}>{verify}</span>
                : <Ok on={st.whatsapp.verify_token} yes="impostato" no="manca" />}
              <button className="btn ghost" onClick={() => run(() => api.post<{ verify_token: string }>("/integrations/whatsapp/verify-token"),
                (r) => { setVerify(r.verify_token); return "Copia il verify token in Meta → WhatsApp → Configurazione. Viene mostrato una sola volta."; })}>
                Genera</button>
            </span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" disabled={!st.whatsapp.configured} onClick={() => run(() => api.post("/integrations/whatsapp/test"),
              (r) => r.ok ? `Messaggio di prova inviato a ${r.sent_to.length} numero/i.` : r.note)}>Messaggio di prova</button>
          </div>
          <p className="dim" style={{ fontSize: 11 }}>
            Il tuo numero personale non viene migrato né registrato: JARVIS usa un suo numero e risponde solo ai numeri
            proprietario. Costi Meta: circa 0,03 $ a messaggio di servizio in Italia (vedi docs/INTEGRATIONS.md).
          </p>

          <div className="h2">Google (Gmail, Calendar, Drive, Docs, Contatti, Tasks)</div>
          <div className="kv">
            <span>Stato</span><span>{st.google.connected ? <><span className="pill ok">collegato</span> <span className="mono">{st.google.account}</span></>
              : <Ok on={false} no={st.google.client_configured ? "da autorizzare" : "da configurare"} />}</span>
            <Secret name="google_client_id" label="OAuth client ID" stored={has("google_client_id")} plain onSaved={saved} />
            <Secret name="google_client_secret" label="OAuth client secret" stored={has("google_client_secret")} onSaved={saved} />
            <span>Scritture</span><span className="dim">{st.google.autonomous_writes
              ? "eventi, attività e documenti senza chiedere (inviti e email sempre con approvazione)"
              : "eventi, attività, documenti ed email solo con la tua approvazione; bozze automatiche"}</span>
            {st.google.connected && <><span>Permessi</span><span className="dim" style={{ fontSize: 11 }}>
              {st.google.scopes.map((x) => x.replace("https://www.googleapis.com/auth/", "")).join(" · ")}</span></>}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" disabled={!st.google.client_configured} onClick={() => run(async () => {
              const r = await api.get<{ url: string }>("/integrations/google/connect");
              window.open(r.url, "_blank", "noopener");
              return r;
            }, () => "Autorizza nella finestra di Google, poi torna qui.")}>{st.google.connected ? "Ricollega" : "Collega Google"}</button>
            {st.google.connected && <button className="btn danger" onClick={() => run(() => api.post("/integrations/google/disconnect"),
              () => "Google scollegato: token eliminato.")}>Scollega</button>}
          </div>
        </div>

        <div>
          <div className="h2">Attivazione vocale</div>
          <div className="kv">
            <span>Stato</span><span>{!wake.available ? <span className="pill warn">non installata</span>
              : <Ok on={!!wake.enabled && !wake.muted} yes={wake.state === "listening" ? "in ascolto" : wake.state ?? "attiva"}
                no={wake.enabled ? "microfono chiuso" : "spenta"} />}</span>
            {(wake.hint || wake.error) && <><span /><span className="dim mono" style={{ fontSize: 11 }}>{wake.error ?? wake.hint}</span></>}
            <span>Sensibilità</span>
            <span className="row" style={{ gap: 8 }}>
              <input type="range" min={0} max={1} step={0.05} defaultValue={wake.sensitivity ?? 0.6} aria-label="Sensibilità"
                onChange={(e) => { const v = Number(e.target.value); void api.post("/wake", { sensitivity: v }).then(reload); }} />
              <span className="dim num">{Math.round((wake.sensitivity ?? 0.6) * 100)}%</span>
            </span>
            {wake.last?.phrase && <><span>Ultima</span><span className="dim">«{wake.last.phrase}» ({wake.last.lang})</span></>}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" disabled={!wake.available} onClick={() => run(() => api.post("/wake", { enabled: !wake.enabled, muted: false }),
              () => wake.enabled ? "Attivazione vocale spenta." : "In ascolto delle frasi di attivazione.")}>
              {wake.enabled ? "Spegni" : "Attiva"}</button>
            {wake.enabled && <button className="btn ghost" onClick={() => run(() => api.post("/wake", { muted: !wake.muted }),
              () => wake.muted ? "Microfono riaperto." : "Microfono chiuso.")}>{wake.muted ? "Riapri microfono" : "Silenzia"}</button>}
          </div>
          <p className="dim" style={{ fontSize: 11 }}>
            Riconoscimento solo sul computer: l'audio non viene mai inviato. Frasi:{" "}
            {Object.values(wake.phrases ?? {}).flat().map((p) => `«${p}»`).join(" ")}
          </p>

          <div className="h2">Chiamate (Twilio)</div>
          <div className="kv">
            <span>Stato</span><span><Ok on={st.phone.configured} yes="configurato" no="da configurare" />{" "}
              <Ok on={st.phone.enabled} yes="autorizzate" no="non autorizzate" /></span>
            <Secret name="twilio_account_sid" label="Account SID" stored={has("twilio_account_sid")} plain onSaved={saved} />
            <Secret name="twilio_auth_token" label="Auth token" stored={has("twilio_auth_token")} onSaved={saved} />
            <Secret name="twilio_from_number" label="Numero Twilio" stored={has("twilio_from_number")} plain placeholder="+1 …" onSaved={saved} />
            <span>Limiti</span><span className="dim">{st.phone.calls_today}/{st.phone.max_per_day} oggi · silenzio {st.phone.quiet_hours}
              {" "}(solo emergenze) · solo eventi verificati</span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" style={{ maxWidth: 130 }} value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="CONFERMO" aria-label="Conferma esplicita" />
            <button className="btn" disabled={!st.phone.configured} onClick={() => run(
              () => api.post("/integrations/phone/enable", { enabled: !st.phone.enabled, confirmation: confirm }),
              () => st.phone.enabled ? "Chiamate disattivate." : "Chiamate autorizzate (solo eventi verificati).")}>
              {st.phone.enabled ? "Disattiva" : "Autorizza"}</button>
            <button className="btn ghost" disabled={!st.phone.configured} onClick={() => run(
              () => api.post("/integrations/phone/test", { enabled: true, confirmation: confirm }),
              (r) => r.called === false ? `Chiamata non partita: ${r.reason}` : "Chiamata di prova avviata.")}>Chiamata di prova</button>
          </div>
          <p className="dim" style={{ fontSize: 11 }}>
            A pagamento: circa 0,045 $/min verso cellulari italiani + numero ~1,15 $/mese. Ogni chiamata richiede la parola CONFERMO
            per l'attivazione; JARVIS chiama solo per pagamenti verificati, contratti firmati, guasti critici, sicurezza o
            opportunità eccezionali.
          </p>
        </div>
      </div>

      <div className="h2">Comunicazioni</div>
      {!log?.length && <div className="empty">Nessun messaggio, email o chiamata registrata.</div>}
      <table className="t"><tbody>
        {log?.map((r) => (
          <tr key={r.id}>
            <td className="mono dim" style={{ width: 170 }}>{new Date(r.ts).toLocaleString("it-IT")}</td>
            <td className="mono">{r.channel} {r.direction === "in" ? "←" : "→"}</td>
            <td className="dim">{r.kind}</td>
            <td className="dim2">{r.summary}</td>
            <td className="dim" style={{ fontSize: 11 }}>{r.status}</td>
          </tr>
        ))}
      </tbody></table>
    </>
  );
}
