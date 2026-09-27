/** Shared API shapes for action handlers (avoids circular inference via `api`). */

export type StudyPlan = "free" | "plus" | "pro";

export type DocumentTextRow = {
  text: string;
  chunkCount: number;
};

export type AiCacheRow = {
  _id: string;
  cacheKey: string;
  documentId: string;
  promptKind: string;
  resultJson: string;
  provider: string;
  createdAt: number;
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

export type StudyGenerateResult = {
  quiz_session_id: string;
  document_id: string;
  document_ids: string[];
  output_type: "flashcards" | "questions";
  provider: string;
  retrieval: { mode: string; chunk_count: number; document_count: number };
  questions: QuizQuestion[];
  flashcards: Flashcard[];
  history: [];
  store: string;
};

export type StudyMessagePayload = {
  id: string;
  document_id: string;
  role: "user" | "assistant";
  content: string;
  prompt_kind: string;
  chip_id: string | null;
  retrieval: Record<string, unknown> | null;
  quiz_session_id: string | null;
  created_at: string;
  quiz_session: null;
};

export type AskAboutFileResult = {
  message: StudyMessagePayload;
  user_message: StudyMessagePayload;
  provider: string;
  retrieval: { mode: string; chunk_count: number; document_count: number };
  store: string;
};

export type PersistAskIds = {
  userId: string;
  assistantId: string;
};

export type AuthMeRow = {
  id: string;
  email: string;
  token: string;
  plan: StudyPlan;
  plan_label: string;
  source: string;
};

export type MembershipSnapshotRow = {
  plan: StudyPlan;
  plan_label: string;
  unlimited: boolean;
  billing_status: string;
  plan_expires_at: string | null;
  uploads_used: number;
  uploads_cap: number;
  uploads_remaining: number;
  email: string;
};

export type UploadedDocumentClient = {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  byte_size: number | null;
  extraction_status: string;
  chunk_count: number;
  created_at: string;
  storage_backend: string;
  notebook_model: string | null;
  source_kind: "scan" | "lecture" | null;
  kind_label: string;
  store: string;
};
