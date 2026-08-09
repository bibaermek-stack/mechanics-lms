"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import type { SpeedQuizBoard } from "@/data/gameContent";

/**
 * The lesson's quiz under a clock.
 *
 * Distinct from the Викторина tab, which is untimed and explains every answer.
 * Here the clock is the mechanic, so the score mixes accuracy with how much
 * time was left — and because both players of a duel get the same shuffled
 * questions from the same seed, it is the fairest of the ten to compete on.
 */
export function SpeedQuizGame({
  board,
  onComplete,
}: {
  board: SpeedQuizBoard;
  onComplete: (score: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(board.perQuestion);
  const [points, setPoints] = useState(0);
  const [finished, setFinished] = useState(false);
  const [correct, setCorrect] = useState(0);
  // Guards the advance so a click and a timeout cannot both fire it.
  const locked = useRef(false);

  const total = board.questions.length;
  const q = board.questions[index];

  const advance = useCallback(
    (gained: number, wasCorrect: boolean) => {
      if (locked.current) return;
      locked.current = true;
      const nextPoints = points + gained;
      setPoints(nextPoints);
      if (wasCorrect) setCorrect((c) => c + 1);

      setTimeout(() => {
        if (index === total - 1) {
          setFinished(true);
          // Ceiling is perQuestion points per question: full marks means every
          // answer right and answered instantly.
          onComplete(Math.round((nextPoints / (total * board.perQuestion)) * 100));
        } else {
          setIndex((i) => i + 1);
          setPicked(null);
          setLeft(board.perQuestion);
          locked.current = false;
        }
      }, 700);
    },
    [board.perQuestion, index, onComplete, points, total]
  );

  // One ticker per question; it restarts when `index` changes.
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => {
      setLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          advance(0, false); // ran out — no points, counts as wrong
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [index, finished, advance]);

  function choose(i: number) {
    if (picked !== null || locked.current) return;
    setPicked(i);
    const hit = i === q.correctIndex;
    // Points equal the seconds remaining, so speed and accuracy both count.
    advance(hit ? Math.max(1, left) : 0, hit);
  }

  if (finished) {
    return (
      <div className="rounded-2xl border border-slate-200/70 p-8 text-center dark:border-white/10">
        <p className="text-h2 text-slate-900 dark:text-white">
          {correct}/{total}
        </p>
        <p className="mt-1 text-label text-slate-600 dark:text-slate-400">
          Жинаған ұпай: {points} / {total * board.perQuestion}
        </p>
      </div>
    );
  }

  const urgent = left <= 5;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="data-num text-micro text-slate-500 dark:text-slate-400">
          {index + 1}/{total}
        </span>
        <span
          className={`flex items-center gap-1.5 text-label font-semibold transition-colors ${
            urgent ? "text-rose-400" : "text-slate-600 dark:text-slate-300"
          }`}
          role="timer"
          aria-live="off"
        >
          <Timer size={15} />
          <span className="data-num">{left} с</span>
        </span>
      </div>

      {/* Time bar. Width is state-driven, not animated, so reduced-motion users
          get the same information without a moving element. */}
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${
            urgent ? "bg-rose-400" : "bg-brand-500"
          }`}
          style={{ width: `${(left / board.perQuestion) * 100}%` }}
        />
      </div>

      <p className="text-body font-medium text-slate-900 dark:text-white">{q.question}</p>

      <div className="grid gap-2">
        {q.options.map((opt, i) => {
          const show = picked !== null;
          const isAnswer = i === q.correctIndex;
          const isPicked = picked === i;
          return (
            <button
              key={opt}
              onClick={() => choose(i)}
              disabled={show}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                show && isAnswer
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                  : show && isPicked
                    ? "border-rose-400 bg-rose-500/10 text-rose-100"
                    : "border-slate-200 text-slate-800 hover:border-brand-400 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <p className="data-num text-micro text-slate-500 dark:text-slate-400">Ұпай: {points}</p>
    </div>
  );
}
