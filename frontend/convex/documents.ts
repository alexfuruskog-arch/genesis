import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import { requireUser, userFromToken } from "./lib/authHelpers";
import { FREE_DAILY_UPLOAD_CAP, utcDateId } from "./lib/plans";

function docToClient(doc: {
  _id: string;
  filename: string;
  mimeType?: string;
  byteSize?: number;
  extractionStatus: string;
  chunkCount: number;
  notebookModel?: string;
  sourceKind?: string;
  createdAt: number;
}) {
  const ready = doc.extractionStatus === "ready" && doc.chunkCount > 0;
  return {
    id: doc._id,
    filename: doc.filename,
    storage_path: doc._id,
    mime_type: doc.mimeType ?? null,
    byte_size: doc.byteSize ?? null,
    extraction_status: ready ? "ready" : doc.extractionStatus === "ready" ? "ready" : "stubbed",
    chunk_count: doc.chunkCount,
    created_at: new Date(doc.createdAt).toISOString(),
    storage_backend: "convex",
    notebook_model: doc.notebookModel ?? null,
    source_kind: (doc.sourceKind as "scan" | "lecture" | undefined) ?? null,
    kind_label: doc.sourceKind === "scan" ? "Notebook scan" : doc.sourceKind === "lecture" ? "Lecture file" : "File",
    store: "convex",
  };
}

export const generateUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.token);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Internal: only finalizeUpload may write records and count daily usage. */
export const saveDocumentRecord = internalMutation({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    notebookModel: v.optional(v.string()),
    sourceKind: v.optional(v.string()),
    extractedText: v.string(),
    extractionStatus: v.string(),
    chunkCount: v.number(),
    incrementDailyUsage: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const now = Date.now();
    if (args.incrementDailyUsage) {
      // Re-check the cap inside the transaction so parallel uploads can't slip past it.
      const email = user.email.toLowerCase();
      const utcDate = utcDateId();
      const row = await ctx.db
        .query("dailyUploadUsage")
        .withIndex("by_email_date", (q) => q.eq("email", email).eq("utcDate", utcDate))
        .unique();
      if ((row?.count ?? 0) >= FREE_DAILY_UPLOAD_CAP) {
        throw new Error("The free plan includes 1 upload per day (UTC), and today's is used.");
      }
      if (row) {
        await ctx.db.patch(row._id, { count: row.count + 1 });
      } else {
        await ctx.db.insert("dailyUploadUsage", { email, utcDate, count: 1 });
      }
    }
    const docId = await ctx.db.insert("documents", {
      ownerId: user._id,
      ownerEmail: user.email.toLowerCase(),
      filename: args.filename,
      storageId: args.storageId,
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      extractedText: args.extractedText,
      extractionStatus: args.extractionStatus,
      chunkCount: args.chunkCount,
      notebookModel: args.notebookModel,
      sourceKind: args.sourceKind,
      createdAt: now,
    });
    return docId;
  },
});

export const listDocuments = query({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const resolved = await userFromToken(ctx, args.token);
    if (!resolved) {
      return {
        documents: [],
        store: "convex",
        cloud_enabled: true,
      };
    }
    const { user } = resolved;
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
    return {
      documents: docs.map(docToClient),
      store: "convex",
      cloud_enabled: true,
    };
  },
});

export const getDocument = query({
  args: { token: v.string(), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== user._id) {
      throw new Error("Document not found.");
    }
    return docToClient(doc);
  },
});

export const getFileUrl = query({
  args: { token: v.string(), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== user._id) {
      throw new Error("Document not found.");
    }
    const url = await ctx.storage.getUrl(doc.storageId);
    return { url, filename: doc.filename, mime_type: doc.mimeType ?? null };
  },
});

export const health = query({
  args: {},
  handler: async () => {
    const llm =
      process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? "live" : "mock";
    return {
      status: "ok",
      service: "study-convex",
      integrations: {
        convex: true,
        llm,
        shopify: "webhook-stub",
      },
    };
  },
});
