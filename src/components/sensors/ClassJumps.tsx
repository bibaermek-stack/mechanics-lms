"use client";

import { useEffect, useState } from "react";
import { loadClassJumps } from "@/lib/sensors/classData";
import { binOf, histogram, standingAmong, type ClassBests } from "@/lib/sensors/standing";
import { num } from "@/lib/sensors/experiments";
import type { AppUser } from "@/lib/types";

const BIN = 0.05; // m

/**
 * How the class jumps, with no names: only your bar is marked. Everyone's best is
 * a single number; the database hands over numbers and an "it's me" flag, never a person.
 */
export function ClassJumps({ user, current, refreshKey }: { user: AppUser; current: number | null; refreshKey: number }) {
  const [data, setData] = useState<ClassBests | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadClassJumps(user)
      .then((d) => !cancelled && (setData(d), setFailed(false)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [user, refreshKey]);

  if (failed) return <p className="text-micro text-slate-500 dark:text-slate-400">Сынып нәтижелері қазір жүктелмеді.</p>;
  if (!data) return <p className="text-micro text-slate-500 dark:text-slate-400">Жүктелуде…</p>;

  const mine = Math.max(data.mine ?? 0, current ?? 0) || null;
  if (data.others.length === 0) {
    return (
      <p className="text-body text-slate-600 dark:text-slate-400">
        Сыныптастарыңның ешқайсысы әлі секіру өлшемін сақтаған жоқ. Достарыңа айт — салыстыратын болады. (Салыстыру тек оқытушың қабылдаған сынып ішінде жүреді.)
      </p>
    );
  }

  const all = mine ? [...data.others, mine] : data.others;
  const bins = histogram(all, BIN);
  const top = Math.max(...bins.map((b) => b.count));
  const meBin = mine ? binOf(bins, mine) : -1;
  const st = mine ? standingAmong(mine, data.others) : null;

  return (
    <div className="space-y-3">
      {st && st.percentile !== null && (
        <p className="text-body text-slate-700 dark:text-slate-300">
          Үздік нәтижең — <strong className="data-num">{num(mine!)} м</strong>. Сыныптастар ({st.n}): сенен төмен — {st.below}, тең — {st.equal}, жоғары — {st.above}.
        </p>
      )}
      <div className="flex items-end gap-1" role="img" aria-label={`Сыныптың секіру биіктігінің таралуы, ${all.length} адам`} style={{ height: 96 }}>
        {bins.map((b, i) => (
          <div key={b.from} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
            <div
              className={`w-full rounded-t ${i === meBin ? "bg-brand-500" : "bg-slate-300 dark:bg-white/25"}`}
              style={{ height: `${Math.max(6, (b.count / top) * 100)}%` }}
              title={`${num(b.from)}–${num(b.to)} м: ${b.count}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-micro text-slate-500 dark:text-slate-400">
        <span className="data-num">{num(bins[0].from)} м</span>
        <span className="data-num">{num(bins[bins.length - 1].to)} м</span>
      </div>
      {meBin >= 0 && <p className="text-micro text-slate-500 dark:text-slate-400">Көк баған — сен. Басқалардың аты көрінбейді.</p>}
    </div>
  );
}
