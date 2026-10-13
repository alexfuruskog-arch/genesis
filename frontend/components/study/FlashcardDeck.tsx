"use client";

import { useMemo, useState } from "react";

import { friendlyError } from "@/lib/errors";
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


  if (!card && !roundOver) {
    return (
      <p className="text-forest/60">No flashcards could be made from this file.</p>
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
      setError(friendlyError(err, "Could not save that. Try again."));
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
      <div className="border border-forest/10 bg-white px-4 py-5">
        <p className="mt-2 font-display text-xl text-forest">
          {remaining === 0 ? "You know every card in this deck." : "Round complete"}
        </p>
        <p className="mt-2 text-[0.95rem] leading-6 text-forest/70">
          {knownCount} known, {remaining} still learning
        </p>
        {remaining > 0 ? (
          <button type="button" onClick={startNextRound} className="btn-ink mt-4">
            Practise the {remaining} you&apos;re still learning
          </button>
        ) : (
          <p className="mt-3 text-[0.95rem] text-forest/60">Come back tomorrow to check it stuck.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-forest/60">
        Card {index + 1} of {deck.length}
      </p>
      <button
        type="button"
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? "Show the question" : "Show the answer"}
        className="ruled mt-2 min-h-[9rem] w-full border border-forest/15 bg-white px-5 py-6 text-left transition hover:border-forest/40"
      >
        <p className="text-sm text-brass">{flipped ? "Answer" : "Question"}</p>
        <p className="mt-2 text-[1.05rem] leading-8 text-forest">{flipped ? card.back : card.front}</p>
        <p className="mt-3 text-sm text-forest/45">{flipped ? "Tap to see the question" : "Tap to see the answer"}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void rate("know")}
          className="btn-ink"
        >
          I know this
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void rate("still_learning")}
          className="btn-line"
        >
          Still learning
        </button>
      </div>
      {error ? <p className="mt-3 text-[0.95rem] text-red-800">{error}</p> : null}
    </div>
  );
}
