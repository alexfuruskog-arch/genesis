import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { planFromHandleOrSku, type StudyPlan } from "./lib/plans";

const http = httpRouter();

/** Stripe signatures older than this are rejected (replay protection). */
const STRIPE_TOLERANCE_SECONDS = 5 * 60;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(signature);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison so signatures can't be guessed byte by byte. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyShopify(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const expected = toBase64(await hmacSha256(secret, rawBody));
  return safeEqual(expected, header.trim());
}

async function verifyStripe(rawBody: string, header: string | null): Promise<boolean> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > STRIPE_TOLERANCE_SECONDS) return false;
  const expected = toHex(await hmacSha256(secret, `${timestamp}.${rawBody}`));
  return signatures.some((sig) => safeEqual(expected, sig));
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function extractEmail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const customer =
    obj.customer && typeof obj.customer === "object"
      ? (obj.customer as Record<string, unknown>)
      : {};
  const candidates = [obj.email, obj.contact_email, obj.customer_email, customer.email];
  for (const item of candidates) {
    if (typeof item === "string" && item.includes("@")) {
      return item.trim().toLowerCase();
    }
  }
  return null;
}

/** Only membership line items decide the plan — notebooks in the same order are ignored. */
function extractPlanFromShopify(payload: Record<string, unknown>): StudyPlan | null {
  const candidates: string[] = [];
  const lineItems = payload.line_items;
  if (Array.isArray(lineItems)) {
    for (const item of lineItems) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const text = ["sku", "title", "name", "product_handle"]
        .map((key) => (typeof row[key] === "string" ? (row[key] as string) : ""))
        .join(" ");
      candidates.push(text);
    }
  }
  // Subscription-contract payloads carry the plan at the top level.
  for (const key of ["sku", "handle", "title", "plan"]) {
    const val = payload[key];
    if (typeof val === "string") candidates.push(val);
  }
  let best: StudyPlan | null = null;
  for (const text of candidates) {
    const plan = planFromHandleOrSku(text);
    if (plan === "pro") return "pro";
    if (plan) best = plan;
  }
  return best;
}

http.route({
  path: "/webhooks/shopify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    if (!(await verifyShopify(rawBody, request.headers.get("x-shopify-hmac-sha256")))) {
      return json({ status: "invalid_signature" }, 401);
    }
    const topic = (request.headers.get("x-shopify-topic") || "orders/paid").toLowerCase();
    const payload = parseJson(rawBody);
    const email = extractEmail(payload);
    if (!email) {
      return json({ status: "ignored_no_email" });
    }
    const plan = extractPlanFromShopify(payload);
    const isSubscriptionTopic = topic.startsWith("subscription");
    // Orders without a membership product (e.g. a notebook) never touch Study access.
    if (!plan && !isSubscriptionTopic) {
      return json({ status: "ignored_no_membership", topic });
    }
    const revoke =
      topic.includes("cancel") || topic.includes("refund") || topic.includes("failure");
    if (!revoke && !plan) {
      return json({ status: "ignored_unknown_plan", topic });
    }
    await ctx.runMutation(internal.webhooks.applyMembership, {
      email,
      provider: "shopify",
      plan: revoke ? "free" : plan!,
      status: revoke ? "cancelled" : "active",
      shopifyOrderId: "id" in payload ? String(payload.id) : undefined,
    });
    return json({ status: "ok", topic });
  }),
});

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    if (!(await verifyStripe(rawBody, request.headers.get("stripe-signature")))) {
      return json({ status: "invalid_signature" }, 401);
    }
    const obj = parseJson(rawBody);
    const data =
      obj.data && typeof obj.data === "object"
        ? (obj.data as Record<string, unknown>).object
        : null;
    const sub =
      data && typeof data === "object" ? (data as Record<string, unknown>) : obj;
    const email = extractEmail(sub);
    const type = String(obj.type || "");
    const revoke = type.includes("deleted") || type.includes("canceled");
    const metadata =
      sub.metadata && typeof sub.metadata === "object"
        ? (sub.metadata as Record<string, unknown>)
        : {};
    const metaPlan = String(metadata.plan || "").toLowerCase();
    const plan: StudyPlan =
      metaPlan === "pro" || metaPlan === "plus"
        ? metaPlan
        : planFromHandleOrSku(`membership ${String(metadata.product || "")}`) ?? "plus";
    if (!email) {
      return json({ status: "ignored_no_email" });
    }
    await ctx.runMutation(internal.webhooks.applyMembership, {
      email,
      provider: "stripe",
      plan: revoke ? "free" : plan,
      status: revoke ? "cancelled" : "active",
      stripeSubscriptionId: typeof sub.id === "string" ? sub.id : undefined,
    });
    return json({ status: "ok", type });
  }),
});

export default http;
