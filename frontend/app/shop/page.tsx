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
          Two notebook models
        </h1>
        <p className="mt-4 max-w-2xl text-base font-light leading-7 text-forest/70">
          Cream Cornell for structured notes. Green Math for problem-solving.
          Buy on Shopify — then scan pages in Study with Arzive under your
          account.
        </p>

        {!publicConfig.shopifyConfigured ? (
          <p className="mt-6 border border-forest/15 bg-cream-soft px-4 py-3 text-sm text-forest/75">
            Set <code className="text-xs">NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN</code>{" "}
            (and optional handle overrides) for live buy links. Paste-ready
            product copy lives in{" "}
            <code className="text-xs">shopify/products.md</code>.
          </p>
        ) : (
          <p className="mt-6 text-sm text-forest/60">
            Buying on{" "}
            <span className="font-medium text-forest">{shopifyStoreDomain}</span>
          </p>
        )}

        <div className="mt-14 space-y-20">
          {products.map((product) => {
            const buyUrl = shopifyProductUrl(
              product.shopifyHandle,
              shopifyStoreDomain,
            );
            return (
              <article
                key={product.id}
                id={product.slug}
                className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12"
              >
                <div className="grid grid-cols-2 gap-3">
                  <Image
                    src={product.layoutImage}
                    alt={`${product.name} open pages`}
                    width={900}
                    height={1125}
                    className="aspect-[4/5] w-full object-cover"
                    priority
                  />
                  <Image
                    src={product.coverImage}
                    alt={`${product.name} cover — ${product.colorName}`}
                    width={900}
                    height={1125}
                    className="aspect-[4/5] w-full object-cover"
                    priority
                  />
                </div>
                <div className="flex flex-col justify-center">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-forest/20"
                      style={{ backgroundColor: product.colorHex }}
                      aria-hidden
                    />
                    <p className="text-[0.68rem] tracking-[0.2em] uppercase text-forest/45">
                      {product.colorName} · {product.tagline}
                    </p>
                  </div>
                  <h2 className="mt-3 font-display text-3xl tracking-[0.04em] text-forest sm:text-4xl">
                    {product.name}
                  </h2>
                  <p className="mt-4 text-sm font-light leading-7 text-forest/70">
                    {product.description}
                  </p>
                  <p className="mt-3 text-xs text-forest/50">
                    Shopify handle:{" "}
                    <code className="text-forest/70">{product.shopifyHandle}</code>
                  </p>
                  {buyUrl ? (
                    <a
                      href={buyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ink mt-8 w-fit"
                    >
                      Buy {product.shortName} on Shopify
                    </a>
                  ) : (
                    <a
                      href={`#${product.slug}`}
                      className="btn-ink mt-8 w-fit opacity-80"
                      title="Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN for live checkout"
                    >
                      Buy {product.shortName} (link pending)
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
            Create an account, scan pages to your cloud library, then generate a
            practice exam or flashcards from selected notes.
          </p>
          <Link href="/study" className="btn-ink mt-6 inline-flex">
            Study with Arzive
          </Link>
        </div>
      </section>
    </main>
  );
}
