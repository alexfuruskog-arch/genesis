"use client";

import { useState } from "react";

import type { QuizQuestion } from "@/lib/api";

export function QuizSet({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  if (!questions.length) {
    return <p className="text-sm font-light text-forest/60">No quiz questions in this set.</p>;
  }

  return (
    <div>
      <p className="text-[0.62rem] uppercase tracking-[0.14em] text-forest/50">
        Quiz · {questions.length} questions
      </p>
      <ol className="mt-3 space-y-4">
        {questions.map((question, index) => {
          const selectedAnswer = answers[question.id];
          const revealed = selectedAnswer !== undefined;
          return (
            <li key={question.id} className="bg-cream p-4">
              <p className="text-sm font-medium text-forest">
                {index + 1}. {question.question}
              </p>
              <ul className="mt-3 space-y-2">
                {question.choices.map((choice, choiceIndex) => {
                  const isSelected = selectedAnswer === choiceIndex;
                  const isCorrect = question.correct_index === choiceIndex;
                  let tone = "bg-white hover:bg-cream-soft";
                  if (revealed && isCorrect) tone = "bg-forest text-cream";
                  else if (revealed && isSelected) tone = "bg-red-50 text-red-900";
                  return (
                    <li key={choiceIndex}>
                      <button
                        type="button"
                        onClick={() =>
                          setAnswers((current) => ({
                            ...current,
                            [question.id]: choiceIndex,
                          }))
                        }
                        className={`w-full px-3 py-2.5 text-left text-sm ${tone}`}
                      >
                        {choice}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {revealed ? (
                <p className="mt-3 text-sm font-light text-forest/70">{question.explanation}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
