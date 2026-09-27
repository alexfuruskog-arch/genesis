import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import {
  effectivePlan,
  hashPassword,
  newToken,
  requireUser,
} from "./lib/authHelpers";
import { PLAN_LABELS } from "./lib/plans";

const SESSION_MS = 1000 * 60 * 60 * 24 * 30;

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@")) {
      throw new Error("Enter a valid email.");
    }
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) {
      throw new Error("An account with this email already exists. Sign in instead.");
    }
    const passwordHash = await hashPassword(args.password);
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      email,
      passwordHash,
      plan: "free",
      createdAt: now,
      updatedAt: now,
    });
    const token = newToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      createdAt: now,
      expiresAt: now + SESSION_MS,
    });
    const plan = await effectivePlan(ctx, { _id: userId, email, plan: "free" });
    return {
      id: userId,
      email,
      token,
      plan,
      plan_label: PLAN_LABELS[plan],
      source: "convex",
    };
  },
});

export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user || !user.passwordHash) {
      throw new Error("No account found for this email.");
    }
    const passwordHash = await hashPassword(args.password);
    if (passwordHash !== user.passwordHash) {
      throw new Error("Incorrect password.");
    }
    const now = Date.now();
    const token = newToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      createdAt: now,
      expiresAt: now + SESSION_MS,
    });
    const plan = await effectivePlan(ctx, user);
    return {
      id: user._id,
      email: user.email,
      token,
      plan,
      plan_label: PLAN_LABELS[plan],
      source: "convex",
    };
  },
});

export const signOut = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
    return { ok: true };
  },
});

export const me = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.token) return null;
    try {
      const { user } = await requireUser(ctx, args.token);
      const plan = await effectivePlan(ctx, user);
      return {
        id: user._id,
        email: user.email,
        token: args.token,
        plan,
        plan_label: PLAN_LABELS[plan],
        source: "convex",
      };
    } catch {
      return null;
    }
  },
});
