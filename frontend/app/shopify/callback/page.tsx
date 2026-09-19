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
          <p className="text-sm text-forest/70">Connecting Shopify…</p>
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
        if (!cancelled) router.replace("/account?shopify=connected");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "OAuth callback failed.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shop, code, state, hmac, router]);

  const message = missing
    ? "Shopify did not return a shop/code."
    : error;

  return (
    <main className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-3 px-4 py-16">
      <p className="font-display text-sm tracking-[0.28em] text-forest">ARZIVE</p>
      <h1 className="font-display text-2xl tracking-[0.04em]">Connecting Shopify</h1>
      {message ? (
        <div className="space-y-3">
          <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {message}
          </p>
          <Link href="/account" className="text-sm font-medium text-forest underline">
            Back to account
          </Link>
        </div>
      ) : (
        <p className="text-sm text-forest/70">
          Exchanging the code for an access token and saving the shop connection…
        </p>
      )}
    </main>
  );
}
