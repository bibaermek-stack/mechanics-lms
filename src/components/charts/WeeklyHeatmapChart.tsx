"use client";

import { useState } from "react";

const DAYS = ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі", "Жексенбі"];
const HOURS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];

function getHeatColor(val: number): string {
  if (val === 0) return "bg-slate-100 dark:bg-slate-800/40 text-transparent";
  if (val < 25) return "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300";
  if (val < 50) return "bg-blue-300 dark:bg-blue-800/80 text-blue-900 dark:text-blue-100";
  if (val < 75) return "bg-indigo-500 text-white font-medium";
  return "bg-brand-600 text-white font-bold shadow-sm";
}

/**
 * When the cohort works: weekday (Monday first) × two-hour slot from 08:00.
 * `data[day][slot]` is 0–100, relative to the busiest slot, so the colours show
 * the shape of the week and not an absolute count.
 */
export function WeeklyHeatmapChart({ data }: { data: number[][] }) {
  const [hoverInfo, setHoverInfo] = useState<{ day: string; hour: string; val: number } | null>(null);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="min-w-[500px]">
          {/* Header hours */}
          <div className="grid grid-cols-9 gap-1 text-center text-micro font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            <div className="text-left font-semibold text-slate-600 dark:text-slate-300">Күн \ Уақыт</div>
            {HOURS.map((h) => (
              <div key={h}>{h}</div>
            ))}
          </div>

          {/* Grid rows */}
          <div className="space-y-1">
            {DAYS.map((day, dIdx) => (
              <div key={day} className="grid grid-cols-9 gap-1 items-center">
                <div className="text-micro font-medium text-slate-700 dark:text-slate-300 truncate">
                  {day}
                </div>
                {HOURS.map((hour, hIdx) => {
                  const val = data[dIdx]?.[hIdx] ?? 0;
                  return (
                    <div
                      key={hour}
                      onMouseEnter={() => setHoverInfo({ day, hour, val })}
                      onMouseLeave={() => setHoverInfo(null)}
                      className={`h-8 rounded-md flex items-center justify-center text-micro transition-all cursor-pointer hover:scale-105 hover:z-10 ${getHeatColor(
                        val
                      )}`}
                    >
                      {val > 0 ? `${val}%` : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend & Hover Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/10 text-micro">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 dark:text-slate-400">Белсенділік (ең белсенді ұяшық = 100%):</span>
          <span className="inline-block h-3 w-3 rounded bg-blue-100 dark:bg-blue-950/60" /> Low
          <span className="inline-block h-3 w-3 rounded bg-indigo-500" /> Mid
          <span className="inline-block h-3 w-3 rounded bg-brand-600" /> Peak
        </div>
        <div className="text-slate-600 dark:text-slate-300 font-medium">
          {hoverInfo ? (
            <span>
              {hoverInfo.day}, {hoverInfo.hour} · Белсенділік: <span className="font-bold text-brand-600 dark:text-brand-400">{hoverInfo.val}%</span>
            </span>
          ) : (
            <span>
              <span className="[@media(pointer:coarse)]:hidden">Ұяшықты меңзеп уақыт жүктемесін қараңыз</span>
              <span className="hidden [@media(pointer:coarse)]:inline">Ұяшықты түртіп уақыт жүктемесін қараңыз</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default WeeklyHeatmapChart;
