"use client";

import { useState } from "react";

interface TrendPoint {
  week: string;
  progress: number;
  score: number;
  activeHours: number;
}

const TREND_DATA: TrendPoint[] = [
  { week: "1-апта", progress: 20, score: 68, activeHours: 42 },
  { week: "2-апта", progress: 38, score: 72, activeHours: 58 },
  { week: "3-апта", progress: 54, score: 65, activeHours: 64 },
  { week: "4-апта", progress: 68, score: 78, activeHours: 72 },
  { week: "5-апта", progress: 82, score: 81, activeHours: 85 },
  { week: "6-апта", progress: 91, score: 86, activeHours: 90 },
];

export function TrendLineChart() {
  const [activeMetric, setActiveMetric] = useState<"score" | "progress" | "activeHours">("score");

  const width = 500;
  const height = 180;
  const padding = 30;

  const points = TREND_DATA.map((d, idx) => {
    const x = padding + (idx / (TREND_DATA.length - 1)) * (width - padding * 2);
    const val = d[activeMetric];
    const y = height - padding - (val / 100) * (height - padding * 2);
    return { x, y, val, label: d.week };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${
    height - padding
  } Z`;

  return (
    <div className="space-y-3">
      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5">
          <button
            onClick={() => setActiveMetric("score")}
            className={`rounded-md px-3 py-1.5 text-micro font-medium transition-colors ${
              activeMetric === "score"
                ? "bg-white text-brand-600 shadow-xs dark:bg-slate-800 dark:text-brand-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Орташа ұпай (%)
          </button>
          <button
            onClick={() => setActiveMetric("progress")}
            className={`rounded-md px-3 py-1.5 text-micro font-medium transition-colors ${
              activeMetric === "progress"
                ? "bg-white text-brand-600 shadow-xs dark:bg-slate-800 dark:text-brand-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Курс Прогресі (%)
          </button>
          <button
            onClick={() => setActiveMetric("activeHours")}
            className={`rounded-md px-3 py-1.5 text-micro font-medium transition-colors ${
              activeMetric === "activeHours"
                ? "bg-white text-brand-600 shadow-xs dark:bg-slate-800 dark:text-brand-400"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Оқу Сағаты (сағ)
          </button>
        </div>

        <span className="text-micro text-slate-500 font-semibold">
          Өсу қарқыны: <span className="text-emerald-600 dark:text-emerald-400">+18% (соңғы аптада)</span>
        </span>
      </div>

      {/* SVG Trend Graph */}
      <div className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-white/10 dark:bg-slate-900/50">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid horizontal lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity="0.5" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#cbd5e1" strokeDasharray="3 3" strokeOpacity="0.5" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" />

          {/* Filled Area */}
          <path d={areaD} fill="url(#trendGradient)" />

          {/* Smooth Trend Line */}
          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />

          {/* Data Points */}
          {points.map((pt, i) => (
            <g key={i}>
              <circle cx={pt.x} cy={pt.y} r="5" fill="#ffffff" stroke="#2563eb" strokeWidth="2.5" />
              <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="text-[10px] font-bold fill-slate-700 dark:fill-slate-200">
                {pt.val}{activeMetric === "activeHours" ? "с" : "%"}
              </text>
              <text x={pt.x} y={height - 10} textAnchor="middle" className="text-[10px] fill-slate-400">
                {pt.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default TrendLineChart;
