"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/lib/auth";

export function SiteNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const onForest = pathname === "/" || pathname === "/story";

  return (
    <header
      className={`sticky top-0 z-40 ${
        onForest
          ? "bg-forest/95 text-cream backdrop-blur-sm"
          : "border-b border-forest/10 bg-cream/95 text-forest backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-6">
        <nav className="flex items-center gap-4 sm:gap-7">
          <Link
            href="/shop"
            className={`nav-link ${onForest ? "" : "!text-forest"}`}
          >
            Shop
          </Link>
          <Link
            href="/study"
            className={`nav-link hidden sm:inline ${onForest ? "" : "!text-forest"}`}
          >
            Study with Arzive
          </Link>
          <Link
            href="/study"
            className={`nav-link sm:hidden ${onForest ? "" : "!text-forest"}`}
          >
            Study
          </Link>
        </nav>

        <Link
          href="/"
          className={`font-display text-center text-xl tracking-[0.28em] sm:text-2xl ${
            onForest ? "text-cream" : "text-forest"
          }`}
        >
          ARZIVE
        </Link>

        <div className="flex items-center justify-end gap-4 sm:gap-7">
          <Link
            href="/account"
            className={`nav-link ${onForest ? "" : "!text-forest"}`}
          >
            {user?.email ? "Account" : "Account"}
          </Link>
          <Link
            href="/shop"
            aria-label="Shopping bag"
            className={`${onForest ? "text-cream" : "text-forest"} opacity-90 hover:opacity-70`}
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8h12l-1 12H7L6 8Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V7a3 3 0 0 1 6 0v1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
