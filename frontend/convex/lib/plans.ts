export type StudyPlan = "free" | "plus" | "pro";

export const FREE_DAILY_UPLOAD_CAP = 1;

export const MEMBERSHIP_HANDLES: Record<string, StudyPlan> = {
  "membership-standard": "plus",
  "membership-annual": "plus",
  "membership-scholar": "pro",
};

export const PLAN_LABELS: Record<StudyPlan, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

export function planFromHandleOrSku(text: string | null | undefined): StudyPlan | null {
  if (!text) return null;
  const blob = text.toLowerCase();
  for (const [handle, plan] of Object.entries(MEMBERSHIP_HANDLES)) {
    if (blob.includes(handle)) return plan;
  }
  if (blob.includes("scholar") || blob.includes("pro")) return "pro";
  if (blob.includes("annual") || blob.includes("plus")) return "plus";
  if (blob.includes("standard")) return "plus";
  return null;
}

export function utcDateId(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isPaidPlan(plan: StudyPlan): boolean {
  return plan === "plus" || plan === "pro";
}
