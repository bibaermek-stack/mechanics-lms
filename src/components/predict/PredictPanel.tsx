"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { PREDICT_ITEMS, itemsForLesson } from "@/data/predictions";
import { EmptyState } from "@/components/ui/EmptyState";
import { studentPredictions } from "@/lib/misconceptions";
import { PredictCard } from "./PredictCard";
import { usePredictions } from "./usePredictions";

/**
 * The predictions of one lesson (or, with no lesson, of the whole course), one at
 * a time. A new item is offered first; the ones already tried can be retaken.
 */
export function PredictPanel({ lesson }: { lesson?: number }) {
  const { rows, record, user } = usePredictions();
  const items = useMemo(() => (lesson ? itemsForLesson(lesson) : PREDICT_ITEMS), [lesson]);
  const [index, setIndex] = useState<number | null>(null);
  // Bumped to give the card a fresh start for a retake; the card itself must not be re-keyed by a save.
  const [retake, setRetake] = useState(0);
  // Where to begin, decided once, when the records first arrive. Left to be recomputed it would slide on
  // to the next untried item the instant a prediction is saved, taking the result off the screen.
  const startAt = useRef<number | null>(null);

  if (!user) return null;
  if (items.length === 0) {
    return <EmptyState title="Бұл сабақта болжам жоқ" hint="Басқа сабақтардың болжамдарын «Болжам» бетінен көруге болады." href="/predict" cta="Барлық болжамдар" />;
  }
  if (rows === null) return <p className="text-sm text-slate-500 dark:text-slate-400">Жүктелуде…</p>;

  const mine = studentPredictions(rows, user.uid);
  const tried = (id: string) => rows.filter((r) => r.itemId === id);
  // Start on the first item this student has not tried; if all are done, on the first.
  if (startAt.current === null) startAt.current = Math.max(0, items.findIndex((i) => tried(i.id).length === 0));
  const at = index ?? startAt.current;
  const item = items[Math.min(at, items.length - 1)];
  const attemptsHere = tried(item.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-body text-slate-600 dark:text-slate-400">
          <Eye size={16} aria-hidden /> Алдымен болжа, содан кейін өлшемді көр.
        </p>
        <p className="data-num text-micro text-slate-500 dark:text-slate-400" aria-live="polite">
          {mine.attempted} болжам · бірінші рет дұрыс: {mine.correct}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Болжамдар">
        {items.map((it, i) => {
          const t = tried(it.id);
          const first = t.length ? t[t.length - 1] : null;
          return (
            <button
              key={it.id}
              role="tab"
              aria-selected={i === at}
              onClick={() => setIndex(i)}
              className={`data-num h-9 w-9 rounded-full text-xs font-semibold transition-colors ${
                i === at
                  ? "bg-brand-500 text-white"
                  : first
                    ? first.correct
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                    : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
              }`}
              aria-label={`${i + 1}-болжам: ${it.title}${first ? (first.correct ? ", дұрыс" : ", дұрыс емес") : ""}`}
              title={it.title}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <PredictCard
        key={`${item.id}:${retake}`}
        item={item}
        userId={user.uid}
        attempts={attemptsHere}
        onAttempt={record}
        onNext={at < items.length - 1 ? () => setIndex(at + 1) : undefined}
        onRetake={() => setRetake((n) => n + 1)}
      />

      {!lesson && (
        <p className="text-micro text-slate-500 dark:text-slate-400">
          Әр болжам өз сабағына байланысты: <Link href="/modules" className="text-brand-600 underline dark:text-brand-300">сабақтарға өту</Link>.
        </p>
      )}
    </div>
  );
}
