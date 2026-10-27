"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { fmt } from "@/data/quizBank";
import type { Observation } from "@/data/predictions";
import { useReducedMotion } from "@/lib/useReducedMotion";

/** Real seconds a scene takes to play: slowed down when the physics is quick, never dragging. */
const playSeconds = (sim: number) => Math.min(5, Math.max(2.5, sim * 2));

/** 0 → 1 over `seconds`, restartable. With reduced motion, it is simply 1. */
function useProgress(seconds: number, reduced: boolean) {
  const [p, setP] = useState(reduced ? 1 : 0);
  const [run, setRun] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (reduced) {
      setP(1);
      return;
    }
    const t0 = performance.now();
    const frame = (now: number) => {
      const v = Math.min(1, (now - t0) / (seconds * 1000));
      setP(v);
      if (v < 1) raf.current = requestAnimationFrame(frame);
    };
    setP(0);
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [seconds, reduced, run]);
  return { p, replay: () => setRun((n) => n + 1) };
}

/**
 * What was measured: the scene (bodies falling, runners racing, or just bars) and,
 * always, the numbers themselves. The numbers are the evidence; the animation is
 * there so the moment of surprise is felt, not only read.
 */
export function ObservationView({ observation }: { observation: Observation }) {
  const reduced = useReducedMotion();
  const { scene, measurements } = observation;
  const seconds = scene.kind === "bars" ? 0.8 : playSeconds(scene.duration);
  const { p, replay } = useProgress(seconds, reduced);
  const t = scene.kind === "bars" ? 0 : p * scene.duration;

  const groups = new Map<string, typeof measurements>();
  for (const m of measurements) groups.set(m.unit, [...(groups.get(m.unit) ?? []), m]);

  return (
    <div className="space-y-3">
      {scene.kind === "paths" && <Paths scene={scene} t={t} />}
      {scene.kind === "race" && <Race scene={scene} t={t} />}

      {scene.kind !== "bars" && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-micro text-slate-500 dark:text-slate-400">Баяулатылған көрсетілім · модель уақыты {fmt(t, 2)} с</p>
          <button onClick={replay} className="btn-ghost !px-2 !py-1 text-micro">
            <RotateCcw size={12} /> Қайта көру
          </button>
        </div>
      )}

      <div className="space-y-3 rounded-xl bg-slate-100 p-3 dark:bg-white/5">
        {[...groups.entries()].map(([unit, list]) => {
          const max = Math.max(...list.map((m) => Math.abs(m.value)), 1e-12);
          return (
            <ul key={unit} className="space-y-2">
              {list.map((m) => (
                <li key={m.key}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{m.label}</span>
                    <span className="data-num shrink-0 font-semibold text-slate-900 dark:text-white">
                      {fmt(m.value, Math.abs(m.value) >= 100 ? 0 : Math.abs(m.value) >= 10 ? 1 : 2)} {m.unit}
                    </span>
                  </div>
                  {scene.kind === "bars" && (
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" aria-hidden>
                      <div
                        className="h-full rounded-full bg-brand-500 transition-[width] duration-700"
                        style={{ width: `${(Math.abs(m.value) / max) * 100 * (reduced ? 1 : p)}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          );
        })}
      </div>
    </div>
  );
}

function Paths({ scene, t }: { scene: Extract<Observation["scene"], { kind: "paths" }>; t: number }) {
  const { w, h } = scene.world;
  const r = Math.max(w, h) * 0.028;
  const sample = (b: (typeof scene.bodies)[number]) => {
    const upTo = Math.min(t, b.end);
    const n = 40;
    return Array.from({ length: n + 1 }, (_, i) => b.at((upTo * i) / n));
  };
  return (
    <div className="overflow-hidden rounded-xl bg-sky-100 dark:bg-slate-900" role="img" aria-label="Денелердің қозғалысы">
      <svg viewBox={`${-w * 0.03} ${-h * 0.03} ${w * 1.06} ${h * 1.06}`} className="block w-full" style={{ maxHeight: 280 }}>
        <line x1={-w * 0.03} x2={w * 1.03} y1={h} y2={h} stroke="#65a30d" strokeWidth={r * 0.8} />
        {scene.bodies.map((b) => {
          const pts = sample(b);
          const now = b.at(Math.min(t, b.end));
          return (
            <g key={b.label}>
              <polyline
                points={pts.map((q) => `${q.x},${h - q.y}`).join(" ")}
                fill="none"
                stroke={b.color}
                strokeWidth={r * 0.25}
                strokeDasharray={`${r * 0.6} ${r * 0.6}`}
                opacity={0.7}
              />
              <circle cx={now.x} cy={h - now.y} r={r} fill={b.color} />
            </g>
          );
        })}
      </svg>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 px-3 pb-2 text-micro text-slate-700 dark:text-slate-300">
        {scene.bodies.map((b) => (
          <li key={b.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: b.color }} aria-hidden />
            {b.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Race({ scene, t }: { scene: Extract<Observation["scene"], { kind: "race" }>; t: number }) {
  return (
    <div className="space-y-2.5 rounded-xl bg-slate-100 p-3 dark:bg-white/5" role="img" aria-label="Жарыс">
      {scene.lanes.map((lane) => {
        const f = lane.at(t);
        const done = lane.finish !== null && t >= lane.finish;
        return (
          <div key={lane.label}>
            <div className="flex items-baseline justify-between gap-2 text-micro text-slate-700 dark:text-slate-300">
              <span>{lane.label}</span>
              <span className="data-num">{done ? `${fmt(lane.finish!, 2)} с` : lane.finish === null ? "" : "…"}</span>
            </div>
            <div className="relative mt-1 h-3 rounded-full bg-slate-200 dark:bg-white/10">
              <div className="absolute inset-y-0 right-0 w-0.5 bg-slate-400" aria-hidden />
              <span
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-white shadow dark:border-slate-900"
                style={{ left: `${Math.min(1, f) * 100}%`, background: lane.color }}
                aria-hidden
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
