"use client";

/** The four answer colours: always with their letter, so colour is never the only signal. */
export const OPTION_STYLE = [
  { letter: "A", bg: "bg-rose-600", ring: "ring-rose-300", soft: "bg-rose-500/15" },
  { letter: "B", bg: "bg-sky-600", ring: "ring-sky-300", soft: "bg-sky-500/15" },
  { letter: "C", bg: "bg-amber-500", ring: "ring-amber-300", soft: "bg-amber-500/15" },
  { letter: "D", bg: "bg-emerald-600", ring: "ring-emerald-300", soft: "bg-emerald-500/15" },
] as const;

export function TimeBar({ remainingMs, totalMs }: { remainingMs: number | null; totalMs: number }) {
  const left = remainingMs === null ? 0 : Math.max(0, Math.min(1, remainingMs / totalMs));
  return (
    <div className="space-y-1">
      <div className="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={Math.round(totalMs / 1000)} aria-valuenow={Math.ceil((remainingMs ?? 0) / 1000)} aria-label="Қалған уақыт">
        <div className={`h-full transition-[width] duration-200 ease-linear ${left < 0.25 ? "bg-rose-500" : "bg-brand-500"}`} style={{ width: `${left * 100}%` }} />
      </div>
      <p className="data-num text-right text-micro text-slate-500 dark:text-slate-400">{Math.ceil((remainingMs ?? 0) / 1000)} с</p>
    </div>
  );
}

export const ordinal = (n: number) => `${n}-орын`;
