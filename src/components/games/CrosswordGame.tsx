"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Eye } from "lucide-react";
import type { CrosswordBoard } from "@/data/gameContent";

/**
 * Cells are shared between an across and a down entry, so the answer state is
 * keyed by coordinate rather than by word — typing a letter has to satisfy both
 * clues at once, which is the whole point of a crossword.
 */
export function CrosswordGame({
  board,
  onComplete,
}: {
  board: CrosswordBoard;
  onComplete: (score: number) => void;
}) {
  const [cells, setCells] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  /** Which letter belongs in each coordinate, and which clue numbers start there. */
  const { solution, starts } = useMemo(() => {
    const sol: Record<string, string> = {};
    const st: Record<string, number[]> = {};
    for (const e of board.entries) {
      (st[`${e.row}:${e.col}`] ??= []).push(e.number);
      for (let i = 0; i < e.answer.length; i++) {
        const r = e.direction === "across" ? e.row : e.row + i;
        const c = e.direction === "across" ? e.col + i : e.col;
        sol[`${r}:${c}`] = e.answer[i];
      }
    }
    return { solution: sol, starts: st };
  }, [board]);

  const keys = Object.keys(solution);
  const correctCount = keys.filter((k) => (cells[k] ?? "") === solution[k]).length;
  const done = correctCount === keys.length;

  function setCell(key: string, value: string) {
    const letter = value.slice(-1).toUpperCase();
    const next = { ...cells, [key]: letter };
    setCells(next);
    setChecked(false);
    if (keys.every((k) => (next[k] ?? "") === solution[k])) {
      onComplete(100);
    }
  }

  function reveal() {
    setCells({ ...solution });
    setRevealed(true);
    // Revealed puzzles still count, but only as a pass — the score has to mean
    // something or the button is just a "win" button.
    onComplete(40);
  }

  const across = board.entries.filter((e) => e.direction === "across");
  const down = board.entries.filter((e) => e.direction === "down");

  return (
    <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${board.cols}, minmax(0, 1fr))` }}
          role="group"
          aria-label="Кроссворд торы"
        >
          {Array.from({ length: board.rows * board.cols }).map((_, i) => {
            const row = Math.floor(i / board.cols);
            const col = i % board.cols;
            const key = `${row}:${col}`;
            const isCell = key in solution;
            if (!isCell) return <div key={key} className="h-8 w-8" />;

            const value = cells[key] ?? "";
            const wrong = checked && value !== "" && value !== solution[key];
            const right = checked && value === solution[key];
            const number = starts[key]?.[0];

            return (
              <div key={key} className="relative">
                {number !== undefined && (
                  <span className="pointer-events-none absolute left-0.5 top-0 z-10 text-[9px] leading-none text-slate-500">
                    {number}
                  </span>
                )}
                <input
                  ref={(el) => {
                    inputs.current[key] = el;
                  }}
                  value={value}
                  onChange={(e) => setCell(key, e.target.value)}
                  maxLength={1}
                  readOnly={revealed}
                  aria-label={`${row + 1}-жол ${col + 1}-баған`}
                  className={`h-8 w-8 rounded-md border text-center text-sm font-semibold uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                    wrong
                      ? "border-rose-400 bg-rose-500/10 text-rose-200"
                      : right
                        ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                        : "border-slate-300 bg-white text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
                  }`}
                />
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setChecked(true)} className="btn-secondary text-sm">
            <Check size={15} /> Тексеру
          </button>
          <button onClick={reveal} disabled={revealed} className="btn-ghost text-sm disabled:opacity-50">
            <Eye size={15} /> Жауаптарды көрсету
          </button>
          <span className="data-num text-micro text-slate-500 dark:text-slate-400">
            {correctCount}/{keys.length} әріп
          </span>
          {done && !revealed && (
            <span className="text-label font-semibold text-emerald-400">Кроссворд шешілді</span>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
        {[
          { title: "Көлденеңінен", list: across },
          { title: "Тігінен", list: down },
        ].map((group) =>
          group.list.length === 0 ? null : (
            <div key={group.title}>
              <p className="mb-2 text-label font-semibold text-slate-900 dark:text-white">
                {group.title}
              </p>
              <ol className="space-y-1.5">
                {group.list
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map((e) => (
                    <li key={e.number} className="text-micro text-slate-600 dark:text-slate-400">
                      <span className="data-num font-semibold text-slate-800 dark:text-slate-200">
                        {e.number}.
                      </span>{" "}
                      {e.clue}{" "}
                      <span className="text-slate-500">({e.answer.length})</span>
                    </li>
                  ))}
              </ol>
            </div>
          )
        )}
      </div>
    </div>
  );
}
