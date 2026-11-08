// Live event stream from the backend (WebSocket), shared by the whole UI.
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, getToken } from "../api/client";
import type { JEvent } from "../api/types";

type Listener = (e: JEvent) => void;

class EventStore {
  events: JEvent[] = [];
  connected = false;
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private subs = new Set<() => void>();
  private retry = 0;
  private timer: number | null = null;
  private lastId = 0;

  start() {
    if (this.ws || !getToken()) return;
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/ws?token=${encodeURIComponent(getToken() ?? "")}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.connected = true;
      this.notify();
      // Catch up on anything missed while disconnected.
      // Replayed history updates the lists but does not fire live listeners
      // (no old notifications popping up, no globe arcs for past searches).
      api.get<JEvent[]>(`/events?after_id=${this.lastId}&limit=300`).then((evs) => evs.forEach((e) => this.push(e, true)))
        .catch(() => undefined);
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === "ping" || data.type === "hello") return;
        this.push(data as JEvent);
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      this.connected = false;
      this.notify();
      const delay = Math.min(15000, 1000 * 2 ** this.retry++);
      this.timer = window.setTimeout(() => this.start(), delay);
    };
  }

  stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }

  push(e: JEvent, replay = false) {
    if (e.id && e.id <= this.lastId) return;
    if (e.id) this.lastId = e.id;
    this.events = [...this.events.slice(-499), e];
    if (!replay) this.listeners.forEach((l) => l(e));
    this.notify();
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };

  private notify() {
    this.version++;
    this.subs.forEach((s) => s());
  }

  version = 0;
  getVersion = () => this.version;
}

export const events = new EventStore();

/** Re-render on every new event; returns the recent events. */
export function useEvents(): { events: JEvent[]; connected: boolean } {
  useSyncExternalStore(events.subscribe, events.getVersion);
  return { events: events.events, connected: events.connected };
}

/** Call `fn` for each live event whose type starts with one of the prefixes. */
export function useEventListener(prefixes: string[], fn: Listener) {
  useEffect(() => {
    return events.on((e) => {
      if (prefixes.some((p) => e.type.startsWith(p))) fn(e);
    }) as unknown as () => void;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefixes.join("|")]);
}

/** Poll an API endpoint; also refresh when matching events arrive. */
export function usePoll<T>(path: string | null, intervalMs = 15000, refreshOn: string[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = () =>
      api.get<T>(path).then((d) => alive && (setData(d), setError(null))).catch((e) => alive && setError(String(e.message ?? e)));
    load();
    const id = window.setInterval(load, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [path, intervalMs, tick]);
  useEffect(() => {
    if (!refreshOn.length) return;
    let pending: number | null = null;
    const off = events.on((e) => {
      if (refreshOn.some((p) => e.type.startsWith(p)) && pending === null) {
        pending = window.setTimeout(() => {
          pending = null;
          setTick((t) => t + 1);
        }, 600);
      }
    });
    return () => {
      off();
      if (pending) window.clearTimeout(pending);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshOn.join("|")]);
  return { data, error, reload: () => setTick((t) => t + 1) };
}
