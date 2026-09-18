"use client";

import { useMemo, useState } from "react";

import type { QuizQuestion, QuizResponse } from "@/lib/api";

type Props = {
  quiz: QuizResponse | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  canGenerate: boolean;
};

export function QuizBoard({ quiz, loading, error, onGenerate, canGenerate }: Props) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const score = useMemo(() => {
    if (!quiz) return null;
    const answered = quiz.questions.filter((question) => answers[question.id] !== undefined);
    if (answered.length === 0) return null;
    const correct = answered.filter(
      (question) => answers[question.id] === question.correct_index,
    ).length;
    return { correct, total: answered.length };
  }, [answers, quiz]);

  function choose(question: QuizQuestion, index: number) {
    setAnswers((current) => ({ ...current, [question.id]: index }));
  }

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Quiz</h2>
          <p className="text-sm text-ink/65">
            Frågorna byggs från de mest relevanta chunkarna i dokumentet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            onGenerate();
          }}
          disabled={!canGenerate || loading}
          className="inline-flex items-center justify-center rounded-xl bg-copper px-4 py-2.5 text-sm font-semibold text-white hover:bg-copper/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Skapar frågor…" : "Generera quiz"}
        </button>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white/70 px-4 py-10 text-center text-sm text-ink/70">
          Plugga hämtar chunkar och ber språkmodellen om frågor…
        </div>
      ) : null}

      {!loading && !quiz && !error ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white/70 px-4 py-10 text-center">
          <p className="font-medium">Inget quiz ännu</p>
          <p className="mt-1 text-sm text-ink/65">
            Ladda upp anteckningar och tryck på generera. Utan API-nyckel får du
            mock-frågor så att flödet går att prova.
          </p>
        </div>
      ) : null}

      {quiz && !loading ? (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wide text-ink/50">
            {quiz.provider} · {quiz.retrieval.chunk_count} chunkar · {quiz.store}
            {score ? ` · ${score.correct}/${score.total} rätt hittills` : ""}
          </p>
          <ol className="space-y-4">
            {quiz.questions.map((question, index) => {
              const selected = answers[question.id];
              const revealed = selected !== undefined;
              return (
                <li
                  key={question.id}
                  className="rounded-2xl border border-ink/8 bg-white p-4 shadow-sm"
                >
                  <p className="text-sm font-medium">
                    {index + 1}. {question.question}
                  </p>
                  <ul className="mt-3 space-y-2">
                    {question.choices.map((choice, choiceIndex) => {
                      const isSelected = selected === choiceIndex;
                      const isCorrect = question.correct_index === choiceIndex;
                      let tone = "border-ink/10 bg-paper hover:border-copper/40";
                      if (revealed && isCorrect) {
                        tone = "border-emerald-600 bg-emerald-50";
                      } else if (revealed && isSelected) {
                        tone = "border-red-400 bg-red-50";
                      }
                      return (
                        <li key={choiceIndex}>
                          <button
                            type="button"
                            onClick={() => choose(question, choiceIndex)}
                            className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${tone}`}
                          >
                            {choice}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {revealed ? (
                    <p className="mt-3 text-sm text-ink/70">{question.explanation}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
