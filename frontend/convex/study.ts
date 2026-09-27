import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireUser } from "./lib/authHelpers";
import { parseRatings } from "./lib/studyHelpers";

export const listStudyMessages = query({
  args: { token: v.string(), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== user._id) {
      return { messages: [], store: "convex" };
    }
    const rows = await ctx.db
      .query("studyMessages")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();
    const messages = await Promise.all(
      rows.map(async (row) => {
        let quiz_session = null;
        if (row.quizSessionId) {
          const session = await ctx.db.get(row.quizSessionId);
          if (session) {
            const questions = session.questionsJson ? JSON.parse(session.questionsJson) : [];
            const flashcards = session.flashcardsJson ? JSON.parse(session.flashcardsJson) : [];
            quiz_session = {
              quiz_session_id: session._id,
              document_id: session.documentId,
              document_ids: [session.documentId],
              output_type: session.outputType,
              provider: session.provider,
              retrieval: { mode: "full_document", chunk_count: 1, document_count: 1 },
              questions,
              flashcards,
              history: parseRatings(session.ratingsJson),
              store: "convex",
            };
          }
        }
        return {
          id: row._id,
          document_id: row.documentId,
          role: row.role,
          content: row.content,
          prompt_kind: row.promptKind ?? null,
          chip_id: row.chipId ?? null,
          retrieval: null,
          quiz_session_id: row.quizSessionId ?? null,
          created_at: new Date(row.createdAt).toISOString(),
          quiz_session,
        };
      }),
    );
    return { messages, store: "convex" };
  },
});

export const getDocumentText = query({
  args: { token: v.string(), documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const doc = await ctx.db.get(args.documentId);
    if (!doc || doc.ownerId !== user._id) {
      throw new Error("Document not found.");
    }
    return { text: doc.extractedText ?? "", chunkCount: doc.chunkCount };
  },
});

export const getAiCache = query({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
  },
});

export const writeAiCache = mutation({
  args: {
    cacheKey: v.string(),
    documentId: v.id("documents"),
    promptKind: v.string(),
    resultJson: v.string(),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("aiCache")
      .withIndex("by_key", (q) => q.eq("cacheKey", args.cacheKey))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("aiCache", {
      cacheKey: args.cacheKey,
      documentId: args.documentId,
      promptKind: args.promptKind,
      resultJson: args.resultJson,
      provider: args.provider,
      createdAt: Date.now(),
    });
  },
});

export const persistStudySession = mutation({
  args: {
    token: v.string(),
    documentId: v.id("documents"),
    outputType: v.string(),
    provider: v.string(),
    questionsJson: v.string(),
    flashcardsJson: v.string(),
    userContent: v.string(),
    assistantContent: v.string(),
    chipId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const now = Date.now();
    const sessionId = await ctx.db.insert("quizSessions", {
      documentId: args.documentId,
      ownerId: user._id,
      outputType: args.outputType,
      provider: args.provider,
      questionsJson: args.questionsJson,
      flashcardsJson: args.flashcardsJson,
      createdAt: now,
    });
    await ctx.db.insert("studyMessages", {
      documentId: args.documentId,
      ownerId: user._id,
      role: "user",
      content: args.userContent,
      promptKind: "chip",
      chipId: args.chipId,
      createdAt: now,
    });
    await ctx.db.insert("studyMessages", {
      documentId: args.documentId,
      ownerId: user._id,
      role: "assistant",
      content: args.assistantContent,
      promptKind: "chip",
      chipId: args.chipId,
      quizSessionId: sessionId,
      createdAt: now + 1,
    });
    return sessionId;
  },
});

export const persistAskMessages = mutation({
  args: {
    token: v.string(),
    documentId: v.id("documents"),
    userMessage: v.string(),
    assistantMessage: v.string(),
    promptKind: v.string(),
    chipId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const now = Date.now();
    const userId = await ctx.db.insert("studyMessages", {
      documentId: args.documentId,
      ownerId: user._id,
      role: "user",
      content: args.userMessage,
      promptKind: args.promptKind,
      chipId: args.chipId,
      createdAt: now,
    });
    const assistantId = await ctx.db.insert("studyMessages", {
      documentId: args.documentId,
      ownerId: user._id,
      role: "assistant",
      content: args.assistantMessage,
      promptKind: args.promptKind,
      chipId: args.chipId,
      createdAt: now + 1,
    });
    return { userId, assistantId };
  },
});

export const rateFlashcard = mutation({
  args: {
    token: v.string(),
    sessionId: v.id("quizSessions"),
    cardId: v.string(),
    rating: v.union(v.literal("know"), v.literal("still_learning")),
  },
  handler: async (ctx, args) => {
    const { user } = await requireUser(ctx, args.token);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.ownerId !== user._id) {
      throw new Error("Quiz session not found.");
    }
    const history = parseRatings(session.ratingsJson);
    history.push({ card_id: args.cardId, rating: args.rating });
    await ctx.db.patch(session._id, { ratingsJson: JSON.stringify(history) });
    const questions = session.questionsJson ? JSON.parse(session.questionsJson) : [];
    const flashcards = session.flashcardsJson ? JSON.parse(session.flashcardsJson) : [];
    return {
      quiz_session_id: session._id,
      document_id: session.documentId,
      document_ids: [session.documentId],
      output_type: session.outputType,
      provider: session.provider,
      retrieval: { mode: "full_document", chunk_count: 1 },
      questions,
      flashcards,
      history,
      store: "convex",
    };
  },
});
