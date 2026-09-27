import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined,
) {
  if (!token) {
    throw new Error("Sign in on Account first.");
  }
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Session expired. Sign in again.");
  }
  const user = await ctx.db.get(session.userId);
  if (!user) {
    throw new Error("Account not found.");
  }
  return { user, session };
}

export function newToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
}

export async function effectivePlan(
  ctx: QueryCtx | MutationCtx,
  user: { _id: Id<"users">; email: string; plan: "free" | "plus" | "pro" },
): Promise<"free" | "plus" | "pro"> {
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_email", (q) => q.eq("email", user.email.toLowerCase()))
    .unique();
  if (membership) {
    const status = membership.status.toLowerCase();
    if (
      status === "active" &&
      (!membership.currentPeriodEnd || membership.currentPeriodEnd > Date.now())
    ) {
      return membership.plan;
    }
    if (status === "active" && !membership.currentPeriodEnd) {
      return membership.plan;
    }
  }
  return user.plan;
}
