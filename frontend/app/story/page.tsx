import Link from "next/link";

export default function StoryPage() {
  return (
    <main className="bg-forest text-cream">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center px-5 py-20 sm:px-8">
        <p className="font-display text-sm tracking-[0.28em] text-cream/75">
          ARZIVE
        </p>
        <h1 className="mt-6 font-display text-4xl leading-tight tracking-[0.02em] sm:text-5xl">
          Tools that respect how students actually learn.
        </h1>
        <p className="mt-6 text-base font-light leading-7 text-cream/72 sm:text-lg sm:leading-8">
          ARZIVE makes research-backed notebooks — Cornell for structured notes,
          Math for problem-solving — and Study with Arzive, where scanned pages
          become practice exams and flashcards. One brand: buy the tools, then
          study with them.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/shop" className="btn-solid">
            Shop notebooks
          </Link>
          <Link href="/study" className="btn-ghost">
            Study with Arzive
          </Link>
        </div>
      </section>
    </main>
  );
}
