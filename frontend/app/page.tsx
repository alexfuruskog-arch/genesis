"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { products, shopifyProductUrl } from "@/lib/products";
import { shopifyStoreDomain } from "@/lib/env";

type Tab = "cornell" | "math";

const gallery = {
  cornell: [
    { src: "/products/cornell-pages.jpg", alt: "Cornell notebook open pages" },
    { src: "/products/notebook-green.jpg", alt: "ARZIVE green notebook cover" },
    { src: "/products/notebook-cream.jpg", alt: "ARZIVE cream notebook cover" },
  ],
  math: [
    { src: "/products/math-pages.jpg", alt: "Math notebook open pages" },
    { src: "/products/notebook-green.jpg", alt: "ARZIVE green notebook cover" },
    { src: "/products/notebook-cream.jpg", alt: "ARZIVE cream notebook cover" },
  ],
} as const;

export default function HomePage() {
  const [active, setActive] = useState<Tab>("cornell");
  const product = products.find((item) => item.id === active) ?? products[0];
  const buyUrl = shopifyProductUrl(product.shopifyHandle, shopifyStoreDomain);
  const images = gallery[active];

  return (
    <main className="bg-forest text-cream">
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20 lg:px-10">
        <div className="max-w-3xl animate-soft-in">
          <p className="font-display text-[0.95rem] tracking-[0.28em] text-cream/85 sm:text-base">
            ARZIVE
          </p>
          <h1 className="animate-fade-up mt-5 font-display text-[2.35rem] leading-[1.12] tracking-[0.01em] text-cream sm:text-[3.15rem] sm:leading-[1.1] lg:text-[3.5rem]">
            We believe every student deserves the tools to succeed.
          </h1>
          <p className="animate-fade-up-delay mt-6 max-w-xl text-[0.98rem] font-light leading-7 text-cream/72 sm:text-lg sm:leading-8">
            Two research-backed notebooks. One for structured thinking, one for
            mathematical clarity — crafted from recycled materials that feel as
            considered as the systems inside.
          </p>
          <div className="animate-fade-up-delay mt-9 flex flex-wrap gap-3">
            <Link href="/shop" className="btn-solid">
              Shop notebooks
            </Link>
            <Link href="/story" className="btn-ghost">
              Our story
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-10">
        <div className="flex items-center gap-8 sm:gap-10">
          {(["cornell", "math"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              className={`pb-2 text-[0.7rem] tracking-[0.24em] uppercase transition ${
                active === tab
                  ? "border-b border-cream text-cream"
                  : "border-b border-transparent text-cream/45 hover:text-cream/75"
              }`}
            >
              {tab === "cornell" ? "Cornell" : "Math"}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
          {images.map((image, index) => (
            <figure
              key={`${active}-${image.src}`}
              className="animate-soft-in overflow-hidden bg-forest-mid/35"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Image
                src={image.src}
                alt={image.alt}
                width={1024}
                height={1024}
                className="aspect-[4/5] w-full object-cover transition duration-700 ease-out hover:scale-[1.03]"
                priority={index === 0}
              />
            </figure>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-lg">
            <h2 className="font-display text-2xl tracking-[0.06em] text-cream">
              {product.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-cream/65">
              {product.description}
            </p>
          </div>
          {buyUrl ? (
            <a href={buyUrl} target="_blank" rel="noreferrer" className="btn-solid w-fit">
              Shop notebooks
            </a>
          ) : (
            <Link href="/shop" className="btn-solid w-fit">
              Shop notebooks
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
