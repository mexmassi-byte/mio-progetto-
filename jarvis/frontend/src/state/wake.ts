// Hand-off of an activation (wake phrase) to the voice screen, which may still be loading.
export interface WakeDetail { lang?: string; greeting?: string }

let pending: { detail: WakeDetail; at: number } | null = null;

export function announceWake(detail: WakeDetail): void {
  pending = { detail, at: Date.now() };
  window.dispatchEvent(new CustomEvent("jarvis:wake", { detail }));
}

/** The voice screen takes the activation once (if it is recent). */
export function takeWake(): WakeDetail | null {
  const p = pending;
  pending = null;
  return p && Date.now() - p.at < 15000 ? p.detail : null;
}
