"use client";

import { useMemo, useState } from "react";
import { seededRandom, seededShuffle } from "@/lib/rng";
import type { GamePair } from "@/lib/types";

// Matching game: put each "right" label on its matching "left" zone.
//
// HTML5 drag-and-drop is the mouse path, but it is not dependable on a
// touchscreen — Android and iOS only start a drag after a long press, and many
// in-app browsers never do — so the same state also answers to taps: tap a
// card to pick it up, tap a zone to put it down. Cards and zones are buttons,
// which also makes the game reachable from a keyboard.
export function DragDropGame({
  pairs,
  onComplete,
  seed = 1,
}: {
  pairs: GamePair[];
  onComplete: (score: number) => void;
  /** Fixes the draggable order; the router passes the lesson or duel seed. */
  seed?: number;
}) {
  const draggables = useMemo(
    () => seededShuffle(pairs.map((p) => p.right), seededRandom(seed)),
    [pairs, seed]
  );
  const [placed, setPlaced] = useState<Record<string, string>>({});
  // The card in hand — dragged with a mouse or picked with a tap.
  const [dragging, setDragging] = useState<string | null>(null);
  const [wrongTarget, setWrongTarget] = useState<string | null>(null);

  const isDone = Object.keys(placed).length === pairs.length;

  function handleDrop(left: string) {
    if (!dragging) return;
    const correct = pairs.find((p) => p.left === left)?.right === dragging;
    if (correct) {
      const next = { ...placed, [left]: dragging };
      setPlaced(next);
      if (Object.keys(next).length === pairs.length) onComplete(100);
    } else {
      setWrongTarget(left);
      setTimeout(() => setWrongTarget(null), 500);
    }
    setDragging(null);
  }

  const remaining = draggables.filter((d) => !Object.values(placed).includes(d));

  return (
    <div className="space-y-4">
      {remaining.length > 0 && (
        <p className="text-micro text-slate-500 dark:text-slate-400">
          Карточканы таңдап, оның орнын бас (немесе сүйреп апар).
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {remaining.map((item) => (
          <button
            key={item}
            type="button"
            draggable
            onDragStart={() => setDragging(item)}
            onDragEnd={() => setDragging(null)}
            onClick={() => setDragging(dragging === item ? null : item)}
            aria-pressed={dragging === item}
            className={`cursor-grab rounded-xl border px-3 py-2 text-sm font-medium transition-colors active:cursor-grabbing ${
              dragging === item
                ? "border-brand-500 bg-brand-500/25 text-brand-800 ring-2 ring-brand-400/60 dark:text-brand-100"
                : "border-brand-300 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
            }`}
          >
            {item}
          </button>
        ))}
        {remaining.length === 0 && (
          <p className="text-sm text-emerald-600 dark:text-emerald-300">Барлық карточкалар орналастырылды!</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pairs.map((p) => (
          <button
            key={p.left}
            type="button"
            onClick={() => handleDrop(p.left)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(p.left)}
            disabled={!!placed[p.left]}
            className={`flex min-h-[3rem] w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed px-3 py-2 text-left text-sm transition-colors disabled:cursor-default ${
              placed[p.left]
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                : wrongTarget === p.left
                ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20"
                : dragging
                ? "border-brand-400/70 bg-brand-500/5"
                : "border-slate-300 dark:border-white/20"
            }`}
          >
            <span className="font-medium">{p.left}</span>
            <span className="text-right text-slate-500 dark:text-slate-400">
              {placed[p.left] ?? (dragging ? "→ осында қойыңыз" : "→ осында тастаңыз")}
            </span>
          </button>
        ))}
      </div>
      {isDone && (
        <p className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
          Тамаша! Барлық формулалар мен ұғымдар дұрыс орналастырылды.
        </p>
      )}
    </div>
  );
}
