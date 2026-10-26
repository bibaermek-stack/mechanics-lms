"use client";

import { useState } from "react";
import { ALL_MODULES } from "@/data/modules";
import { lessonAverages, lessonCompletion, COHORT } from "@/data/cohort";

interface Point {
  id: number | string;
  lessonNum: number;
  title: string;
  score: number;       // X axis
  timeMinutes: number; // Y axis
  dropOff: number;     // Bubble size
  color: string;
}

export function LessonScatterChart() {
  const averages = lessonAverages(COHORT);
  const completion = lessonCompletion(COHORT);
  const [hovered, setHovered] = useState<Point | null>(null);

  // Mock time spent per lesson in minutes
  const mockTimes = [25, 38, 45, 52, 60, 58, 42, 48, 55, 65];

  const points: Point[] = ALL_MODULES.map((mod, idx) => {
    const score = averages[idx] ?? 70;
    const timeMinutes = mockTimes[idx] ?? 40;
    const prevCount = idx === 0 ? COHORT.length : completion[idx - 1];
    const currCount = completion[idx];
    const dropOff = Math.max(0, prevCount - currCount);

    let color = "#10b981"; // Green
    if (score < 65) color = "#e11d48"; // Red
    else if (score < 78) color = "#f59e0b"; // Amber

    return {
      id: mod.id,
      lessonNum: idx + 1,
      title: mod.title,
      score,
      timeMinutes,
      dropOff,
      color,
    };
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
          <span>70 мин</span>
          <span>50 мин</span>
          <span>30 мин</span>
          <span>10 мин</span>
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
            // Map timeMinutes (10 to 70) to Y percentage (0% to 100%)
            const bottomPct = Math.max(0, Math.min(100, ((pt.timeMinutes - 10) / 60) * 100));
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
              Орташа уақыт: <strong className="text-slate-900 dark:text-white">{hovered.timeMinutes} мин</strong> · 
              Жетпеген студенттер: <strong className="text-rose-500">{hovered.dropOff} адам</strong>
            </span>
          </div>
        ) : (
          <span className="text-slate-500 dark:text-slate-400">
            Сабақтың күрделілігі мен жұмсалған уақыт көрсеткішін көру үшін шарды басыңыз немесе нұсқаңыз
          </span>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Жоғары меңгерілу</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500"/> Орташа</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500"/> Қиын тақырып</span>
        </div>
      </div>
    </div>
  );
}

export default LessonScatterChart;
