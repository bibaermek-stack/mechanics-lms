"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { OrderBoard } from "@/data/moreGames";

/** Each wrong tap costs this many of the hundred points. */
const PENALTY = 15;

/**
 * Cards from the lesson's film, face up and out of order. Tap them in the order
 * the lesson tells them: a right tap locks the card in with its number, a wrong
 * one costs points and the card stays put. There is no way to drag, so it is the
 * same on a phone, with a keyboard, and for a screen reader.
 */
export function OrderGame({
  board,
  onComplete,
}: {
  board: OrderBoard;
  onComplete: (score: number) => void;
}) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const reported = useRef(false);

  const total = board.answer.length;
  const done = placed.length === total;
  const score = Math.max(0, 100 - PENALTY * mistakes);

  useEffect(() => {
    if (done && !reported.current) {
      reported.current = true;
      onComplete(score);
    }
  }, [done, onComplete, score]);

  // Clear the red flash on its own.
  useEffect(() => {
    if (!wrongId) return;
    const t = setTimeout(() => setWrongId(null), 700);
    return () => clearTimeout(t);
  }, [wrongId]);

  function tap(id: string) {
    if (done || placed.includes(id)) return;
    if (id === board.answer[placed.length]) {
      setPlaced((p) => [...p, id]);
    } else {
      setMistakes((m) => m + 1);
      setWrongId(id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-body text-slate-600 dark:text-slate-400">
          Сабақ қалай айтылады? Оқиғаларды ретімен бас: <strong>{placed.length}</strong> / {total}.
        </p>
        <span className="data-num text-micro text-slate-500 dark:text-slate-400">Қате: {mistakes}</span>
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {board.items.map((it) => {
          const at = placed.indexOf(it.id);
          const isPlaced = at >= 0;
          const isWrong = wrongId === it.id;
          return (
            <li key={it.id}>
              <button
                onClick={() => tap(it.id)}
                disabled={isPlaced || done}
                aria-label={isPlaced ? `${at + 1}-орында: ${it.text}` : it.text}
                className={`flex h-full w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition-colors ${
                  isPlaced
                    ? "border-emerald-400/60 bg-emerald-500/10 text-slate-900 dark:text-emerald-50"
                    : isWrong
                      ? "border-rose-400 bg-rose-500/15 text-slate-900 dark:text-rose-50"
                      : "border-slate-200 text-slate-800 hover:border-brand-400 dark:border-white/10 dark:text-slate-200"
                }`}
              >
                <span
                  className={`data-num flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-micro font-bold ${
                    isPlaced ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500"
                  }`}
                  aria-hidden
                >
                  {isPlaced ? at + 1 : "?"}
                </span>
                <span>{it.text}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {done && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-400/50 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            {mistakes === 0
              ? "Қатесіз! Сабақтың құрылымын жақсы түсінесің."
              : `Дайын. ${mistakes} қате — ${score} ұпай.`}
          </p>
          <button
            onClick={() => {
              setPlaced([]);
              setMistakes(0);
              reported.current = false;
            }}
            className="btn-ghost text-sm"
          >
            <RotateCcw size={14} /> Қайта
          </button>
        </div>
      )}
    </div>
  );
}
