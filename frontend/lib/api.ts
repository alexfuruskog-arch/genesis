import { api } from "../convex/_generated/api";
import { convexClient } from "./convex";

export type HealthResponse = {
  status: string;
  service: string;
  integrations: {
    convex?: boolean;
    supabase?: boolean;
    llm: string;
    shopify: string;
  };
};

export type UploadedDocument = {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
  extraction_status: string;
  chunk_count: number;
  created_at: string;
  storage_backend?: string | null;
  notebook_model?: string | null;
  source_kind?: "scan" | "lecture" | null;
  kind_label?: string | null;
  store?: string;
};

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

export type CardRating = "know" | "still_learning";

export type FlashcardRating = {
  card_id: string;
  rating: CardRating;
  at?: string | null;
};

export type StudyResponse = {
  quiz_session_id: string;
  document_id: string | null;
  document_ids: string[];
  output_type: "quiz" | "flashcards" | "questions";
  provider: string;
  retrieval: {
    mode: string;
    chunk_count: number;
    document_count?: number;
  };
  questions: QuizQuestion[];
  flashcards: Flashcard[];
  history?: FlashcardRating[];
  store: string;
};

export type PromptKind = "chip" | "free_text";

export type StudyMessage = {
  id: string;
  document_id: string | null;
  role: "user" | "assistant";
  content: string;
  prompt_kind: PromptKind | null;
  chip_id: string | null;
  retrieval: Record<string, unknown> | null;
  quiz_session_id: string | null;
  created_at: string;
  quiz_session?: StudyResponse | null;
};

export type AskResponse = {
  message: StudyMessage;
  user_message: StudyMessage;
  provider: string;
  retrieval: {
    mode: string;
    chunk_count: number;
    document_count?: number;
  };
  store: string;
};

export type PlanId = "free" | "plus" | "pro";

export type AuthSession = {
  id: string;
  email: string;
  source: string;
  token: string;
  message?: string | null;
  plan?: PlanId;
  plan_label?: string;
  unlimited?: boolean;
};

export type MembershipSnapshot = {
  plan: PlanId;
  plan_label: string;
  unlimited: boolean;
  billing_status: string;
  plan_expires_at: string | null;
  uploads_used: number;
  uploads_cap: number;
  uploads_remaining: number;
  email: string | null;
};

function sessionToken(authHeaders?: Record<string, string>): string {
  const bearer = authHeaders?.Authorization;
  if (bearer?.startsWith("Bearer ")) return bearer.slice(7);
  return authHeaders?.["X-Session-Token"] || "";
}

export async function fetchHealth(): Promise<HealthResponse> {
  const body = await convexClient.query(api.documents.health, {});
  return {
    status: body.status,
    service: body.service,
    integrations: {
      convex: body.integrations.convex,
      llm: body.integrations.llm,
      shopify: body.integrations.shopify,
    },
  };
}

export async function uploadDocument(
  file: File,
  authHeaders?: Record<string, string>,
  options?: {
    notebookModel?: "math" | "cornell" | null;
    sourceKind?: "scan" | "lecture";
  },
): Promise<UploadedDocument> {
  const token = sessionToken(authHeaders);
  const uploadUrl = await convexClient.mutation(api.documents.generateUploadUrl, { token });
  const uploadResult = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!uploadResult.ok) {
    throw new Error("Could not upload file to storage.");
  }
  const { storageId } = (await uploadResult.json()) as { storageId: string };
  return await convexClient.action(api.documentActions.finalizeUpload, {
    token,
    storageId,
    filename: file.name,
    mimeType: file.type || undefined,
    byteSize: file.size,
    notebookModel: options?.notebookModel ?? undefined,
    sourceKind: options?.sourceKind,
  });
}

export async function fetchDocumentFile(
  documentId: string,
  authHeaders?: Record<string, string>,
): Promise<{ blob: Blob; filename: string }> {
  const token = sessionToken(authHeaders);
  const meta = await convexClient.query(api.documents.getFileUrl, {
    token,
    documentId: documentId as never,
  });
  if (!meta.url) {
    throw new Error("File is not available.");
  }
  const response = await fetch(meta.url);
  if (!response.ok) {
    throw new Error("Could not download this file.");
  }
  const blob = await response.blob();
  return { blob, filename: meta.filename };
}

export async function listDocuments(authHeaders?: Record<string, string>) {
  const token = sessionToken(authHeaders);
  return await convexClient.query(api.documents.listDocuments, { token });
}

export async function generateStudy(
  input: {
    documentIds: string[];
    outputType: "quiz" | "flashcards" | "questions";
    questionCount?: number;
  },
  authHeaders?: Record<string, string>,
): Promise<StudyResponse> {
  const token = sessionToken(authHeaders);
  return (await convexClient.action(api.studyActions.generateStudy, {
    token,
    documentId: input.documentIds[0] as never,
    outputType: input.outputType === "questions" ? "questions" : input.outputType,
    questionCount: input.questionCount,
  })) as StudyResponse;
}

export async function askAboutFile(
  input: {
    documentId: string;
    message: string;
    promptKind?: PromptKind;
    chipId?: string;
  },
  authHeaders?: Record<string, string>,
): Promise<AskResponse> {
  const token = sessionToken(authHeaders);
  return (await convexClient.action(api.studyActions.askAboutFile, {
    token,
    documentId: input.documentId as never,
    message: input.message,
    promptKind: input.promptKind,
    chipId: input.chipId,
  })) as AskResponse;
}

export async function listStudyMessages(documentId: string, authHeaders?: Record<string, string>) {
  const token = sessionToken(authHeaders);
  return await convexClient.query(api.study.listStudyMessages, {
    token,
    documentId: documentId as never,
  });
}

export async function rateFlashcard(
  sessionId: string,
  cardId: string,
  rating: CardRating,
  authHeaders?: Record<string, string>,
): Promise<StudyResponse> {
  const token = sessionToken(authHeaders);
  return (await convexClient.mutation(api.study.rateFlashcard, {
    token,
    sessionId: sessionId as never,
    cardId,
    rating,
  })) as StudyResponse;
}

export async function authSignup(email: string, password: string): Promise<AuthSession> {
  const session = await convexClient.mutation(api.auth.signUp, { email, password });
  return { ...session, unlimited: session.plan !== "free" };
}

export async function authLogin(email: string, password: string): Promise<AuthSession> {
  const session = await convexClient.mutation(api.auth.signIn, { email, password });
  return { ...session, unlimited: session.plan !== "free" };
}

export async function authLogout(token?: string): Promise<void> {
  if (token) {
    await convexClient.mutation(api.auth.signOut, { token });
  }
}

export async function fetchMe(authHeaders?: Record<string, string>): Promise<AuthSession> {
  const token = sessionToken(authHeaders);
  const session = await convexClient.query(api.auth.me, { token });
  if (!session) {
    throw new Error("Not signed in.");
  }
  return { ...session, unlimited: session.plan !== "free" };
}

export async function fetchMembership(authHeaders?: Record<string, string>): Promise<MembershipSnapshot> {
  const token = sessionToken(authHeaders);
  return await convexClient.query(api.membership.snapshot, { token });
}
