export type StudyPlan = "free" | "plus" | "pro";

export const FREE_DAILY_UPLOAD_CAP = 1;

export const MEMBERSHIP_HANDLES: Record<string, StudyPlan> = {
  "membership-standard": "plus",
  "membership-annual": "plus",
  "membership-scholar": "pro",
  // SKUs used on the Shopify membership products.
  "arz-mem-standard": "plus",
  "arz-mem-annual": "plus",
  "arz-mem-scholar": "pro",
};

export const PLAN_LABELS: Record<StudyPlan, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

/**
 * Map a Shopify handle / SKU / product title to a Study plan.
 * Only membership products count: a notebook titled "Problem sets" must not
 * match "pro", so plain words are matched as whole words next to "membership"
 * or "study", never as substrings.
 */
export function planFromHandleOrSku(text: string | null | undefined): StudyPlan | null {
  if (!text) return null;
  const blob = text.toLowerCase();
  for (const [handle, plan] of Object.entries(MEMBERSHIP_HANDLES)) {
    if (blob.includes(handle)) return plan;
  }
  const isMembership = /\b(membership|study)\b/.test(blob);
  if (!isMembership) return null;
  if (/\b(scholar|pro)\b/.test(blob)) return "pro";
  if (/\b(annual|plus|standard)\b/.test(blob)) return "plus";
  return null;
}

export function utcDateId(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isPaidPlan(plan: StudyPlan): boolean {
  return plan === "plus" || plan === "pro";
}
