import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}

/** Legacy format: unsalted SHA-256 hex. Only used to verify old accounts. */
async function legacySha256(password: string): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const SHA_ITERATIONS = 5_000;

/** Salted, iterated SHA-256 — fallback if the runtime lacks PBKDF2. */
async function iteratedSha256(password: string, salt: Uint8Array, iterations: number) {
  const encoder = new TextEncoder();
  let state = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(bytesToBase64(salt) + password)),
  );
  for (let i = 1; i < iterations; i += 1) {
    const next = new Uint8Array(state.length + salt.length);
    next.set(state);
    next.set(salt, state.length);
    state = new Uint8Array(await crypto.subtle.digest("SHA-256", next));
  }
  return bytesToBase64(state);
}

/**
 * Salted password hash stored as `pbkdf2$<iterations>$<salt>$<hash>`
 * (or `sha256i$…` if PBKDF2 isn't available in this runtime).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  try {
    const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
    return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${hash}`;
  } catch {
    const hash = await iteratedSha256(password, salt, SHA_ITERATIONS);
    return `sha256i$${SHA_ITERATIONS}$${bytesToBase64(salt)}$${hash}`;
  }
}

/**
 * Checks a password against a stored hash. Old unsalted hashes still work and
 * report `needsRehash` so sign-in can upgrade them transparently.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith("pbkdf2$")) {
    const [, iterRaw, saltRaw, hash] = stored.split("$");
    const iterations = Number(iterRaw);
    if (!iterations || !saltRaw || !hash) return { ok: false, needsRehash: false };
    const candidate = await pbkdf2(password, base64ToBytes(saltRaw), iterations);
    return { ok: safeEqual(candidate, hash), needsRehash: iterations < PBKDF2_ITERATIONS };
  }
  if (stored.startsWith("sha256i$")) {
    const [, iterRaw, saltRaw, hash] = stored.split("$");
    const iterations = Number(iterRaw);
    if (!iterations || !saltRaw || !hash) return { ok: false, needsRehash: false };
    const candidate = await iteratedSha256(password, base64ToBytes(saltRaw), iterations);
    return { ok: safeEqual(candidate, hash), needsRehash: false };
  }
  const legacy = await legacySha256(password);
  const ok = safeEqual(legacy, stored);
  return { ok, needsRehash: ok };
}

export async function userFromToken(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined,
) {
  const trimmed = token?.trim();
  if (!trimmed) {
    return null;
  }
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", trimmed))
    .unique();
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  const user = await ctx.db.get(session.userId);
  if (!user) {
    return null;
  }
  return { user, session };
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  token: string | undefined,
) {
  const resolved = await userFromToken(ctx, token);
  if (!resolved) {
    if (!token?.trim()) {
      throw new Error("Sign in on Account first.");
    }
    throw new Error("Session expired. Sign in again.");
  }
  return resolved;
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
