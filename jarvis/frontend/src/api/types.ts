export interface JEvent {
  id: number;
  ts: string;
  type: string;
  payload: Record<string, any>;
}

export interface Progress {
  total: number;
  finished: number;
  ratio: number;
  counts: Record<string, number>;
}

export interface Task {
  id: string;
  seq: number;
  title: string;
  tool: string;
  args: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  error: string | null;
  result: any;
  optional: boolean;
  started_at: string | null;
  finished_at: string | null;
}

export interface Approval {
  id: string;
  mission_id: string | null;
  task_id: string | null;
  tool: string;
  args: Record<string, unknown>;
  permission: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface Mission {
  id: string;
  objective: string;
  kind: string;
  params: Record<string, any>;
  status: string;
  priority: number;
  steps_used: number;
  max_steps: number;
  max_seconds: number;
  completion_condition: string;
  verification: { passed: boolean | null; check: string } | null;
  result: any;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  progress: Progress;
  tasks?: Task[];
  approvals?: Approval[];
}

export interface AuditCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail" | "info";
  detail: string;
  weight: number;
}

export interface Lead {
  id: string;
  name: string;
  website: string | null;
  sector: string | null;
  city: string | null;
  country: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  score: number | null;
  score_breakdown: { criterion: string; points: number; reason: string }[];
  audit: {
    checks: AuditCheck[];
    problems: string[];
    opportunity_score: number;
    error?: string;
    platform?: string;
    contacts?: { emails: string[]; phones: string[]; contact_page: string | null };
  } | null;
  next_action: string | null;
  legal_basis: string | null;
  notes: string | null;
  mission_id: string | null;
  created_at: string;
}

export interface Draft {
  id: string;
  lead_id: string | null;
  lead_name?: string;
  kind: string;
  language: string;
  subject: string | null;
  body: string;
  status: string;
  generated_by: string;
  created_at: string;
}

export interface Memory {
  id: string;
  category: string;
  title: string;
  content: string;
  reliability: string;
  source: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  revisions?: { id: number; version: number; content: string; change_note: string; changed_by: string; changed_at: string }[];
}

export interface Dashboard {
  generated_at: string;
  hours: number;
  activity: { hour: string; tasks: number; research: number; leads: number; chat: number; dev: number; total: number }[];
  missions_active: { id: string; objective: string; status: string; progress: Progress; steps_used: number; max_steps: number; priority: number }[];
  mission_status: Record<string, number>;
  task_status: Record<string, number>;
  sales: {
    total: number;
    by_status: Record<string, number>;
    by_sector: Record<string, number>;
    per_day: { day: string; n: number }[];
    verified_revenue_eur: number;
    drafts: number;
  };
  memory: Record<string, number>;
  approvals_pending: number;
  events_total: number;
  recent_events: JEvent[];
  engine: { running: boolean; busy_missions: string[]; last_tick: string | null };
}

export interface SystemStatus {
  version: string;
  llm: { ok: boolean; provider: string; model: string; model_installed?: boolean; error?: string | null; version?: string; note?: string };
  engine: { running: boolean; last_tick: string | null };
  voice: {
    stt: { available: boolean; hint: string | null };
    tts: { available: boolean; hint: string | null; engine?: string; fallback?: string | null;
      chars_used_month?: number | null; chars_budget_month?: number | null };
  };
  counts: Record<string, number>;
  settings: Record<string, any>;
}
