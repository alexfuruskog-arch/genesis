import { httpRouter } from "convex/server";

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { planFromHandleOrSku } from "./lib/plans";

const http = httpRouter();

function extractEmail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const customer =
    obj.customer && typeof obj.customer === "object"
      ? (obj.customer as Record<string, unknown>)
      : {};
  const candidates = [
    obj.email,
    obj.contact_email,
    customer.email,
  ];
  for (const item of candidates) {
    if (typeof item === "string" && item.includes("@")) {
      return item.trim().toLowerCase();
    }
  }
  return null;
}

function extractPlanFromPayload(payload: unknown): "free" | "plus" | "pro" | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["sku", "handle", "title", "name", "plan"]) {
    const val = obj[key];
    if (typeof val === "string") parts.push(val);
  }
  const lineItems = obj.line_items;
  if (Array.isArray(lineItems)) {
    for (const item of lineItems) {
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        for (const key of ["sku", "title", "name", "product_handle"]) {
          const val = row[key];
          if (typeof val === "string") parts.push(val);
        }
      }
    }
  }
  return planFromHandleOrSku(parts.join(" "));
}

http.route({
  path: "/webhooks/shopify",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const topic = request.headers.get("x-shopify-topic") || "orders/paid";
    let payload: unknown = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
    const email = extractEmail(payload);
    const plan = extractPlanFromPayload(payload);
    const revoke =
      topic.includes("cancel") ||
      topic.includes("refund") ||
      topic.includes("failure");
    if (!email) {
      return new Response(JSON.stringify({ status: "ignored_no_email" }), { status: 200 });
    }
    await ctx.runMutation(internal.webhooks.applyMembership, {
      email,
      provider: "shopify",
      plan: revoke ? "free" : plan ?? "free",
      status: revoke ? "cancelled" : "active",
      shopifyOrderId:
        payload && typeof payload === "object" && "id" in payload
          ? String((payload as { id: unknown }).id)
          : undefined,
    });
    return new Response(JSON.stringify({ status: "ok", topic }), { status: 200 });
  }),
});

http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let payload: unknown = {};
    try {
      payload = await request.json();
    } catch {
      payload = {};
    }
    const obj = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const data =
      obj.data && typeof obj.data === "object"
        ? (obj.data as Record<string, unknown>).object
        : null;
    const sub =
      data && typeof data === "object" ? (data as Record<string, unknown>) : obj;
    const email =
      typeof sub?.customer_email === "string"
        ? sub.customer_email.toLowerCase()
        : extractEmail(sub);
    const type = String(obj.type || "");
    const revoke = type.includes("deleted") || type.includes("canceled");
    const metadata =
      sub?.metadata && typeof sub.metadata === "object"
        ? (sub.metadata as Record<string, unknown>)
        : {};
    const plan =
      planFromHandleOrSku(String(metadata.plan || metadata.product || "")) ?? "plus";
    if (!email) {
      return new Response(JSON.stringify({ status: "ignored_no_email" }), { status: 200 });
    }
    await ctx.runMutation(internal.webhooks.applyMembership, {
      email,
      provider: "stripe",
      plan: revoke ? "free" : plan,
      status: revoke ? "cancelled" : "active",
      stripeSubscriptionId:
        sub && typeof sub.id === "string" ? sub.id : undefined,
    });
    return new Response(JSON.stringify({ status: "ok", type }), { status: 200 });
  }),
});

export default http;
