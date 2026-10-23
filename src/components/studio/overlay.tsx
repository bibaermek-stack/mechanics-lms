"use client";

// 2D graphics drawn over the 3D film: formula cards, live readouts, graphs and
// labels pinned to bodies. Pure DOM/SVG driven by the playhead `t`.

import { useRef } from "react";
import type * as THREE from "three";
import { Html } from "@react-three/drei";
import { useStudioFrame } from "./clock";
import { chapterAt, clamp, seg, smooth, type LessonScript } from "@/lib/studio/timeline";

// ---------------------------------------------------------------------------
// Chrome shared by every film
// ---------------------------------------------------------------------------

export function Chrome({ script, t }: { script: LessonScript; t: number }) {
  const ch = chapterAt(script, t);
  // Fade the caption at each end of its line so cuts do not pop.
  const fade = ch ? Math.min(smooth(seg(t, ch.from, ch.from + 0.3)), 1 - smooth(seg(t, ch.to - 0.3, ch.to))) : 0;
  return (
    <>
      <div className="st-badge">
        <span className="st-badge-num">{script.moduleId}</span>
        <span>
          <div className="st-badge-kicker">Сабақ {script.moduleId} / 10</div>
          <div className="st-badge-title">{script.title}</div>
        </span>
      </div>
      <div className="st-mark">Механика AI LMS</div>
      {ch && (
        <div className="st-caption" style={{ opacity: fade, transform: `translateY(${(1 - fade) * 0.8}cqh)` }}>
          {ch.caption}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

/** Where a card sits. Strings are CSS lengths, normally in cqw / cqh. */
export interface Place {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
}

/** Opacity/slide for something visible during [from, to]. */
export function appear(t: number, from: number, to: number, fade = 0.45) {
  const a = smooth(seg(t, from, from + fade));
  const b = 1 - smooth(seg(t, to - fade, to));
  return clamp(Math.min(a, b));
}

export function Card({
  t,
  from,
  to,
  place,
  title,
  children,
  width,
}: {
  t: number;
  from: number;
  to: number;
  place: Place;
  title?: string;
  children: React.ReactNode;
  width?: string;
}) {
  const o = appear(t, from, to);
  if (o <= 0.001) return null;
  return (
    <div
      className="st-card"
      style={{ ...place, width, opacity: o, transform: `translateY(${(1 - o) * 1.4}cqh)` }}
    >
      {title && <div className="st-card-title">{title}</div>}
      {children}
    </div>
  );
}

export function Formula({ children, note, small }: { children: React.ReactNode; note?: string; small?: boolean }) {
  return (
    <div className="st-formula" style={small ? { fontSize: "2.1cqw" } : undefined}>
      {children}
      {note && <small>{note}</small>}
    </div>
  );
}

export function Row({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
}) {
  return (
    <div className="st-row">
      <span>
        {color && <i className="st-dot" style={{ background: color }} />}
        {label}
      </span>
      <b>
        {value}
        {unit && <span style={{ marginLeft: "0.4cqw", fontWeight: 600 }}>{unit}</span>}
      </b>
    </div>
  );
}

/** Number as a Kazakh reader expects it: decimal comma. */
export function num(v: number, d = 1): string {
  return (Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v).toFixed(d).replace(".", ",").replace("-", "−");
}

// ---------------------------------------------------------------------------
// Plot
// ---------------------------------------------------------------------------

export interface PlotLine {
  fn: (x: number) => number;
  color: string;
  /** Shade the area under the curve up to the cursor. */
  area?: boolean;
  label?: string;
  /** The curve ends here (data units on x); the default is the end of the axis. */
  until?: number;
}

/**
 * A small function plot that draws itself as the film plays: solid up to the
 * cursor, faint after it, with a dot riding the curve. Axes are in data units.
 */
export function Plot({
  lines,
  x0 = 0,
  x1,
  y0 = 0,
  y1,
  cursor,
  xLabel,
  yLabel,
  w = 21,
  h = 13,
  xTicks = 4,
  yTicks = 4,
  guides,
}: {
  lines: PlotLine[];
  x0?: number;
  x1: number;
  y0?: number;
  y1: number;
  /** Current x; the curve is drawn only up to here. */
  cursor: number;
  xLabel: string;
  yLabel: string;
  /** Size in cqw / cqh-ish units: width in cqw, height in cqw too (keeps aspect). */
  w?: number;
  h?: number;
  xTicks?: number;
  yTicks?: number;
  /** Optional dashed horizontal guides: [y, label, side the label sits on]. */
  guides?: ([number, string] | [number, string, "above" | "below"])[];
}) {
  const W = 300;
  const H = (300 * h) / w;
  const padL = 54;
  const padR = 14;
  const padT = 30;
  const padB = 40;
  const px = (x: number) => padL + ((x - x0) / (x1 - x0)) * (W - padL - padR);
  const py = (y: number) => H - padB - ((y - y0) / (y1 - y0)) * (H - padT - padB);
  const cx = clamp(cursor, x0, x1);
  const N = 90;

  const path = (fn: (x: number) => number, upTo: number, from = x0) => {
    const n = Math.max(2, Math.ceil((N * (upTo - from)) / (x1 - x0)));
    let d = "";
    for (let i = 0; i <= n; i++) {
      const x = from + ((upTo - from) * i) / n;
      d += `${i === 0 ? "M" : "L"}${px(x).toFixed(1)},${py(fn(x)).toFixed(1)}`;
    }
    return d;
  };

  // Enough decimals to tell neighbouring ticks apart; steps that are not round fall back to one.
  const decimalsFor = (step: number) => {
    for (let d = 0; d <= 3; d++) {
      const k = Math.abs(step) * 10 ** d;
      if (Math.abs(k - Math.round(k)) < 1e-6) return d;
    }
    return 1;
  };
  const xDec = decimalsFor((x1 - x0) / xTicks);
  const yDec = decimalsFor((y1 - y0) / yTicks);
  const fmtTick = (v: number, d: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : Number(v.toFixed(d)).toString()).replace(".", ",");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={`${w}cqw`} style={{ display: "block", overflow: "visible" }}>
      {/* grid + ticks */}
      {Array.from({ length: xTicks + 1 }, (_, i) => {
        const x = x0 + ((x1 - x0) * i) / xTicks;
        return (
          <g key={`x${i}`}>
            <line x1={px(x)} x2={px(x)} y1={py(y0)} y2={py(y1)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={px(x)} y={H - padB + 18} fontSize={14} textAnchor="middle" fill="#475569" fontWeight={700}>
              {fmtTick(x, xDec)}
            </text>
          </g>
        );
      })}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const y = y0 + ((y1 - y0) * i) / yTicks;
        return (
          <g key={`y${i}`}>
            <line x1={px(x0)} x2={px(x1)} y1={py(y)} y2={py(y)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padL - 7} y={py(y) + 5} fontSize={14} textAnchor="end" fill="#475569" fontWeight={700}>
              {fmtTick(y, yDec)}
            </text>
          </g>
        );
      })}
      {y0 < 0 && y1 > 0 && (
        <line x1={px(x0)} x2={px(x1)} y1={py(0)} y2={py(0)} stroke="#94a3b8" strokeWidth={1.4} />
      )}
      <line x1={px(x0)} x2={px(x0)} y1={py(y0)} y2={py(y1)} stroke="#334155" strokeWidth={2.2} />
      <line x1={px(x0)} x2={px(x1)} y1={py(y0)} y2={py(y0)} stroke="#334155" strokeWidth={2.2} />
      <text x={px(x1)} y={H - 3} fontSize={16} textAnchor="end" fill="#1e293b" fontWeight={800}>
        {xLabel}
      </text>
      <text x={4} y={16} fontSize={16} textAnchor="start" fill="#1e293b" fontWeight={800}>
        {yLabel}
      </text>

      {guides?.map(([y, label, side]: [number, string, ("above" | "below")?]) => (
        <g key={label}>
          <line x1={px(x0)} x2={px(x1)} y1={py(y)} y2={py(y)} stroke="#f59e0b" strokeWidth={1.8} strokeDasharray="5 4" />
          <text x={px(x1) - 2} y={side === "below" ? py(y) + 16 : py(y) - 5} fontSize={14} textAnchor="end" fill="#b45309" fontWeight={800}>
            {label}
          </text>
        </g>
      ))}

      {lines.map((ln, i) => {
        const end = Math.min(ln.until ?? x1, x1);
        const c = Math.min(cx, end);
        return (
          <g key={i}>
            {ln.area && c > x0 && (
              <path
                d={`${path(ln.fn, c)}L${px(c).toFixed(1)},${py(Math.max(y0, 0)).toFixed(1)}L${px(x0).toFixed(1)},${py(Math.max(y0, 0)).toFixed(1)}Z`}
                fill={ln.color}
                opacity={0.18}
              />
            )}
            <path d={path(ln.fn, end)} fill="none" stroke={ln.color} strokeWidth={2} opacity={0.22} strokeDasharray="3 3" />
            {c > x0 && <path d={path(ln.fn, c)} fill="none" stroke={ln.color} strokeWidth={4.2} strokeLinecap="round" />}
            <circle cx={px(c)} cy={py(ln.fn(c))} r={7} fill="#fff" stroke={ln.color} strokeWidth={4} />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Labels pinned to 3D positions
// ---------------------------------------------------------------------------

export function Tag({
  position,
  children,
  tone,
  opacity = 1,
}: {
  position: [number, number, number];
  children: React.ReactNode;
  tone?: "brand" | "red" | "green" | "amber";
  opacity?: number;
}) {
  if (opacity <= 0.01) return null;
  return (
    <Html position={position} zIndexRange={[20, 0]} style={{ pointerEvents: "none", opacity }}>
      <div className="st-tag">
        <div className={`st-tag-chip${tone ? ` is-${tone}` : ""}`}>{children}</div>
        <span className="st-tag-stem" />
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Cut between locations
// ---------------------------------------------------------------------------

/**
 * A quick white dip that peaks at `at`. The scene swaps places under it, so a
 * change of location reads as an edit rather than as a glitch.
 */
export function Dip({ t, at, width = 0.9 }: { t: number; at: number; width?: number }) {
  const o = 1 - clamp(Math.abs(t - at) / (width / 2));
  if (o <= 0.001) return null;
  return <div style={{ position: "absolute", inset: 0, background: "#f8fafc", opacity: smooth(o) }} />;
}

/** Carries 3D children (a label, say) along a moving point. */
export function Follow({
  get,
  children,
}: {
  get: (t: number) => [number, number, number] | null;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  useStudioFrame((t) => {
    const p = get(t);
    ref.current.visible = !!p;
    if (p) ref.current.position.set(p[0], p[1], p[2]);
  });
  return <group ref={ref}>{children}</group>;
}

/**
 * A label that moves with a body and fades in and out. Position and opacity are
 * computed per frame; the text itself is fixed.
 */
export function LiveTag({
  get,
  tone,
  text,
  children,
}: {
  get: (t: number) => { pos: [number, number, number]; opacity?: number } | null;
  tone?: "brand" | "red" | "green" | "amber";
  /** When given, replaces the children and is re-evaluated every frame (a live readout). */
  text?: (t: number) => string;
  children?: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null!);
  const el = useRef<HTMLDivElement>(null!);
  const chip = useRef<HTMLDivElement>(null!);
  useStudioFrame((t) => {
    const g = get(t);
    const o = g ? (g.opacity ?? 1) : 0;
    if (g) group.current.position.set(g.pos[0], g.pos[1], g.pos[2]);
    if (el.current) {
      el.current.style.opacity = String(o);
      el.current.style.visibility = o > 0.01 ? "visible" : "hidden";
    }
    if (text && chip.current && o > 0.01) chip.current.textContent = text(t);
  });
  return (
    <group ref={group}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="st-tag" ref={el} style={{ visibility: "hidden" }}>
          <div ref={chip} className={`st-tag-chip${tone ? ` is-${tone}` : ""}`}>
            {text ? null : children}
          </div>
          <span className="st-tag-stem" />
        </div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------

export interface BarItem {
  label: string;
  value: number;
  color: string;
}

/** Vertical bar meters for comparing a handful of quantities (energies, momenta). */
export function Bars({ items, max, height = 17, unit = "кДж", digits = 0 }: { items: BarItem[]; max: number; height?: number; unit?: string; digits?: number }) {
  return (
    <div style={{ display: "flex", gap: "1.1cqw", alignItems: "flex-end", height: `${height + 6}cqh` }}>
      {items.map((b) => (
        <div key={b.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "5.2cqw", height: "100%", justifyContent: "flex-end" }}>
          <div style={{ fontSize: "1.45cqw", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "#0f172a", marginBottom: "0.3cqw" }}>
            {num(b.value, digits)}
          </div>
          <div style={{ width: "100%", height: `${height}cqh`, background: "rgba(148,163,184,0.25)", borderRadius: "0.5cqw", display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
            <div style={{ width: "100%", height: `${Math.max(0, Math.min(1, b.value / max)) * 100}%`, background: b.color, borderRadius: "0.5cqw" }} />
          </div>
          <div style={{ fontSize: "1.35cqw", fontWeight: 800, color: "#334155", marginTop: "0.35cqw" }}>{b.label}</div>
        </div>
      ))}
      <div style={{ alignSelf: "flex-start", fontSize: "1.2cqw", fontWeight: 700, color: "#64748b" }}>{unit}</div>
    </div>
  );
}
