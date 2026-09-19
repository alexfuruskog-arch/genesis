"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchHealth,
  generateStudy,
  listDocuments,
  uploadDocument,
  type HealthResponse,
  type StudyResponse,
  type UploadedDocument,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { publicConfig } from "@/lib/env";

type NotebookModel = "math" | "cornell";

export default function StudyPage() {
  const { user, ready, authHeaders } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notebookModel, setNotebookModel] = useState<NotebookModel>("cornell");
  const [listLoading, setListLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [result, setResult] = useState<StudyResponse | null>(null);
  const [outputType, setOutputType] = useState<"quiz" | "flashcards">("quiz");
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const signedIn = Boolean(user?.email);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const [healthResult, docs] = await Promise.all([
        fetchHealth(),
        listDocuments(authHeaders),
      ]);
      setHealth(healthResult);
      setDocuments(docs.documents);
      setCloudEnabled(Boolean(docs.cloud_enabled || healthResult.integrations.supabase));
      setBackendError(null);
    } catch (err) {
      setBackendError(
        err instanceof Error
          ? err.message
          : "Could not reach the API. Start FastAPI on port 48721.",
      );
    } finally {
      setListLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, refresh]);

  async function onUpload(fileList: FileList | null) {
    if (!fileList?.length) return;
    if (!signedIn) {
      setUploadError("Sign in on Account first — scans are saved under your customer account.");
      return;
    }
    setUploadBusy(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const uploaded: UploadedDocument[] = [];
      for (const file of Array.from(fileList)) {
        uploaded.push(
          await uploadDocument(file, authHeaders, notebookModel),
        );
      }
      setDocuments((current) => [...uploaded, ...current]);
      setSelected((current) => [...uploaded.map((doc) => doc.id), ...current]);
      const backend = uploaded[0]?.storage_backend;
      setUploadNotice(
        backend === "supabase"
          ? `${uploaded.length} scan(s) saved to your cloud library.`
          : `${uploaded.length} scan(s) saved locally (Supabase keys missing — cloud path is ready when configured).`,
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  function toggleDoc(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function onGenerate() {
    if (selected.length === 0) {
      setGenerateError("Select at least one scan.");
      return;
    }
    setGenerateBusy(true);
    setGenerateError(null);
    setAnswers({});
    setFlipped({});
    try {
      const study = await generateStudy(
        { documentIds: selected, outputType },
        authHeaders,
      );
      setResult(study);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerateBusy(false);
    }
  }

  return (
    <main className="bg-cream">
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.22em] uppercase text-forest/55">
              Study with Arzive
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-[0.04em] text-forest">
              Scan to your account
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-forest/70">
              Photograph or upload pages from your Cream Cornell or Green Math
              notebook. Files are stored under your customer account (Supabase
              Storage + RLS when keys are set) and listed only for you.
            </p>
          </div>
          <div className="text-xs text-forest/55">
            {signedIn ? (
              <p>
                Signed in as <span className="text-forest">{user?.email}</span>
              </p>
            ) : (
              <p>
                <Link href="/account" className="underline underline-offset-2">
                  Create an account / sign in
                </Link>{" "}
                to save scans to your library.
              </p>
            )}
            {health ? (
              <p className="mt-1">
                API ok · LLM {health.integrations.llm} ·{" "}
                {cloudEnabled ? "cloud ready" : "local fallback"}
                {publicConfig.supabaseConfigured ? " · Supabase client set" : ""}
              </p>
            ) : null}
          </div>
        </div>

        {!signedIn ? (
          <div className="mt-8 border border-forest/15 bg-cream-soft px-4 py-4 text-sm text-forest/80">
            Scans belong to a customer account.{" "}
            <Link href="/account" className="font-medium underline underline-offset-2">
              Sign in or sign up
            </Link>{" "}
            before uploading — then only you will see them.
          </div>
        ) : null}

        {backendError ? (
          <div className="mt-8 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            {backendError}
          </div>
        ) : null}

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-6">
            <section className="border border-forest/10 bg-white/50 p-5 sm:p-6">
              <h2 className="font-display text-xl tracking-[0.04em]">1. Scan notes</h2>
              <p className="mt-2 text-sm text-forest/65">
                Use the camera on your phone, or upload photos / PDF / TXT.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    { id: "cornell" as const, label: "Cream Cornell" },
                    { id: "math" as const, label: "Green Math" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setNotebookModel(option.id)}
                    className={`px-3 py-2 text-xs tracking-[0.14em] uppercase ${
                      notebookModel === option.id
                        ? "bg-forest text-cream"
                        : "border border-forest/20 text-forest"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!signedIn || Boolean(backendError) || uploadBusy}
                  onClick={() => cameraRef.current?.click()}
                  className="border border-dashed border-forest/25 bg-cream-soft/60 px-4 py-8 text-center text-sm font-medium text-forest transition hover:border-forest/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadBusy ? "Uploading…" : "Open camera"}
                </button>
                <button
                  type="button"
                  disabled={!signedIn || Boolean(backendError) || uploadBusy}
                  onClick={() => fileRef.current?.click()}
                  className="border border-dashed border-forest/25 bg-cream-soft/60 px-4 py-8 text-center text-sm font-medium text-forest transition hover:border-forest/45 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploadBusy ? "Uploading…" : "Upload files"}
                </button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={!signedIn || Boolean(backendError) || uploadBusy}
                onChange={(event) => {
                  void onUpload(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".txt,.md,.pdf,image/*,text/plain,application/pdf"
                className="sr-only"
                disabled={!signedIn || Boolean(backendError) || uploadBusy}
                onChange={(event) => {
                  void onUpload(event.target.files);
                  event.target.value = "";
                }}
              />
              <p className="mt-3 text-xs text-forest/55">
                .jpg .png .heic .pdf .txt · max 10 MB · tagged as{" "}
                {notebookModel === "cornell" ? "Cream Cornell" : "Green Math"}
              </p>
              {uploadError ? (
                <p className="mt-3 text-sm text-red-800">{uploadError}</p>
              ) : null}
              {uploadNotice ? (
                <p className="mt-3 text-sm text-forest/75">{uploadNotice}</p>
              ) : null}
            </section>

            <section className="border border-forest/10 bg-white/50 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl tracking-[0.04em]">
                  2. Your library
                </h2>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="text-xs tracking-[0.14em] uppercase text-forest/60 hover:text-forest"
                >
                  Refresh
                </button>
              </div>
              <p className="mt-2 text-sm text-forest/60">
                Only scans for this account. RLS on Supabase keeps other users out.
              </p>

              {listLoading ? (
                <p className="mt-6 text-sm text-forest/60">Loading scans…</p>
              ) : null}

              {!listLoading && documents.length === 0 ? (
                <div className="mt-6 border border-dashed border-forest/20 px-4 py-8 text-center">
                  <p className="font-medium text-forest">No scans yet</p>
                  <p className="mt-1 text-sm text-forest/60">
                    Scan a notebook page to build your cloud library.
                  </p>
                </div>
              ) : null}

              <ul className="mt-4 space-y-2">
                {documents.map((doc) => {
                  const checked = selected.includes(doc.id);
                  const cloud =
                    doc.storage_backend === "supabase" ? "Cloud" : "Local";
                  const model =
                    doc.notebook_model === "math"
                      ? "Green Math"
                      : doc.notebook_model === "cornell"
                        ? "Cream Cornell"
                        : null;
                  return (
                    <li key={doc.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 border px-3 py-3 text-sm transition ${
                          checked
                            ? "border-forest bg-cream-soft"
                            : "border-forest/10 bg-white hover:border-forest/25"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDoc(doc.id)}
                          className="mt-1"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-forest">
                            {doc.filename}
                          </span>
                          <span className="mt-0.5 block text-xs text-forest/55">
                            {cloud}
                            {model ? ` · ${model}` : ""} · {doc.chunk_count} chunks ·{" "}
                            {new Date(doc.created_at).toLocaleString()}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="space-y-6">
            <section className="border border-forest/10 bg-white/50 p-5 sm:p-6">
              <h2 className="font-display text-xl tracking-[0.04em]">3. Generate</h2>
              <p className="mt-2 text-sm text-forest/65">
                Select a few scans, then ask for a practice exam or flashcards.
              </p>
              <p className="mt-1 text-sm text-forest/55">
                Selected: {selected.length} note{selected.length === 1 ? "" : "s"}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOutputType("quiz")}
                  className={`px-3 py-2 text-xs tracking-[0.14em] uppercase ${
                    outputType === "quiz"
                      ? "bg-forest text-cream"
                      : "border border-forest/20 text-forest"
                  }`}
                >
                  Practice exam
                </button>
                <button
                  type="button"
                  onClick={() => setOutputType("flashcards")}
                  className={`px-3 py-2 text-xs tracking-[0.14em] uppercase ${
                    outputType === "flashcards"
                      ? "bg-forest text-cream"
                      : "border border-forest/20 text-forest"
                  }`}
                >
                  Flashcards
                </button>
              </div>

              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={Boolean(backendError) || generateBusy || selected.length === 0}
                className="btn-ink mt-5"
              >
                {generateBusy
                  ? "Generating…"
                  : outputType === "quiz"
                    ? "Generate practice exam"
                    : "Generate flashcards"}
              </button>

              {generateError ? (
                <p className="mt-3 text-sm text-red-800">{generateError}</p>
              ) : null}
            </section>

            <section className="border border-forest/10 bg-white/50 p-5 sm:p-6">
              <h2 className="font-display text-xl tracking-[0.04em]">Results</h2>

              {generateBusy ? (
                <div className="mt-6 border border-dashed border-forest/20 px-4 py-10 text-center text-sm text-forest/65">
                  Retrieving your chunks and asking the model…
                </div>
              ) : null}

              {!generateBusy && !result && !generateError ? (
                <div className="mt-6 border border-dashed border-forest/20 px-4 py-10 text-center">
                  <p className="font-medium text-forest">Nothing generated yet</p>
                  <p className="mt-1 text-sm text-forest/60">
                    Pick scans and choose practice exam or flashcards. Without an
                    LLM key you still get mock output.
                  </p>
                </div>
              ) : null}

              {result && !generateBusy ? (
                <div className="mt-4 space-y-4">
                  <p className="text-xs uppercase tracking-wide text-forest/50">
                    {result.output_type} · {result.provider} ·{" "}
                    {result.retrieval.chunk_count} chunks ·{" "}
                    {result.document_ids.length} notes · {result.store}
                  </p>

                  {result.output_type === "quiz" ? (
                    <ol className="space-y-4">
                      {result.questions.map((question, index) => {
                        const selectedAnswer = answers[question.id];
                        const revealed = selectedAnswer !== undefined;
                        return (
                          <li
                            key={question.id}
                            className="border border-forest/10 bg-cream/40 p-4"
                          >
                            <p className="text-sm font-medium text-forest">
                              {index + 1}. {question.question}
                            </p>
                            <ul className="mt-3 space-y-2">
                              {question.choices.map((choice, choiceIndex) => {
                                const isSelected = selectedAnswer === choiceIndex;
                                const isCorrect =
                                  question.correct_index === choiceIndex;
                                let tone =
                                  "border-forest/15 bg-white hover:border-forest/35";
                                if (revealed && isCorrect) {
                                  tone = "border-emerald-700 bg-emerald-50";
                                } else if (revealed && isSelected) {
                                  tone = "border-red-400 bg-red-50";
                                }
                                return (
                                  <li key={choiceIndex}>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setAnswers((current) => ({
                                          ...current,
                                          [question.id]: choiceIndex,
                                        }))
                                      }
                                      className={`w-full border px-3 py-2 text-left text-sm ${tone}`}
                                    >
                                      {choice}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                            {revealed ? (
                              <p className="mt-3 text-sm text-forest/70">
                                {question.explanation}
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <ul className="space-y-3">
                      {result.flashcards.map((card) => {
                        const isFlipped = flipped[card.id];
                        return (
                          <li key={card.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setFlipped((current) => ({
                                  ...current,
                                  [card.id]: !current[card.id],
                                }))
                              }
                              className="w-full border border-forest/15 bg-cream/50 px-4 py-5 text-left transition hover:border-forest/35"
                            >
                              <p className="text-xs tracking-[0.14em] uppercase text-forest/45">
                                {isFlipped ? "Back" : "Front"} · tap to flip
                              </p>
                              <p className="mt-2 text-sm leading-6 text-forest">
                                {isFlipped ? card.back : card.front}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
