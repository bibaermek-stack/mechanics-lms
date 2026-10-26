"use client";

import { useState } from "react";
import { ALL_MODULES } from "@/data/modules";
import { lessonAverages, lessonCompletion, type StudentRow } from "@/data/cohort";

interface Point {
  id: number | string;
  lessonNum: number;
  title: string;
  score: number; // X axis
  attempts: number; // Y axis
  dropOff: number; // Bubble size
  color: string;
}

/**
 * Lesson difficulty at a glance: mean quiz score (X) against how many tries a
 * student needs (Y), with the bubble sized by how many students dropped out
 * before reaching the lesson.
 *
 * A lesson nobody has attempted has neither a score nor a try count, so it is
 * left off the plot and listed underneath — earlier this chart quietly drew it
 * at a default of 70 %, which is a number nobody measured.
 */
export function LessonScatterChart({
  rows,
  attempts,
}: {
  rows: StudentRow[];
  /** Mean quiz attempts per student, by lesson; `null` where nobody has tried. */
  attempts: (number | null)[];
}) {
  const averages = lessonAverages(rows);
  const completion = lessonCompletion(rows);
  const [hovered, setHovered] = useState<Point | null>(null);

  const yMax = Math.max(3, Math.ceil(Math.max(1, ...attempts.filter((a): a is number => a !== null))));
  const ticks = [yMax, 1 + ((yMax - 1) * 2) / 3, 1 + (yMax - 1) / 3, 1].map((v) => Math.round(v * 10) / 10);

  const missing: number[] = [];
  const points: Point[] = [];
  ALL_MODULES.forEach((mod, idx) => {
    const score = averages[idx];
    const tries = attempts[idx];
    if (score === null || tries === null || tries === undefined) {
      missing.push(idx + 1);
      return;
    }
    const prevCount = idx === 0 ? rows.length : completion[idx - 1];
    const dropOff = Math.max(0, prevCount - completion[idx]);

    let color = "#10b981"; // Green
    if (score < 65) color = "#e11d48"; // Red
    else if (score < 78) color = "#f59e0b"; // Amber

    points.push({ id: mod.id, lessonNum: idx + 1, title: mod.title, score, attempts: tries, dropOff, color });
  });

  return (
    <div className="space-y-3">
      <div className="relative h-[280px] w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-slate-900/50">
        {/* Y Axis Grid lines & Labels */}
        <div className="absolute left-10 top-4 bottom-8 right-4 flex flex-col justify-between border-l border-b border-slate-200 dark:border-white/10">
          <div className="w-full border-b border-dashed border-slate-200/60 dark:border-white/5" />
          <div className="w-full border-b border-dashed border-slate-200/60 dark:border-white/5" />
          <div className="w-full border-b border-dashed border-slate-200/60 dark:border-white/5" />
          <div className="w-full border-b border-dashed border-slate-200/60 dark:border-white/5" />
        </div>

        <div className="absolute left-2 top-4 bottom-8 flex flex-col justify-between text-[10px] text-slate-400">
          {ticks.map((t) => (
            <span key={t}>{t} рет</span>
          ))}
        </div>

        {/* X Axis Labels */}
        <div className="absolute left-10 right-4 bottom-2 flex justify-between text-[10px] text-slate-400">
          <span>40% (Төмен)</span>
          <span>60%</span>
          <span>80%</span>
          <span>100% (Жоғары ұпай)</span>
        </div>

        {/* Bubbles Plot Area */}
        <div className="absolute left-12 top-6 bottom-10 right-6">
          {points.map((pt) => {
            // Map score (40 to 100) to X percentage (0% to 100%)
            const leftPct = Math.max(0, Math.min(100, ((pt.score - 40) / 60) * 100));
            // Map tries (1 to yMax) to Y percentage (0% to 100%)
            const bottomPct = Math.max(0, Math.min(100, ((pt.attempts - 1) / (yMax - 1)) * 100));
            // Bubble diameter based on dropOff (min 20px, max 42px)
            const bubbleSize = Math.max(22, Math.min(44, 22 + pt.dropOff * 5));

            return (
              <div
                key={pt.id}
                onMouseEnter={() => setHovered(pt)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  left: `${leftPct}%`,
                  bottom: `${bottomPct}%`,
                  width: `${bubbleSize}px`,
                  height: `${bubbleSize}px`,
                  backgroundColor: pt.color,
                }}
                className="absolute -translate-x-1/2 translate-y-1/2 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-md cursor-pointer transition-transform hover:scale-125 z-10"
              >
                {pt.lessonNum}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail info box */}
      <div className="rounded-lg bg-white p-3 border border-slate-200 dark:border-white/10 dark:bg-slate-900 text-micro flex flex-wrap items-center justify-between gap-2">
        {hovered ? (
          <div>
            <span className="font-bold text-slate-900 dark:text-white">
              {hovered.lessonNum}-сабақ: «{hovered.title}»
            </span>
            <span className="ml-3 text-slate-600 dark:text-slate-400">
              Орташа ұпай: <strong className="text-slate-900 dark:text-white">{hovered.score}%</strong> · 
              Орташа әрекет: <strong className="text-slate-900 dark:text-white">{hovered.attempts} рет</strong> · 
              Жетпеген студенттер: <strong className="text-rose-500">{hovered.dropOff} адам</strong>
            </span>
          </div>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">
            Сабақтың күрделілігі мен қайта тапсыру көрсеткішін көру үшін шарды басыңыз немесе нұсқаңыз
          </span>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Жоғары меңгерілу</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"/> Орташа</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"/> Қиын тақырып</span>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="text-micro text-slate-500 dark:text-slate-400">
          Әлі ешкім тапсырмаған сабақтар графикте жоқ: {missing.join(", ")}.
        </p>
      )}
    </div>
  );
}

export default LessonScatterChart;
