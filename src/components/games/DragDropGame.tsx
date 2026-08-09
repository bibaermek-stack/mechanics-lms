"use client";

import { useMemo, useState } from "react";
import { seededRandom, seededShuffle } from "@/lib/rng";
import type { GamePair } from "@/lib/types";

// HTML5 drag-and-drop matching game: drag each "right" label onto its
// matching "left" drop-zone.
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
      <div className="flex flex-wrap gap-2">
        {remaining.map((item) => (
          <div
            key={item}
            draggable
            onDragStart={() => setDragging(item)}
            className="cursor-grab rounded-xl border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 active:cursor-grabbing dark:bg-brand-900/30 dark:text-brand-200"
          >
            {item}
          </div>
        ))}
        {remaining.length === 0 && (
          <p className="text-sm text-emerald-600 dark:text-emerald-300">Барлық карточкалар орналастырылды!</p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {pairs.map((p) => (
          <div
            key={p.left}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(p.left)}
            className={`flex min-h-[3rem] items-center justify-between rounded-xl border-2 border-dashed px-3 py-2 text-sm transition-colors ${
              placed[p.left]
                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                : wrongTarget === p.left
                ? "border-rose-400 bg-rose-50 dark:bg-rose-900/20"
                : "border-slate-300 dark:border-white/20"
            }`}
          >
            <span className="font-medium">{p.left}</span>
            <span className="text-slate-500 dark:text-slate-400">{placed[p.left] ?? "→ осында тастаңыз"}</span>
          </div>
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
