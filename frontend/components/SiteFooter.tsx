import Link from "next/link";

import { shopifyStoreUrl } from "@/lib/env";
import { products } from "@/lib/products";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-forest-deep text-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div>
          <Link href="/" className="font-display text-[1.4rem] tracking-[0.3em]">
            ARZIVE
          </Link>
          <p className="mt-4 max-w-xs text-[0.95rem] leading-7 text-cream/65">
            Notebooks built for recall, and a study tool that turns what you wrote
            into practice.
          </p>
        </div>
        <nav aria-label="Notebooks">
          <p className="text-sm font-medium text-cream/50">Notebooks</p>
          <ul className="mt-4 space-y-2.5 text-[0.95rem] text-cream/85">
            {products.map((product) => (
              <li key={product.id}>
                <a
                  href={shopifyStoreUrl(`/products/${product.shopifyHandle}`)}
                  className="hover:text-cream"
                >
                  {product.name}
                </a>
              </li>
            ))}
            <li>
              <a href={shopifyStoreUrl("/collections/all")} className="hover:text-cream">
                Shop all
              </a>
            </li>
            <li>
              <a href={shopifyStoreUrl("/pages/our-story")} className="hover:text-cream">
                Our story
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Study with Arzive">
          <p className="text-sm font-medium text-cream/50">Study with Arzive</p>
          <ul className="mt-4 space-y-2.5 text-[0.95rem] text-cream/85">
            <li>
              <Link href="/study" className="hover:text-cream">
                Open Study
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-cream">
                Plans and pricing
              </Link>
            </li>
            <li>
              <Link href="/account" className="hover:text-cream">
                Your account
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-cream/10">
        <p className="mx-auto max-w-6xl px-5 py-5 text-sm text-cream/45 sm:px-8 lg:px-10">
          © {year} ARZIVE
        </p>
      </div>
    </footer>
  );
}
