"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { StudyChat } from "@/components/study/StudyChat";
import {
  fetchDocumentFile,
  fetchMembership,
  listDocuments,
  uploadDocument,
  type UploadedDocument,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { convexConfigured } from "@/lib/convex";
import { shopifyMembershipUrl } from "@/lib/env";
import { friendlyError } from "@/lib/errors";
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

type NotebookModel = "math" | "cornell";

const LOOP = [
  {
    cue: "Add",
    notes:
      "Photograph a page from your Cornell or Math notebook, or upload lecture slides, a PDF or Word notes.",
  },
  {
    cue: "Ask",
    notes:
      "Pick one file. Make flashcards, take a short quiz, get a summary or ask your own question.",
  },
  {
    cue: "Learn",
    notes:
      "Flip cards and mark what you know. Check quiz answers with an explanation from your own notes.",
  },
] as const;

export default function StudyPage() {
  const { user, ready } = useAuth();
  const signedIn = Boolean(user?.email);

  return (
    <main className="bg-cream text-forest">
      <section className="bg-forest text-cream">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-8 lg:px-10 lg:pb-14 lg:pt-16">
          <p className="rise text-[0.95rem] text-brass-light">Study with Arzive</p>
          <h1 className="rise mt-3 max-w-2xl font-display text-[2.5rem] leading-[1.05] sm:text-[3.2rem]">
            Turn your notes into practice
          </h1>
          <p className="rise-2 mt-4 max-w-xl text-[1.05rem] leading-7 text-cream/72">
            Add a notebook page or a lecture file, then quiz yourself on exactly
            what&apos;s in it.
          </p>
        </div>
      </section>

      {!ready ? (
        <p className="mx-auto max-w-6xl px-5 py-16 text-forest/60 sm:px-8 lg:px-10">
          Loading Study…
        </p>
      ) : signedIn ? (
        <Workspace />
      ) : (
        <SignedOut />
      )}
    </main>
  );
}

function SignedOut() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
      <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr] lg:gap-16">
        <div className="cornell">
          {LOOP.map((step) => (
            <div key={step.cue} className="cornell-row">
              <p className="cornell-cue">{step.cue}</p>
              <p className="cornell-notes text-[1.02rem] leading-7 text-forest/75">{step.notes}</p>
            </div>
          ))}
        </div>
        <div className="study-panel self-start">
          <h2 className="font-display text-[1.9rem] leading-tight">Your library lives in your account</h2>
          <p className="mt-3 text-[0.98rem] leading-7 text-forest/70">
            Create a free account to save your notes and study from them on any
            device. Free includes one upload a day.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/account?mode=signup" className="btn-ink">
              Create free account
            </Link>
            <Link href="/account" className="btn-line">
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-sm text-forest/55">
            Need more uploads?{" "}
            <Link href="/pricing" className="text-link">
              See plans
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function Workspace() {
  const { user, authHeaders } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const lectureRef = useRef<HTMLInputElement>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<SourceKind>("scan");
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
  const [plan, setPlanState] = useState<PlanId>(() => getPlan());
  const [uploadsUsed, setUploadsUsed] = useState(0);

  const uploadGate = canUploadToday({ plan, uploadsUsed });
  const selectedDoc = documents.find((doc) => doc.id === selectedId) ?? null;
  const previewDoc = documents.find((doc) => doc.id === previewId) ?? null;

  const syncUsage = useCallback(async () => {
    try {
      const next = await fetchMembership(authHeaders);
      applyServerUsage({ plan: next.plan, uploads_used: next.uploads_used });
      setPlanState(next.plan);
      setUploadsUsed(next.uploads_used);
    } catch {
      /* keep the cached plan if the backend is unreachable */
    }
  }, [authHeaders]);

  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const docs = await Promise.race([
        listDocuments(authHeaders),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error("Study is taking too long to respond. Check your connection and try again.")),
            15000,
          ),
        ),
      ]);
      setDocuments(docs.documents);
      setSelectedId((current) => current ?? docs.documents[0]?.id ?? null);
      setBackendError(null);
    } catch (err) {
      setBackendError(friendlyError(err, "Study is unreachable right now. Try again in a moment."));
    } finally {
      setListLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
      void syncUsage();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh, syncUsage]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onUpload(fileList: FileList | File[] | null, sourceKind: SourceKind) {
    const files = fileList ? Array.from(fileList) : [];
    if (!files.length) return;
    setUploadError(null);
    setUploadNotice(null);
    const blocked = files.find((file) => !isAllowedLibraryFile(file));
    if (blocked) {
      setUploadError(
        `${blocked.name} isn't a supported file. Use a PDF, photo, Word (.docx), PowerPoint (.pptx) or text file.`,
      );
      return;
    }
    const tooBig = files.find((file) => file.size > 10 * 1024 * 1024);
    if (tooBig) {
      setUploadError(`${tooBig.name} is larger than 10 MB. Try exporting a smaller PDF.`);
      return;
    }
    const gate = canUploadToday({ plan, uploadsUsed, extra: files.length });
    if (!gate.ok) {
      setUploadError(
        gate.remaining > 0
          ? `You can add ${gate.remaining} more file today on the Free plan. Choose one file, or upgrade for unlimited uploads.`
          : "You've used today's free upload. Upgrade for unlimited uploads, or keep studying files already in your library.",
      );
      return;
    }
    setUploadBusy(true);
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
      setUploadNotice(
        uploaded.length === 1
          ? `Added ${uploaded[0].filename} to your library.`
          : `Added ${uploaded.length} files to your library.`,
      );
    } catch (err) {
      setUploadError(friendlyError(err, "The upload didn't go through. Try again."));
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
      setPreviewError(friendlyError(err, "Could not open this file."));
    } finally {
      setPreviewBusy(false);
    }
  }

  function closePreview() {
    setPreviewId(null);
    setPreviewError(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  const captureDisabled =
    Boolean(backendError) || uploadBusy || !uploadGate.ok || !convexConfigured;
  const unlimited = plan !== "free";
  const usedPct = Math.min(100, (uploadsUsed / FREE_DAILY_UPLOAD_CAP) * 100);
  const uploadLabel = uploadBusy ? "Uploading…" : null;

  return (
    <>
      <div className="border-b border-forest/10 bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4 text-[0.95rem] sm:px-8 lg:px-10">
          <p className="text-forest/70">
            Signed in as <span className="font-medium text-forest">{user?.email}</span>
          </p>
          <div className="flex items-center gap-4">
            <span className="text-forest/70">
              {planDisplayName[plan]} plan
              {unlimited ? ", unlimited uploads" : ""}
            </span>
            {!unlimited ? (
              <span className="flex items-center gap-2.5">
                <span className="meter w-20" aria-hidden>
                  <span style={{ width: `${usedPct}%` }} />
                </span>
                <span className="tabular-nums text-forest/70">
                  {uploadsUsed} of {FREE_DAILY_UPLOAD_CAP} upload today
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-10 lg:py-14">
        {!convexConfigured ? (
          <p className="mb-8 border-l-2 border-amber-700 bg-amber-50 px-4 py-3 text-[0.95rem] text-amber-950">
            Study isn&apos;t connected to its backend. Set <code>NEXT_PUBLIC_CONVEX_URL</code> and
            redeploy.
          </p>
        ) : null}

        {backendError ? (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-800 bg-red-50 px-4 py-3 text-[0.95rem] text-red-900">
            <span>{backendError}</span>
            <button type="button" className="text-link font-medium" onClick={() => void refresh()}>
              Try again
            </button>
          </div>
        ) : null}

        {!unlimited && !uploadGate.ok ? (
          <div className="mb-8 flex flex-col gap-4 border border-forest/15 bg-paper px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="font-display text-[1.45rem] leading-tight">You&apos;ve used today&apos;s free upload</p>
              <p className="mt-1 text-[0.95rem] text-forest/70">
                You can keep studying everything already in your library. A new upload
                unlocks at midnight UTC.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a href={shopifyMembershipUrl("standard")} className="btn-ink">
                Get unlimited uploads
              </a>
              <Link href="/pricing" className="btn-line">
                Compare plans
              </Link>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-8">
          <div className="space-y-6">
            {/* Add notes */}
            <section className="study-panel" aria-labelledby="add-heading">
              <h2 id="add-heading" className="font-display text-[1.75rem] leading-tight">
                Add notes
              </h2>
              <div className="segmented mt-4" role="group" aria-label="What are you adding?">
                <button type="button" aria-pressed={addKind === "scan"} onClick={() => setAddKind("scan")}>
                  Notebook page
                </button>
                <button
                  type="button"
                  aria-pressed={addKind === "lecture"}
                  onClick={() => setAddKind("lecture")}
                >
                  Lecture file
                </button>
              </div>

              {addKind === "scan" ? (
                <div className="mt-5">
                  <p className="text-[0.95rem] text-forest/70">Which notebook is it from?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(["cornell", "math"] as const).map((id) => (
                      <label
                        key={id}
                        className={`flex cursor-pointer items-center gap-2 border px-3 py-2 text-[0.95rem] ${
                          notebookModel === id ? "border-forest bg-white" : "border-forest/20"
                        }`}
                      >
                        <input
                          type="radio"
                          name="notebook-model"
                          className="accent-[var(--forest)]"
                          checked={notebookModel === id}
                          onChange={() => setNotebookModel(id)}
                        />
                        {id === "cornell" ? "Cornell" : "Math"}
                      </label>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={captureDisabled}
                      onClick={() => cameraRef.current?.click()}
                      className="btn-ink"
                    >
                      {uploadLabel ?? "Take a photo"}
                    </button>
                    <button
                      type="button"
                      disabled={captureDisabled}
                      onClick={() => fileRef.current?.click()}
                      className="btn-line"
                    >
                      Choose a photo
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-forest/55">
                    Photos are saved to your library. Reading handwriting isn&apos;t
                    available yet, so to quiz yourself, also add the typed notes or
                    slides as a lecture file.
                  </p>
                </div>
              ) : (
                <div
                  className={`mt-5 border border-dashed px-4 py-6 text-center transition ${
                    dropActive ? "border-forest bg-white" : "border-forest/25"
                  }`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDropActive(true);
                  }}
                  onDragLeave={() => setDropActive(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDropActive(false);
                    if (!captureDisabled) void onUpload(event.dataTransfer.files, "lecture");
                  }}
                >
                  <p className="text-[0.98rem] text-forest/75">
                    {dropActive ? "Drop to add it" : "Drag a file here, or"}
                  </p>
                  <button
                    type="button"
                    disabled={captureDisabled}
                    onClick={() => lectureRef.current?.click()}
                    className="btn-ink mt-3"
                  >
                    {uploadLabel ?? "Choose a file"}
                  </button>
                  <p className="mt-3 text-sm text-forest/55">
                    PDF, Word, PowerPoint, text or image. Up to 10 MB.
                  </p>
                </div>
              )}

              <input
                ref={cameraRef}
                type="file"
                accept={CAMERA_ACCEPT}
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void onUpload(event.target.files, "scan");
                  event.target.value = "";
                }}
              />
              <input
                ref={fileRef}
                type="file"
                multiple={unlimited}
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void onUpload(event.target.files, "scan");
                  event.target.value = "";
                }}
              />
              <input
                ref={lectureRef}
                type="file"
                multiple={unlimited}
                accept={LIBRARY_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                onChange={(event) => {
                  void onUpload(event.target.files, "lecture");
                  event.target.value = "";
                }}
              />
              {uploadError ? (
                <p role="alert" className="mt-4 text-[0.95rem] text-red-800">
                  {uploadError}
                </p>
              ) : null}
              {uploadNotice ? (
                <p role="status" className="mt-4 text-[0.95rem] text-forest/80">
                  {uploadNotice}
                </p>
              ) : null}
            </section>

            {/* Library */}
            <section className="study-panel" aria-labelledby="library-heading">
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="library-heading" className="font-display text-[1.75rem] leading-tight">
                  Your library
                </h2>
                {documents.length ? (
                  <span className="text-sm text-forest/55">
                    {documents.length} {documents.length === 1 ? "file" : "files"}
                  </span>
                ) : null}
              </div>

              {listLoading && !documents.length ? (
                <p className="mt-6 text-[0.95rem] text-forest/55">Loading your files…</p>
              ) : null}

              {!listLoading && !backendError && documents.length === 0 ? (
                <div className="ruled mt-5 border border-forest/10 px-5 py-10 text-center">
                  <p className="font-display text-[1.4rem]">Nothing here yet</p>
                  <p className="mx-auto mt-2 max-w-xs text-[0.95rem] leading-6 text-forest/60">
                    Add a lecture file above and it will show up here, ready to study.
                  </p>
                </div>
              ) : null}

              {documents.length ? (
                <ul className="mt-4 divide-y divide-forest/10 border-y border-forest/10" aria-label="Files">
                  {documents.map((doc) => {
                    const checked = selectedId === doc.id;
                    const size = formatBytes(doc.byte_size);
                    const label = sourceLabel(doc.source_kind, doc.notebook_model);
                    const readyText = doc.extraction_status === "ready" && doc.chunk_count > 0;
                    return (
                      <li key={doc.id}>
                        <div
                          className={`flex items-start gap-3 px-3 py-3 transition ${
                            checked ? "bg-forest text-cream" : "hover:bg-white"
                          }`}
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                            <input
                              type="radio"
                              name="library-item"
                              checked={checked}
                              onChange={() => setSelectedId(doc.id)}
                              className="mt-1.5 accent-current"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{doc.filename}</span>
                              <span
                                className={`mt-0.5 block text-sm ${checked ? "text-cream/70" : "text-forest/55"}`}
                              >
                                {[label, size, readyText ? null : "No readable text"]
                                  .filter(Boolean)
                                  .join(", ")}
                              </span>
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => void openPreview(doc)}
                            className={`shrink-0 pt-0.5 text-sm underline underline-offset-4 ${
                              checked ? "text-cream/85" : "text-forest/65 hover:text-forest"
                            }`}
                          >
                            View
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}

              {previewId ? (
                <div className="mt-5 border border-forest/10 bg-white px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-medium">{previewDoc?.filename || "File"}</p>
                    <button type="button" onClick={closePreview} className="text-sm underline underline-offset-4">
                      Close
                    </button>
                  </div>
                  {previewBusy ? <p className="mt-4 text-forest/55">Opening file…</p> : null}
                  {previewError ? <p className="mt-4 text-red-800">{previewError}</p> : null}
                  {!previewBusy && previewUrl && previewDoc?.mime_type?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={previewDoc.filename}
                      className="mt-4 max-h-80 w-full object-contain"
                    />
                  ) : null}
                  {!previewBusy && previewUrl && previewDoc?.mime_type === "application/pdf" ? (
                    <iframe title={previewDoc.filename} src={previewUrl} className="mt-4 h-80 w-full" />
                  ) : null}
                  {!previewBusy && previewUrl ? (
                    <a
                      href={previewUrl}
                      download={previewDoc?.filename}
                      className="mt-4 inline-block text-sm underline underline-offset-4"
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
            signedIn
            backendError={backendError}
          />
        </div>
      </section>
    </>
  );
}
