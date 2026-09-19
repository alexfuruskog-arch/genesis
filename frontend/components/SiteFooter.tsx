import Link from "next/link";

import { shopifyStoreDomain } from "@/lib/env";

function shopUrl(path = "") {
  const domain = (shopifyStoreDomain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!domain) return path || "/shop";
  return `https://${domain}${path}`;
}

export function SiteFooter() {
  return (
    <footer className="border-t border-forest/10 bg-cream text-forest">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-12 lg:px-10">
        <div>
          <p className="font-display text-[1.15rem] tracking-[0.28em]">ARZIVE</p>
          <p className="mt-3 max-w-xs text-sm font-light leading-6 text-forest/60">
            Notebooks built for recall — and Study with Arzive to practice what you wrote.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-7 gap-y-3 text-[0.62rem] uppercase tracking-[0.16em] text-forest/70">
          <a href={shopUrl("/collections/all")} className="transition hover:text-forest">
            Shop
          </a>
          <Link href="/study" className="transition hover:text-forest">
            Study
          </Link>
          <Link href="/pricing" className="transition hover:text-forest">
            Pricing
          </Link>
          <Link href="/account" className="transition hover:text-forest">
            Account
          </Link>
        </nav>
      </div>
    </footer>
  );
}
