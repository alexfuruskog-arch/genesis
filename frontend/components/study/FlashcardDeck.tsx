"use client";

import { useEffect, useMemo, useState } from "react";

import { rateFlashcard, type CardRating, type Flashcard, type FlashcardRating } from "@/lib/api";

type Props = {
  sessionId: string;
  cards: Flashcard[];
  history?: FlashcardRating[];
  authHeaders?: Record<string, string>;
};

function latestRatings(history: FlashcardRating[]): Record<string, CardRating> {
  const ratings: Record<string, CardRating> = {};
  for (const item of history) {
    ratings[item.card_id] = item.rating;
  }
  return ratings;
}

export function FlashcardDeck({ sessionId, cards, history = [], authHeaders }: Props) {
  const [deck, setDeck] = useState<Flashcard[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState<Record<string, CardRating>>(() => latestRatings(history));
  const [roundOver, setRoundOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stillLearning = useMemo(
    () => deck.filter((card) => ratings[card.id] === "still_learning"),
    [deck, ratings],
  );
  const knownCount = deck.filter((card) => ratings[card.id] === "know").length;
  const card = deck[index];

  useEffect(() => {
    setDeck(cards);
    setIndex(0);
    setFlipped(false);
    setRatings(latestRatings(history));
    setRoundOver(false);
  }, [sessionId]);

  if (!card && !roundOver) {
    return (
      <p className="text-sm font-light text-forest/60">No flashcards in this deck.</p>
    );
  }

  async function rate(rating: CardRating) {
    if (!card || busy) return;
    setBusy(true);
    setError(null);
    try {
      await rateFlashcard(sessionId, card.id, rating, authHeaders);
      setRatings((current) => ({ ...current, [card.id]: rating }));
      const nextIndex = index + 1;
      if (nextIndex >= deck.length) {
        setRoundOver(true);
      } else {
        setIndex(nextIndex);
        setFlipped(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that rating.");
    } finally {
      setBusy(false);
    }
  }

  function startNextRound() {
    const remaining = deck.filter((item) => ratings[item.id] !== "know");
    if (!remaining.length) return;
    setDeck(remaining);
    setIndex(0);
    setFlipped(false);
    setRoundOver(false);
  }

  if (roundOver) {
    const remaining = stillLearning.length;
    return (
      <div className="border border-forest/10 bg-cream px-4 py-5">
        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">Deck</p>
        <p className="mt-2 font-display text-xl text-forest">
          {remaining === 0 ? "You know this deck." : "Round complete."}
        </p>
        <p className="mt-2 text-sm font-light leading-6 text-forest/70">
          {knownCount} known · {remaining} still learning
        </p>
        {remaining > 0 ? (
          <button type="button" onClick={startNextRound} className="btn-ink mt-4">
            Next round · {remaining} still learning
          </button>
        ) : (
          <p className="mt-3 text-sm font-light text-forest/60">
            Every card in this round is marked Know.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">
        Flashcards · {index + 1} / {deck.length}
      </p>
      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        className="mt-3 w-full bg-cream px-4 py-8 text-left transition hover:bg-white"
      >
        <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/45">
          {flipped ? "Back" : "Front"} · tap to flip
        </p>
        <p className="mt-3 text-base leading-7 text-forest">{flipped ? card.back : card.front}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void rate("know")}
          className="bg-forest px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.14em] text-cream disabled:opacity-45"
        >
          Know
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void rate("still_learning")}
          className="border border-forest/25 px-4 py-2.5 text-[0.62rem] uppercase tracking-[0.14em] text-forest disabled:opacity-45"
        >
          Still learning
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-800">{error}</p> : null}
    </div>
  );
}
