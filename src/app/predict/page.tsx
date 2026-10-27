"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PredictPanel } from "@/components/predict/PredictPanel";
import { PREDICT_ITEMS } from "@/data/predictions";

const LESSONS = Array.from({ length: 10 }, (_, i) => i + 1);

/** Every prediction of the course; the same ones sit in each lesson's «Болжам» tab. */
export default function PredictPage() {
  const [lesson, setLesson] = useState<number | undefined>(undefined);
  const count = (l: number) => PREDICT_ITEMS.filter((i) => i.lesson === l).length;
  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader
          as="h1"
          title="Болжа — содан кейін көр"
          description="Эксперимент не көрсететінін алдын ала айт. Қателессең, ол — жаман емес: дәл осы сәтте физика жақсы ұғылады. Қаншалықты сенімді болғаныңды да белгіле."
        />
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Сабақты таңда">
          <button
            onClick={() => setLesson(undefined)}
            aria-pressed={lesson === undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${lesson === undefined ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"}`}
          >
            Барлығы ({PREDICT_ITEMS.length})
          </button>
          {LESSONS.map((l) => (
            <button
              key={l}
              onClick={() => setLesson(l)}
              aria-pressed={lesson === l}
              disabled={count(l) === 0}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${lesson === l ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"}`}
            >
              {l}-сабақ ({count(l)})
            </button>
          ))}
        </div>
        <PredictPanel key={lesson ?? "all"} lesson={lesson} />
      </div>
    </DashboardShell>
  );
}
