"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type {
  AuthMeRow,
  MembershipSnapshotRow,
  UploadedDocumentClient,
} from "./lib/apiTypes";
import { extractTextFromBytes } from "./lib/extraction";
import { FREE_DAILY_UPLOAD_CAP } from "./lib/plans";

export const finalizeUpload = action({
  args: {
    token: v.string(),
    storageId: v.id("_storage"),
    filename: v.string(),
    mimeType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    notebookModel: v.optional(v.string()),
    sourceKind: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<UploadedDocumentClient> => {
    const user = (await ctx.runQuery(api.auth.me, { token: args.token })) as AuthMeRow | null;
    if (!user) {
      throw new Error("Sign in on Account first.");
    }
    const membership = (await ctx.runQuery(api.membership.snapshot, {
      token: args.token,
    })) as MembershipSnapshotRow;
    if (!membership.unlimited && membership.uploads_used >= FREE_DAILY_UPLOAD_CAP) {
      throw new Error(
        `Free plan includes 1 upload per day (UTC). You've used today's upload. Upgrade to Plus ($12/mo) or Pro ($19/mo) on Shopify for unlimited uploads within fair use.`,
      );
    }
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error("Upload failed — file not found in storage.");
    }
    const bytes = await blob.arrayBuffer();
    if ((args.byteSize ?? bytes.byteLength) > 10 * 1024 * 1024) {
      throw new Error("File is larger than 10 MB.");
    }
    const extracted = await extractTextFromBytes(args.filename, args.mimeType, bytes);
    const docId = (await ctx.runMutation(api.documents.saveDocumentRecord, {
      token: args.token,
      storageId: args.storageId,
      filename: args.filename,
      mimeType: args.mimeType,
      byteSize: args.byteSize ?? bytes.byteLength,
      notebookModel: args.notebookModel,
      sourceKind: args.sourceKind,
      extractedText: extracted.text,
      extractionStatus: extracted.status === "ready" ? "ready" : extracted.status,
      chunkCount: extracted.chunkCount,
      incrementDailyUsage: !membership.unlimited,
    })) as Id<"documents">;
    return (await ctx.runQuery(api.documents.getDocument, {
      token: args.token,
      documentId: docId,
    })) as UploadedDocumentClient;
  },
});
