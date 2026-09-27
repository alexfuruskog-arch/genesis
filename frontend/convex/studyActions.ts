"use node";

import { v } from "convex/values";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import {
  cacheKey,
  generateAnswer,
  generateFlashcards,
  generateQuiz,
  providerName,
} from "./lib/llm";

export const generateStudy = action({
  args: {
    token: v.string(),
    documentId: v.id("documents"),
    outputType: v.union(v.literal("quiz"), v.literal("flashcards"), v.literal("questions")),
    questionCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const docRow = await ctx.runQuery(api.study.getDocumentText, {
      token: args.token,
      documentId: args.documentId,
    });
    const count = args.questionCount ?? 5;
    const promptKind = args.outputType === "flashcards" ? "flashcards" : "quiz";
    const fingerprint = `${args.outputType}:${count}`;
    const key = cacheKey(args.documentId, promptKind, fingerprint);
    const cached = await ctx.runQuery(api.study.getAiCache, { cacheKey: key });
    let questions: unknown[] = [];
    let flashcards: unknown[] = [];
    const provider = cached?.provider ?? providerName();
    if (cached) {
      const payload = JSON.parse(cached.resultJson);
      questions = payload.questions ?? [];
      flashcards = payload.flashcards ?? [];
    } else {
      if (args.outputType === "flashcards") {
        flashcards = await generateFlashcards(docRow.text, count);
      } else {
        questions = await generateQuiz(docRow.text, count);
      }
      await ctx.runMutation(api.study.writeAiCache, {
        cacheKey: key,
        documentId: args.documentId,
        promptKind,
        resultJson: JSON.stringify({ questions, flashcards }),
        provider,
      });
    }
    const sessionId = await ctx.runMutation(api.study.persistStudySession, {
      token: args.token,
      documentId: args.documentId,
      outputType: args.outputType === "flashcards" ? "flashcards" : "questions",
      provider,
      questionsJson: JSON.stringify(questions),
      flashcardsJson: JSON.stringify(flashcards),
      userContent: args.outputType === "flashcards" ? "Make flashcards" : "Quiz me",
      assistantContent:
        args.outputType === "flashcards"
          ? "Flashcards from this file."
          : "Short quiz from this file.",
      chipId: args.outputType === "flashcards" ? "flashcards" : "quiz",
    });
    return {
      quiz_session_id: sessionId,
      document_id: args.documentId,
      document_ids: [args.documentId],
      output_type: args.outputType === "flashcards" ? "flashcards" : "questions",
      provider,
      retrieval: { mode: "full_document", chunk_count: 1, document_count: 1 },
      questions,
      flashcards,
      history: [],
      store: "convex",
    };
  },
});

export const askAboutFile = action({
  args: {
    token: v.string(),
    documentId: v.id("documents"),
    message: v.string(),
    promptKind: v.optional(v.string()),
    chipId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const docRow = await ctx.runQuery(api.study.getDocumentText, {
      token: args.token,
      documentId: args.documentId,
    });
    const kind = args.promptKind ?? "free_text";
    const fingerprint = `${kind}:${args.chipId ?? ""}:${args.message}`;
    const key = cacheKey(args.documentId, kind, fingerprint);
    const cached = await ctx.runQuery(api.study.getAiCache, { cacheKey: key });
    let answer: string;
    const provider = cached?.provider ?? providerName();
    if (cached) {
      const payload = JSON.parse(cached.resultJson);
      answer = payload.answer ?? "";
    } else {
      answer = await generateAnswer(docRow.text, args.message);
      await ctx.runMutation(api.study.writeAiCache, {
        cacheKey: key,
        documentId: args.documentId,
        promptKind: kind,
        resultJson: JSON.stringify({ answer }),
        provider,
      });
    }
    const ids = await ctx.runMutation(api.study.persistAskMessages, {
      token: args.token,
      documentId: args.documentId,
      userMessage: args.message,
      assistantMessage: answer,
      promptKind: kind,
      chipId: args.chipId,
    });
    const user_message = {
      id: ids.userId,
      document_id: args.documentId,
      role: "user" as const,
      content: args.message,
      prompt_kind: kind,
      chip_id: args.chipId ?? null,
      retrieval: null,
      quiz_session_id: null,
      created_at: new Date().toISOString(),
      quiz_session: null,
    };
    const message = {
      id: ids.assistantId,
      document_id: args.documentId,
      role: "assistant" as const,
      content: answer,
      prompt_kind: kind,
      chip_id: args.chipId ?? null,
      retrieval: { mode: "full_document", chunk_count: 1 },
      quiz_session_id: null,
      created_at: new Date().toISOString(),
      quiz_session: null,
    };
    return {
      message,
      user_message,
      provider,
      retrieval: { mode: "full_document", chunk_count: 1, document_count: 1 },
      store: "convex",
    };
  },
});
