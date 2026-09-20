import Link from "next/link";

import { shopifyMembershipUrl } from "@/lib/env";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "",
    note: "Taste the loop. Feel the limit.",
    badge: "Start here",
    featured: false,
    cta: "Create free account",
    href: "/account",
    points: [
      "3 chats per week (practice exam or flashcards)",
      "Up to 5 scans saved under your account",
      "Cornell & Math notebook tagging",
      "Private library · cloud when Supabase is connected",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: "$12",
    cadence: "/ month",
    note: "The study loop, unlocked.",
    badge: "Most chosen",
    featured: true,
    cta: "Buy Standard on Shopify",
    href: shopifyMembershipUrl("standard"),
    points: [
      "Unlimited practice exams & flashcards",
      "Unlimited scans to your private library",
      "Active-recall chats without weekly caps",
      "Priority when exam week spikes traffic",
    ],
  },
  {
    id: "annual",
    name: "Annual",
    price: "$96",
    cadence: "/ year",
    note: "Eight dollars a month — save 33%.",
    badge: "Best value",
    featured: false,
    cta: "Buy Annual on Shopify",
    href: shopifyMembershipUrl("annual"),
    points: [
      "Everything in Standard",
      "Billed once · $8 effective monthly",
      "Early access to new recall formats",
      "Semester reset rituals & study streaks",
    ],
  },
  {
    id: "scholar",
    name: "Scholar",
    price: "$29",
    cadence: "/ month",
    note: "Unlimited Study + stationery credit.",
    badge: "Notebook + Study",
    featured: false,
    cta: "Buy Scholar on Shopify",
    href: shopifyMembershipUrl("scholar"),
    points: [
      "Everything in Annual features, month to month",
      "$25 notebook credit each semester (Cornell or Math)",
      "Concierge first-scan setup",
      "Unlimited chats — no soft ceilings",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <main className="bg-cream text-forest">
      <section className="relative overflow-hidden border-b border-forest/10 bg-forest text-cream">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #f5f5f0 0.6px, transparent 0.7px), radial-gradient(circle at 80% 60%, #f5f5f0 0.6px, transparent 0.7px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-22">
          <p className="animate-soft-in font-display text-[0.95rem] tracking-[0.28em] text-cream/80">
            ARZIVE
          </p>
          <h1 className="animate-fade-up mt-5 font-display text-[2.5rem] leading-[1.1] sm:text-[3.35rem]">
            Study plans, quietly expensive.
          </h1>
          <p className="animate-fade-up-delay mx-auto mt-5 max-w-md text-base font-light leading-7 text-cream/68">
            Free is capped. Standard is $12. Annual and Scholar sit beside it —
            no clutter, no soft trials.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-18">
        <div className="divide-y divide-forest/10 border-y border-forest/10">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`grid gap-7 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] md:items-end md:gap-12 ${
                plan.featured
                  ? "bg-[#f0ebe3] -mx-5 px-5 sm:-mx-8 sm:px-8"
                  : ""
              }`}
            >
              <div>
                <p className="text-[0.58rem] uppercase tracking-[0.22em] text-forest/45">
                  {plan.badge}
                </p>
                <h2 className="mt-2.5 font-display text-[2rem] tracking-[0.02em] sm:text-[2.15rem]">
                  {plan.name}
                </h2>
                <p className="mt-2 max-w-[16rem] text-sm font-light leading-6 text-forest/60">
                  {plan.note}
                </p>
              </div>

              <ul className="space-y-2.5 text-sm font-light leading-6 text-forest/72">
                {plan.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <span className="mt-[0.55rem] h-px w-3 shrink-0 bg-forest/35" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              <div className="md:min-w-[11rem] md:text-right">
                <p className="font-display text-[2.65rem] leading-none tracking-[0.02em]">
                  {plan.price}
                  {plan.cadence ? (
                    <span className="ml-1.5 font-sans text-[0.72rem] font-light tracking-[0.08em] uppercase text-forest/45">
                      {plan.cadence}
                    </span>
                  ) : null}
                </p>
                {plan.href.startsWith("http") ? (
                  <a
                    href={plan.href}
                    className={`mt-6 inline-flex ${
                      plan.featured
                        ? "btn-ink"
                        : "border border-forest/25 px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.14em] text-forest transition hover:border-forest/50"
                    }`}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    href={plan.href}
                    className={`mt-6 inline-flex ${
                      plan.featured
                        ? "btn-ink"
                        : "border border-forest/25 px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.14em] text-forest transition hover:border-forest/50"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 grid gap-10 border-t border-forest/10 pt-12 md:grid-cols-2">
          <div>
            <h3 className="font-display text-xl tracking-[0.02em]">
              Free means free — and finite
            </h3>
            <p className="mt-3 text-sm font-light leading-7 text-forest/68">
              Three chats a week. Five scans. When you hit the gate,
              Study blocks the action and offers Standard — no dark patterns,
              no infinite soft trial.
            </p>
          </div>
          <div>
            <h3 className="font-display text-xl tracking-[0.02em]">Checkout</h3>
            <p className="mt-3 text-sm font-light leading-7 text-forest/68">
              Paid plans check out on Shopify with a recurring card (Shopify
              Payments). Use the same email in Study — if you buy first, the plan
              attaches when you sign up; if you already have Study, it unlocks as
              soon as the order is paid.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-forest px-5 py-16 text-center text-cream">
        <p className="mx-auto max-w-xl font-display text-2xl leading-snug sm:text-3xl">
          Start free. Upgrade when the third chat isn&apos;t enough.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link href="/account" className="btn-solid">
            Create free account
          </Link>
          <a href={shopifyMembershipUrl("standard")} className="btn-ghost">
            Go Standard · $12
          </a>
        </div>
      </section>
    </main>
  );
}
