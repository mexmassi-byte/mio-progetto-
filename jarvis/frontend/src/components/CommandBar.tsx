import { FormEvent, useEffect, useRef, useState } from "react";
import { api, streamChat } from "../api/client";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  tools?: { name: string; ok?: boolean; status: string }[];
  error?: boolean;
}

/** Global "talk to JARVIS" bar, present on every page. */
export function CommandBar({ onThinking, placeholder }: { onThinking?: (busy: boolean) => void; placeholder?: string }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [conv, setConv] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const fromStream = useRef(false);

  // The dashboard, voice and WhatsApp share one conversation (and its context).
  useEffect(() => {
    api.get<{ conversation_id: string }>("/conversations/primary").then((r) => setConv(r.conversation_id))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!conv || fromStream.current) return void (fromStream.current = false);
    api.get<{ role: string; content: string; meta: any }[]>(`/conversations/${conv}/messages`)
      .then((rows) => setMsgs(rows.filter((r) => r.role === "user" || r.role === "assistant").slice(-30)
        .map((r) => ({ role: r.role as ChatMsg["role"], content: r.content, error: r.meta?.error }))))
      .catch(() => setMsgs([]));
  }, [conv]);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs, open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(e: FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    setOpen(true);
    setBusy(true);
    onThinking?.(true);
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", tools: [] }]);
    const update = (fn: (last: ChatMsg) => ChatMsg) =>
      setMsgs((m) => [...m.slice(0, -1), fn(m[m.length - 1])]);
    abort.current = new AbortController();
    try {
      await streamChat(q, conv, (ev) => {
        if (ev.type === "conversation") {
          if (ev.conversation_id !== conv) {
            fromStream.current = true;
            setConv(ev.conversation_id);
          }
        }
        else if (ev.type === "token") update((l) => ({ ...l, content: l.content + ev.text }));
        else if (ev.type === "reset") update((l) => ({ ...l, content: ev.text }));
        else if (ev.type === "tool") {
          update((l) => {
            const tools = [...(l.tools ?? [])];
            const i = tools.findIndex((t) => t.name === ev.name && t.status === "running");
            if (ev.status === "running") tools.push({ name: ev.name, status: "running" });
            else if (i >= 0) tools[i] = { name: ev.name, status: "done", ok: ev.ok };
            return { ...l, tools };
          });
        } else if (ev.type === "error") update((l) => ({ ...l, content: ev.error, error: true }));
      }, abort.current.signal);
    } catch (err) {
      if ((err as Error).name !== "AbortError") update((l) => ({ ...l, content: String(err), error: true }));
    } finally {
      setBusy(false);
      onThinking?.(false);
    }
  }

  function newConversation() {
    setConv(null);
    setMsgs([]);
  }

  return (
    <div className="command">
      {open && (
        <div className="convo" ref={box} aria-live="polite">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span className="label">Conversazione</span>
            <span className="row">
              <button className="btn ghost" onClick={newConversation}>Nuova</button>
              <button className="btn ghost" onClick={() => setOpen(false)} aria-label="Chiudi">Chiudi</button>
            </span>
          </div>
          {msgs.length === 0 && <p className="dim">Scrivi un obiettivo o una domanda.</p>}
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <span className="who">{m.role === "user" ? "Tu" : "JARVIS"}</span>
              {m.tools?.map((t, k) => (
                <div key={k} className="toolline">
                  {t.status === "running" ? "…" : t.ok ? "✓" : "✗"} {t.name}
                </div>
              ))}
              <span className={m.error ? "error" : ""}>{m.content || (busy && i === msgs.length - 1 ? "…" : "")}</span>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={send}>
        <input
          aria-label="Messaggio a JARVIS"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => msgs.length && setOpen(true)}
          placeholder={placeholder ?? "JARVIS, trova cinque studi dentistici a Monaco con un sito da rifare…"}
        />
        {busy ? (
          <button type="button" onClick={() => abort.current?.abort()}>Stop</button>
        ) : (
          <button type="submit">Invia</button>
        )}
        <button type="button" onClick={() => setOpen((o) => !o)}>{open ? "▾" : "▴"}</button>
      </form>
    </div>
  );
}
