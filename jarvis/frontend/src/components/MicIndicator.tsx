import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useEventListener } from "../state/events";

interface Wake { available: boolean; state: string; enabled: boolean; muted: boolean; hint?: string | null }

const LABEL: Record<string, string> = {
  listening: "IN ASCOLTO", speaking: "PARLA", thinking: "ELABORA", muted: "MUTO", off: "SPENTO", unavailable: "N/D",
};

/** Microphone state for the always-on activation phrases; click to mute. */
export function MicIndicator() {
  const [w, setW] = useState<Wake | null>(null);
  const load = () => api.get<Wake>("/wake").then(setW).catch(() => undefined);
  useEffect(() => {
    void load();
  }, []);
  useEventListener(["mic.state"], (e) => setW((x) => (x ? { ...x, state: e.payload.state } : x)));
  if (!w) return null;
  const state = !w.enabled ? "off" : w.muted ? "muted" : w.state;
  const toggle = async () => {
    if (!w.enabled) return void (location.hash = "settings");
    setW(await api.post<Wake>("/wake", { muted: !w.muted }));
  };
  return (
    <button className="modebtn" onClick={toggle}
      title={w.hint ?? (w.muted ? "Microfono chiuso: clic per riattivare" : "Clic per silenziare il microfono")}>
      <span className={`dot ${state === "listening" ? "on" : state === "unavailable" ? "bad" : ""}`} />
      MIC <b>{LABEL[state] ?? state}</b>
    </button>
  );
}
