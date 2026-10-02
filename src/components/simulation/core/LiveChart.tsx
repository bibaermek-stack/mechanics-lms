"use client";

// Lightweight SVG strip-chart for the sampled sensor data. Chart.js is already
// in the project but is heavier than needed here — these plots update ~20×/s
// and only ever draw a few hundred points.

import { useMemo } from "react";
import { Download } from "lucide-react";
import type { Sample } from "./useSimEngine";

/**
 * The run's samples as a CSV file, for the lab report.
 *
 * Semicolon-separated with a decimal comma and a UTF-8 byte-order mark, because
 * that is what Excel expects on a Kazakh or Russian locale: with plain commas it
 * puts every row in one cell, and without the BOM the Cyrillic headers arrive as
 * mojibake. The whole buffer is exported, not just the window on screen.
 */
function downloadCsv(series: Sample[], lines: ChartLine[], xLabel: string) {
  const cell = (v: number) =>
    Number.isFinite(v) ? String(Number(v.toPrecision(7))).replace(".", ",") : "";
  const head = [xLabel, ...lines.map((l) => l.label)].join(";");
  const rows = series.map((s) => [s.t, ...lines.map((l) => s[l.key])].map(cell).join(";"));
  const blob = new Blob(["\ufeff" + [head, ...rows].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `zerthana-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ChartLine {
  key: string;
  label: string;
  color: string;
}

export function LiveChart({
  series,
  lines,
  yLabel,
  xLabel = "t, с",
  height = 130,
  symmetric = false,
  window: windowSeconds = 0,
}: {
  series: Sample[];
  lines: ChartLine[];
  yLabel: string;
  xLabel?: string;
  height?: number;
  /** Force the y-axis to be symmetric about zero (nice for v and a plots). */
  symmetric?: boolean;
  /** Show only the last N seconds (0 = everything). */
  window?: number;
}) {
  const W = 420;
  const H = height;
  const padL = 40;
  const padR = 8;
  const padT = 10;
  const padB = 22;

  const view = useMemo(() => {
    if (windowSeconds <= 0 || series.length === 0) return series;
    const tEnd = series[series.length - 1].t;
    return series.filter((s) => s.t >= tEnd - windowSeconds);
  }, [series, windowSeconds]);

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (view.length === 0) return { xMin: 0, xMax: 1, yMin: -1, yMax: 1 };
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of view) {
      for (const l of lines) {
        const v = s[l.key];
        if (Number.isFinite(v)) {
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      }
    }
    if (!Number.isFinite(lo)) {
      lo = -1;
      hi = 1;
    }
    if (symmetric) {
      const m = Math.max(Math.abs(lo), Math.abs(hi), 1e-6);
      lo = -m;
      hi = m;
    }
    const span = hi - lo || Math.max(Math.abs(hi), 1e-3);
    return {
      xMin: view[0].t,
      xMax: Math.max(view[view.length - 1].t, view[0].t + 0.5),
      yMin: lo - span * 0.12,
      yMax: hi + span * 0.12,
    };
  }, [view, lines, symmetric]);

  const sx = (t: number) => padL + ((t - xMin) / (xMax - xMin || 1)) * (W - padL - padR);
  const sy = (v: number) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - padT - padB);

  const paths = lines.map((l) => {
    let d = "";
    let pen = false;
    let last: { x: number; y: number } | null = null;
    for (const s of view) {
      const v = s[l.key];
      if (!Number.isFinite(v)) {
        pen = false;
        continue;
      }
      const px = sx(s.t);
      const py = sy(v);
      d += `${pen ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`;
      pen = true;
      last = { x: px, y: py };
    }
    return { ...l, d, last };
  });

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const zeroInRange = yMin < 0 && yMax > 0;

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {yLabel}
        </span>
        {lines.map((l) => (
          <span
            key={l.key}
            className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        <button
          type="button"
          onClick={() => downloadCsv(series, lines, xLabel)}
          disabled={series.length === 0}
          title="Өлшеу деректерін кесте (CSV) ретінде жүктеу — Excel не Google Sheets-те ашылады"
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-40 dark:border-white/10 dark:text-slate-400 dark:hover:text-brand-300"
        >
          <Download size={11} /> CSV
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={yLabel}>
        <rect
          x={padL}
          y={padT}
          width={W - padL - padR}
          height={H - padT - padB}
          className="fill-slate-50/80 stroke-slate-200/70 dark:fill-white/[0.04] dark:stroke-white/10"
          strokeWidth={1}
          rx={8}
        />
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={sy(v)}
              y2={sy(v)}
              className="stroke-slate-200 dark:stroke-white/10"
              strokeWidth={1}
            />
            <text
              x={padL - 4}
              y={sy(v) + 3}
              textAnchor="end"
              className="fill-slate-400 text-[8px]"
              style={{ fontSize: 8 }}
            >
              {formatTick(v)}
            </text>
          </g>
        ))}
        {zeroInRange && (
          <line
            x1={padL}
            x2={W - padR}
            y1={sy(0)}
            y2={sy(0)}
            className="stroke-slate-400 dark:stroke-white/30"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
        {paths.map((p) => (
          <path
            key={p.key}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* Marker on the newest sample, so the live end of each trace is obvious */}
        {paths.map((p) =>
          p.last ? (
            <g key={`${p.key}-head`}>
              <circle cx={p.last.x} cy={p.last.y} r={4.5} fill={p.color} opacity={0.2} />
              <circle
                cx={p.last.x}
                cy={p.last.y}
                r={2.2}
                fill={p.color}
                className="stroke-white dark:stroke-slate-900"
                strokeWidth={1}
              />
            </g>
          ) : null
        )}
        <text
          x={W - padR}
          y={H - 6}
          textAnchor="end"
          className="fill-slate-400"
          style={{ fontSize: 8 }}
        >
          {xLabel}
        </text>
        <text x={padL} y={H - 6} className="fill-slate-400" style={{ fontSize: 8 }}>
          {xMin.toFixed(1)}
        </text>
        <text
          x={(padL + W - padR) / 2}
          y={H - 6}
          textAnchor="middle"
          className="fill-slate-400"
          style={{ fontSize: 8 }}
        >
          {((xMin + xMax) / 2).toFixed(1)}
        </text>
      </svg>
    </div>
  );
}

function formatTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return v.toExponential(1);
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1);
  return v.toFixed(2);
}
