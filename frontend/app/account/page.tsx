"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { useAuth } from "@/lib/auth";
import { ShopifyConnect } from "@/components/ShopifyConnect";

export default function AccountPage() {
  const { user, ready, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setMessage("Account created. You can use Study with Arzive with this session.");
      } else {
        await signIn(email, password);
        setMessage("Signed in.");
      }
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-cream">
      <section className="mx-auto max-w-xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-xs tracking-[0.22em] uppercase text-forest/55">Account</p>
        <h1 className="mt-3 font-display text-4xl tracking-[0.04em] text-forest">
          {user?.email ? "Your ARZIVE account" : "Sign in"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-forest/70">
          Local MVP auth works without Supabase. When Supabase keys are set, the
          API validates JWTs the same way — wire the frontend client later.
        </p>

        {!ready ? (
          <p className="mt-8 text-sm text-forest/60">Loading session…</p>
        ) : user?.email ? (
          <div className="mt-8 space-y-4 border border-forest/10 bg-white/50 p-5">
            <p className="text-sm text-forest">
              Signed in as <strong>{user.email}</strong>
            </p>
            <p className="text-xs text-forest/55">
              Source: {user.source} · id {user.id.slice(0, 8)}…
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/study" className="btn-ink">
                Go to Study
              </Link>
              <button
                type="button"
                className="border border-forest/25 px-4 py-2 text-xs tracking-[0.14em] uppercase text-forest"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 space-y-4 border border-forest/10 bg-white/50 p-5"
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`px-3 py-2 text-xs tracking-[0.14em] uppercase ${
                  mode === "login"
                    ? "bg-forest text-cream"
                    : "border border-forest/20 text-forest"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`px-3 py-2 text-xs tracking-[0.14em] uppercase ${
                  mode === "signup"
                    ? "bg-forest text-cream"
                    : "border border-forest/20 text-forest"
                }`}
              >
                Sign up
              </button>
            </div>
            <label className="block text-sm">
              <span className="text-forest/70">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full border border-forest/15 bg-cream px-3 py-2.5 text-forest outline-none focus:border-forest/40"
              />
            </label>
            <label className="block text-sm">
              <span className="text-forest/70">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full border border-forest/15 bg-cream px-3 py-2.5 text-forest outline-none focus:border-forest/40"
              />
            </label>
            {error ? <p className="text-sm text-red-800">{error}</p> : null}
            {message ? <p className="text-sm text-forest/70">{message}</p> : null}
            <button type="submit" disabled={busy} className="btn-ink">
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        )}

        <div className="mt-12">
          <h2 className="font-display text-xl tracking-[0.04em] text-forest">
            Merchant tools
          </h2>
          <p className="mt-2 mb-4 text-sm text-forest/65">
            Connect Shopify Admin for catalog sync and draft orders (optional for
            the public shopfront buy links).
          </p>
          <ShopifyConnect />
        </div>
      </section>
    </main>
  );
}
