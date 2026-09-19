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
import {
  canScan,
  canStartStudySession,
  FREE_SCAN_CAP,
  FREE_SESSION_CAP,
  getPlan,
  getScanCount,
  getWeeklySessionsUsed,
  recordScan,
  recordStudySession,
  type PlanId,
} from "@/lib/plan";

type NotebookModel = "math" | "cornell";

const HOW_STEPS = [
  {
    n: "01",
    title: "Capture",
    copy: "Photograph a Cream Cornell or Green Math page into your private library.",
  },
  {
    n: "02",
    title: "Practice",
    copy: "Generate a practice exam or flashcards from the notes you actually wrote.",
  },
  {
    n: "03",
    title: "Learn",
    copy: "Force active recall — then return to the page with sharper questions.",
  },
] as const;

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
  const [plan, setPlanState] = useState<PlanId>("free");
  const [sessionsUsed, setSessionsUsed] = useState(0);
  const [scansUsed, setScansUsed] = useState(0);

  const signedIn = Boolean(user?.email);
  const sessionGate = canStartStudySession(plan);
  const scanGate = canScan(plan);
  const chatPct = Math.min(100, (sessionsUsed / FREE_SESSION_CAP) * 100);
  const scanPct = Math.min(100, (scansUsed / FREE_SCAN_CAP) * 100);

  useEffect(() => {
    setPlanState(getPlan());
    setSessionsUsed(getWeeklySessionsUsed());
    setScansUsed(getScanCount());
  }, []);

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
      setUploadError("Sign in on Account first — scans are saved under your account.");
      return;
    }
    const gate = canScan(plan, fileList.length);
    if (!gate.ok) {
      setUploadError(
        `Free plan allows ${FREE_SCAN_CAP} scans. You’ve used ${gate.used}. Upgrade to Standard ($12/mo) for unlimited.`,
      );
      return;
    }
    setUploadBusy(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const uploaded: UploadedDocument[] = [];
      for (const file of Array.from(fileList)) {
        uploaded.push(await uploadDocument(file, authHeaders, notebookModel));
      }
      setDocuments((current) => [...uploaded, ...current]);
      setSelected((current) => [...uploaded.map((doc) => doc.id), ...current]);
      setScansUsed(recordScan(uploaded.length));
      const backend = uploaded[0]?.storage_backend;
      setUploadNotice(
        backend === "supabase"
          ? `${uploaded.length} scan(s) saved to your cloud library.`
          : `${uploaded.length} scan(s) saved locally under your account.`,
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
    const gate = canStartStudySession(plan);
    if (!gate.ok) {
      setGenerateError(
        `Free plan: ${FREE_SESSION_CAP} chats per week. You’ve used ${gate.used}. Upgrade to Standard — $12/month — for unlimited practice.`,
      );
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
      setSessionsUsed(recordStudySession());
      setResult(study);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenerateBusy(false);
    }
  }

  return (
    <main className="bg-cream">
      <section className="bg-forest text-cream">
        <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-16 lg:px-10">
          <p className="animate-soft-in font-display text-[0.95rem] tracking-[0.28em] text-cream/85">
            Study with Arzive
          </p>
          <h1 className="animate-fade-up mt-4 max-w-2xl font-display text-[2.35rem] leading-[1.12] tracking-[0.01em] sm:text-[3rem]">
            Read once. Recall hard. Remember longer.
          </h1>
          <p className="animate-fade-up-delay mt-5 max-w-xl text-[0.98rem] font-light leading-7 text-cream/72 sm:text-lg">
            Capture Cream Cornell or Green Math pages, then force active recall with
            practice exams and flashcards — the fast study loop, ARZIVE-designed.
          </p>

          <div className="mt-10 grid gap-8 border-t border-cream/15 pt-8 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.62rem] uppercase tracking-[0.16em] text-cream/55">
              {signedIn ? (
                <span>Signed in · {user?.email}</span>
              ) : (
                <Link href="/account" className="underline underline-offset-4 text-cream/80">
                  Log in to save scans
                </Link>
              )}
              {health ? (
                <span>
                  {cloudEnabled ? "Cloud library" : "Private library"}
                  {health.integrations.llm &&
                  health.integrations.llm !== "mock"
                    ? ` · ${health.integrations.llm}`
                    : " · ready"}
                </span>
              ) : null}
            </div>

            {plan === "free" ? (
              <div className="plan-meter w-full max-w-xs sm:justify-self-end">
                <p className="mb-1 text-[0.58rem] uppercase tracking-[0.2em] text-cream/45">
                  Free · this week
                </p>
                <div className="plan-meter-row">
                  <span className="text-[0.62rem] uppercase tracking-[0.14em] text-cream/65">
                    Chats
                  </span>
                  <div className="plan-meter-track" aria-hidden>
                    <div className="plan-meter-fill" style={{ width: `${chatPct}%` }} />
                  </div>
                  <span className="text-[0.62rem] tabular-nums tracking-[0.08em] text-cream/70">
                    {sessionsUsed}/{FREE_SESSION_CAP}
                  </span>
                </div>
                <div className="plan-meter-row">
                  <span className="text-[0.62rem] uppercase tracking-[0.14em] text-cream/65">
                    Scans
                  </span>
                  <div className="plan-meter-track" aria-hidden>
                    <div className="plan-meter-fill" style={{ width: `${scanPct}%` }} />
                  </div>
                  <span className="text-[0.62rem] tabular-nums tracking-[0.08em] text-cream/70">
                    {scansUsed}/{FREE_SCAN_CAP}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-cream/55">
                Plan · {plan} · unlimited
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-forest/10 bg-cream">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-3 md:gap-10 md:py-12 lg:px-10">
          {HOW_STEPS.map((step) => (
            <div key={step.n} className="how-step animate-soft-in">
              <p className="text-[0.58rem] uppercase tracking-[0.22em] text-forest/40">
                {step.n}
              </p>
              <h2 className="mt-2 font-display text-2xl tracking-[0.02em] text-forest">
                {step.title}
              </h2>
              <p className="mt-2 max-w-xs text-sm font-light leading-6 text-forest/65">
                {step.copy}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        {!signedIn ? (
          <div className="mb-10 study-panel animate-soft-in">
            <p className="study-label">Account required</p>
            <p className="mt-3 max-w-xl font-light leading-7 text-forest/75">
              Scans belong to your ARZIVE account — the same place you manage Study.
            </p>
            <Link href="/account" className="btn-ink mt-5 inline-flex">
              Log in / create account
            </Link>
          </div>
        ) : null}

        {signedIn && plan === "free" && !sessionGate.ok ? (
          <div className="mb-10 animate-soft-in border border-forest/15 bg-[#f0ebe3] px-5 py-7 sm:px-8">
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-forest/50">
              Free plan · weekly gate
            </p>
            <h2 className="mt-3 font-display text-2xl tracking-[0.02em] text-forest sm:text-3xl">
              You&apos;ve used your {FREE_SESSION_CAP} chats this week.
            </h2>
            <p className="mt-3 max-w-xl text-sm font-light leading-7 text-forest/70">
              Free is honest about its limits. Standard unlocks unlimited practice
              exams and flashcards for $12/month — or save with Annual.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/account?plan=standard" className="btn-ink">
                Upgrade to Standard · $12
              </Link>
              <Link
                href="/pricing"
                className="border border-forest/25 px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.14em] text-forest"
              >
                Compare plans
              </Link>
            </div>
          </div>
        ) : null}

        {signedIn && plan === "free" && sessionGate.ok && !scanGate.ok ? (
          <div className="mb-10 animate-soft-in border border-forest/15 bg-[#f0ebe3] px-5 py-7 sm:px-8">
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-forest/50">
              Free plan · scan limit
            </p>
            <h2 className="mt-3 font-display text-2xl tracking-[0.02em] text-forest sm:text-3xl">
              {FREE_SCAN_CAP} scans used — library is full on Free.
            </h2>
            <p className="mt-3 max-w-xl text-sm font-light leading-7 text-forest/70">
              You can still practice from notes already in your library (
              {sessionGate.remaining} chat
              {sessionGate.remaining === 1 ? "" : "s"} left this week). Upgrade for
              unlimited captures.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/account?plan=standard" className="btn-ink">
                Unlock unlimited scans
              </Link>
              <Link
                href="/pricing"
                className="border border-forest/25 px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.14em] text-forest"
              >
                See Pricing
              </Link>
            </div>
          </div>
        ) : null}

        {backendError ? (
          <div className="mb-8 border border-red-800/20 bg-red-50 px-4 py-3 text-sm text-red-900">
            {backendError}
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="space-y-8">
            <section className="study-panel">
              <p className="study-label">01 · Capture</p>
              <h2 className="mt-3 font-display text-2xl tracking-[0.03em] text-forest">
                Photograph a page
              </h2>
              <p className="mt-2 text-sm font-light leading-6 text-forest/70">
                Tag the notebook model, then open the camera or upload a photo / PDF.
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
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
                    className={`px-3 py-2 text-[0.62rem] tracking-[0.14em] uppercase transition ${
                      notebookModel === option.id
                        ? "bg-forest text-cream"
                        : "border border-forest/20 text-forest hover:border-forest/40"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={
                    !signedIn ||
                    Boolean(backendError) ||
                    uploadBusy ||
                    !scanGate.ok
                  }
                  onClick={() => cameraRef.current?.click()}
                  className="bg-cream px-4 py-10 text-center text-[0.65rem] tracking-[0.16em] uppercase text-forest transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {uploadBusy
                    ? "Uploading…"
                    : !scanGate.ok
                      ? "Scan limit reached"
                      : "Open camera"}
                </button>
                <button
                  type="button"
                  disabled={
                    !signedIn ||
                    Boolean(backendError) ||
                    uploadBusy ||
                    !scanGate.ok
                  }
                  onClick={() => fileRef.current?.click()}
                  className="bg-cream px-4 py-10 text-center text-[0.65rem] tracking-[0.16em] uppercase text-forest transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {uploadBusy
                    ? "Uploading…"
                    : !scanGate.ok
                      ? "Scan limit reached"
                      : "Upload files"}
                </button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={
                  !signedIn || Boolean(backendError) || uploadBusy || !scanGate.ok
                }
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
                disabled={
                  !signedIn || Boolean(backendError) || uploadBusy || !scanGate.ok
                }
                onChange={(event) => {
                  void onUpload(event.target.files);
                  event.target.value = "";
                }}
              />
              <p className="mt-4 text-xs font-light text-forest/55">
                .jpg .png .pdf .txt · max 10 MB · tagged as{" "}
                {notebookModel === "cornell" ? "Cream Cornell" : "Green Math"}
              </p>
              {uploadError ? <p className="mt-3 text-sm text-red-800">{uploadError}</p> : null}
              {uploadNotice ? <p className="mt-3 text-sm text-forest/75">{uploadNotice}</p> : null}
            </section>

            <section className="study-panel">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="study-label">02 · Library</p>
                  <h2 className="mt-3 font-display text-2xl tracking-[0.03em] text-forest">
                    Your scans
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="text-[0.62rem] tracking-[0.14em] uppercase text-forest/55 hover:text-forest"
                >
                  Refresh
                </button>
              </div>

              {listLoading ? (
                <p className="mt-10 text-center text-sm font-light tracking-wide text-forest/50">
                  Opening library…
                </p>
              ) : null}

              {!listLoading && documents.length === 0 ? (
                <div className="mt-8 border border-dashed border-forest/15 px-5 py-12 text-center">
                  <p className="font-display text-[1.35rem] tracking-[0.02em] text-forest">
                    Empty shelf
                  </p>
                  <p className="mx-auto mt-2 max-w-[16rem] text-sm font-light leading-6 text-forest/55">
                    Capture one Cornell or Math page — practice starts from what you wrote.
                  </p>
                </div>
              ) : null}

              <ul className="mt-5 space-y-2">
                {documents.map((doc) => {
                  const checked = selected.includes(doc.id);
                  const model =
                    doc.notebook_model === "math"
                      ? "Green Math"
                      : doc.notebook_model === "cornell"
                        ? "Cream Cornell"
                        : null;
                  return (
                    <li key={doc.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 px-3 py-3 text-sm transition ${
                          checked ? "bg-forest text-cream" : "bg-cream hover:bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleDoc(doc.id)}
                          className="mt-1 accent-current"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{doc.filename}</span>
                          <span
                            className={`mt-0.5 block text-xs ${checked ? "text-cream/65" : "text-forest/55"}`}
                          >
                            {doc.storage_backend === "supabase" ? "Cloud" : "Local"}
                            {model ? ` · ${model}` : ""} · {doc.chunk_count} chunks
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="space-y-8">
            <section className="study-panel">
              <p className="study-label">03 · Practice</p>
              <h2 className="mt-3 font-display text-2xl tracking-[0.03em] text-forest">
                Generate from your notes
              </h2>
              <p className="mt-2 text-sm font-light leading-6 text-forest/70">
                Select scans, then ask for a practice exam or flashcards.
              </p>
              <p className="mt-3 text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">
                Selected · {selected.length}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOutputType("quiz")}
                  className={`px-3 py-2 text-[0.62rem] tracking-[0.14em] uppercase ${
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
                  className={`px-3 py-2 text-[0.62rem] tracking-[0.14em] uppercase ${
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
                disabled={
                  Boolean(backendError) ||
                  generateBusy ||
                  selected.length === 0 ||
                  !sessionGate.ok
                }
                className="btn-ink mt-6"
              >
                {generateBusy
                  ? "Generating…"
                  : !sessionGate.ok
                    ? "Weekly limit reached"
                    : outputType === "quiz"
                      ? "Generate practice exam"
                      : "Generate flashcards"}
              </button>
              {plan === "free" && sessionGate.ok ? (
                <p className="mt-3 text-xs font-light text-forest/55">
                  {sessionGate.remaining} of {FREE_SESSION_CAP} Free chats left this week.
                </p>
              ) : null}
              {generateError ? <p className="mt-3 text-sm text-red-800">{generateError}</p> : null}
            </section>

            <section className="study-panel min-h-[20rem]">
              <p className="study-label">04 · Learn</p>
              <h2 className="mt-3 font-display text-2xl tracking-[0.03em] text-forest">
                Your chat
              </h2>

              {generateBusy ? (
                <div className="mt-8 border border-dashed border-forest/12 px-4 py-14 text-center text-sm font-light text-forest/55">
                  Retrieving your notes…
                </div>
              ) : null}

              {!generateBusy && !result && !generateError ? (
                <div className="mt-8 border border-dashed border-forest/15 px-5 py-14 text-center">
                  <p className="font-display text-[1.35rem] tracking-[0.02em] text-forest">
                    Waiting on a chat
                  </p>
                  <p className="mx-auto mt-2 max-w-[17rem] text-sm font-light leading-6 text-forest/55">
                    Pick scans, then generate a practice exam or a deck of flashcards.
                  </p>
                </div>
              ) : null}

              {result && !generateBusy ? (
                <div className="mt-6 space-y-4">
                  <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">
                    {result.output_type} · {result.provider} · {result.document_ids.length} notes
                  </p>

                  {result.output_type === "quiz" ? (
                    <ol className="space-y-4">
                      {result.questions.map((question, index) => {
                        const selectedAnswer = answers[question.id];
                        const revealed = selectedAnswer !== undefined;
                        return (
                          <li key={question.id} className="bg-cream p-4">
                            <p className="text-sm font-medium text-forest">
                              {index + 1}. {question.question}
                            </p>
                            <ul className="mt-3 space-y-2">
                              {question.choices.map((choice, choiceIndex) => {
                                const isSelected = selectedAnswer === choiceIndex;
                                const isCorrect = question.correct_index === choiceIndex;
                                let tone = "bg-white hover:bg-cream-soft";
                                if (revealed && isCorrect) tone = "bg-forest text-cream";
                                else if (revealed && isSelected) tone = "bg-red-50 text-red-900";
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
                                      className={`w-full px-3 py-2.5 text-left text-sm ${tone}`}
                                    >
                                      {choice}
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                            {revealed ? (
                              <p className="mt-3 text-sm font-light text-forest/70">
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
                              className="w-full bg-cream px-4 py-5 text-left transition hover:bg-white"
                            >
                              <p className="text-[0.62rem] tracking-[0.14em] uppercase text-forest/45">
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
