"use node";

import { createHash } from "crypto";

export type QuizQuestion = {
  id: string;
  question: string;
  choices: string[];
  correct_index: number;
  explanation: string;
};

export type Flashcard = {
  id: string;
  front: string;
  back: string;
};

export function cacheKey(
  documentId: string,
  promptKind: string,
  fingerprint: string,
): string {
  return createHash("sha256")
    .update(`${documentId}:${promptKind}:${fingerprint}`)
    .digest("hex");
}

export function providerName(): string {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "mock";
}

const QUIZ_INSTRUCTIONS = `You are a study coach for ARZIVE. Create short multiple-choice quiz questions from the source notes.
Reply ONLY with valid JSON shaped like:
{"questions":[{"id":"q1","question":"...","choices":["A","B","C","D"],"correct_index":0,"explanation":"..."}]}`;

const FLASH_INSTRUCTIONS = `You are a study coach for ARZIVE. Create flashcards from the source notes.
Reply ONLY with valid JSON shaped like:
{"flashcards":[{"id":"c1","front":"...","back":"..."}]}`;

const ASK_INSTRUCTIONS = `You are a study coach for ARZIVE. Answer using ONLY the student's uploaded notes. Be concise.`;

export async function generateQuiz(
  sourceText: string,
  questionCount: number,
): Promise<QuizQuestion[]> {
  const provider = providerName();
  const clipped = sourceText.slice(0, 12000);
  const user = `Create ${questionCount} short quiz questions.\n\nSource notes:\n${clipped}`;
  if (provider === "openai") {
    const raw = await openaiChat(QUIZ_INSTRUCTIONS, user, true);
    return parseQuestions(raw, questionCount, sourceText);
  }
  if (provider === "anthropic") {
    const raw = await anthropicChat(QUIZ_INSTRUCTIONS, user);
    return parseQuestions(raw, questionCount, sourceText);
  }
  return mockQuestions(sourceText, questionCount);
}

export async function generateFlashcards(
  sourceText: string,
  cardCount: number,
): Promise<Flashcard[]> {
  const provider = providerName();
  const clipped = sourceText.slice(0, 12000);
  const user = `Create ${cardCount} flashcards.\n\nSource notes:\n${clipped}`;
  if (provider === "openai") {
    const raw = await openaiChat(FLASH_INSTRUCTIONS, user, true);
    return parseFlashcards(raw, cardCount, sourceText);
  }
  if (provider === "anthropic") {
    const raw = await anthropicChat(FLASH_INSTRUCTIONS, user);
    return parseFlashcards(raw, cardCount, sourceText);
  }
  return mockFlashcards(sourceText, cardCount);
}

export async function generateAnswer(sourceText: string, question: string): Promise<string> {
  const provider = providerName();
  const clipped = sourceText.slice(0, 12000);
  const user = `Student question:\n${question}\n\nSource notes:\n${clipped}`;
  if (provider === "openai") {
    return (await openaiChat(ASK_INSTRUCTIONS, user, false)).trim();
  }
  if (provider === "anthropic") {
    return (await anthropicChat(ASK_INSTRUCTIONS, user)).trim();
  }
  return mockAnswer(sourceText, question);
}

async function openaiChat(system: string, user: string, jsonMode: boolean): Promise<string> {
  const model = process.env.LLM_MODEL || "gpt-4.1-mini";
  const payload: Record<string, unknown> = {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (jsonMode) payload.response_format = { type: "json_object" };
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`OpenAI error: ${response.status}`);
  const body = (await response.json()) as {
    choices: { message: { content: string } }[];
  };
  return body.choices[0]?.message?.content || "";
}

async function anthropicChat(system: string, user: string): Promise<string> {
  const model = process.env.LLM_MODEL || "claude-sonnet-4-5";
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic error: ${response.status}`);
  const body = (await response.json()) as {
    content: { type: string; text?: string }[];
  };
  return (body.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("");
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;
  const match = /\{[\s\S]*\}/.exec(trimmed);
  if (!match) throw new Error("No JSON in model output");
  return match[0];
}

function parseQuestions(raw: string, count: number, source: string): QuizQuestion[] {
  try {
    const payload = JSON.parse(extractJson(raw)) as {
      questions?: QuizQuestion[];
    };
    const items = payload.questions || [];
    const out: QuizQuestion[] = [];
    for (const [i, item] of items.slice(0, count).entries()) {
      const choices = (item.choices || []).map(String);
      if (choices.length < 2) continue;
      out.push({
        id: String(item.id || `q${i + 1}`),
        question: String(item.question || "").trim(),
        choices: choices.slice(0, 4),
        correct_index: Number(item.correct_index) || 0,
        explanation: String(item.explanation || "").trim(),
      });
    }
    if (out.length) return out;
  } catch {
    /* fall through */
  }
  return mockQuestions(source, count);
}

function parseFlashcards(raw: string, count: number, source: string): Flashcard[] {
  try {
    const payload = JSON.parse(extractJson(raw)) as {
      flashcards?: Flashcard[];
    };
    const items = payload.flashcards || [];
    const out: Flashcard[] = [];
    for (const [i, item] of items.slice(0, count).entries()) {
      const front = String(item.front || "").trim();
      const back = String(item.back || "").trim();
      if (!front || !back) continue;
      out.push({ id: String(item.id || `c${i + 1}`), front, back });
    }
    if (out.length) return out;
  } catch {
    /* fall through */
  }
  return mockFlashcards(source, count);
}

function mockQuestions(sourceText: string, questionCount: number): QuizQuestion[] {
  const snippets = sourceText
    .split(/[.\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 24);
  const pool = snippets.length
    ? snippets
    : ["Upload notebook scans so ARZIVE can turn them into practice questions."];
  const questions: QuizQuestion[] = [];
  for (let i = 0; i < questionCount; i++) {
    const snippet = pool[i % pool.length].slice(0, 140);
    questions.push({
      id: `q${i + 1}`,
      question: `Based on your notes, which statement best matches: “${snippet}”?`,
      choices: [
        snippet.slice(0, 90) || "The claim in the notes",
        "This is not mentioned in the material",
        "The opposite of what the notes say",
        "Only a definition without context",
      ],
      correct_index: 0,
      explanation:
        "Mock mode: the first choice mirrors the excerpt. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for live questions.",
    });
  }
  return questions;
}

function mockFlashcards(sourceText: string, cardCount: number): Flashcard[] {
  const snippets = sourceText
    .split(/[.\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 18);
  const pool = snippets.length ? snippets : ["ARZIVE turns scanned notebook pages into study tools."];
  const cards: Flashcard[] = [];
  for (let i = 0; i < cardCount; i++) {
    const snippet = pool[i % pool.length].slice(0, 160);
    cards.push({
      id: `c${i + 1}`,
      front: `Recall from your notes (${i + 1})`,
      back: snippet,
    });
  }
  return cards;
}

function mockAnswer(sourceText: string, question: string): string {
  const snippets = sourceText
    .split(/[.\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 24);
  const excerpt = (snippets.slice(0, 3).join(" ") || "The uploaded file did not yield a longer excerpt.").slice(
    0,
    420,
  );
  return (
    `From this file, here is a grounded answer to: ${question.trim()}\n\n` +
    `${excerpt}\n\n` +
    "Mock mode uses excerpts from your notes. Set OPENAI_API_KEY or ANTHROPIC_API_KEY for a live explanation."
  );
}
