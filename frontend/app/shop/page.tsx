import Image from "next/image";
import Link from "next/link";

import { products, shopifyProductUrl } from "@/lib/products";
import { shopifyStoreDomain, shopifyStoreUrl } from "@/lib/env";

export default function ShopPage() {
  const shopHome = shopifyStoreUrl();

  return (
    <main className="bg-cream">
      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20 lg:px-10">
        <p className="text-[0.95rem] text-brass">Shop</p>
        <h1 className="mt-3 font-display text-4xl tracking-[0.03em] text-forest sm:text-5xl">
          Notebooks
        </h1>
        <p className="mt-4 max-w-2xl text-base font-light leading-7 text-forest/70">
          Cornell for structured notes. Math for problem-solving. Checkout on the
          ARZIVE shop — then Study with Arzive turns pages into practice.
        </p>

        <p className="mt-5 text-sm text-forest/55">
          Storefront{" "}
          <a href={shopHome} className="font-medium text-forest underline underline-offset-2">
            {shopifyStoreDomain}
          </a>
        </p>

        <div className="mt-14 grid gap-12 md:grid-cols-2 md:gap-8">
          {products.map((product) => {
            const buyUrl =
              shopifyProductUrl(product.shopifyHandle, shopifyStoreDomain) ||
              shopifyStoreUrl(`/products/${product.shopifyHandle}`);
            return (
              <article key={product.id} id={product.slug} className="flex flex-col">
                <div className="relative aspect-[4/5] overflow-hidden bg-[#f0ebe3]">
                  <Image
                    src={product.coverImage}
                    alt={product.name}
                    fill
                    className="object-cover transition duration-700 hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                  />
                </div>
                <div className="mt-5 flex items-center gap-3 text-[0.95rem] text-brass">
                  <span
                    className="inline-block h-3.5 w-3.5 rounded-full border border-forest/20"
                    style={{ background: product.colorHex }}
                  />
                  {product.tagline}
                </div>
                <h2 className="mt-3 font-display text-3xl tracking-[0.03em] text-forest">
                  {product.name}
                </h2>
                <p className="mt-3 max-w-md text-sm font-light leading-6 text-forest/70">
                  {product.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a href={buyUrl} className="btn-ink">
                    Shop the {product.shortName} Notebook
                  </a>
                  <Link href="/study" className="btn-line">
                    Study with Arzive
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
