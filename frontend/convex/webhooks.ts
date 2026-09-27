import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { planValidator } from "./schema";

export const applyMembership = internalMutation({
  args: {
    email: v.string(),
    provider: v.union(v.literal("shopify"), v.literal("stripe"), v.literal("manual")),
    plan: planValidator,
    status: v.string(),
    currentPeriodEnd: v.optional(v.number()),
    shopifyOrderId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const now = Date.now();
    const existing = await ctx.db
      .query("memberships")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        provider: args.provider,
        plan: args.plan,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        shopifyOrderId: args.shopifyOrderId ?? existing.shopifyOrderId,
        stripeSubscriptionId: args.stripeSubscriptionId ?? existing.stripeSubscriptionId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("memberships", {
        email,
        provider: args.provider,
        plan: args.plan,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        shopifyOrderId: args.shopifyOrderId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        updatedAt: now,
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (user) {
      await ctx.db.patch(user._id, {
        plan: args.status === "active" ? args.plan : "free",
        updatedAt: now,
      });
    }
    return { ok: true };
  },
});
