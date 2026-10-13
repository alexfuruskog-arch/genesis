"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { shopifyStoreUrl } from "@/lib/env";

type NavItem = { label: string; href: string; external?: boolean };

export function SiteNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  // Forest header only on home. Study / Pricing / Account stay cream.
  const onForest = pathname === "/";
  const tone = onForest ? "text-cream" : "text-forest";

  const left: NavItem[] = [
    { label: "Shop", href: shopifyStoreUrl(), external: true },
    { label: "Study with Arzive", href: "/study" },
  ];
  const right: NavItem[] = [
    { label: "Pricing", href: "/pricing" },
    { label: "Our story", href: shopifyStoreUrl("/pages/our-story"), external: true },
    { label: user?.email ? "Account" : "Sign in", href: "/account" },
  ];

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function renderLink(item: NavItem, className = "") {
    const current = !item.external && pathname === item.href ? "page" : undefined;
    if (item.external) {
      return (
        <a href={item.href} className={`nav-link ${tone} ${className}`}>
          {item.label}
        </a>
      );
    }
    return (
      <Link
        href={item.href}
        aria-current={current}
        onClick={() => setOpen(false)}
        className={`nav-link ${tone} ${className}`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <>
      <div className="arzive-announce">
        <a href={shopifyStoreUrl("/collections/all")}>
          Free shipping on orders over $75. Shop all notebooks
        </a>
      </div>
      <header
        className={`sticky top-0 z-40 ${
          onForest
            ? "border-b border-cream/10 bg-forest"
            : "border-b border-forest/10 bg-cream/95 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-4 sm:px-8 lg:px-10">
          <nav aria-label="Primary" className="flex min-w-0 items-center gap-7">
            <button
              type="button"
              className={`-ml-2 p-2 md:hidden ${tone}`}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
            >
              <MenuIcon open={open} />
            </button>
            {left.map((item) => (
              <span key={item.label}>{renderLink(item, "hidden md:inline")}</span>
            ))}
          </nav>

          <Link
            href="/"
            className={`font-display text-center text-[1.5rem] tracking-[0.3em] sm:text-[1.75rem] sm:tracking-[0.34em] ${tone}`}
            onClick={() => setOpen(false)}
          >
            ARZIVE
          </Link>

          <div className="flex items-center justify-end gap-7">
            {right.map((item) => (
              <span key={item.label}>{renderLink(item, "hidden md:inline")}</span>
            ))}
            <a
              href={shopifyStoreUrl("/cart")}
              aria-label="Shopping bag"
              className={`${tone} -mr-2 p-2 transition hover:opacity-70`}
            >
              <BagIcon />
            </a>
          </div>
        </div>

        {open ? (
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className={`border-t md:hidden ${
              onForest ? "border-cream/10 bg-forest" : "border-forest/10 bg-cream"
            }`}
          >
            <ul className="mx-auto flex max-w-6xl flex-col px-5 py-3 sm:px-8">
              {[...left, ...right].map((item) => (
                <li key={item.label}>
                  {item.external ? (
                    <a
                      href={item.href}
                      className={`block py-3 font-display text-2xl ${tone}`}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={pathname === item.href ? "page" : undefined}
                      className={`block py-3 font-display text-2xl ${tone}`}
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>
    </>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
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
