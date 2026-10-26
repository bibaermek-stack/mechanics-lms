"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Flame, Timer, X } from "lucide-react";
import type { TrueFalseBoard } from "@/data/moreGames";

/**
 * A question and an answer to it — right or wrong, half the deck each way — and
 * the player has twelve seconds to say which. Streaks are shown because a streak
 * is what makes "one more card" hard to put down.
 *
 * ← says false and → says true, and Enter moves on, so a keyboard player never
 * touches the mouse. The buttons are the same size as the other games' answers
 * (and tall enough for a thumb); time running out counts as wrong.
 */
export function TrueFalseGame({
  board,
  onComplete,
}: {
  board: TrueFalseBoard;
  onComplete: (score: number) => void;
}) {
  const total = board.cards.length;
  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<{ said: boolean | null; right: boolean } | null>(null);
  const [left, setLeft] = useState(board.perCard);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [done, setDone] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  const card = board.cards[index];

  const settle = useCallback(
    (said: boolean | null) => {
      if (verdict || done) return;
      const right = said !== null && said === card.isTrue;
      setVerdict({ said, right });
      if (right) {
        setCorrect((c) => c + 1);
        setStreak(streak + 1);
        setBest((b) => Math.max(b, streak + 1));
      } else {
        setStreak(0);
      }
    },
    [card, done, streak, verdict]
  );

  // One tick per second while a card is open. A chain of timeouts rather than an
  // interval: it cleans itself up the moment the card is answered.
  useEffect(() => {
    if (verdict || done) return;
    if (left <= 0) {
      settle(null);
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, verdict, done, settle]);

  const next = useCallback(() => {
    if (index === total - 1) {
      setDone(true);
      onComplete(Math.round((100 * correct) / total));
    } else {
      setIndex((i) => i + 1);
      setVerdict(null);
      setLeft(board.perCard);
    }
  }, [board.perCard, correct, index, onComplete, total]);

  // Keyboard: ← false, → true; once answered, Enter or → moves on.
  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (verdict) {
        if (e.key === "Enter" || e.key === "ArrowRight") {
          e.preventDefault();
          next();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        settle(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        settle(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, next, settle, verdict]);

  // After an answer the "next" button takes focus, so Enter works from the keyboard and screen readers hear the feedback.
  useEffect(() => {
    if (verdict) nextRef.current?.focus({ preventScroll: true });
  }, [verdict]);

  if (done) {
    const pct = Math.round((100 * correct) / total);
    return (
      <div className="rounded-2xl border border-slate-200/70 p-8 text-center dark:border-white/10">
        <p className="text-h2 text-slate-900 dark:text-white">
          {correct}/{total}
        </p>
        <p className="mt-1 text-label text-slate-600 dark:text-slate-400">
          Ең ұзақ серия: <span className="data-num font-semibold">{best}</span> · {pct}% дұрыс
        </p>
        <p className="mt-3 text-body text-slate-600 dark:text-slate-400">
          {pct >= 90
            ? "Мінсіз! Түсінбей жаттау мұндай нәтиже бермейді."
            : pct >= 65
              ? "Жақсы. Қателескен карточкаларды викториналар арқылы бекітіп көр."
              : "Сабақтың дәрісін қайта қарап, тағы бір рет көр."}
        </p>
      </div>
    );
  }

  const urgent = left <= 4 && !verdict;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <span className="data-num text-micro text-slate-500 dark:text-slate-400">
          {index + 1}/{total}
        </span>
        <span
          className={`flex items-center gap-1.5 text-label font-semibold ${
            streak >= 3 ? "text-amber-400" : "text-slate-500 dark:text-slate-400"
          }`}
          aria-label={`Серия: ${streak}`}
        >
          <Flame size={16} /> <span className="data-num">{streak}</span>
        </span>
        <span
          className={`flex items-center gap-1.5 text-label font-semibold ${
            urgent ? "text-rose-400" : "text-slate-600 dark:text-slate-300"
          }`}
          role="timer"
          aria-live="off"
        >
          <Timer size={15} />
          <span className="data-num">{verdict ? "—" : `${left} с`}</span>
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-1000 ease-linear ${urgent ? "bg-rose-400" : "bg-brand-500"}`}
          style={{ width: `${verdict ? 100 : (left / board.perCard) * 100}%` }}
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200/70 p-5 dark:border-white/10">
        <div>
          <p className="text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">Сұрақ</p>
          <p className="mt-1 text-body font-medium text-slate-900 dark:text-white">{card.prompt}</p>
        </div>
        <div className="rounded-xl bg-brand-500/10 p-4">
          <p className="text-micro uppercase tracking-wider text-brand-500 dark:text-brand-300">Ұсынылған жауап</p>
          <p className="mt-1 text-h3 text-slate-900 dark:text-white">«{card.claim}»</p>
        </div>
      </div>

      {verdict ? (
        <div className="space-y-3" role="status">
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              verdict.right
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-rose-400/60 bg-rose-500/10 text-rose-900 dark:text-rose-100"
            }`}
          >
            {verdict.right ? <Check className="mt-0.5 shrink-0" size={18} /> : <X className="mt-0.5 shrink-0" size={18} />}
            <div className="space-y-1 text-sm">
              <p className="font-semibold">
                {verdict.said === null
                  ? "Уақыт бітті. "
                  : verdict.right
                    ? "Дұрыс! "
                    : "Қате. "}
                Бұл жауап — {card.isTrue ? "шын" : "өтірік"}.
              </p>
              <p>{card.explanation}</p>
            </div>
          </div>
          <button ref={nextRef} onClick={next} className="btn-primary w-full sm:w-auto">
            {index === total - 1 ? "Нәтижені көру" : "Келесі"} <ArrowRight size={16} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => settle(false)}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-rose-400/50 bg-rose-500/10 px-4 py-3 text-body font-semibold text-rose-700 transition-colors hover:bg-rose-500/20 dark:text-rose-200"
          >
            <X size={18} /> Өтірік
          </button>
          <button
            onClick={() => settle(true)}
            className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-3 text-body font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-200"
          >
            <Check size={18} /> Шын
          </button>
        </div>
      )}

      <p className="text-micro text-slate-500 dark:text-slate-400 [@media(pointer:coarse)]:hidden">
        Пернетақта: ← өтірік · → шын · Enter — келесі
      </p>
    </div>
  );
}
