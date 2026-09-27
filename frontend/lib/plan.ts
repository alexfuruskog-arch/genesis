/** Client cache of the last server plan. Source of truth is Convex membership. */

export type PlanId = "free" | "plus" | "pro";

const PLAN_KEY = "arzive_plan";

export const FREE_DAILY_UPLOAD_CAP = 1;

export function getPlan(): PlanId {
  if (typeof window === "undefined") return "free";
  const raw = window.localStorage.getItem(PLAN_KEY);
  if (raw === "plus" || raw === "pro") return raw;
  return "free";
}

export function setPlan(plan: PlanId) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PLAN_KEY, plan);
}

export function applyServerPlan(plan: PlanId) {
  setPlan(plan);
}

export function applyServerUsage(input: { plan?: PlanId; uploads_used?: number }) {
  if (typeof window === "undefined") return;
  if (input.plan) setPlan(input.plan);
}

export function isUnlimited(plan: PlanId = getPlan()) {
  return plan === "plus" || plan === "pro";
}

export function canUploadToday(input: {
  plan: PlanId;
  uploadsUsed: number;
  extra?: number;
}) {
  const extra = input.extra ?? 1;
  if (isUnlimited(input.plan)) {
    return { ok: true as const, remaining: Infinity, used: input.uploadsUsed, cap: Infinity };
  }
  const remaining = Math.max(0, FREE_DAILY_UPLOAD_CAP - input.uploadsUsed);
  return {
    ok: remaining >= extra,
    remaining,
    used: input.uploadsUsed,
    cap: FREE_DAILY_UPLOAD_CAP,
  };
}

export const planDisplayName: Record<PlanId, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};
