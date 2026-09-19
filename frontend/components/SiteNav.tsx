"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteNav() {
  const pathname = usePathname();
  const onForest = pathname === "/" || pathname === "/story";

  return (
    <header
      className={`z-40 ${
        onForest
          ? "bg-forest text-cream"
          : "sticky top-0 border-b border-forest/10 bg-cream/95 text-forest backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-5 sm:gap-4 sm:px-8 lg:px-10">
        <nav className="flex min-w-0 items-center gap-4 sm:gap-8">
          <Link
            href="/shop"
            className={`nav-link ${onForest ? "" : "!text-forest"}`}
          >
            Shop
          </Link>
          <Link
            href="/study"
            className={`nav-link truncate ${onForest ? "" : "!text-forest"}`}
          >
            <span className="hidden sm:inline">Study with Arzive</span>
            <span className="sm:hidden">Study</span>
          </Link>
        </nav>

        <Link
          href="/"
          className={`font-display text-center text-[1.35rem] tracking-[0.32em] sm:text-[1.65rem] sm:tracking-[0.36em] ${
            onForest ? "text-cream" : "text-forest"
          }`}
        >
          ARZIVE
        </Link>

        <div className="flex items-center justify-end gap-4 sm:gap-8">
          <Link
            href="/account"
            className={`nav-link ${onForest ? "" : "!text-forest"}`}
          >
            Account
          </Link>
          <Link
            href="/shop"
            aria-label="Shopping bag"
            className={`${onForest ? "text-cream" : "text-forest"} transition hover:opacity-70`}
          >
            <BagIcon />
          </Link>
        </div>
      </div>
    </header>
  );
}

function BagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
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
