"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { dayKey } from "@/lib/engagement";
import { factOfTheDay, type Fact } from "@/data/facts";

/**
 * One physics question a day, answered a tap later. The answer is held back on
 * purpose: a question you have half-thought about sticks better than one that is
 * answered before you can wonder.
 */
export function DailyFact() {
  const [fact, setFact] = useState<Fact | null>(null);
  const [shown, setShown] = useState(false);

  // The day is the viewer's, which the server cannot know.
  useEffect(() => setFact(factOfTheDay(dayKey(new Date()))), []);
  if (!fact) return null;

  return (
    <Card className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500" aria-hidden>
        <Lightbulb size={24} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">Бүгінгі физика сұрағы</p>
        <p className="mt-1 text-h3 text-slate-900 dark:text-white">{fact.question}</p>
        {shown ? (
          <div className="mt-2 space-y-2" role="status">
            <p className="text-body text-slate-700 dark:text-slate-300">{fact.answer(fact.calc())}</p>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-micro">
              <Link href={`/modules/${fact.lesson}`} className="text-brand-600 hover:underline dark:text-brand-300">
                {fact.lesson}-сабақ <ArrowRight size={11} className="inline" />
              </Link>
              <Link href="/myths" className="text-brand-600 hover:underline dark:text-brand-300">
                Миф па, шындық па? <ArrowRight size={11} className="inline" />
              </Link>
            </p>
          </div>
        ) : (
          <button onClick={() => setShown(true)} className="btn-ghost mt-2 !px-3 !py-1.5 text-sm">
            Жауабын көру
          </button>
        )}
      </div>
    </Card>
  );
}
