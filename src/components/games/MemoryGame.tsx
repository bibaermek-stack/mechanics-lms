"use client";

import { useMemo, useState } from "react";
import { seededRandom, seededShuffle } from "@/lib/rng";
import type { GamePair } from "@/lib/types";

interface Card {
  key: string;
  pairId: number;
  label: string;
}

export function MemoryGame({
  pairs,
  onComplete,
  seed = 1,
}: {
  pairs: GamePair[];
  onComplete: (score: number) => void;
  /** Fixes the card layout; the router passes the lesson or duel seed. */
  seed?: number;
}) {
  const cards = useMemo<Card[]>(() => {
    const raw = pairs.flatMap((p, i) => [
      { key: `${i}-l`, pairId: i, label: p.left },
      { key: `${i}-r`, pairId: i, label: p.right },
    ]);
    return seededShuffle(raw, seededRandom(seed));
  }, [pairs, seed]);

  const [flipped, setFlipped] = useState<string[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  const isDone = matchedPairIds.length === pairs.length;

  function handleFlip(card: Card) {
    if (locked || flipped.includes(card.key) || matchedPairIds.includes(card.pairId)) return;
    const next = [...flipped, card.key];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      setLocked(true);
      const [a, b] = next.map((k) => cards.find((c) => c.key === k)!);
      setTimeout(() => {
        if (a.pairId === b.pairId) {
          const updated = [...matchedPairIds, a.pairId];
          setMatchedPairIds(updated);
          if (updated.length === pairs.length) {
            const score = Math.max(40, 100 - (moves - pairs.length) * 5);
            onComplete(score);
          }
        }
        setFlipped([]);
        setLocked(false);
      }, 650);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-micro text-slate-600 dark:text-slate-400">Жүрістер саны: {moves}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((card) => {
          const isFlipped = flipped.includes(card.key) || matchedPairIds.includes(card.pairId);
          return (
            <button
              key={card.key}
              onClick={() => handleFlip(card)}
              className={`flex h-20 items-center justify-center rounded-xl border p-2 text-center text-xs font-medium transition-colors ${
                matchedPairIds.includes(card.pairId)
                  ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
                  : isFlipped
                  ? "border-brand-400 bg-brand-50 dark:bg-brand-900/20"
                  : "border-slate-200 bg-gradient-to-br from-brand-500 to-indigo-600 text-white dark:border-white/10"
              }`}
            >
              {isFlipped ? card.label : "?"}
            </button>
          );
        })}
      </div>
      {isDone && (
        <p className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
          Жады ойыны аяқталды. Жалпы жүрістер: {moves}
        </p>
      )}
    </div>
  );
}
