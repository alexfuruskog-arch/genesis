"use client";

import { useEffect, useState } from "react";

import { DocumentUpload } from "@/components/DocumentUpload";
import { QuizBoard } from "@/components/QuizBoard";
import {
  fetchHealth,
  fetchShopifyStatus,
  generateQuiz,
  type HealthResponse,
  type QuizResponse,
  type ShopifyStatus,
  type UploadedDocument,
} from "@/lib/api";
import { publicConfig } from "@/lib/env";

export default function Home() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [shopify, setShopify] = useState<ShopifyStatus | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [document, setDocument] = useState<UploadedDocument | null>(null);
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [healthResult, shopifyResult] = await Promise.all([
          fetchHealth(),
          fetchShopifyStatus().catch(() => null),
        ]);
        if (cancelled) return;
        setHealth(healthResult);
        setShopify(shopifyResult);
        setBackendError(null);
      } catch (err) {
        if (cancelled) return;
        setBackendError(
          err instanceof Error
            ? err.message
            : "Kunde inte nå backend. Starta FastAPI på port 48721.",
        );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onGenerate() {
    if (!document) return;
    setQuizLoading(true);
    setQuizError(null);
    try {
      const result = await generateQuiz(document.id);
      setQuiz(result);
    } catch (err) {
      setQuizError(err instanceof Error ? err.message : "Kunde inte skapa quiz.");
    } finally {
      setQuizLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-ink/8 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper">
              Plugga
            </p>
            <p className="text-sm text-ink/70">Från anteckningar till quiz</p>
          </div>
          <StatusPills
            health={health}
            backendError={backendError}
            shopify={shopify}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <section className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Plugga på det du faktiskt läste.
          </h1>
          <p className="mt-3 text-base leading-7 text-ink/75 sm:text-lg">
            Ladda upp föreläsningsanteckningar. Plugga plockar ut texten, lägger
            den i sökbara chunkar och gör studiefrågor du kan svara på direkt —
            i mobilen mellan lektioner eller vid skrivbordet innan tenta.
          </p>
        </section>

        {backendError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {backendError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-ink/8 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold">1. Ladda upp</h2>
              <p className="mt-1 mb-4 text-sm text-ink/65">
                Filen sparas mot Supabase när nycklarna finns, annars lokalt i
                backend så att du kan utveckla utan hemligheter.
              </p>
              <DocumentUpload
                disabled={Boolean(backendError)}
                onUploaded={(next) => {
                  setDocument(next);
                  setQuiz(null);
                  setQuizError(null);
                }}
              />
            </section>

            <section className="rounded-3xl border border-ink/8 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-semibold">Dokument</h2>
              {document ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <Row label="Fil" value={document.filename} />
                  <Row label="Status" value={document.extraction_status} />
                  <Row label="Chunkar" value={String(document.chunk_count)} />
                  <Row
                    label="Extraktion"
                    value={
                      document.extraction_mode === "extracted"
                        ? "Text utläst"
                        : "Stub — flödet är kopplat"
                    }
                  />
                  <Row label="Lagring" value={document.store} />
                </dl>
              ) : (
                <p className="mt-3 text-sm text-ink/60">
                  Inget dokument valt. När något är uppladdat visas sökväg,
                  chunkar och hur texten extraherades.
                </p>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-ink/8 bg-white p-5 shadow-sm sm:p-6">
            <QuizBoard
              quiz={quiz}
              loading={quizLoading}
              error={quizError}
              canGenerate={Boolean(document) && !backendError}
              onGenerate={onGenerate}
            />
          </section>
        </div>
      </main>

      <footer className="border-t border-ink/8 bg-white/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-ink/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Commerce pekar mot Shopify ({shopify?.mode ?? "okänd"}
            {shopify?.shop_domain ? ` · ${shopify.shop_domain}` : ""}).
            Koppla kund via <code>/shopify/customers/link</code>.
          </p>
          <p>
            Frontend-nycklar: Supabase{" "}
            {publicConfig.supabaseConfigured ? "satta" : "saknas"}, Shopify-domän{" "}
            {publicConfig.shopifyConfigured ? "satt" : "saknas"}.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/55">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function StatusPills({
  health,
  backendError,
  shopify,
}: {
  health: HealthResponse | null;
  backendError: string | null;
  shopify: ShopifyStatus | null;
}) {
  const items = [
    {
      label: backendError ? "API nere" : "API",
      ok: Boolean(health) && !backendError,
    },
    {
      label: health?.integrations.supabase ? "Supabase" : "Minne",
      ok: true,
    },
    {
      label: `LLM ${health?.integrations.llm ?? "…"}`,
      ok: Boolean(health),
    },
    {
      label: `Shopify ${shopify?.mode ?? health?.integrations.shopify ?? "…"}`,
      ok: Boolean(health),
    },
  ];
  return (
    <ul className="hidden flex-wrap gap-2 md:flex">
      {items.map((item) => (
        <li
          key={item.label}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            item.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}
