"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { FlashcardDeck } from "@/components/study/FlashcardDeck";
import { QuizSet } from "@/components/study/QuizSet";
import {
  askAboutFile,
  generateStudy,
  listStudyMessages,
  type StudyMessage,
  type StudyResponse,
  type UploadedDocument,
} from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { studyTextBlockedMessage } from "@/lib/library";

export const STUDY_CHIPS = [
  { id: "flashcards", label: "Make flashcards", run: "flashcards" },
  { id: "quiz", label: "Quiz me", run: "quiz" },
  { id: "summarize", label: "Summarize", run: "ask" },
  { id: "explain", label: "Explain the key ideas", run: "ask" },
] as const;

type ChipId = (typeof STUDY_CHIPS)[number]["id"];

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chipId?: string | null;
  quizSession?: StudyResponse | null;
};

type Props = {
  document: UploadedDocument | null;
  authHeaders: Record<string, string>;
  signedIn: boolean;
  backendError: string | null;
};

function hasExtractedText(document: UploadedDocument | null) {
  return Boolean(document && document.extraction_status === "ready" && document.chunk_count > 0);
}

function fromApiMessage(message: StudyMessage): ChatItem {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    chipId: message.chip_id,
    quizSession: message.quiz_session || null,
  };
}

function localId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** The parent keys this component by document id, so each file gets a fresh thread. */
export function StudyChat(props: Props) {
  return <Thread key={props.document?.id ?? "none"} {...props} />;
}

function Thread({ document, authHeaders, signedIn, backendError }: Props) {
  const documentId = document?.id || null;
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(Boolean(documentId && signedIn));
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const readable = hasExtractedText(document);
  const blockedMessage =
    document && !readable ? studyTextBlockedMessage(document.filename, document.mime_type) : null;

  useEffect(() => {
    if (!documentId || !signedIn) return;
    let cancelled = false;
    void listStudyMessages(documentId, authHeaders)
      .then((body) => {
        if (!cancelled) setItems(body.messages.map(fromApiMessage));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, signedIn, authHeaders]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [items, busy]);

  function precheck(): boolean {
    setError(null);
    if (!document) {
      setError("Choose a file from your library first.");
      return false;
    }
    if (backendError) {
      setError(backendError);
      return false;
    }
    if (!readable) {
      setError(blockedMessage);
      return false;
    }
    return true;
  }

  async function runChip(chipId: ChipId) {
    const chip = STUDY_CHIPS.find((item) => item.id === chipId);
    if (!chip || !precheck() || !document) return;
    setBusy(true);
    try {
      if (chip.run === "flashcards" || chip.run === "quiz") {
        const study = await generateStudy(
          {
            documentIds: [document.id],
            outputType: chip.run === "flashcards" ? "flashcards" : "questions",
          },
          authHeaders,
        );
        setItems((current) => [
          ...current,
          { id: localId("u"), role: "user", content: chip.label, chipId: chip.id },
          {
            id: localId("a"),
            role: "assistant",
            content:
              chip.run === "flashcards"
                ? "Here are flashcards from this file. Tap a card to flip it."
                : "Here's a short quiz from this file. Pick an answer to check it.",
            chipId: chip.id,
            quizSession: study,
          },
        ]);
        return;
      }
      const asked = await askAboutFile(
        { documentId: document.id, message: chip.label, promptKind: "chip", chipId: chip.id },
        authHeaders,
      );
      setItems((current) => [
        ...current,
        fromApiMessage(asked.user_message),
        fromApiMessage(asked.message),
      ]);
    } catch (err) {
      setError(friendlyError(err, "That didn't work. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !precheck() || !document) return;
    setBusy(true);
    try {
      const asked = await askAboutFile(
        { documentId: document.id, message: text, promptKind: "free_text" },
        authHeaders,
      );
      setDraft("");
      setItems((current) => [
        ...current,
        fromApiMessage(asked.user_message),
        fromApiMessage(asked.message),
      ]);
    } catch (err) {
      setError(friendlyError(err, "Your question didn't go through. Try again."));
    } finally {
      setBusy(false);
    }
  }

  const composerDisabled = Boolean(backendError) || busy || !signedIn || !document || !readable;

  return (
    <section
      className="study-panel flex min-h-[34rem] flex-col lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]"
      aria-labelledby="chat-heading"
    >
      <h2 id="chat-heading" className="font-display text-[1.75rem] leading-tight">
        Study this file
      </h2>
      <p className="mt-1 truncate text-[0.95rem] text-forest/65">
        {document ? document.filename : "Choose a file from your library to begin."}
      </p>

      <div
        ref={threadRef}
        aria-live="polite"
        className="mt-4 min-h-[16rem] flex-1 space-y-3 overflow-y-auto border border-forest/10 bg-white/60 px-3 py-4"
      >
        {loadingThread ? (
          <p className="py-10 text-center text-forest/50">Loading this conversation…</p>
        ) : null}

        {!loadingThread && !items.length && !busy ? (
          <div className="px-3 py-10 text-center">
            {blockedMessage ? (
              <>
                <p className="font-display text-[1.4rem]">This file has no readable text</p>
                <p className="mx-auto mt-2 max-w-sm text-[0.95rem] leading-6 text-forest/60">
                  {blockedMessage}
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-[1.4rem]">
                  {document ? "What do you want to practise?" : "No file selected"}
                </p>
                <p className="mx-auto mt-2 max-w-xs text-[0.95rem] leading-6 text-forest/60">
                  {document
                    ? "Pick an option below or ask your own question. Answers come only from this file."
                    : "Your flashcards, quizzes and answers will appear here."}
                </p>
              </>
            )}
          </div>
        ) : null}

        {items.map((item) => (
          <article
            key={item.id}
            className={
              item.role === "user"
                ? "ml-8 bg-forest px-4 py-3 text-cream"
                : "mr-4 border border-forest/10 bg-paper px-4 py-3"
            }
          >
            <p className={`text-sm ${item.role === "user" ? "text-cream/60" : "text-brass"}`}>
              {item.role === "user" ? "You" : "Study"}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[0.98rem] leading-7">{item.content}</p>
            {item.quizSession?.output_type === "flashcards" ? (
              <div className="mt-4">
                <FlashcardDeck
                  sessionId={item.quizSession.quiz_session_id}
                  cards={item.quizSession.flashcards}
                  history={item.quizSession.history}
                  authHeaders={authHeaders}
                />
              </div>
            ) : null}
            {item.quizSession &&
            (item.quizSession.output_type === "questions" || item.quizSession.output_type === "quiz") ? (
              <div className="mt-4">
                <QuizSet questions={item.quizSession.questions} />
              </div>
            ) : null}
          </article>
        ))}

        {busy ? (
          <p className="px-4 py-6 text-center text-forest/55" role="status">
            Reading your notes…
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-[0.95rem] text-red-800">
          {error}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-4">
        <div className="flex flex-wrap gap-2">
          {STUDY_CHIPS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={composerDisabled}
              onClick={() => void runChip(chip.id)}
              className="study-chip"
            >
              {chip.label}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <label htmlFor="study-question" className="sr-only">
            Ask a question about this file
          </label>
          <input
            id="study-question"
            value={draft}
            maxLength={2000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={document ? "Ask a question about this file" : "Choose a file first"}
            disabled={composerDisabled}
            className="study-input"
          />
          <button type="submit" disabled={composerDisabled || !draft.trim()} className="btn-ink shrink-0">
            Ask
          </button>
        </div>
      </form>
    </section>
  );
}
