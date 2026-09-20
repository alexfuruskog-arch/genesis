/** Client cache of the last server plan. Source of truth is the API. */

export type PlanId = "free" | "standard" | "annual" | "scholar";

const PLAN_KEY = "arzive_plan";
const WEEK_KEY = "arzive_study_week";
const COUNT_KEY = "arzive_study_sessions";
const SCANS_KEY = "arzive_scan_count";

export const FREE_SESSION_CAP = 3;
export const FREE_SCAN_CAP = 5;

export function getPlan(): PlanId {
  if (typeof window === "undefined") return "free";
  const raw = window.localStorage.getItem(PLAN_KEY);
  if (raw === "standard" || raw === "annual" || raw === "scholar") return raw;
  return "free";
}

export function setPlan(plan: PlanId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAN_KEY, plan);
}

export function applyServerPlan(plan: PlanId) {
  if (typeof window === "undefined") return;
  setPlan(plan);
}

export function applyServerUsage(input: {
  plan?: PlanId;
  chats_used?: number;
  scans_used?: number;
}) {
  if (typeof window === "undefined") return;
  if (input.plan) setPlan(input.plan);
  if (typeof input.chats_used === "number") {
    ensureWeek();
    window.localStorage.setItem(COUNT_KEY, String(input.chats_used));
  }
  if (typeof input.scans_used === "number") {
    window.localStorage.setItem(SCANS_KEY, String(input.scans_used));
  }
}

export function isUnlimited(plan: PlanId = getPlan()) {
  return plan !== "free";
}

function weekId() {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
  );
  return `${now.getFullYear()}-W${week}`;
}

function ensureWeek() {
  const current = weekId();
  if (window.localStorage.getItem(WEEK_KEY) !== current) {
    window.localStorage.setItem(WEEK_KEY, current);
    window.localStorage.setItem(COUNT_KEY, "0");
  }
}

export function getWeeklySessionsUsed() {
  if (typeof window === "undefined") return 0;
  ensureWeek();
  return Number(window.localStorage.getItem(COUNT_KEY) || "0");
}

export function recordStudySession() {
  ensureWeek();
  const next = getWeeklySessionsUsed() + 1;
  window.localStorage.setItem(COUNT_KEY, String(next));
  return next;
}

export function canStartStudySession(plan: PlanId = getPlan()) {
  if (isUnlimited(plan)) return { ok: true as const, remaining: Infinity };
  const used = getWeeklySessionsUsed();
  const remaining = Math.max(0, FREE_SESSION_CAP - used);
  return {
    ok: remaining > 0,
    remaining,
    used,
    cap: FREE_SESSION_CAP,
  };
}

export function getScanCount() {
  if (typeof window === "undefined") return 0;
  return Number(window.localStorage.getItem(SCANS_KEY) || "0");
}

export function recordScan(n = 1) {
  const next = getScanCount() + n;
  window.localStorage.setItem(SCANS_KEY, String(next));
  return next;
}

export function canScan(plan: PlanId = getPlan(), extra = 1) {
  if (isUnlimited(plan)) return { ok: true as const, remaining: Infinity };
  const used = getScanCount();
  const remaining = Math.max(0, FREE_SCAN_CAP - used);
  return {
    ok: remaining >= extra,
    remaining,
    used,
    cap: FREE_SCAN_CAP,
  };
}
