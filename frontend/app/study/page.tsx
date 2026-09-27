"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { StudyChat } from "@/components/study/StudyChat";
import {
  fetchDocumentFile,
  fetchHealth,
  fetchMembership,
  listDocuments,
  uploadDocument,
  type HealthResponse,
  type UploadedDocument,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { shopifyMembershipUrl } from "@/lib/env";
import {
  CAMERA_ACCEPT,
  LIBRARY_ACCEPT,
  formatBytes,
  isAllowedLibraryFile,
  sourceLabel,
  type SourceKind,
} from "@/lib/library";
import {
  applyServerUsage,
  canUploadToday,
  FREE_DAILY_UPLOAD_CAP,
  getPlan,
  planDisplayName,
  type PlanId,
} from "@/lib/plan";
import { convexConfigured } from "@/lib/convex";

type NotebookModel = "math" | "cornell";

const HOW_STEPS = [
  {
    n: "01",
    title: "Add",
    copy: "Photograph a Cornell or Math page, or upload a lecture PDF, slide deck, or photo.",
  },
  {
    n: "02",
    title: "Ask",
    copy: "Pick one file. Tap a chip or type a question — flashcards, a short quiz, an explanation, or a summary.",
  },
  {
    n: "03",
    title: "Learn",
    copy: "Flip cards, mark Know or Still learning, and check quiz answers against your own notes.",
  },
] as const;

export default function StudyPage() {
  const { user, ready, authHeaders } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const lectureRef = useRef<HTMLInputElement>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notebookModel, setNotebookModel] = useState<NotebookModel>("cornell");
  const [listLoading, setListLoading] = useState(true);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [plan, setPlanState] = useState<PlanId>("free");
  const [uploadsUsed, setUploadsUsed] = useState(0);

  const signedIn = Boolean(user?.email);
  const uploadGate = canUploadToday({ plan, uploadsUsed });
  const uploadPct = Math.min(100, (uploadsUsed / FREE_DAILY_UPLOAD_CAP) * 100);
  const selectedDoc = documents.find((doc) => doc.id === selectedId) ?? null;

  useEffect(() => {
    setPlanState(getPlan());
  }, []);

  const syncUsage = useCallback(async () => {
    if (!signedIn) return;
    try {
      const next = await fetchMembership(authHeaders);
      applyServerUsage({ plan: next.plan, uploads_used: next.uploads_used });
      setPlanState(next.plan);
      setUploadsUsed(next.uploads_used);
    } catch {
      /* keep cached plan if the API is down */
    }
  }, [signedIn, authHeaders]);

  useEffect(() => {
    if (!ready || !signedIn) return;
    void syncUsage();
  }, [ready, signedIn, syncUsage]);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const [healthResult, docs] = await Promise.all([
        fetchHealth(),
        listDocuments(authHeaders),
      ]);
      setHealth(healthResult);
      setDocuments(docs.documents);
      setCloudEnabled(Boolean(docs.cloud_enabled || healthResult.integrations.convex));
      setBackendError(null);
    } catch (err) {
      setBackendError(
        err instanceof Error
          ? err.message
          : "Could not reach Convex. Run `npx convex dev` and set NEXT_PUBLIC_CONVEX_URL.",
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onUpload(fileList: FileList | File[] | null, sourceKind: SourceKind) {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    if (!signedIn) {
      setUploadError("Sign in on Account first — files are saved under your account.");
      return;
    }
    const blocked = files.find((file) => !isAllowedLibraryFile(file));
    if (blocked) {
      setUploadError(
        `${blocked.name} is not supported. Use PDF, image, Word (.docx), PowerPoint (.pptx), or text.`,
      );
      return;
    }
    const gate = canUploadToday({ plan, uploadsUsed, extra: files.length });
    if (!gate.ok) {
      setUploadError(
        `Free plan includes ${FREE_DAILY_UPLOAD_CAP} upload per day (UTC). You’ve used today’s upload. Upgrade to Plus ($12/mo) or Pro ($19/mo) on Shopify for unlimited uploads within fair use.`,
      );
      return;
    }
    setUploadBusy(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const uploaded: UploadedDocument[] = [];
      for (const file of files) {
        uploaded.push(
          await uploadDocument(file, authHeaders, {
            sourceKind,
            notebookModel: sourceKind === "scan" ? notebookModel : null,
          }),
        );
      }
      setDocuments((current) => [...uploaded, ...current]);
      setSelectedId(uploaded[0]?.id ?? null);
      await syncUsage();
      const noun = sourceKind === "lecture" ? "lecture file" : "scan";
      setUploadNotice(
        `${uploaded.length} ${noun}${uploaded.length === 1 ? "" : "s"} saved to your Convex library.`,
      );
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploadBusy(false);
    }
  }

  async function openPreview(doc: UploadedDocument) {
    setPreviewError(null);
    setPreviewBusy(true);
    setPreviewId(doc.id);
    try {
      const { blob } = await fetchDocumentFile(doc.id, authHeaders);
      const url = URL.createObjectURL(blob);
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
    } catch (err) {
      setPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setPreviewError(err instanceof Error ? err.message : "Could not open this file.");
    } finally {
      setPreviewBusy(false);
    }
  }

  const captureDisabled =
    !signedIn || Boolean(backendError) || uploadBusy || !uploadGate.ok || !convexConfigured;
  const previewDoc = documents.find((doc) => doc.id === previewId) ?? null;

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
            Scan Cornell or Math pages, or upload lecture files — then ask, make
            flashcards, or take a short quiz grounded on that file.
          </p>

          <div className="mt-10 grid gap-8 border-t border-cream/15 pt-8 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.62rem] uppercase tracking-[0.16em] text-cream/55">
              {signedIn ? (
                <span>Signed in · {user?.email}</span>
              ) : (
                <Link href="/account" className="underline underline-offset-4 text-cream/80">
                  Log in to save your library
                </Link>
              )}
              {health ? (
                <span>
                  {cloudEnabled ? "Convex library" : "Convex"}
                  {health.integrations.llm && health.integrations.llm !== "mock"
                    ? ` · ${health.integrations.llm}`
                    : " · mock AI ready"}
                </span>
              ) : null}
            </div>

            {plan === "free" ? (
              <div className="plan-meter w-full max-w-xs sm:justify-self-end">
                <p className="mb-1 text-[0.58rem] uppercase tracking-[0.2em] text-cream/45">
                  Free · today (UTC)
                </p>
                <div className="plan-meter-row">
                  <span className="text-[0.62rem] uppercase tracking-[0.14em] text-cream/65">
                    Uploads
                  </span>
                  <div className="plan-meter-track" aria-hidden>
                    <div className="plan-meter-fill" style={{ width: `${uploadPct}%` }} />
                  </div>
                  <span className="text-[0.62rem] tabular-nums tracking-[0.08em] text-cream/70">
                    {uploadsUsed}/{FREE_DAILY_UPLOAD_CAP}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[0.62rem] uppercase tracking-[0.16em] text-cream/55">
                Plan · {planDisplayName[plan]} · unlimited uploads
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
              Notebook scans and lecture files belong to your ARZIVE account — the
              same place you manage Study.
            </p>
            <Link href="/account" className="btn-ink mt-5 inline-flex">
              Log in / create account
            </Link>
          </div>
        ) : null}

        {signedIn && plan === "free" && !uploadGate.ok ? (
          <div className="mb-10 animate-soft-in border border-forest/15 bg-[#f0ebe3] px-5 py-7 sm:px-8">
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-forest/50">
              Free plan · daily upload cap
            </p>
            <h2 className="mt-3 font-display text-2xl tracking-[0.02em] text-forest sm:text-3xl">
              Today&apos;s free upload is used.
            </h2>
            <p className="mt-3 max-w-xl text-sm font-light leading-7 text-forest/70">
              Free includes one upload per day (UTC). You can still study from files
              already in your library. Plus and Pro unlock unlimited uploads within
              fair use.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={shopifyMembershipUrl("standard")} className="btn-ink">
                Upgrade to Plus · $12/mo
              </a>
              <Link
                href="/pricing"
                className="border border-forest/25 px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.14em] text-forest"
              >
                Compare plans
              </Link>
            </div>
          </div>
        ) : null}

        {!convexConfigured ? (
          <div className="mb-8 border border-amber-800/20 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Set <code className="text-xs">NEXT_PUBLIC_CONVEX_URL</code> and run{" "}
            <code className="text-xs">npx convex dev</code> to connect Study to your Convex
            backend.
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
                Add to your library
              </h2>
              <p className="mt-2 text-sm font-light leading-6 text-forest/70">
                Same account, same shelf. Photograph a notebook page or upload a
                lecture file.
              </p>

              <div className="mt-6 border border-forest/10 bg-cream/60 px-4 py-4">
                <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">
                  Notebook scan
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      { id: "cornell" as const, label: "Cornell" },
                      { id: "math" as const, label: "Math" },
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
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={captureDisabled}
                    onClick={() => cameraRef.current?.click()}
                    className="bg-cream px-4 py-8 text-center text-[0.65rem] tracking-[0.16em] uppercase text-forest transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {uploadBusy
                      ? "Uploading…"
                      : !uploadGate.ok
                        ? "Upload cap reached"
                        : "Open camera"}
                  </button>
                  <button
                    type="button"
                    disabled={captureDisabled}
                    onClick={() => fileRef.current?.click()}
                    className="bg-cream px-4 py-8 text-center text-[0.65rem] tracking-[0.16em] uppercase text-forest transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {uploadBusy
                      ? "Uploading…"
                      : !uploadGate.ok
                        ? "Library full"
                        : "Upload page photo"}
                  </button>
                </div>
                <p className="mt-3 text-xs font-light text-forest/55">
                  Tagged as {notebookModel === "cornell" ? "Cornell" : "Math"} · jpg png
                </p>
              </div>

              <div
                className={`mt-4 border px-4 py-4 transition ${
                  dropActive
                    ? "border-forest bg-white"
                    : "border-dashed border-forest/20 bg-cream/40"
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropActive(true);
                }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDropActive(false);
                  void onUpload(event.dataTransfer.files, "lecture");
                }}
              >
                <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">
                  Lecture file
                </p>
                <p className="mt-2 text-sm font-light leading-6 text-forest/70">
                  PDF slides, Word notes, PowerPoint, or a photo of the board. Drop
                  a file here or choose one.
                </p>
                <button
                  type="button"
                  disabled={captureDisabled}
                  onClick={() => lectureRef.current?.click()}
                  className="mt-4 w-full bg-forest px-4 py-8 text-center text-[0.65rem] tracking-[0.16em] uppercase text-cream transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {uploadBusy
                    ? "Uploading…"
                    : !uploadGate.ok
                      ? "Library full"
                      : dropActive
                        ? "Drop to add"
                        : "Upload PDF or lecture file"}
                </button>
                <p className="mt-3 text-xs font-light text-forest/55">
                  .pdf .docx .pptx .jpg .png .txt · max 10 MB · Free: 1 upload/day
                </p>
              </div>

              <input
                ref={cameraRef}
                type="file"
                accept={CAMERA_ACCEPT}
                capture="environment"
                className="sr-only"
                disabled={captureDisabled}
                onChange={(event) => {
                  void onUpload(event.target.files, "scan");
                  event.target.value = "";
                }}
              />
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,.pdf,application/pdf"
                className="sr-only"
                disabled={captureDisabled}
                onChange={(event) => {
                  void onUpload(event.target.files, "scan");
                  event.target.value = "";
                }}
              />
              <input
                ref={lectureRef}
                type="file"
                multiple
                accept={LIBRARY_ACCEPT}
                className="sr-only"
                disabled={captureDisabled}
                onChange={(event) => {
                  void onUpload(event.target.files, "lecture");
                  event.target.value = "";
                }}
              />
              {uploadError ? <p className="mt-3 text-sm text-red-800">{uploadError}</p> : null}
              {uploadNotice ? <p className="mt-3 text-sm text-forest/75">{uploadNotice}</p> : null}
            </section>

            <section className="study-panel">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="study-label">02 · Library</p>
                  <h2 className="mt-3 font-display text-2xl tracking-[0.03em] text-forest">
                    Scans &amp; lecture files
                  </h2>
                  <p className="mt-2 text-sm font-light leading-6 text-forest/70">
                    Select one file. Study AI works on that file only.
                  </p>
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
                  <p className="mx-auto mt-2 max-w-[18rem] text-sm font-light leading-6 text-forest/55">
                    Photograph one notebook page or upload a lecture PDF. Chat
                    starts from what you add.
                  </p>
                </div>
              ) : null}

              <ul className="mt-5 space-y-2">
                {documents.map((doc) => {
                  const checked = selectedId === doc.id;
                  const size = formatBytes(doc.byte_size);
                  const label = sourceLabel(doc.source_kind, doc.notebook_model);
                  const kind = doc.kind_label || "File";
                  const readyText = doc.extraction_status === "ready" && doc.chunk_count > 0;
                  return (
                    <li key={doc.id}>
                      <div
                        className={`flex items-start gap-3 px-3 py-3 text-sm transition ${
                          checked ? "bg-forest text-cream" : "bg-cream hover:bg-white"
                        }`}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                          <input
                            type="radio"
                            name="library-item"
                            checked={checked}
                            onChange={() => setSelectedId(doc.id)}
                            className="mt-1 accent-current"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{doc.filename}</span>
                            <span
                              className={`mt-0.5 block text-xs ${checked ? "text-cream/65" : "text-forest/55"}`}
                            >
                              Convex
                              {` · ${label} · ${kind}`}
                              {size ? ` · ${size}` : ""}
                              {readyText ? " · text ready" : " · no extractable text"}
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => void openPreview(doc)}
                          className={`shrink-0 pt-0.5 text-[0.58rem] uppercase tracking-[0.12em] ${
                            checked ? "text-cream/80" : "text-forest/55 hover:text-forest"
                          }`}
                        >
                          View
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {previewId ? (
                <div className="mt-5 border border-forest/10 bg-cream px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">
                        Preview
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-forest">
                        {previewDoc?.filename || "File"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewId(null);
                        setPreviewError(null);
                        setPreviewUrl((current) => {
                          if (current) URL.revokeObjectURL(current);
                          return null;
                        });
                      }}
                      className="text-[0.58rem] uppercase tracking-[0.12em] text-forest/50"
                    >
                      Close
                    </button>
                  </div>
                  {previewBusy ? (
                    <p className="mt-4 text-sm font-light text-forest/55">Opening file…</p>
                  ) : null}
                  {previewError ? (
                    <p className="mt-4 text-sm text-red-800">{previewError}</p>
                  ) : null}
                  {!previewBusy && previewUrl && previewDoc?.mime_type?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={previewDoc.filename}
                      className="mt-4 max-h-72 w-full object-contain"
                    />
                  ) : null}
                  {!previewBusy && previewUrl && previewDoc?.mime_type === "application/pdf" ? (
                    <iframe
                      title={previewDoc.filename}
                      src={previewUrl}
                      className="mt-4 h-72 w-full bg-white"
                    />
                  ) : null}
                  {!previewBusy && previewUrl ? (
                    <a
                      href={previewUrl}
                      download={previewDoc?.filename}
                      className="mt-4 inline-block text-[0.62rem] uppercase tracking-[0.14em] text-forest/70 underline underline-offset-4"
                    >
                      Download original
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>

          <StudyChat
            document={selectedDoc}
            authHeaders={authHeaders}
            signedIn={signedIn}
            plan={plan}
            backendError={backendError}
            onUsageChange={syncUsage}
          />
        </div>
      </section>
    </main>
  );
}
