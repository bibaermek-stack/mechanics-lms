"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Timer, X } from "lucide-react";
import type { BlitzBoard } from "@/data/moreGames";
import { displaySymbol } from "@/data/formulas";
import { fmt } from "@/data/quizBank";

/**
 * Eight numerical problems against a clock. The numbers come from the formula
 * bank, so the right answer is the one the Problems page would also give.
 *
 * A right answer is worth half a point and the other half is the time left, so
 * getting it right matters more than getting it first — a wild guess at ten
 * seconds does not beat a careful answer at thirty.
 */
export function BlitzGame({
  board,
  onComplete,
}: {
  board: BlitzBoard;
  onComplete: (score: number) => void;
}) {
  const total = board.problems.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [left, setLeft] = useState(board.perProblem);
  const [points, setPoints] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const p = board.problems[index];
  const show = (v: number) => `${fmt(v, p.decimals)}${p.unknown.unit ? ` ${p.unknown.unit}` : ""}`;

  const reveal = useCallback(
    (choice: number | null) => {
      if (revealed || done) return;
      setPicked(choice);
      setRevealed(true);
      if (choice === p.correctIndex) {
        setCorrect((c) => c + 1);
        setPoints((x) => x + 0.5 + (0.5 * left) / board.perProblem);
      }
    },
    [board.perProblem, done, left, p.correctIndex, revealed]
  );

  useEffect(() => {
    if (revealed || done) return;
    if (left <= 0) {
      reveal(null);
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, revealed, done, reveal]);

  useEffect(() => {
    if (revealed) nextRef.current?.focus({ preventScroll: true });
  }, [revealed]);

  function next() {
    if (index === total - 1) {
      setDone(true);
      onComplete(Math.round((100 * points) / total));
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
      setRevealed(false);
      setLeft(board.perProblem);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200/70 p-8 text-center dark:border-white/10">
        <p className="text-h2 text-slate-900 dark:text-white">
          {correct}/{total}
        </p>
        <p className="mt-1 text-label text-slate-600 dark:text-slate-400">
          Ұпай: <span className="data-num font-semibold">{Math.round((100 * points) / total)}</span> / 100
        </p>
      </div>
    );
  }

  const urgent = left <= 8 && !revealed;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="data-num text-micro text-slate-500 dark:text-slate-400">
          {index + 1}/{total}
        </span>
        <span
          className={`flex items-center gap-1.5 text-label font-semibold ${urgent ? "text-rose-400" : "text-slate-600 dark:text-slate-300"}`}
          role="timer"
          aria-live="off"
        >
          <Timer size={15} />
          <span className="data-num">{revealed ? "—" : `${left} с`}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${urgent ? "bg-rose-400" : "bg-brand-500"}`}
          style={{ width: `${revealed ? 100 : (left / board.perProblem) * 100}%` }}
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200/70 p-5 dark:border-white/10">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">{p.title}</p>
          <p className="font-mono text-body font-semibold text-brand-500 dark:text-brand-300">{p.expr}</p>
        </div>
        <ul className="space-y-1 text-body text-slate-800 dark:text-slate-200">
          {p.given.map((g) => (
            <li key={g.sym}>
              <span className="font-mono font-semibold">{displaySymbol(g.sym)}</span> — {g.name.toLowerCase()} ={" "}
              <strong className="data-num">
                {fmt(g.value, 6)}
                {g.unit ? ` ${g.unit}` : ""}
              </strong>
            </li>
          ))}
        </ul>
        <p className="rounded-lg bg-brand-500/10 px-3 py-2 text-body font-medium text-slate-900 dark:text-white">
          Табу керек: <span className="font-mono">{displaySymbol(p.unknown.sym)}</span> — {p.unknown.name.toLowerCase()}
          {p.unknown.unit ? ` (${p.unknown.unit})` : ""}
        </p>
        {p.approx && (
          <p className="text-micro text-slate-500 dark:text-slate-400">
            Жауапты жүзіншіге дейін дөңгелекте, π ≈ 3,14 деп ал.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {p.options.map((o, i) => {
          const isAnswer = i === p.correctIndex;
          const isPicked = picked === i;
          return (
            <button
              key={`${index}-${i}`}
              onClick={() => reveal(i)}
              disabled={revealed}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-body font-semibold transition-colors ${
                revealed && isAnswer
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                  : revealed && isPicked
                    ? "border-rose-400 bg-rose-500/10 text-rose-900 dark:text-rose-100"
                    : "border-slate-200 text-slate-800 hover:border-brand-400 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
              }`}
            >
              {revealed && isAnswer && <Check size={16} className="shrink-0" />}
              {revealed && isPicked && !isAnswer && <X size={16} className="shrink-0" />}
              <span className="data-num">{show(o)}</span>
            </button>
          );
        })}
      </div>

      {revealed && (
        <div className="space-y-3" role="status">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {picked === null ? "Уақыт бітті. " : picked === p.correctIndex ? "Дұрыс! " : "Қате. "}
            Дұрыс жауап: <strong className="data-num">{show(p.options[p.correctIndex])}</strong>.
          </p>
          <button ref={nextRef} onClick={next} className="btn-primary w-full sm:w-auto">
            {index === total - 1 ? "Нәтижені көру" : "Келесі"} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
