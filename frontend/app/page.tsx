import Image from "next/image";
import Link from "next/link";

import { shopifyStoreUrl } from "@/lib/env";
import { products, shopifyProductUrl } from "@/lib/products";

const LOOP = [
  {
    cue: "Write",
    notes:
      "Take notes in a Cornell or Math notebook. The printed layout does the organising: cues on the left, notes on the right, a summary at the bottom.",
  },
  {
    cue: "Scan",
    notes:
      "Photograph a finished page, or upload the lecture slides, PDF or Word notes it came from. Everything lands in one private library.",
  },
  {
    cue: "Recall",
    notes:
      "Pick a file and Study turns it into flashcards, a short quiz, a summary or answers to your own questions — all based only on that file.",
  },
] as const;

export default function HomePage() {
  const shopUrl = shopifyStoreUrl();

  return (
    <main className="bg-cream text-forest">
      {/* Hero */}
      <section className="bg-forest text-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-20">
          <div className="rise">
            <p className="text-[0.95rem] text-brass-light">Cornell and Math notebooks</p>
            <h1 className="mt-4 font-display text-[2.6rem] leading-[1.05] sm:text-[3.4rem] lg:text-[4rem]">
              Write it once. Remember it on exam day.
            </h1>
            <p className="mt-6 max-w-md text-[1.05rem] leading-7 text-cream/75">
              Research-backed notebooks that structure every page for revision, and
              Study with Arzive to turn those pages into practice.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href={shopUrl} className="btn-solid">
                Shop notebooks
              </a>
              <Link href="/study" className="btn-ghost">
                Try Study free
              </Link>
            </div>
            <p className="mt-10 text-sm text-cream/55">3M+ pages studied by students using ARZIVE</p>
          </div>

          <div className="rise-2 relative">
            <div className="relative aspect-square overflow-hidden bg-cream-soft">
              <Image
                src="/products/cornell-pages.jpg"
                alt="An open ARZIVE Cornell notebook showing the Cues, Main Notes and Summary sections"
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
            <div className="absolute -bottom-6 -left-4 hidden w-[34%] border-4 border-forest bg-forest sm:block lg:-left-10">
              <div className="relative aspect-square">
                <Image
                  src="/products/notebook-green.jpg"
                  alt="The forest-green Math Notebook cover"
                  fill
                  className="object-cover"
                  sizes="20vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The two notebooks */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="max-w-2xl">
          <h2 className="font-display text-[2.1rem] leading-tight sm:text-[2.7rem]">
            Two notebooks, one for each kind of thinking
          </h2>
          <p className="mt-4 text-[1.05rem] leading-7 text-forest/70">
            Both use the same recycled paper and spiral binding. The difference is
            the page.
          </p>
        </div>

        <div className="mt-14 space-y-20">
          {products.map((product, index) => {
            const url =
              shopifyProductUrl(product.shopifyHandle) ||
              shopifyStoreUrl(`/products/${product.shopifyHandle}`);
            const flip = index % 2 === 1;
            return (
              <article
                key={product.id}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
              >
                <div className={`grid aspect-[16/11] grid-cols-[0.8fr_1.2fr] gap-3 ${flip ? "lg:order-2" : ""}`}>
                  <div className="relative h-full overflow-hidden bg-cream-soft">
                    <Image
                      src={product.coverImage}
                      alt={`${product.name} cover in ${product.colorName.toLowerCase()}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 40vw, 22vw"
                    />
                  </div>
                  <div className="relative h-full overflow-hidden bg-cream-soft">
                    <Image
                      src={product.layoutImage}
                      alt={`Inside pages of the ${product.name}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 60vw, 32vw"
                    />
                  </div>
                </div>
                <div className={flip ? "lg:order-1" : ""}>
                  <p className="text-[0.95rem] text-brass">{product.tagline}</p>
                  <h3 className="mt-2 font-display text-[2rem] leading-tight sm:text-[2.4rem]">
                    {product.name}
                  </h3>
                  <p className="mt-4 max-w-md text-[1.02rem] leading-7 text-forest/72">
                    {product.description}
                  </p>
                  <div className="mt-7 flex flex-wrap items-center gap-5">
                    <a href={url} className="btn-ink">
                      Shop the {product.shortName} Notebook
                    </a>
                    <span className="inline-flex items-center gap-2 text-sm text-forest/60">
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border border-forest/25"
                        style={{ background: product.colorHex }}
                        aria-hidden
                      />
                      {product.colorName} cover
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it works — laid out like a Cornell page */}
      <section className="dark bg-forest text-cream">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-[0.95rem] text-brass-light">Study with Arzive</p>
            <h2 className="mt-3 font-display text-[2.1rem] leading-tight sm:text-[2.7rem]">
              Your notes, turned into practice
            </h2>
          </div>

          <div className="cornell mt-12">
            <div className="hidden text-sm text-cream/45 md:grid md:grid-cols-[13rem_1fr]">
              <span className="py-3">Cues</span>
              <span className="py-3 pl-8">Main notes</span>
            </div>
            {LOOP.map((step) => (
              <div key={step.cue} className="cornell-row">
                <p className="cornell-cue">{step.cue}</p>
                <p className="cornell-notes max-w-2xl text-[1.05rem] leading-7 text-cream/78">
                  {step.notes}
                </p>
              </div>
            ))}
            <div className="cornell-summary">
              <p className="text-sm text-cream/45">Summary</p>
              <div className="mt-3 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <p className="max-w-xl font-display text-[1.7rem] leading-snug sm:text-[2rem]">
                  Read once. Recall hard. Remember longer.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link href="/study" className="btn-solid">
                    Open Study
                  </Link>
                  <Link href="/pricing" className="btn-ghost">
                    See plans
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="ruled px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-[2rem] leading-[1.2] sm:text-[2.7rem]">
            We believe every student deserves the tools to succeed.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[1.05rem] leading-7 text-forest/70">
            The only notebook that teaches you how to study, and a companion that
            makes sure it sticks.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={shopUrl} className="btn-ink">
              Shop notebooks
            </a>
            <a href={shopifyStoreUrl("/pages/our-story")} className="btn-line">
              Read our story
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
