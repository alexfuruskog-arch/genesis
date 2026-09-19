import Image from "next/image";
import Link from "next/link";

import { products, shopifyProductUrl } from "@/lib/products";
import { publicConfig, shopifyStoreDomain } from "@/lib/env";

export default function ShopPage() {
  return (
    <main className="bg-cream">
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="text-xs tracking-[0.22em] uppercase text-forest/55">Shop</p>
        <h1 className="mt-3 font-display text-4xl tracking-[0.04em] text-forest sm:text-5xl">
          Notebooks
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-forest/70">
          Cornell for structured thinking. Math for clarity on the page. Checkout
          lives on Shopify — ARZIVE is one brand, one site.
        </p>

        {!publicConfig.shopifyConfigured ? (
          <p className="mt-6 border border-forest/15 bg-cream-soft px-4 py-3 text-sm text-forest/75">
            Shopify store domain is not set. Buy buttons use placeholder links
            until you add <code className="text-xs">NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code>.
          </p>
        ) : null}

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {products.map((product) => {
            const buyUrl = shopifyProductUrl(
              product.shopifyHandle,
              shopifyStoreDomain,
            );
            return (
              <article key={product.id} className="flex flex-col gap-5">
                <div className="grid grid-cols-2 gap-3">
                  <Image
                    src={product.coverImage}
                    alt={`${product.name} cover`}
                    width={640}
                    height={640}
                    className="aspect-square w-full object-cover"
                  />
                  <Image
                    src={product.layoutImage}
                    alt={`${product.name} layout`}
                    width={640}
                    height={640}
                    className="aspect-square w-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-xs tracking-[0.18em] uppercase text-forest/50">
                    {product.tagline}
                  </p>
                  <h2 className="mt-2 font-display text-2xl tracking-[0.06em]">
                    {product.name}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-forest/70">
                    {product.description}
                  </p>
                </div>
                {buyUrl ? (
                  <a
                    href={buyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ink w-fit"
                  >
                    Buy on Shopify
                  </a>
                ) : (
                  <a
                    href={`#${product.slug}-placeholder`}
                    className="btn-ink w-fit opacity-80"
                    title="Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN for live checkout"
                  >
                    Buy (Shopify link pending)
                  </a>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-16 border-t border-forest/10 pt-10">
          <h2 className="font-display text-2xl tracking-[0.06em]">
            Already writing in an ARZIVE notebook?
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-forest/70">
            Scan pages in Study with Arzive and turn them into practice exams or
            flashcards — same brand, logged-in study surface.
          </p>
          <Link href="/study" className="btn-ink mt-6 inline-flex">
            Study with Arzive
          </Link>
        </div>
      </section>
    </main>
  );
}
