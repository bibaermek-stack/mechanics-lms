"use client";

// Shared chrome around every simulation: the brief, the equipment legend, the
// 3D stage, the control column and the data area underneath.

import { Boxes, ClipboardCheck, Target } from "lucide-react";
import type { PascoSpec } from "./pascoCatalog";

export const G = 9.81;

export const COLORS = {
  x: "#3366ff",
  v: "#10b981",
  a: "#f59e0b",
  f: "#ef4444",
  e1: "#8b5cf6",
  e2: "#ec4899",
  e3: "#0ea5e9",
};

export interface SimLayoutProps {
  goal: string;
  formulas: string[];
  /** Scanned PASCO hardware used in this scene. */
  pasco: PascoSpec[];
  /** Self-made equipment modelled for this scene. */
  built: string[];
  stage: React.ReactNode;
  controls: React.ReactNode;
  data: React.ReactNode;
  /** Two or three short questions for the student. */
  tasks: string[];
}

export function SimLayout({
  goal,
  formulas,
  pasco,
  built,
  stage,
  controls,
  data,
  tasks,
}: SimLayoutProps) {
  return (
    <div className="space-y-5">
      {/* Brief -------------------------------------------------------------- */}
      <div className="surface overflow-hidden">
        <div className="flex gap-3.5 p-4">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300">
            <Target size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-label uppercase text-brand-600 dark:text-brand-400">
              Тәжірибенің мақсаты
            </p>
            <p className="mt-1 text-body text-slate-700 dark:text-slate-200">{goal}</p>
          </div>
        </div>
        {formulas.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-900/5 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
            {formulas.map((f) => (
              <span
                key={f}
                className="rounded-lg border border-brand-200/70 bg-white px-2.5 py-1 font-mono text-xs font-medium text-brand-700 shadow-sm dark:border-brand-400/20 dark:bg-brand-900/30 dark:text-brand-200"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stage + controls --------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-3">
          {stage}
          <div className="surface p-3.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-label uppercase text-slate-500 dark:text-slate-400">
              <Boxes size={13} /> Сахнадағы жабдық
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pasco.map((p) => (
                <span
                  key={p.key}
                  title={`${p.partNo} — ${p.measures}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-brand-50 py-1 pl-2 pr-2.5 text-[11px] font-semibold text-brand-700 dark:border-brand-400/20 dark:bg-brand-900/40 dark:text-brand-200"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                  {p.label}
                  <span className="font-mono text-[10px] font-normal opacity-60">{p.partNo}</span>
                </span>
              ))}
              {built.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2 pr-2.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  {b}
                </span>
              ))}
            </div>
            <p className="mt-2.5 text-[10px] leading-snug text-slate-500">
              Көк белгі — PASCO-ның нақты 3D сканерленген құрылғысы; сұр белгі — осы
              симуляция үшін жасалған 3D модель.
            </p>
          </div>
        </div>

        {/* On wide screens the controls follow the student down the page. */}
        <div className="space-y-3 lg:sticky lg:top-4">{controls}</div>
      </div>

      {/* Data --------------------------------------------------------------- */}
      {data}

      {/* Tasks -------------------------------------------------------------- */}
      <div className="overflow-hidden rounded-xl2 border border-amber-200/70 bg-amber-50/60 shadow-sm dark:border-amber-500/20 dark:bg-amber-900/15">
        <p className="flex items-center gap-1.5 border-b border-amber-200/60 px-4 py-2.5 text-label uppercase text-amber-800 dark:border-amber-500/20 dark:text-amber-300">
          <ClipboardCheck size={13} /> Зерттеу тапсырмалары
        </p>
        <ol className="divide-y divide-amber-200/50 dark:divide-amber-500/15">
          {tasks.map((t, i) => (
            <li key={i} className="flex gap-3 px-4 py-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                {i + 1}
              </span>
              <span className="text-body text-slate-700 dark:text-slate-200">{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
