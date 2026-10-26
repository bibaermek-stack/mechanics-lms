"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { DailyBoard } from "@/data/daily";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Five questions, one at a time, each explained once answered. The score is the
 * share answered right — speed plays no part, because this is the one game meant
 * to be done every day, calmly, and a clock would turn it into a chore.
 *
 * The keys 1–4 pick an option and Enter moves on.
 */
export function DailyChallenge({
  board,
  onComplete,
}: {
  board: DailyBoard;
  onComplete: (score: number) => void;
}) {
  const total = board.questions.length;
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  const q = board.questions[index];

  function pick(i: number) {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correctIndex) setCorrect((c) => c + 1);
  }

  function next() {
    if (index === total - 1) {
      setDone(true);
      onComplete(Math.round((100 * correct) / total));
    } else {
      setIndex((i) => i + 1);
      setPicked(null);
    }
  }

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const n = Number(e.key);
      if (picked === null && Number.isInteger(n) && n >= 1 && n <= q.options.length) pick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `pick` closes over the current question and answer state, which are the deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, picked, index]);

  useEffect(() => {
    if (picked !== null) nextRef.current?.focus({ preventScroll: true });
  }, [picked]);

  if (done) {
    const score = Math.round((100 * correct) / total);
    return (
      <div className="rounded-2xl border border-slate-200/70 p-8 text-center dark:border-white/10">
        <p className="text-h2 text-slate-900 dark:text-white">
          {correct} / {total}
        </p>
        <p className="mt-1 text-label text-slate-600 dark:text-slate-400">{score} ұпай</p>
        <p className="mt-3 text-body text-slate-600 dark:text-slate-400">
          {correct === total
            ? "Бес бестік! Ертең жаңа сұрақтармен кездесеміз."
            : correct >= 3
              ? "Жақсы. Қателескен сұрақтардың түсіндірмесін қайта оқып шық."
              : "Ештеңе етпейді — әр күн жаңа мүмкіндік. Қиын тақырыптарды сабақтан қайталап көр."}
        </p>
      </div>
    );
  }

  const isRight = picked !== null && picked === q.correctIndex;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className="data-num text-micro text-slate-500 dark:text-slate-400">
          {index + 1} / {total}
        </span>
        <span className="data-num text-micro text-slate-500 dark:text-slate-400">Дұрыс: {correct}</span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${index + 1} / ${total}`}>
        {board.questions.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-brand-500" : "bg-slate-200 dark:bg-white/10"}`} />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/70 p-5 dark:border-white/10">
        <p className="text-body font-medium text-slate-900 dark:text-white">{q.question}</p>
      </div>

      <div className="grid gap-2" role="group" aria-label="Жауап нұсқалары">
        {q.options.map((o, i) => {
          const chosen = picked === i;
          const right = picked !== null && i === q.correctIndex;
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={picked !== null}
              className={`flex min-h-[48px] items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                right
                  ? "border-emerald-400 bg-emerald-500/15 text-slate-900 dark:text-emerald-50"
                  : chosen
                    ? "border-rose-400 bg-rose-500/15 text-slate-900 dark:text-rose-50"
                    : "border-slate-200 text-slate-800 hover:border-brand-400 disabled:hover:border-slate-200 dark:border-white/10 dark:text-slate-200"
              }`}
            >
              <span className="data-num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-micro font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                {LETTERS[i]}
              </span>
              <span className="flex-1">{o}</span>
              {right && <Check size={16} className="shrink-0 text-emerald-500" aria-label="Дұрыс жауап" />}
              {chosen && !right && <X size={16} className="shrink-0 text-rose-500" aria-label="Қате" />}
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="space-y-3" role="status">
          <div
            className={`rounded-xl border p-4 text-sm ${
              isRight
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-rose-400/60 bg-rose-500/10 text-rose-900 dark:text-rose-100"
            }`}
          >
            <p className="font-semibold">{isRight ? "Дұрыс!" : "Қате."}</p>
            <p className="mt-1">{q.explanation}</p>
          </div>
          <button ref={nextRef} onClick={next} className="btn-primary w-full sm:w-auto">
            {index === total - 1 ? "Нәтижені көру" : "Келесі"} <ArrowRight size={16} />
          </button>
        </div>
      )}

      <p className="text-micro text-slate-500 dark:text-slate-400 [@media(pointer:coarse)]:hidden">
        Пернетақта: 1–{q.options.length} — жауап таңдау · Enter — келесі
      </p>
    </div>
  );
}
