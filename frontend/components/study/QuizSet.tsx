"use client";

import { useState } from "react";

import type { QuizQuestion } from "@/lib/api";

export function QuizSet({ questions }: { questions: QuizQuestion[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});

  if (!questions.length) {
    return <p className="text-forest/60">No questions could be made from this file.</p>;
  }

  const answered = questions.filter((q) => answers[q.id] !== undefined);
  const correct = answered.filter((q) => answers[q.id] === q.correct_index).length;
  const done = answered.length === questions.length;

  return (
    <div>
      <p className="text-sm text-forest/60">
        {done
          ? `You got ${correct} of ${questions.length} right.`
          : `${answered.length} of ${questions.length} answered`}
      </p>
      <ol className="mt-3 space-y-4">
        {questions.map((question, index) => {
          const selectedAnswer = answers[question.id];
          const revealed = selectedAnswer !== undefined;
          const gotIt = revealed && selectedAnswer === question.correct_index;
          return (
            <li key={question.id} className="border border-forest/10 bg-white p-4">
              <p className="font-medium leading-6">
                {index + 1}. {question.question}
              </p>
              <ul className="mt-3 space-y-2">
                {question.choices.map((choice, choiceIndex) => {
                  const isSelected = selectedAnswer === choiceIndex;
                  const isCorrect = question.correct_index === choiceIndex;
                  let tone = "border-forest/15 hover:border-forest/45";
                  if (revealed && isCorrect) tone = "border-forest bg-forest text-cream";
                  else if (revealed && isSelected) tone = "border-red-300 bg-red-50 text-red-900";
                  else if (revealed) tone = "border-forest/10 text-forest/55";
                  return (
                    <li key={choiceIndex}>
                      <button
                        type="button"
                        disabled={revealed}
                        aria-pressed={isSelected}
                        onClick={() =>
                          setAnswers((current) => ({ ...current, [question.id]: choiceIndex }))
                        }
                        className={`w-full border px-3 py-2.5 text-left text-[0.95rem] transition disabled:cursor-default ${tone}`}
                      >
                        {choice}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {revealed ? (
                <p className="mt-3 text-[0.95rem] leading-6 text-forest/75">
                  <span className={`font-medium ${gotIt ? "text-forest" : "text-red-800"}`}>
                    {gotIt ? "Correct. " : "Not quite. "}
                  </span>
                  {question.explanation}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
      {done ? (
        <button type="button" className="btn-line mt-4" onClick={() => setAnswers({})}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
