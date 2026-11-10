// Thin client for the local JARVIS backend.

const TOKEN_KEY = "jarvis.token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: token lives only in memory for this session */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail ?? data);
    } catch {
      /* not JSON */
    }
    if (res.status === 401) window.dispatchEvent(new Event("jarvis:unauthorized"));
    throw new ApiError(res.status, detail);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("json") ? res.json() : res.text()) as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T>(path: string) => request<T>("DELETE", path),
};

export type ChatEvent =
  | { type: "conversation"; conversation_id: string }
  | { type: "token"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool"; name: string; status: "running" | "done"; ok?: boolean; args?: unknown; result?: unknown }
  | { type: "reset"; text: string }
  | { type: "done"; message_id: number; conversation_id: string; stats: Record<string, unknown>; text?: string }
  | { type: "error"; error: string };

/** Stream a chat answer (Server-Sent Events over fetch). */
export async function streamChat(
  text: string,
  conversationId: string | null,
  onEvent: (e: ChatEvent) => void,
  signal?: AbortSignal,
  mode: "text" | "voice" = "text",
): Promise<void> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
    body: JSON.stringify({ text, conversation_id: conversationId, mode }),
    signal,
  });
  if (!res.ok || !res.body) {
    if (res.status === 401) window.dispatchEvent(new Event("jarvis:unauthorized"));
    onEvent({ type: "error", error: `HTTP ${res.status}` });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) {
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  }
}

export async function uploadAudio(blob: Blob): Promise<{ text: string; language: string }> {
  const res = await fetch("/api/voice/stt", {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm", Authorization: `Bearer ${getToken() ?? ""}` },
    body: blob,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, data.detail ?? "Errore STT");
  }
  return res.json();
}

export async function synthesize(text: string): Promise<Blob> {
  const res = await fetch("/api/voice/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, data.detail ?? "Errore TTS");
  }
  return res.blob();
}
