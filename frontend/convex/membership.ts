import { v } from "convex/values";

import { query } from "./_generated/server";
import { effectivePlan, requireUser } from "./lib/authHelpers";
import {
  FREE_DAILY_UPLOAD_CAP,
  PLAN_LABELS,
  isPaidPlan,
  utcDateId,
} from "./lib/plans";

export const snapshot = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const plan = await effectivePlan(ctx, user);
    const unlimited = isPaidPlan(plan);
    const today = utcDateId();
    const usage = await ctx.db
      .query("dailyUploadUsage")
      .withIndex("by_email_date", (q) =>
        q.eq("email", user.email.toLowerCase()).eq("utcDate", today),
      )
      .unique();
    const uploadsUsed = usage?.count ?? 0;
    const uploadsCap = unlimited ? null : FREE_DAILY_UPLOAD_CAP;
    const uploadsRemaining = unlimited
      ? null
      : Math.max(0, FREE_DAILY_UPLOAD_CAP - uploadsUsed);
    return {
      plan,
      plan_label: PLAN_LABELS[plan],
      unlimited,
      billing_status: plan === "free" ? "none" : "active",
      plan_expires_at: null,
      uploads_used: uploadsUsed,
      uploads_cap: uploadsCap ?? FREE_DAILY_UPLOAD_CAP,
      uploads_remaining: uploadsRemaining ?? FREE_DAILY_UPLOAD_CAP,
      email: user.email,
    };
  },
});
