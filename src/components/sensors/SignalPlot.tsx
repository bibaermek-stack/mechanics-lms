"use client";

import { useMemo } from "react";
import type { Sample } from "@/lib/sensors/analysis";
import { magnitude } from "@/lib/sensors/analysis";
import { decimate } from "@/lib/sensors/plot";
import type { Highlight } from "@/lib/sensors/experiments";

const W = 360, H = 190;
const PAD = { l: 34, r: 8, t: 10, b: 24 };

const niceStep = (span: number) => {
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
};

/**
 * One signal against time, in plain SVG so it scales to any phone and reads for a
 * screen reader. Either the length of the acceleration vector, or one axis.
 */
export function SignalPlot({
  samples,
  axis,
  reference,
  fit = false,
  highlights = [],
  label,
}: {
  samples: Sample[];
  /** Plot one axis instead of |a|. */
  axis?: "x" | "y" | "z";
  /** A dashed horizontal line, e.g. g. */
  reference?: { value: number; label: string };
  /** Zoom to the data. Without it the scale starts at zero, which is how a free fall shows. */
  fit?: boolean;
  highlights?: Highlight[];
  label: string;
}) {
  const plot = useMemo(() => {
    const pts = decimate(samples.map((s) => ({ t: s.t, v: axis ? s[axis] : magnitude(s) })), 480);
    const tMax = samples[samples.length - 1].t || 1;
    const vals = pts.map((p) => p.v);
    const dataLo = Math.min(...vals, ...(reference ? [reference.value] : []));
    const dataHi = Math.max(...vals, ...(reference ? [reference.value] : []));
    // zoomed in, never closer than ±0,3: a still phone's scatter should look like scatter, not like a mountain range
    const pad = fit ? Math.max((dataHi - dataLo) * 0.15, 0.3) : (dataHi - dataLo) * 0.06;
    const lo = fit ? dataLo - pad : 0;
    const hi = dataHi + pad;
    const step = niceStep(hi - lo);
    const yTicks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) yTicks.push(Math.round(v * 1e6) / 1e6);
    const tStep = tMax <= 8 ? 1 : tMax <= 20 ? 2 : tMax <= 40 ? 5 : 10;
    const xTicks: number[] = [];
    for (let t = 0; t <= tMax + 1e-9; t += tStep) xTicks.push(t);
    const x = (t: number) => PAD.l + (t / tMax) * (W - PAD.l - PAD.r);
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join("");
    return { d, x, y, xTicks, yTicks, lo, hi };
  }, [samples, axis, reference, fit]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label}>
      {highlights.map((h, i) => (
        <g key={i}>
          <rect
            x={plot.x(h.from)}
            y={PAD.t}
            width={Math.max(2, plot.x(h.to) - plot.x(h.from))}
            height={H - PAD.t - PAD.b}
            className={h.tone === "good" ? "fill-emerald-500/20" : "fill-amber-500/20"}
          />
          <text x={(plot.x(h.from) + plot.x(h.to)) / 2} y={PAD.t + 10} textAnchor="middle" fontSize="10" className="fill-slate-600 dark:fill-slate-300">
            {h.label}
          </text>
        </g>
      ))}
      {plot.yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={plot.y(v)} y2={plot.y(v)} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />
          <text x={PAD.l - 4} y={plot.y(v) + 3.5} textAnchor="end" fontSize="10" className="fill-slate-500 dark:fill-slate-400">
            {String(v).replace(".", ",")}
          </text>
        </g>
      ))}
      {plot.xTicks.map((t) => (
        <text key={t} x={plot.x(t)} y={H - 8} textAnchor="middle" fontSize="10" className="fill-slate-500 dark:fill-slate-400">
          {t} с
        </text>
      ))}
      {reference && reference.value >= plot.lo && reference.value <= plot.hi && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={plot.y(reference.value)} y2={plot.y(reference.value)} className="stroke-slate-500 dark:stroke-slate-400" strokeDasharray="4 3" strokeWidth="1" />
          <text x={W - PAD.r} y={plot.y(reference.value) - 3} textAnchor="end" fontSize="10" className="fill-slate-500 dark:fill-slate-400">
            {reference.label}
          </text>
        </g>
      )}
      <path d={plot.d} fill="none" className="stroke-brand-500" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
