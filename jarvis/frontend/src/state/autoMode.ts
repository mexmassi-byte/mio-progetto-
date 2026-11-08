// Automatic choice of the visual mode from what JARVIS is doing:
//   conversation          -> voice sphere
//   autonomous research   -> globe
//   showing data/results  -> Command Center
// Rules that keep it calm and predictable:
//   * it only acts while one of the three visual pages is open;
//   * a manual choice pauses it for MANUAL_PAUSE_MS;
//   * after a switch it waits MIN_DWELL_MS before the next one;
//   * during a conversation, background research does not take the screen.
import type { JEvent } from "../api/types";

export type VisualMode = "overview" | "research" | "voice";
export const VISUAL_MODES: VisualMode[] = ["overview", "research", "voice"];

export const MANUAL_PAUSE_MS = 60_000;
export const MIN_DWELL_MS = 6_000;
const TALK_TAIL_MS = 4_000;
const RECENT_WORK_MS = 20_000;

/** Chat tools whose answer is data the user wants to look at. */
const DATA_TOOLS = new Set(["crm_list_leads", "mission_status", "sales_audit_url"]);

export type Kind = "talk" | "work" | "data";
export interface Target { mode: VisualMode; kind: Kind; reason: string }

export function targetFor(e: JEvent): Target | null {
  const t = e.type;
  const p = e.payload ?? {};
  if (t === "chat.started") return { mode: "voice", kind: "talk", reason: "conversazione" };
  if (t === "voice.state" && ["listening", "thinking", "speaking"].includes(p.state))
    return { mode: "voice", kind: "talk", reason: "conversazione vocale" };
  if (t === "chat.tool" && DATA_TOOLS.has(p.name)) return { mode: "overview", kind: "data", reason: "dati richiesti" };
  if (["research.search", "research.location", "research.analyze", "research.evaluate", "research.source"].includes(t))
    return { mode: "research", kind: "work", reason: "ricerca in corso" };
  if (["research.done", "mission.completed", "mission.incomplete", "mission.completed_unverified"].includes(t))
    return { mode: "overview", kind: "data", reason: "risultati della missione" };
  return null;
}

export class AutoMode {
  enabled: boolean;
  private manualUntil = 0;
  private lastSwitch = 0;
  private talkingUntil = 0;
  private talkingOpen = false;
  private pending: { target: Target; at: number } | null = null;
  private timer: number | null = null;

  constructor(
    private current: () => string,
    private switchTo: (mode: VisualMode, reason: string) => void,
    private now: () => number = () => Date.now(),
  ) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("jarvis.autoMode");
    } catch {
      /* ignore */
    }
    this.enabled = saved !== "off";
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      localStorage.setItem("jarvis.autoMode", on ? "on" : "off");
    } catch {
      /* ignore */
    }
  }

  /** The user picked a page: respect it for a while. */
  manual() {
    this.manualUntil = this.now() + MANUAL_PAUSE_MS;
    this.pending = null;
  }

  dispose() {
    if (this.timer) window.clearTimeout(this.timer);
  }

  handle(e: JEvent) {
    const now = this.now();
    // Track the conversation window even when not switching.
    if (e.type === "chat.started" || (e.type === "voice.state" && e.payload?.state !== "idle")) {
      this.talkingOpen = true;
    } else if (e.type === "chat.finished" || (e.type === "voice.state" && e.payload?.state === "idle")) {
      this.talkingOpen = false;
      this.talkingUntil = now + TALK_TAIL_MS;
      this.schedule(TALK_TAIL_MS + 50);
    }
    const target = targetFor(e);
    if (target) this.consider(target, now);
  }

  private talking(now: number) {
    return this.talkingOpen || now < this.talkingUntil;
  }

  private consider(target: Target, now: number) {
    if (!this.enabled) return;
    if (!(VISUAL_MODES as string[]).includes(this.current())) return; // never leave work pages
    if (now < this.manualUntil) return;
    if (target.kind === "work" && this.talking(now)) {
      this.pending = { target, at: now }; // show the research once the conversation ends
      return;
    }
    if (this.current() === target.mode) {
      this.pending = null;
      return;
    }
    const wait = this.lastSwitch + MIN_DWELL_MS - now;
    if (wait > 0 && target.kind !== "talk") {
      this.pending = { target, at: now };
      this.schedule(wait + 50);
      return;
    }
    this.pending = null;
    this.lastSwitch = now;
    this.switchTo(target.mode, target.reason);
  }

  private schedule(ms: number) {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      this.timer = null;
      const p = this.pending;
      if (p && this.now() - p.at < RECENT_WORK_MS) this.consider(p.target, this.now());
    }, ms);
  }
}
