import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const planValidator = v.union(
  v.literal("free"),
  v.literal("plus"),
  v.literal("pro"),
);

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.optional(v.string()),
    plan: planValidator,
    shopifyCustomerId: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  documents: defineTable({
    ownerId: v.id("users"),
    ownerEmail: v.string(),
    filename: v.string(),
    storageId: v.id("_storage"),
    mimeType: v.optional(v.string()),
    byteSize: v.optional(v.number()),
    extractedText: v.optional(v.string()),
    extractionStatus: v.string(),
    chunkCount: v.number(),
    notebookModel: v.optional(v.string()),
    sourceKind: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_created", ["ownerId", "createdAt"]),

  dailyUploadUsage: defineTable({
    email: v.string(),
    utcDate: v.string(),
    count: v.number(),
  }).index("by_email_date", ["email", "utcDate"]),

  aiCache: defineTable({
    cacheKey: v.string(),
    documentId: v.id("documents"),
    promptKind: v.string(),
    resultJson: v.string(),
    provider: v.string(),
    createdAt: v.number(),
  }).index("by_key", ["cacheKey"]),

  memberships: defineTable({
    email: v.string(),
    provider: v.union(v.literal("shopify"), v.literal("stripe"), v.literal("manual")),
    status: v.string(),
    plan: planValidator,
    currentPeriodEnd: v.optional(v.number()),
    shopifyContractId: v.optional(v.string()),
    shopifyOrderId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  studyMessages: defineTable({
    documentId: v.id("documents"),
    ownerId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    promptKind: v.optional(v.string()),
    chipId: v.optional(v.string()),
    quizSessionId: v.optional(v.id("quizSessions")),
    createdAt: v.number(),
  }).index("by_document", ["documentId", "createdAt"]),

  quizSessions: defineTable({
    documentId: v.id("documents"),
    ownerId: v.id("users"),
    outputType: v.string(),
    provider: v.string(),
    questionsJson: v.optional(v.string()),
    flashcardsJson: v.optional(v.string()),
    ratingsJson: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_owner", ["ownerId"]),
});
