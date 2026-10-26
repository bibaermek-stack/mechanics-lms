"use client";

import { useState } from "react";
import type { TrendPoint } from "@/data/cohort";

type Metric = "score" | "progress" | "activity";

const WIDTH = 500;
const HEIGHT = 180;
const PAD = 30;

/** Rounds a maximum up to a tidy axis end (7 → 10, 130 → 150). */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const f = v / pow;
  const step = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Week-by-week course trend. The data comes in as a prop — a synthetic series
 * in demo mode, the real attempts in live mode — and a week with no quiz
 * attempts has no score, which the line leaves as a gap rather than inventing.
 */
export function TrendLineChart({
  data,
  activityLabel,
  activityUnit,
}: {
  data: TrendPoint[];
  /** Tab title for the third metric, e.g. "Әрекет саны". */
  activityLabel: string;
  /** Short unit printed after the activity values. */
  activityUnit: string;
}) {
  const [metric, setMetric] = useState<Metric>("score");

  const suffix = metric === "activity" ? ` ${activityUnit}` : "%";
  const values = data.map((d) => d[metric]);
  const known = values.filter((v): v is number => v !== null);
  const maxY = metric === "activity" ? niceCeil(Math.max(0, ...known)) : 100;

  const points = data.map((d, i) => {
    const v = d[metric];
    const x = data.length > 1 ? PAD + (i / (data.length - 1)) * (WIDTH - PAD * 2) : WIDTH / 2;
    const y = v === null ? null : HEIGHT - PAD - (v / maxY) * (HEIGHT - PAD * 2);
    return { x, y, v, label: d.week };
  });

  // A line per run of consecutive weeks that have a value, so a missing week
  // is a visible break and not a straight line drawn across it.
  const runs: { x: number; y: number }[][] = [];
  for (const p of points) {
    if (p.y === null) {
      runs.push([]);
      continue;
    }
    if (!runs.length) runs.push([]);
    runs[runs.length - 1].push({ x: p.x, y: p.y });
  }
  const lines = runs.filter((r) => r.length > 0);
  const linePath = (r: { x: number; y: number }[]) => r.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
  const areaPath = (r: { x: number; y: number }[]) =>
    `${linePath(r)} L ${r[r.length - 1].x} ${HEIGHT - PAD} L ${r[0].x} ${HEIGHT - PAD} Z`;

  // Change over the last two weeks, but only when both have a value.
  const last = values[values.length - 1];
  const before = values[values.length - 2];
  const change = last !== null && last !== undefined && before !== null && before !== undefined ? last - before : null;
  const changeText =
    change === null
      ? "—"
      : `${change > 0 ? "+" : ""}${Math.round(change * 10) / 10}${metric === "activity" ? ` ${activityUnit}` : "%"}`;

  const tabs: { key: Metric; label: string }[] = [
    { key: "score", label: "Орташа ұпай (%)" },
    { key: "progress", label: "Курс прогресі (%)" },
    { key: "activity", label: activityLabel },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setMetric(t.key)}
              aria-pressed={metric === t.key}
              className={`rounded-md px-3 py-1.5 text-micro font-medium transition-colors ${
                metric === t.key
                  ? "bg-white text-brand-600 shadow-xs dark:bg-slate-800 dark:text-brand-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <span className="text-micro font-semibold text-slate-500">
          Соңғы аптадағы өзгеріс:{" "}
          <span
            className={
              change === null
                ? ""
                : change >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
            }
          >
            {changeText}
          </span>
        </span>
      </div>

      <div className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-white/10 dark:bg-slate-900/50">
        {known.length === 0 ? (
          <p className="flex h-[180px] items-center justify-center px-4 text-center text-micro text-slate-500">
            Бұл көрсеткіш бойынша әлі деректер жоқ.
          </p>
        ) : (
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full overflow-visible" role="img" aria-label="Апталық үрдіс графигі">
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <line x1={PAD} y1={PAD} x2={WIDTH - PAD} y2={PAD} stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity="0.5" />
            <line x1={PAD} y1={HEIGHT / 2} x2={WIDTH - PAD} y2={HEIGHT / 2} stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity="0.5" />
            <line x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} stroke="#cbd5e1" />

            {lines.map((r, i) => (
              <g key={i}>
                {r.length > 1 && <path d={areaPath(r)} fill="url(#trendGradient)" />}
                {r.length > 1 && <path d={linePath(r)} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />}
              </g>
            ))}

            {points.map((pt, i) => (
              <g key={i}>
                {pt.y !== null && pt.v !== null && (
                  <>
                    <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
                    <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="fill-slate-700 text-[10px] font-bold dark:fill-slate-200">
                      {pt.v}
                      {suffix}
                    </text>
                  </>
                )}
                <text x={pt.x} y={HEIGHT - 10} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {pt.label}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

export default TrendLineChart;
