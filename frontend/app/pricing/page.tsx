import Link from "next/link";

import { shopifyMembershipUrl } from "@/lib/env";

type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  summary: string;
  points: string[];
  featured?: boolean;
  actions: { label: string; href: string; primary?: boolean }[];
  footnote?: string;
};

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    summary: "Everything you need to try Study on your own notes.",
    points: [
      "1 upload a day: a notebook scan or a lecture file",
      "Unlimited flashcards, quizzes and questions on files you've added",
      "Your private library, saved to your account",
    ],
    actions: [{ label: "Create free account", href: "/account?mode=signup" }],
  },
  {
    id: "plus",
    name: "Plus",
    price: "$12",
    cadence: "a month",
    summary: "For a full term of lectures and revision.",
    featured: true,
    points: [
      "Unlimited uploads, within fair use",
      "Everything in Free",
      "Unlocks the moment you pay with the same email",
    ],
    actions: [
      { label: "Get Plus monthly", href: shopifyMembershipUrl("standard"), primary: true },
      { label: "Or $79 a year", href: shopifyMembershipUrl("annual") },
    ],
    footnote: "Paying yearly works out at about $6.60 a month.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    cadence: "a month",
    summary: "For heavy exam seasons and the newest tools first.",
    points: [
      "Everything in Plus",
      "First access to practice exams and study plans as they launch",
    ],
    actions: [{ label: "Get Pro", href: shopifyMembershipUrl("scholar") }],
  },
];

const faqs = [
  {
    q: "How do I pay?",
    a: "Plans are sold on the ARZIVE shop with a card, just like the notebooks. Your subscription renews automatically.",
  },
  {
    q: "How does my plan reach Study?",
    a: "Use the same email at checkout as your Study account. If you don't have an account yet, create one with that email afterwards and the plan is already there.",
  },
  {
    q: "What counts as an upload?",
    a: "Each photo of a notebook page or each lecture file (PDF, Word, PowerPoint, image or text) you add to your library. Studying a file you've already added never uses an upload.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, any time from your ARZIVE shop account. Your account moves back to Free and everything in your library stays.",
  },
];

export default function PricingPage() {
  return (
    <main className="bg-cream text-forest">
      <section className="bg-forest text-cream">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 lg:px-10 lg:pb-20 lg:pt-20">
          <p className="rise text-[0.95rem] text-brass-light">Study with Arzive</p>
          <h1 className="rise mt-3 max-w-2xl font-display text-[2.6rem] leading-[1.05] sm:text-[3.4rem]">
            Start free. Upgrade when you&apos;re adding notes every day.
          </h1>
          <p className="rise-2 mt-5 max-w-xl text-[1.05rem] leading-7 text-cream/72">
            Every plan includes flashcards, quizzes, summaries and answers on your
            own files. Paid plans remove the daily upload limit.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:px-10 lg:py-20">
        <div className="grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={`flex flex-col border p-7 sm:p-8 ${
                plan.featured
                  ? "border-forest bg-paper shadow-[0_1px_0_var(--forest),0_18px_40px_-28px_rgba(11,36,33,0.45)]"
                  : "border-forest/15 bg-paper/60"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[2rem] leading-none">{plan.name}</h2>
                {plan.featured ? (
                  <span className="text-sm text-brass">Most popular</span>
                ) : null}
              </div>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-[3rem] leading-none">{plan.price}</span>
                <span className="text-forest/60">{plan.cadence}</span>
              </p>
              <p className="mt-4 text-[0.98rem] leading-7 text-forest/70">{plan.summary}</p>
              <ul className="mt-6 flex-1 space-y-3 border-t border-forest/10 pt-6 text-[0.98rem] leading-6">
                {plan.points.map((point) => (
                  <li key={point} className="flex gap-3">
                    <CheckIcon />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-col gap-2">
                {plan.actions.map((action, index) =>
                  action.href.startsWith("http") ? (
                    <a
                      key={action.label}
                      href={action.href}
                      className={action.primary ? "btn-ink" : index === 0 ? "btn-line" : "btn-line border-forest/15"}
                    >
                      {action.label}
                    </a>
                  ) : (
                    <Link key={action.label} href={action.href} className="btn-line">
                      {action.label}
                    </Link>
                  ),
                )}
              </div>
              {plan.footnote ? (
                <p className="mt-3 text-sm text-forest/55">{plan.footnote}</p>
              ) : null}
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm text-forest/55">
          Checkout happens on the ARZIVE shop.
        </p>
      </section>

      <section className="border-t border-forest/10">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_2fr] lg:px-10 lg:py-20">
          <h2 className="font-display text-[2rem] leading-tight sm:text-[2.4rem]">
            Questions about plans
          </h2>
          <dl className="divide-y divide-forest/10 border-y border-forest/10">
            {faqs.map((item) => (
              <div key={item.q} className="py-6">
                <dt className="font-display text-[1.4rem]">{item.q}</dt>
                <dd className="mt-2 max-w-2xl text-[1rem] leading-7 text-forest/70">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="mt-[0.2rem] shrink-0 text-brass"
    >
      <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
