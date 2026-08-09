"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import type { WordSearchBoard } from "@/data/gameContent";

/**
 * Selection is click-start then click-end rather than drag: a drag across a
 * grid is unreliable on a touchscreen and impossible with a keyboard, and the
 * two-tap version needs no pointer capture at all. The line between the two
 * cells has to be straight — horizontal, vertical or 45° — which is exactly
 * the set of directions the board was built with.
 */
export function WordSearchGame({
  board,
  onComplete,
}: {
  board: WordSearchBoard;
  onComplete: (score: number) => void;
}) {
  const [anchor, setAnchor] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<Record<string, [number, number][]>>({});
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);

  /** Every cell that belongs to an already-found word. */
  const foundCells = useMemo(() => {
    const s = new Set<string>();
    for (const path of Object.values(found)) for (const [r, c] of path) s.add(`${r}:${c}`);
    return s;
  }, [found]);

  function cellsBetween(a: [number, number], b: [number, number]): [number, number][] | null {
    const dr = b[0] - a[0];
    const dc = b[1] - a[1];
    const len = Math.max(Math.abs(dr), Math.abs(dc));
    if (len === 0) return null;
    // Straight line only: pure row, pure column, or a true diagonal.
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    const sr = Math.sign(dr);
    const sc = Math.sign(dc);
    return Array.from({ length: len + 1 }, (_, i) => [a[0] + sr * i, a[1] + sc * i] as [number, number]);
  }

  function click(r: number, c: number) {
    if (!anchor) {
      setAnchor([r, c]);
      return;
    }
    const path = cellsBetween(anchor, [r, c]);
    setAnchor(null);
    if (!path) return;

    const text = path.map(([pr, pc]) => board.grid[pr][pc]).join("");
    // Accept either reading direction so the player does not have to guess
    // which end the word starts at.
    const reversed = [...text].reverse().join("");
    const hit = board.words.find(
      (w) => !found[w.word] && (w.word === text || w.word === reversed)
    );

    if (hit) {
      const next = { ...found, [hit.word]: path };
      setFound(next);
      setFlash("hit");
      if (Object.keys(next).length === board.words.length) {
        onComplete(100);
      }
    } else {
      setFlash("miss");
    }
    setTimeout(() => setFlash(null), 400);
  }

  const remaining = board.words.length - Object.keys(found).length;

  return (
    <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
      <div className="overflow-x-auto">
        <div
          className="inline-grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}
          role="group"
          aria-label="Сөз табу торы"
        >
          {board.grid.map((row, r) =>
            row.map((letter, c) => {
              const isFound = foundCells.has(`${r}:${c}`);
              const isAnchor = anchor?.[0] === r && anchor?.[1] === c;
              return (
                <button
                  key={`${r}:${c}`}
                  onClick={() => click(r, c)}
                  aria-label={`${r + 1}-жол ${c + 1}-баған, әріп ${letter}`}
                  className={`h-7 w-7 rounded-md text-xs font-semibold uppercase transition-colors ${
                    isFound
                      ? "bg-emerald-500/25 text-emerald-100"
                      : isAnchor
                        ? "bg-brand-500 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-brand-100 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  }`}
                >
                  {letter}
                </button>
              );
            })
          )}
        </div>
        <p
          className="mt-3 text-micro text-slate-500 dark:text-slate-400"
          role="status"
          aria-live="polite"
        >
          {anchor
            ? "Енді сөздің соңғы әрпін бас."
            : flash === "hit"
              ? "Табылды."
              : flash === "miss"
                ? "Бұл жерде сөз жоқ."
                : "Сөздің бірінші, сосын соңғы әрпін бас."}
        </p>
      </div>

      <div>
        <p className="mb-2 text-label font-semibold text-slate-900 dark:text-white">
          Табу керек {remaining > 0 ? `(${remaining} қалды)` : "— бәрі табылды"}
        </p>
        <ul className="space-y-1.5">
          {board.words.map((w) => {
            const isFound = Boolean(found[w.word]);
            return (
              <li
                key={w.word}
                className={`flex items-center gap-2 text-micro transition-colors ${
                  isFound
                    ? "text-emerald-400 line-through"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {isFound && <Check size={13} className="shrink-0" />}
                <span className="font-semibold uppercase">{w.word}</span>
                {w.label !== w.word && <span className="text-slate-500">— {w.label}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
