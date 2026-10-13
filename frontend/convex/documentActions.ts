"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type {
  AuthMeRow,
  MembershipSnapshotRow,
  UploadedDocumentClient,
} from "./lib/apiTypes";
import { extractTextFromBytes } from "./lib/extraction";
import { FREE_DAILY_UPLOAD_CAP } from "./lib/plans";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
    // The file is already in storage at this point, so every rejection below
    // deletes it — otherwise refused uploads would pile up as orphaned files.
    const reject = async (message: string): Promise<never> => {
      await ctx.storage.delete(args.storageId).catch(() => undefined);
      throw new Error(message);
    };
    const user = (await ctx.runQuery(api.auth.me, { token: args.token })) as AuthMeRow | null;
    if (!user) {
      return await reject("Sign in on Account first.");
    }
    const membership = (await ctx.runQuery(api.membership.snapshot, {
      token: args.token,
    })) as MembershipSnapshotRow;
    if (!membership.unlimited && membership.uploads_used >= FREE_DAILY_UPLOAD_CAP) {
      return await reject(
        "The free plan includes 1 upload per day (UTC), and today's is used. Upgrade to Plus or Pro for unlimited uploads.",
      );
    }
    const blob = await ctx.storage.get(args.storageId);
    if (!blob) {
      throw new Error("Upload failed — file not found in storage.");
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      return await reject("File is larger than 10 MB.");
    }
    const sourceKind = args.sourceKind === "lecture" ? "lecture" : "scan";
    const notebookModel =
      args.notebookModel === "math" || args.notebookModel === "cornell"
        ? args.notebookModel
        : undefined;
    const bytes = await blob.arrayBuffer();
    const extracted = await extractTextFromBytes(args.filename, args.mimeType, bytes);
    let docId: Id<"documents">;
    try {
      docId = (await ctx.runMutation(internal.documents.saveDocumentRecord, {
        token: args.token,
        storageId: args.storageId,
        filename: args.filename.slice(0, 200),
        mimeType: args.mimeType,
        byteSize: bytes.byteLength,
        notebookModel,
        sourceKind,
        extractedText: extracted.text,
        extractionStatus: extracted.status === "ready" ? "ready" : extracted.status,
        chunkCount: extracted.chunkCount,
        incrementDailyUsage: !membership.unlimited,
      })) as Id<"documents">;
    } catch (err) {
      return await reject(err instanceof Error ? err.message : "Upload failed.");
    }
    return (await ctx.runQuery(api.documents.getDocument, {
      token: args.token,
      documentId: docId,
    })) as UploadedDocumentClient;
  },
});
