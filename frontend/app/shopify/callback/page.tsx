"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { completeShopifyOAuth } from "@/lib/api";

export default function ShopifyCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-full max-w-lg items-center justify-center px-4">
          <p className="text-sm text-ink/70">Kopplar Shopify…</p>
        </main>
      }
    >
      <CallbackBody />
    </Suspense>
  );
}

function CallbackBody() {
  const params = useSearchParams();
  const router = useRouter();
  const shop = params.get("shop");
  const code = params.get("code");
  const state = params.get("state") ?? undefined;
  const hmac = params.get("hmac") ?? undefined;
  const missing = !shop || !code;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shop || !code) return;
    let cancelled = false;
    completeShopifyOAuth({ shop, code, state, hmac }, window.location.search)
      .then(() => {
        if (!cancelled) router.replace("/?shopify=connected");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "OAuth-callback misslyckades.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shop, code, state, hmac, router]);

  const message = missing
    ? "Shopify returnerade ingen shop/code."
    : error;

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-3 px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-copper">
        Plugga
      </p>
      <h1 className="text-2xl font-semibold">Kopplar Shopify</h1>
      {message ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>
          <Link href="/" className="text-sm font-medium text-copper">
            Tillbaka till startsidan
          </Link>
        </div>
      ) : (
        <p className="text-sm text-ink/70">
          Byter kod mot access token och sparar butikskopplingen…
        </p>
      )}
    </main>
  );
}
