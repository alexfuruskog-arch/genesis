"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { ShopifyConnect } from "@/components/ShopifyConnect";
import { getPlan, setPlan, type PlanId } from "@/lib/plan";

const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  standard: "Standard · $12/mo",
  annual: "Annual · $96/yr",
  scholar: "Scholar · $29/mo",
};

function parsePlan(raw: string | null): PlanId | null {
  if (raw === "standard" || raw === "annual" || raw === "scholar" || raw === "free") {
    return raw;
  }
  return null;
}

function AccountInner() {
  const searchParams = useSearchParams();
  const { user, ready, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [plan, setPlanState] = useState<PlanId>("free");

  useEffect(() => {
    const fromQuery = parsePlan(searchParams.get("plan"));
    if (fromQuery) {
      setPlan(fromQuery);
      setPlanState(fromQuery);
      if (fromQuery !== "free") {
        setMessage(
          `${PLAN_LABELS[fromQuery]} selected. Sign in to attach it to your account — Study unlocks unlimited immediately for this browser.`,
        );
        setMode("signup");
      }
      return;
    }
    setPlanState(getPlan());
  }, [searchParams]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        await signUp(email, password);
        setMessage("Account created. Open Study with Arzive to scan notes.");
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

  function choosePlan(next: PlanId) {
    setPlan(next);
    setPlanState(next);
    setMessage(
      next === "free"
        ? "Back on Free — 3 chats per week, 5 scans."
        : `${PLAN_LABELS[next]} active on this device.`,
    );
  }

  return (
    <>
      {!ready ? (
        <p className="mt-10 text-sm font-light text-cream/65">Loading session…</p>
      ) : user?.email ? (
        <div className="mt-10 w-full bg-cream p-7 text-forest sm:p-9">
          <h1 className="font-display text-3xl tracking-[0.03em]">Welcome back</h1>
          <p className="mt-3 text-sm font-light text-forest/70">
            Signed in as <strong className="font-medium text-forest">{user.email}</strong>
          </p>
          <p className="mt-4 text-[0.62rem] uppercase tracking-[0.16em] text-forest/50">
            Plan · {PLAN_LABELS[plan]}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/study" className="btn-ink">
              Study with Arzive
            </Link>
            <Link
              href="/pricing"
              className="border border-forest/25 px-4 py-2.5 text-[0.62rem] tracking-[0.14em] uppercase text-forest"
            >
              Change plan
            </Link>
            <button
              type="button"
              className="border border-forest/25 px-4 py-2.5 text-[0.62rem] tracking-[0.14em] uppercase text-forest"
              onClick={() => void signOut()}
            >
              Sign out
            </button>
          </div>
          {message ? <p className="mt-4 text-sm text-forest/70">{message}</p> : null}
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-10 w-full bg-cream p-7 text-forest sm:p-9"
        >
          <h1 className="font-display text-3xl tracking-[0.03em]">
            {mode === "signup" ? "Create account" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm font-light text-forest/65">
            One account for Study with Arzive — scans, exams, and flashcards.
          </p>
          <p className="mt-3 text-[0.62rem] uppercase tracking-[0.16em] text-forest/50">
            Plan · {PLAN_LABELS[plan]}
          </p>

          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`px-3 py-2 text-[0.62rem] tracking-[0.14em] uppercase ${
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
              className={`px-3 py-2 text-[0.62rem] tracking-[0.14em] uppercase ${
                mode === "signup"
                  ? "bg-forest text-cream"
                  : "border border-forest/20 text-forest"
              }`}
            >
              Sign up
            </button>
          </div>

          <label className="mt-6 block text-sm">
            <span className="study-label">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="study-input mt-2"
            />
          </label>
          <label className="mt-5 block text-sm">
            <span className="study-label">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="study-input mt-2"
            />
          </label>
          {error ? <p className="mt-4 text-sm text-red-800">{error}</p> : null}
          {message ? <p className="mt-4 text-sm text-forest/70">{message}</p> : null}
          <button type="submit" disabled={busy} className="btn-ink mt-7 w-full">
            {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>
      )}

      <div className="mt-10 w-full border-t border-cream/15 pt-8">
        <p className="text-[0.62rem] uppercase tracking-[0.18em] text-cream/55">
          Attach a plan
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ["free", "Free"],
              ["standard", "Standard"],
              ["annual", "Annual"],
              ["scholar", "Scholar"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => choosePlan(id)}
              className={`px-3 py-3 text-[0.58rem] uppercase tracking-[0.12em] transition ${
                plan === id
                  ? "bg-cream text-forest"
                  : "border border-cream/25 text-cream/80 hover:border-cream/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs font-light text-cream/50">
          Billing is local for this MVP. See{" "}
          <Link href="/pricing" className="underline underline-offset-2">
            Pricing
          </Link>{" "}
          for the full editorial list.
        </p>
      </div>
    </>
  );
}

export default function AccountPage() {
  return (
    <main className="min-h-[70vh] bg-forest text-cream">
      <section className="mx-auto flex max-w-lg flex-col items-center px-5 py-16 sm:py-20">
        <p className="font-display text-3xl tracking-[0.28em]">ARZIVE</p>
        <p className="mt-3 text-[0.62rem] uppercase tracking-[0.22em] text-cream/55">
          Account
        </p>

        <Suspense
          fallback={
            <p className="mt-10 text-sm font-light text-cream/65">Loading session…</p>
          }
        >
          <AccountInner />
        </Suspense>

        <div className="mt-12 w-full border-t border-cream/15 pt-10">
          <h2 className="font-display text-xl tracking-[0.04em] text-cream">
            Merchant tools
          </h2>
          <p className="mt-2 mb-4 text-sm font-light text-cream/65">
            Optional Shopify Admin connect for catalog sync.
          </p>
          <div className="bg-cream/5 p-1">
            <ShopifyConnect />
          </div>
        </div>
      </section>
    </main>
  );
}
