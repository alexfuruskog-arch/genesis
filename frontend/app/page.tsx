"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { products, shopifyProductUrl, type Product } from "@/lib/products";
import { publicConfig, shopifyStoreDomain } from "@/lib/env";

export default function HomePage() {
  const [active, setActive] = useState<"cornell" | "math">("cornell");
  const product = products.find((item) => item.id === active) ?? products[0];

  return (
    <main>
      <section className="relative overflow-hidden bg-forest text-cream">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #f3eee4 0.8px, transparent 1px), radial-gradient(circle at 80% 60%, #f3eee4 0.7px, transparent 1px)",
            backgroundSize: "28px 28px, 36px 36px",
          }}
        />
        <div className="relative mx-auto flex min-h-[78vh] max-w-4xl flex-col items-center justify-center px-6 py-20 text-center sm:py-28">
          <p className="animate-soft-in font-display text-sm tracking-[0.35em] text-cream/80">
            ARZIVE
          </p>
          <h1 className="animate-fade-up mt-6 max-w-3xl font-display text-[2.15rem] leading-[1.15] text-cream sm:text-5xl sm:leading-[1.12]">
            We believe every student deserves the tools to succeed.
          </h1>
          <p className="animate-fade-up-delay mt-6 max-w-2xl text-base leading-7 text-cream/75 sm:text-lg">
            Two research-backed notebooks. One for structured thinking, one for
            mathematical clarity — crafted from recycled materials that feel as
            considered as the systems inside.
          </p>
          <div className="animate-fade-up-delay mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/shop" className="btn-solid">
              Shop notebooks
            </Link>
            <Link href="/story" className="btn-ghost">
              Our story
            </Link>
            <Link
              href="/study"
              className="btn-ghost border-cream/30 text-cream/90"
            >
              Study with Arzive
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-forest pb-20 pt-6 text-cream">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-center gap-10">
            {products.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id as "cornell" | "math")}
                className={`pb-2 text-xs tracking-[0.22em] uppercase transition ${
                  active === item.id
                    ? "border-b border-cream text-cream"
                    : "border-b border-transparent text-cream/55 hover:text-cream/80"
                }`}
              >
                {item.id === "cornell" ? "Cornell" : "Math"}
              </button>
            ))}
          </div>

          <ProductShowcase product={product} />
        </div>
      </section>
    </main>
  );
}

function ProductShowcase({ product }: { product: Product }) {
  const buyUrl = shopifyProductUrl(product.shopifyHandle, shopifyStoreDomain);
  return (
    <div className="mt-10 grid gap-6 md:grid-cols-2">
      <figure className="overflow-hidden bg-forest-mid/40">
        <Image
          src={product.layoutImage}
          alt={`${product.name} page layout`}
          width={1024}
          height={1024}
          className="h-full w-full object-cover transition duration-700 hover:scale-[1.02]"
          priority
        />
      </figure>
      <figure className="overflow-hidden bg-forest-mid/40">
        <Image
          src={product.coverImage}
          alt={`${product.name} cover`}
          width={1024}
          height={1024}
          className="h-full w-full object-cover transition duration-700 hover:scale-[1.02]"
          priority
        />
      </figure>
      <div className="md:col-span-2 flex flex-col items-center gap-4 pt-4 text-center">
        <h2 className="font-display text-2xl tracking-[0.08em]">{product.name}</h2>
        <p className="max-w-xl text-sm leading-6 text-cream/70">{product.description}</p>
        {buyUrl ? (
          <a href={buyUrl} target="_blank" rel="noreferrer" className="btn-solid">
            Buy on Shopify
          </a>
        ) : (
          <Link href="/shop" className="btn-solid">
            View in shop
          </Link>
        )}
        {!publicConfig.shopifyConfigured ? (
          <p className="text-xs text-cream/45">
            Set NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN for live product links.
          </p>
        ) : null}
      </div>
    </div>
  );
}
