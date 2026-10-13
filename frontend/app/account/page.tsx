"use client";

import Link from "next/link";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { fetchMembership, type MembershipSnapshot } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { shopifyMembershipUrl } from "@/lib/env";
import { applyServerUsage, type PlanId } from "@/lib/plan";

const PLAN_NAMES: Record<PlanId, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

const CHECKOUT_LABELS: Record<"standard" | "annual" | "scholar", string> = {
  standard: "Plus, $12 a month",
  annual: "Plus Annual, $79 a year",
  scholar: "Pro, $19 a month",
};

function parseShopifyPlan(raw: string | null): "standard" | "annual" | "scholar" | null {
  if (raw === "standard" || raw === "annual" || raw === "scholar") {
    return raw;
  }
  return null;
}

function AccountInner() {
  const searchParams = useSearchParams();
  const { user, ready, signIn, signUp, signOut, authHeaders } = useAuth();
  const intended = parseShopifyPlan(searchParams.get("plan"));
  const [mode, setMode] = useState<"login" | "signup">(
    intended || searchParams.get("mode") === "signup" ? "signup" : "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membership, setMembership] = useState<MembershipSnapshot | null>(null);
  const plan: PlanId = membership?.plan || (user?.plan as PlanId | undefined) || "free";
  const signedIn = Boolean(user?.email);

  useEffect(() => {
    if (!ready || !signedIn) return;
    let cancelled = false;
    void fetchMembership(authHeaders)
      .then((next) => {
        if (cancelled) return;
        setMembership(next);
        applyServerUsage({ plan: next.plan, uploads_used: next.uploads_used });
      })
      .catch(() => {
        if (!cancelled) setMembership(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, signedIn, authHeaders]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      setPassword("");
    } catch (err) {
      setError(
        friendlyError(err, mode === "signup" ? "Could not create the account." : "Could not sign in."),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className="mt-10 text-forest/60">Loading your account…</p>;
  }

  if (signedIn && user) {
    const unlimited = plan !== "free";
    return (
      <div className="mt-10 w-full">
        <div className="study-panel">
          <h1 className="font-display text-[2.2rem] leading-tight">Your account</h1>
          <dl className="mt-6 divide-y divide-forest/10 border-y border-forest/10">
            <div className="flex flex-wrap justify-between gap-2 py-3.5">
              <dt className="text-forest/60">Email</dt>
              <dd className="font-medium">{user.email}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3.5">
              <dt className="text-forest/60">Plan</dt>
              <dd className="font-medium">{PLAN_NAMES[plan]}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2 py-3.5">
              <dt className="text-forest/60">Uploads today</dt>
              <dd className="font-medium">
                {unlimited
                  ? "Unlimited"
                  : membership
                    ? `${membership.uploads_used} of ${membership.uploads_cap} used`
                    : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/study" className="btn-ink">
              Open Study
            </Link>
            <button type="button" className="btn-line" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </div>

        {!unlimited ? (
          <UpgradePanel intended={intended} />
        ) : (
          <p className="mt-6 text-[0.95rem] leading-7 text-forest/65">
            Your {PLAN_NAMES[plan]} plan is billed through the ARZIVE shop. To change
            or cancel it, use the subscription link in your order email.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-10 w-full">
      <form onSubmit={onSubmit} className="study-panel" noValidate={false}>
        <h1 className="font-display text-[2.2rem] leading-tight">
          {mode === "signup" ? "Create your account" : "Sign in"}
        </h1>
        <p className="mt-2 text-[0.98rem] leading-7 text-forest/68">
          {mode === "signup"
            ? "Free to start. If you buy a plan on the ARZIVE shop, use this same email and it unlocks automatically."
            : "Welcome back. Sign in to open your Study library."}
        </p>

        {intended ? (
          <p className="mt-5 border-l-2 border-brass bg-cream px-4 py-3 text-[0.95rem] leading-6">
            Buying {CHECKOUT_LABELS[intended]}? Create your account with the email
            you&apos;ll use at checkout, then{" "}
            <a href={shopifyMembershipUrl(intended)} className="text-link font-medium">
              continue to the shop
            </a>
            .
          </p>
        ) : null}

        <div className="segmented mt-6" role="group" aria-label="Choose sign in or create account">
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === "signup"}
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
          >
            Create account
          </button>
        </div>

        <label className="mt-6 block">
          <span className="study-label">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="study-input mt-1.5"
          />
        </label>
        <label className="mt-4 block">
          <span className="study-label">Password</span>
          <input
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="study-input mt-1.5"
          />
          {mode === "signup" ? (
            <span className="mt-1.5 block text-sm text-forest/55">At least 8 characters.</span>
          ) : null}
        </label>
        {error ? (
          <p role="alert" className="mt-4 border-l-2 border-red-800 bg-red-50 px-3 py-2 text-[0.95rem] text-red-900">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="btn-ink mt-6 w-full">
          {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function UpgradePanel({ intended }: { intended: "standard" | "annual" | "scholar" | null }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-[1.6rem]">Want unlimited uploads?</h2>
      <p className="mt-2 text-[0.98rem] leading-7 text-forest/68">
        Paid plans are bought on the ARZIVE shop. Check out with the same email as
        this account and Study upgrades as soon as the payment goes through.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {(Object.keys(CHECKOUT_LABELS) as Array<keyof typeof CHECKOUT_LABELS>).map((id) => (
          <a
            key={id}
            href={shopifyMembershipUrl(id)}
            className={intended === id ? "btn-ink" : "btn-line"}
          >
            {CHECKOUT_LABELS[id]}
          </a>
        ))}
      </div>
      <p className="mt-4 text-[0.95rem]">
        <Link href="/pricing" className="text-link">
          Compare plans
        </Link>
      </p>
    </section>
  );
}

export default function AccountPage() {
  return (
    <main className="ruled min-h-[70vh] text-forest">
      <section className="mx-auto flex max-w-lg flex-col px-5 py-14 sm:py-20">
        <Suspense fallback={<p className="mt-10 text-forest/60">Loading your account…</p>}>
          <AccountInner />
        </Suspense>
      </section>
    </main>
  );
}
