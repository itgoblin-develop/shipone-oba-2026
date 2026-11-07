export type Task = {
  id: string;
  title: string;
  minutes: number;
  priority: number;
  energy: "low" | "medium" | "high";
  source: "manual" | "sample" | "notion";
  due?: string;
  url?: string;
  done?: boolean;
};
export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  source: string;
};
export type Criterion = {
  id: string;
  label: string;
  kind: "contains" | "minLength" | "http" | "manual";
  expected: string;
};
export type Check = {
  criterionId: string;
  label: string;
  status: "pass" | "fail" | "unknown" | "manual";
  detail: string;
};
export type Evidence = {
  kind: "text" | "file" | "url";
  text: string;
  label: string;
  status?: number;
  hash?: string;
  checkedAt: string;
};
export type Mission = {
  id: string;
  taskId: string;
  title: string;
  reason: string;
  minutes: number;
  steps: { id: string; title: string; done: boolean }[];
  criteria: Criterion[];
  status: "ready" | "active" | "review" | "shipped";
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  planSource: string;
  checks?: Check[];
  evidence?: Evidence;
  verifiedSignature?: string;
  parked: string[];
  replans: { at: string; blocker: string; suggestion: string }[];
};
export type Receipt = {
  id: string;
  title: string;
  completedAt: string;
  minutes: number;
  actualMinutes: number;
  checks: Check[];
  evidence?: Evidence;
  mode: string;
  planSource: string;
};
export type AppState = {
  version: 1;
  tasks: Task[];
  events: CalendarEvent[];
  mission: Mission | null;
  receipts: Receipt[];
  energy: "low" | "medium" | "high";
  availableMinutes: number;
  windowStart: string;
  windowEnd: string;
  syncedAt?: string;
  calendarSyncedAt?: string;
};
export type Settings = {
  hasOpenAI: boolean;
  hasNotion: boolean;
  hasGoogle: boolean;
  model: string;
  notionSource: string;
  googleClientId: string;
  secureStorage: boolean;
  requests: number;
  inputTokens: number;
  outputTokens: number;
};
export type PlanResult = {
  taskId: string;
  reason: string;
  minutes: number;
  steps: string[];
  criteria: Omit<Criterion, "id">[];
  source: string;
};
export interface DesktopAPI {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  settings(): Promise<Settings>;
  configure(input: Record<string, string>): Promise<Settings>;
  plan(input: unknown): Promise<PlanResult>;
  replan(input: unknown): Promise<{ suggestion: string; source: string }>;
  notion(): Promise<{ tasks: Task[]; syncedAt: string; truncated: boolean }>;
  googleConnect(): Promise<void>;
  calendar(): Promise<{ events: CalendarEvent[]; syncedAt: string }>;
  readFile(): Promise<Evidence | null>;
  importCalendar(): Promise<CalendarEvent[] | null>;
  verifyUrl(url: string): Promise<Evidence>;
  exportReceipt(text: string): Promise<boolean>;
  notify(title: string, body: string): Promise<void>;
  openExternal(url: string): Promise<void>;
}
declare global {
  interface Window {
    shipone?: DesktopAPI;
  }
}
