"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { BlankItem } from "@/data/gameContent";

/**
 * A definition with the term it defines hidden. Answering moves to the next
 * item rather than letting the player retry: the score has to reflect what they
 * knew, and an unlimited retry turns every item into a guaranteed hit.
 */
export function FillBlankGame({
  items,
  onComplete,
}: {
  items: BlankItem[];
  onComplete: (score: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);

  const item = items[index];
  const isLast = index === items.length - 1;
  const finished = index >= items.length;

  function choose(option: string) {
    if (picked) return;
    setPicked(option);
    const hit = option === item.answer;
    const nextCorrect = correct + (hit ? 1 : 0);
    if (hit) setCorrect(nextCorrect);

    setTimeout(() => {
      if (isLast) {
        onComplete(Math.round((nextCorrect / items.length) * 100));
        setIndex(items.length);
      } else {
        setIndex((i) => i + 1);
        setPicked(null);
      }
    }, 900);
  }

  if (finished) {
    return (
      <div className="rounded-2xl border border-slate-200/70 p-8 text-center dark:border-white/10">
        <p className="text-h2 text-slate-900 dark:text-white">
          {correct}/{items.length}
        </p>
        <p className="mt-1 text-label text-slate-600 dark:text-slate-400">
          Дұрыс жауап — {Math.round((correct / items.length) * 100)}%
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between text-micro text-slate-500 dark:text-slate-400">
        <span className="data-num">
          {index + 1}/{items.length}
        </span>
        <span className="data-num">Дұрыс: {correct}</span>
      </div>

      <p className="rounded-2xl border border-slate-200/70 p-5 text-body text-slate-900 dark:border-white/10 dark:text-white">
        {item.sentence}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {item.options.map((opt) => {
          const isAnswer = opt === item.answer;
          const isPicked = picked === opt;
          const show = picked !== null;
          return (
            <button
              key={opt}
              onClick={() => choose(opt)}
              disabled={show}
              className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                show && isAnswer
                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-100"
                  : show && isPicked
                    ? "border-rose-400 bg-rose-500/10 text-rose-100"
                    : "border-slate-200 text-slate-800 hover:border-brand-400 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
              }`}
            >
              {opt}
              {show && isAnswer && <Check size={15} className="shrink-0" />}
              {show && isPicked && !isAnswer && <X size={15} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
