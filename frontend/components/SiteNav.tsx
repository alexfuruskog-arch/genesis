"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { shopifyStoreDomain } from "@/lib/env";

function shopUrl(path = "") {
  const domain = (shopifyStoreDomain || "sexb4g-xw.myshopify.com")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  return `https://${domain}${path}`;
}

export function SiteNav() {
  const pathname = usePathname();
  // Forest header only on home & story. Study / Pricing / Shop / Account stay cream
  // (pathname === "/pricing" must never match forest).
  const onForest = pathname === "/" || pathname === "/story";

  return (
    <>
      <div className="arzive-announce">
        <a href={shopUrl("/collections/all")}>
          Free shipping over $75 · Shop all →
        </a>
      </div>
      <header
        className={`z-40 sticky top-0 ${
          onForest
            ? "bg-forest text-cream border-b border-cream/10"
            : "border-b border-forest/10 bg-cream/95 text-forest backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-4 sm:gap-4 sm:px-8 lg:px-10">
          <nav className="flex min-w-0 items-center gap-4 sm:gap-7">
            <a
              href={shopUrl("/collections/all")}
              className={`nav-link ${onForest ? "text-cream" : "text-forest"}`}
            >
              Shop
            </a>
            <Link
              href="/study"
              className={`nav-link truncate ${onForest ? "text-cream" : "text-forest"}`}
            >
              <span className="hidden sm:inline">Study with Arzive</span>
              <span className="sm:hidden">Study</span>
            </Link>
          </nav>

          <a
            href={shopUrl()}
            className={`font-display text-center text-[1.45rem] tracking-[0.3em] sm:text-[1.75rem] sm:tracking-[0.34em] ${
              onForest ? "text-cream" : "text-forest"
            }`}
          >
            ARZIVE
          </a>

          <div className="flex items-center justify-end gap-3 sm:gap-6 lg:gap-7">
            <Link
              href="/pricing"
              className={`nav-link ${onForest ? "text-cream" : "text-forest"}`}
            >
              Pricing
            </Link>
            <Link
              href="/story"
              className={`nav-link hidden sm:inline ${onForest ? "text-cream" : "text-forest"}`}
            >
              Our story
            </Link>
            <Link
              href="/account"
              className={`nav-link ${onForest ? "text-cream" : "text-forest"}`}
            >
              Account
            </Link>
            <a
              href={shopUrl("/cart")}
              aria-label="Shopping bag"
              className={`${onForest ? "text-cream" : "text-forest"} transition hover:opacity-70`}
            >
              <BagIcon />
            </a>
          </div>
        </div>
      </header>
    </>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 8.5h10l-.85 11.2a1 1 0 0 1-1 .9H8.85a1 1 0 0 1-1-.9L7 8.5Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.5V7.4a2.8 2.8 0 0 1 5.6 0v1.1"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
