"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import type { SortingBoard, TermCategory } from "@/data/gameContent";

/**
 * Classify each term as a quantity, a law, a concept or a phenomenon.
 *
 * Select-then-place instead of drag and drop: HTML5 drag does not work on
 * touch without a polyfill and is invisible to a keyboard, whereas two taps
 * work everywhere and need no library.
 */
export function SortingGame({
  board,
  onComplete,
}: {
  board: SortingBoard;
  onComplete: (score: number) => void;
}) {
  const [placed, setPlaced] = useState<Record<string, TermCategory>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);

  const remaining = board.items.filter((i) => !placed[i.term]);

  function place(category: TermCategory) {
    if (!selected) return;
    const item = board.items.find((i) => i.term === selected);
    if (!item) return;

    if (item.category === category) {
      const next = { ...placed, [item.term]: category };
      setPlaced(next);
      setSelected(null);
      if (Object.keys(next).length === board.items.length) {
        // Every term ends up in the right bucket eventually, so the score has
        // to come from how many wrong attempts it took to get there.
        const penalty = Math.min(60, mistakes * 10);
        onComplete(Math.max(40, 100 - penalty));
      }
    } else {
      setMistakes((m) => m + 1);
      setWrongFlash(category);
      setTimeout(() => setWrongFlash(null), 450);
    }
  }

  function reset() {
    setPlaced({});
    setSelected(null);
    setMistakes(0);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label text-slate-600 dark:text-slate-400">
          Терминді таңдап, оны қай санатқа жататынын бас.
        </p>
        <div className="flex items-center gap-3">
          <span className="data-num text-micro text-slate-500">Қате: {mistakes}</span>
          <button onClick={reset} className="btn-ghost text-sm">
            <RotateCcw size={14} /> Қайта бастау
          </button>
        </div>
      </div>

      {/* Unsorted pool */}
      <div className="min-h-[3.5rem] rounded-2xl border border-dashed border-slate-300/70 p-3 dark:border-white/10">
        {remaining.length === 0 ? (
          <p className="py-2 text-center text-label text-emerald-400">
            Бәрі сұрыпталды — {mistakes} қатемен.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {remaining.map((i) => (
              <button
                key={i.term}
                onClick={() => setSelected(selected === i.term ? null : i.term)}
                aria-pressed={selected === i.term}
                className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                  selected === i.term
                    ? "border-brand-400 bg-brand-500/20 text-brand-100"
                    : "border-slate-200 text-slate-800 hover:border-brand-400 dark:border-white/10 dark:text-slate-200"
                }`}
              >
                {i.term}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category buckets */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {board.categories.map((cat) => {
          const mine = board.items.filter((i) => placed[i.term] === cat);
          return (
            <button
              key={cat}
              onClick={() => place(cat)}
              disabled={!selected}
              className={`min-h-[8rem] rounded-2xl border p-3 text-left align-top transition-colors disabled:cursor-default ${
                wrongFlash === cat
                  ? "border-rose-400 bg-rose-500/10"
                  : selected
                    ? "border-brand-400/70 bg-brand-500/5 hover:bg-brand-500/10"
                    : "border-slate-200/70 dark:border-white/10"
              }`}
            >
              <span className="block text-label font-semibold text-slate-900 dark:text-white">
                {cat}
                <span className="data-num ml-1.5 text-micro font-normal text-slate-500">
                  {mine.length}
                </span>
              </span>
              <span className="mt-2 flex flex-wrap gap-1.5">
                {mine.map((i) => (
                  <span
                    key={i.term}
                    className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-100"
                  >
                    {i.term}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
