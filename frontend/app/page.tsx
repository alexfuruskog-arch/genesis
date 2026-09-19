"use client";

import Image from "next/image";
import Link from "next/link";

import { shopifyStoreDomain } from "@/lib/env";
import { products, shopifyProductUrl } from "@/lib/products";

function shopBase() {
  const domain = (shopifyStoreDomain || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return domain ? `https://${domain}` : null;
}

export default function HomePage() {
  const shop = shopBase();
  const cornell = products.find((p) => p.id === "cornell")!;
  const math = products.find((p) => p.id === "math")!;
  const cornellUrl =
    shopifyProductUrl(cornell.shopifyHandle, shopifyStoreDomain) || "/shop#cornell";
  const mathUrl =
    shopifyProductUrl(math.shopifyHandle, shopifyStoreDomain) || "/shop#math";

  return (
    <main className="bg-cream text-forest">
      <section className="grid lg:grid-cols-2 lg:min-h-[min(88vh,52rem)]">
        <div className="relative min-h-[28rem] overflow-hidden bg-cream-soft">
          <Image
            src="/products/notebook-cream.jpg"
            alt="Cream Cornell Notebook lifestyle"
            fill
            className="object-cover"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-cream/95 via-cream/40 to-transparent" />
          <div className="absolute left-5 top-5 z-10 grid h-[4.25rem] w-[4.25rem] place-items-center rounded-full bg-[#c4a574] text-center text-[0.55rem] font-semibold uppercase leading-tight tracking-wide text-[#1a1510] shadow-lg sm:left-6 sm:top-6">
            3M+
            <br />
            pages
            <br />
            studied
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-10">
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-forest/70">
              Cream Cornell
            </p>
            <h1 className="mt-3 max-w-md font-display text-[1.85rem] leading-[1.15] tracking-[0.01em] sm:text-[2.35rem]">
              Join students striving for top grades
            </h1>
            <p className="mt-3 max-w-sm text-sm font-light leading-6 text-forest/75">
              Cue, Main Notes, and Summary — the classic Cornell system on recycled
              cream paper.
            </p>
            <a href={cornellUrl} className="btn-ink mt-5 inline-flex">
              Shop the Cornell notebook
            </a>
          </div>
        </div>

        <div className="relative min-h-[28rem] overflow-hidden bg-forest text-cream">
          <Image
            src="/products/notebook-green.jpg"
            alt="Green Math Notebook"
            fill
            className="object-cover opacity-90"
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-forest/95 via-forest/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 z-10 p-6 sm:p-10">
            <p className="text-[0.62rem] uppercase tracking-[0.2em] text-cream/70">
              Two systems
            </p>
            <h2 className="mt-3 max-w-md font-display text-[1.85rem] leading-[1.15] sm:text-[2.35rem]">
              The notebooks teachers and students swear by
            </h2>
            <p className="mt-3 max-w-sm text-sm font-light leading-6 text-cream/72">
              Cream Cornell for structured thinking. Forest-green Math for
              problem-solving — then Study with Arzive turns pages into practice.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={mathUrl} className="btn-solid">
                Shop the Math study system
              </a>
              <Link href="/study" className="btn-ghost">
                Study with Arzive
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-forest py-4 text-cream">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 text-[0.62rem] uppercase tracking-[0.16em] text-cream/90 sm:px-8">
          <span>Trusted by students</span>
          <span>Math study system</span>
          <span>Cornell method</span>
          <span>Active recall practice</span>
        </div>
      </section>

      <section className="px-5 py-16 text-center sm:px-8 sm:py-20">
        <p className="font-display text-[0.95rem] tracking-[0.28em] text-forest/70">
          Arzive&apos;s philosophy
        </p>
        <h2 className="mx-auto mt-5 max-w-3xl font-display text-[1.85rem] leading-[1.2] sm:text-[2.65rem]">
          We believe every student deserves the tools to succeed.
        </h2>
        <p className="mt-6 text-[0.68rem] uppercase italic tracking-[0.2em] text-forest/55">
          The only notebook that teaches you how to study.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8 lg:px-10">
        <div className="text-center">
          <p className="text-[0.62rem] uppercase tracking-[0.22em] text-forest/50">
            Our notebooks
          </p>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl">
            Start with the right system
          </h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <article className="flex flex-col bg-[#f0ebe3] p-5">
            <div className="relative aspect-square overflow-hidden bg-cream">
              <Image
                src="/products/notebook-cream.jpg"
                alt="Cream Cornell"
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
            <p className="mt-4 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[#8a6b3d]">
              New
            </p>
            <h3 className="mt-2 font-display text-xl">{cornell.name}</h3>
            <p className="mt-2 flex-1 text-sm font-light leading-6 text-forest/70">
              {cornell.description}
            </p>
            <a href={cornellUrl} className="btn-ink mt-5 self-start">
              Shop Cornell
            </a>
          </article>
          <article className="flex flex-col bg-[#f0ebe3] p-5">
            <div className="relative aspect-square overflow-hidden bg-cream">
              <Image
                src="/products/notebook-green.jpg"
                alt="Green Math"
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
            <p className="mt-4 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[#8a6b3d]">
              New
            </p>
            <h3 className="mt-2 font-display text-xl">{math.name}</h3>
            <p className="mt-2 flex-1 text-sm font-light leading-6 text-forest/70">
              {math.description}
            </p>
            <a href={mathUrl} className="btn-ink mt-5 self-start">
              Shop Math
            </a>
          </article>
          <article className="flex flex-col bg-[#f0ebe3] p-5">
            <div className="relative aspect-square overflow-hidden bg-cream">
              <Image
                src="/products/notebook-cream.jpg"
                alt="Study with Arzive"
                fill
                className="object-cover opacity-90"
                sizes="33vw"
              />
              <div className="absolute inset-0 bg-forest/55" />
              <p className="absolute inset-0 grid place-items-center px-4 text-center font-display text-2xl text-cream">
                Study with Arzive
              </p>
            </div>
            <p className="mt-4 text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-[#8a6b3d]">
              Digital
            </p>
            <h3 className="mt-2 font-display text-xl">From page to practice</h3>
            <p className="mt-2 flex-1 text-sm font-light leading-6 text-forest/70">
              Scan notebook pages under your account. Generate practice exams and
              flashcards that force active recall — not passive rereading.
            </p>
            <Link href="/pricing" className="btn-ink mt-5 self-start">
              See Study plans
            </Link>
          </article>
        </div>
      </section>

      <section className="bg-forest px-5 py-16 text-cream sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl sm:text-4xl">
            Read once. Recall hard. Remember longer.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base font-light leading-7 text-cream/72">
            ARZIVE notebooks teach structure on paper. Study with Arzive closes the
            loop: capture what you wrote, practice what you forget, walk into exams
            ready.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/study" className="btn-solid">
              Open Study
            </Link>
            <Link href="/pricing" className="btn-ghost">
              Pricing
            </Link>
          </div>
        </div>
      </section>

      {shop ? (
        <p className="sr-only">Shopify storefront {shop}</p>
      ) : null}
    </main>
  );
}
