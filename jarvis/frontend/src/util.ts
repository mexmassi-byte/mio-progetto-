export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.max(0, Math.round(s))}s fa`;
  if (s < 3600) return `${Math.round(s / 60)}m fa`;
  if (s < 86400) return `${Math.round(s / 3600)}h fa`;
  return `${Math.round(s / 86400)}g fa`;
}

export function hhmm(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "in coda", planning: "pianificazione", running: "in esecuzione", verifying: "verifica",
  awaiting_approval: "attende approvazione", blocked: "in pausa", completed: "completata",
  completed_unverified: "completata · non verificata", incomplete: "incompleta", failed: "fallita",
  cancelled: "annullata", pending: "in attesa", succeeded: "ok", rejected: "rifiutata", skipped: "saltata",
  new: "nuovo", audited: "analizzato", scored: "valutato", qualified: "qualificato", contacted: "contattato",
  negotiating: "trattativa", won: "cliente", lost: "perso", discarded: "scartato", draft: "bozza",
  approved: "approvata", sent: "inviata",
};

export function statusClass(s: string): string {
  if (["completed", "succeeded", "won", "qualified", "approved", "sent"].includes(s)) return "pill ok";
  if (["failed", "rejected", "lost", "cancelled"].includes(s)) return "pill bad";
  if (["awaiting_approval", "blocked", "incomplete", "completed_unverified"].includes(s)) return "pill warn";
  if (["running", "planning", "verifying"].includes(s)) return "pill live";
  return "pill";
}

/** Human description of an event, for activity feeds. */
export function describeEvent(type: string, p: Record<string, any>): string {
  switch (type) {
    case "research.search": return `ricerca: ${p.query ?? ""}`;
    case "research.source": return `fonte: ${p.title || p.url}`;
    case "research.location": return `${p.stage === "found" ? "trovato" : "zona"}: ${p.name ?? p.city ?? ""}`;
    case "research.analyze": return `analisi: ${p.name ?? p.url ?? ""}`;
    case "research.evaluate": return `valutazione di ${p.count} lead`;
    case "research.organize": return "organizzazione del lavoro";
    case "research.done": return `qualificati ${p.qualified}/${p.target}`;
    case "lead.created": return `nuovo lead: ${p.name}`;
    case "lead.audited": return `sito analizzato (opportunità ${p.opportunity ?? "?"})`;
    case "lead.status": return `lead → ${STATUS_LABEL[p.status] ?? p.status}`;
    case "task.started": return `▸ ${p.title}`;
    case "task.succeeded": return `✓ ${p.title}`;
    case "task.failed": return `✗ passo ${p.seq}: ${p.error}`;
    case "task.retrying": return `↻ nuovo tentativo tra ${p.delay_s}s`;
    case "mission.created": return `missione: ${p.objective}`;
    case "notify": return `◆ ${p.title}`;
    case "memory.created": return `memoria: ${p.title}`;
    case "lead.enriched": return "contatti del lead arricchiti";
    case "lead.won": return "nuovo cliente (pagamento verificato)";
    case "chat.started": return "conversazione";
    case "goals.briefing": return `obiettivi del giorno: ${p.goals}`;
    case "goals.mission": return `nuovo tentativo per un obiettivo (${p.attempt})`;
    case "goals.report": return `rapporto giornaliero: ${p.achieved}/${p.total}`;
    case "dev.claude_code": return p.stage === "started" ? "Claude Code al lavoro" : "Claude Code ha finito";
    case "dev.project_created": return "nuovo progetto di sviluppo";
    case "system.backup": return "backup del database";
    case "approval.requested": return `approvazione richiesta: ${p.tool}`;
    case "system.started": return `sistema avviato (${p.model})`;
    default: return type.startsWith("mission.") ? `missione ${STATUS_LABEL[type.slice(8)] ?? type.slice(8)}` : type;
  }
}
