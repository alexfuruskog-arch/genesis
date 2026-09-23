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
import { shopifyMembershipUrl } from "@/lib/env";
import { FREE_SESSION_CAP, type PlanId } from "@/lib/plan";

export const STUDY_CHIPS = [
  { id: "flashcards", label: "Make flashcards", run: "flashcards" },
  { id: "quiz", label: "Quiz me", run: "quiz" },
  { id: "exam", label: "Practice exam", run: "soon-exam" },
  { id: "explain", label: "Explain this", run: "ask" },
  { id: "summarize", label: "Summarize", run: "ask" },
  { id: "plan", label: "Make a study plan", run: "soon-plan" },
] as const;

type ChipId = (typeof STUDY_CHIPS)[number]["id"];

type ChatItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chipId?: string | null;
  comingSoon?: "exam" | "plan";
  quizSession?: StudyResponse | null;
};

type SessionGate = {
  ok: boolean;
  remaining: number;
  used?: number;
};

type Props = {
  document: UploadedDocument | null;
  authHeaders: Record<string, string>;
  signedIn: boolean;
  sessionGate: SessionGate;
  plan: PlanId;
  backendError: string | null;
  onUsageChange: () => Promise<void> | void;
};

const SOON: Record<"exam" | "plan", { user: string; assistant: string }> = {
  exam: {
    user: "Practice exam",
    assistant:
      "Practice exam is coming next — a longer test with a score and a review at the end. It is not generated yet. Use Quiz me for short questions on this file.",
  },
  plan: {
    user: "Make a study plan",
    assistant:
      "Study plans are coming next — a day-by-day schedule up to an exam date. This chip stays in the composer so the layout is complete; it does not invent a plan yet.",
  },
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

export function StudyChat({
  document,
  authHeaders,
  signedIn,
  sessionGate,
  plan,
  backendError,
  onUsageChange,
}: Props) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const documentId = document?.id || null;

  useEffect(() => {
    if (!documentId || !signedIn) {
      setItems([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoadingThread(true);
    setError(null);
    void listStudyMessages(documentId, authHeaders)
      .then((body) => {
        if (cancelled) return;
        setItems(body.messages.map(fromApiMessage));
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

  function pushLocal(userText: string, assistantText: string, comingSoon: "exam" | "plan") {
    const stamp = Date.now();
    setItems((current) => [
      ...current,
      { id: `u-${stamp}`, role: "user", content: userText, chipId: comingSoon, comingSoon },
      {
        id: `a-${stamp}`,
        role: "assistant",
        content: assistantText,
        comingSoon,
      },
    ]);
  }

  async function runChip(chipId: ChipId) {
    const chip = STUDY_CHIPS.find((item) => item.id === chipId);
    if (!chip) return;
    setError(null);
    if (!signedIn) {
      setError("Sign in on Account first.");
      return;
    }
    if (!document) {
      setError("Select one file in your library.");
      return;
    }
    if (chip.run === "soon-exam") {
      pushLocal(SOON.exam.user, SOON.exam.assistant, "exam");
      return;
    }
    if (chip.run === "soon-plan") {
      pushLocal(SOON.plan.user, SOON.plan.assistant, "plan");
      return;
    }
    if (backendError) {
      setError(backendError);
      return;
    }
    if (!sessionGate.ok) {
      setError(
        `Free plan: ${FREE_SESSION_CAP} chats per week. You’ve used ${sessionGate.used ?? FREE_SESSION_CAP}. Upgrade to Standard — $12/month — for unlimited practice.`,
      );
      return;
    }
    if (!hasExtractedText(document)) {
      setError(
        "This file has no extractable text yet. Photos are stored, but OCR is not connected. Try a PDF, Word, PowerPoint, or text file.",
      );
      return;
    }

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
        const stamp = Date.now();
        setItems((current) => [
          ...current,
          { id: `u-${stamp}`, role: "user", content: chip.label, chipId: chip.id },
          {
            id: `a-${stamp}`,
            role: "assistant",
            content: chip.run === "flashcards" ? "Flashcards from this file." : "Short quiz from this file.",
            chipId: chip.id,
            quizSession: study,
          },
        ]);
        await onUsageChange();
        return;
      }
      const asked = await askAboutFile(
        {
          documentId: document.id,
          message: chip.label,
          promptKind: "chip",
          chipId: chip.id,
        },
        authHeaders,
      );
      setItems((current) => [
        ...current,
        fromApiMessage(asked.user_message),
        fromApiMessage(asked.message),
      ]);
      await onUsageChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setError(null);
    if (!signedIn) {
      setError("Sign in on Account first.");
      return;
    }
    if (!document) {
      setError("Select one file in your library.");
      return;
    }
    if (backendError) {
      setError(backendError);
      return;
    }
    if (!sessionGate.ok) {
      setError(
        `Free plan: ${FREE_SESSION_CAP} chats per week. You’ve used ${sessionGate.used ?? FREE_SESSION_CAP}. Upgrade to Standard — $12/month — for unlimited practice.`,
      );
      return;
    }
    if (!hasExtractedText(document)) {
      setError(
        "This file has no extractable text yet. Photos are stored, but OCR is not connected. Try a PDF, Word, PowerPoint, or text file.",
      );
      return;
    }
    setBusy(true);
    try {
      const asked = await askAboutFile(
        {
          documentId: document.id,
          message: text,
          promptKind: "free_text",
        },
        authHeaders,
      );
      setDraft("");
      setItems((current) => [
        ...current,
        fromApiMessage(asked.user_message),
        fromApiMessage(asked.message),
      ]);
      await onUsageChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That question failed.");
    } finally {
      setBusy(false);
    }
  }

  const composerDisabled = Boolean(backendError) || busy || !signedIn;

  return (
    <section className="study-panel flex min-h-[32rem] flex-col lg:min-h-[40rem]">
      <p className="study-label">03 · Chat</p>
      <h2 className="mt-3 font-display text-2xl tracking-[0.03em] text-forest">
        Ask about this file
      </h2>
      <p className="mt-2 text-sm font-light leading-6 text-forest/70">
        {document
          ? `Selected · ${document.filename}`
          : "Pick one library item. Chips and the question field both talk to that file."}
      </p>

      <div
        ref={threadRef}
        className="mt-5 min-h-[14rem] flex-1 space-y-3 overflow-y-auto border border-forest/10 bg-cream/40 px-3 py-4"
      >
        {loadingThread ? (
          <p className="py-10 text-center text-sm font-light text-forest/50">Opening this thread…</p>
        ) : null}

        {!loadingThread && !items.length && !busy ? (
          <div className="px-3 py-10 text-center">
            <p className="font-display text-[1.35rem] tracking-[0.02em] text-forest">
              {document ? "Ask or tap a chip" : "Select one file"}
            </p>
            <p className="mx-auto mt-2 max-w-[18rem] text-sm font-light leading-6 text-forest/55">
              {document
                ? "Make flashcards, quiz yourself, explain, summarize, or type a question about this file."
                : "The composer stays here. Choose a file with extracted text to start."}
            </p>
          </div>
        ) : null}

        {items.map((item) => (
          <article
            key={item.id}
            className={item.role === "user" ? "ml-6 bg-forest px-4 py-3 text-cream" : "mr-6 bg-cream px-4 py-3"}
          >
            <p className={`text-[0.58rem] uppercase tracking-[0.14em] ${item.role === "user" ? "text-cream/55" : "text-forest/45"}`}>
              {item.role === "user" ? "You" : "Study AI"}
            </p>
            <p
              className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${item.role === "user" ? "text-cream" : "text-forest"}`}
            >
              {item.content}
            </p>
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
          <p className="border border-dashed border-forest/12 px-4 py-8 text-center text-sm font-light text-forest/55">
            Retrieving your notes…
          </p>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
      {plan === "free" && !sessionGate.ok ? (
        <p className="mt-3 text-sm font-light text-forest/70">
          Weekly chat limit reached.{" "}
          <a href={shopifyMembershipUrl("standard")} className="underline underline-offset-4">
            Upgrade to Standard · $12
          </a>
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-5">
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
        <label className="mt-4 block">
          <span className="sr-only">Ask about this file</span>
          <div className="flex items-end gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about this file…"
              disabled={composerDisabled}
              className="study-input"
            />
            <button type="submit" disabled={composerDisabled || !draft.trim()} className="btn-ink shrink-0">
              Send
            </button>
          </div>
        </label>
        {plan === "free" && sessionGate.ok ? (
          <p className="mt-3 text-xs font-light text-forest/55">
            {sessionGate.remaining} of {FREE_SESSION_CAP} Free chats left this week.
          </p>
        ) : null}
      </form>
    </section>
  );
}
