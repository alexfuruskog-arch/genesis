import Image from "next/image";
import Link from "next/link";

import { products, shopifyProductUrl } from "@/lib/products";
import { publicConfig, shopifyStoreDomain } from "@/lib/env";

export default function ShopPage() {
  return (
    <main className="bg-cream">
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
        <p className="text-[0.68rem] tracking-[0.22em] uppercase text-forest/50">
          Shop
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-[0.03em] text-forest sm:text-5xl">
          Notebooks
        </h1>
        <p className="mt-4 max-w-2xl text-base font-light leading-7 text-forest/70">
          Two research-backed notebooks. Checkout on Shopify — same ARZIVE brand
          as Study with Arzive.
        </p>

        {!publicConfig.shopifyConfigured ? (
          <p className="mt-6 border border-forest/15 bg-cream-soft px-4 py-3 text-sm text-forest/75">
            Set <code className="text-xs">NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code>{" "}
            for live product links. Buy buttons stay as placeholders until then.
          </p>
        ) : null}

        <div className="mt-14 space-y-16">
          {products.map((product) => {
            const buyUrl = shopifyProductUrl(
              product.shopifyHandle,
              shopifyStoreDomain,
            );
            return (
              <article key={product.id} className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Image
                    src={product.layoutImage}
                    alt={`${product.name} pages`}
                    width={720}
                    height={900}
                    className="col-span-2 aspect-[4/5] w-full object-cover sm:col-span-1 sm:aspect-[4/5]"
                  />
                  <Image
                    src="/products/notebook-green.jpg"
                    alt="Green ARZIVE cover"
                    width={720}
                    height={900}
                    className="aspect-[4/5] w-full object-cover"
                  />
                  <Image
                    src="/products/notebook-cream.jpg"
                    alt="Cream ARZIVE cover"
                    width={720}
                    height={900}
                    className="aspect-[4/5] w-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <p className="text-[0.68rem] tracking-[0.2em] uppercase text-forest/45">
                    {product.tagline}
                  </p>
                  <h2 className="mt-3 font-display text-3xl tracking-[0.04em] text-forest">
                    {product.name}
                  </h2>
                  <p className="mt-4 text-sm font-light leading-7 text-forest/70">
                    {product.description}
                  </p>
                  {buyUrl ? (
                    <a
                      href={buyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ink mt-8 w-fit"
                    >
                      Buy on Shopify
                    </a>
                  ) : (
                    <a
                      href={`#${product.slug}-placeholder`}
                      className="btn-ink mt-8 w-fit opacity-80"
                      title="Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN for live checkout"
                    >
                      Buy (Shopify link pending)
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-20 border-t border-forest/10 pt-12">
          <h2 className="font-display text-2xl tracking-[0.04em] text-forest">
            Already writing in an ARZIVE notebook?
          </h2>
          <p className="mt-3 max-w-xl text-sm font-light leading-6 text-forest/70">
            Scan pages in Study with Arzive and turn them into practice exams or
            flashcards.
          </p>
          <Link href="/study" className="btn-ink mt-6 inline-flex">
            Study with Arzive
          </Link>
        </div>
      </section>
    </main>
  );
}
