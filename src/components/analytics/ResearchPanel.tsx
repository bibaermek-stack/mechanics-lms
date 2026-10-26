"use client";

// The pre/post section of the teacher analytics page — the figures the thesis
// reports. Every number comes from src/lib/analytics/research.ts; this file only
// lays them out and wires the two export buttons.

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { StudentRow } from "@/data/cohort";
import { downloadCsv } from "@/lib/csv";
import {
  compareArms,
  groupNames,
  researchCsvRows,
  researchTable,
  type GroupStats,
} from "@/lib/analytics/research";
import { effectLabel, formatP, hakeBand } from "@/lib/stats";

/** Kazakh and Russian write the decimal mark as a comma. */
const num = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : v.toFixed(digits).replace(".", ",");
const pValue = (p: number) => formatP(p).replace(".", ",");
/** "p < 0,001" or "p = 0,023" — the relation sign belongs with the number. */
const pText = (p: number) => (p < 0.001 ? `p ${pValue(p)}` : `p = ${pValue(p)}`);

const ARMS_KEY = "mechanics-lms:researchArms:";

interface Arms {
  experimental: string;
  control: string;
}

function readArms(owner: string): Arms | null {
  try {
    const raw = window.localStorage.getItem(ARMS_KEY + owner);
    return raw ? (JSON.parse(raw) as Arms) : null;
  } catch {
    return null;
  }
}

const HAKE_BAND: Record<"low" | "medium" | "high", { label: string; variant: "danger" | "warning" | "success" }> = {
  low: { label: "төмен", variant: "danger" },
  medium: { label: "орташа", variant: "warning" },
  high: { label: "жоғары", variant: "success" },
};

export function ResearchPanel({
  rows,
  ownerId,
  isDemo,
  onExportRoster,
}: {
  rows: StudentRow[];
  /** Whose choice of groups this is — it is stored per teacher, in this browser. */
  ownerId: string;
  isDemo: boolean;
  onExportRoster: () => void;
}) {
  const groups = useMemo(() => groupNames(rows), [rows]);
  const table = useMemo(() => researchTable(rows), [rows]);

  const [arms, setArms] = useState<Arms>({ experimental: "", control: "" });
  useEffect(() => {
    const saved = readArms(ownerId);
    const valid = saved && groups.includes(saved.experimental) && groups.includes(saved.control);
    setArms(valid ? saved : { experimental: groups[0] ?? "", control: groups[1] ?? "" });
  }, [ownerId, groups]);

  function choose(next: Arms) {
    setArms(next);
    try {
      window.localStorage.setItem(ARMS_KEY + ownerId, JSON.stringify(next));
    } catch {
      // Private mode: the choice just does not survive a reload.
    }
  }

  const comparison = useMemo(
    () => (arms.experimental && arms.control ? compareArms(rows, arms.experimental, arms.control) : null),
    [rows, arms]
  );

  const anyPaired = table[table.length - 1].paired > 0;

  const columns: Column<GroupStats>[] = [
    { key: "group", header: "Топ", render: (g) => <span className="font-medium">{g.group}</span> },
    {
      key: "n",
      header: "Жұп / барлығы",
      numeric: true,
      render: (g) => `${g.paired} / ${g.students}`,
    },
    {
      key: "pre",
      header: "Бастапқы, %",
      numeric: true,
      render: (g) => (g.preMean === null ? "—" : `${num(g.preMean)} ± ${num(g.preSd)}`),
    },
    {
      key: "post",
      header: "Қорытынды, %",
      numeric: true,
      render: (g) => (g.postMean === null ? "—" : `${num(g.postMean)} ± ${num(g.postSd)}`),
    },
    {
      key: "gain",
      header: "Өсім, п.п.",
      numeric: true,
      render: (g) => (g.gain === null ? "—" : `${g.gain > 0 ? "+" : ""}${num(g.gain)}`),
    },
    {
      key: "hake",
      header: "Hake g",
      numeric: true,
      render: (g) =>
        g.hake === null ? (
          "—"
        ) : (
          <span className="inline-flex items-center justify-end gap-2">
            {num(g.hake, 2)}
            <Badge variant={HAKE_BAND[hakeBand(g.hake)].variant}>{HAKE_BAND[hakeBand(g.hake)].label}</Badge>
          </span>
        ),
    },
    {
      key: "t",
      header: "t (df), p",
      numeric: true,
      render: (g) =>
        g.test ? `${num(g.test.t, 2)} (${g.test.df}), ${pText(g.test.p)}` : "—",
    },
    {
      key: "d",
      header: "Cohen d_z",
      numeric: true,
      render: (g) => (g.test?.dz == null ? "—" : `${num(g.test.dz, 2)} · ${effectLabel(g.test.dz)}`),
    },
  ];

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Зерттеу нәтижесі: бастапқы және қорытынды диагностика"
        description="Бір тест оқу басталғанға дейін және курстан кейін өткізіледі. Тек екі нәтижесі де бар студенттер есепке кіреді."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={onExportRoster} className="btn-secondary px-4 py-2 text-sm">
              <FileSpreadsheet size={16} /> Студенттер (CSV)
            </button>
            <button
              onClick={() => downloadCsv("zertteu-natizhesi", researchCsvRows(table, comparison))}
              disabled={!anyPaired}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
            >
              <FlaskConical size={16} /> Зерттеу кестесі (CSV)
            </button>
          </div>
        }
      />

      {isDemo && (
        <p className="text-micro text-amber-600 dark:text-amber-300">
          Бұл — демо-топ: сандар ойдан құрастырылған, оларды зерттеу нәтижесі ретінде пайдалануға болмайды.
        </p>
      )}

      {!anyPaired ? (
        <EmptyState
          title="Салыстыруға жеткілікті деректер жоқ"
          hint="Студенттер «Диагностика» бөлімінде бастапқы тестті тапсырып, курстан кейін қорытынды тестті тапсырғанда нәтижелер осында шығады."
        />
      ) : (
        <>
          <DataTable columns={columns} rows={table} rowKey={(g) => g.group} />
          <p className="text-micro text-slate-500 dark:text-slate-400">
            x̄ ± SD — орташа және стандартты ауытқу. Hake g = (post − pre) / (100 − pre), топтың орташа мәндері бойынша:
            &lt; 0,3 төмен, 0,3–0,7 орташа, ≥ 0,7 жоғары. t — жұптасқан t-критерийі, d_z — өсімнің стандартты өлшемі.
          </p>

          {groups.length >= 2 && (
            <Card>
              <p className="text-h3">Екі топты салыстыру</p>
              <p className="mt-1 text-micro text-slate-600 dark:text-slate-400">
                Қай топ эксперименттік (жаңа платформамен оқыған), қайсысы бақылау екенін таңдаңыз. Таңдау осы
                браузерде сақталады.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-micro font-medium text-slate-600 dark:text-slate-300">
                  Эксперименттік топ
                  <select
                    value={arms.experimental}
                    onChange={(e) => choose({ ...arms, experimental: e.target.value })}
                    className="input-glow mt-1 w-full"
                  >
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-micro font-medium text-slate-600 dark:text-slate-300">
                  Бақылау тобы
                  <select
                    value={arms.control}
                    onChange={(e) => choose({ ...arms, control: e.target.value })}
                    className="input-glow mt-1 w-full"
                  >
                    {groups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {arms.experimental === arms.control ? (
                <p className="mt-4 text-micro text-amber-600 dark:text-amber-300">
                  Екі топты салыстыру үшін әртүрлі топтар таңдаңыз.
                </p>
              ) : comparison?.gains ? (
                <div className="mt-4 space-y-2 text-body text-slate-700 dark:text-slate-300">
                  <p>
                    <strong>Өсім</strong> (post − pre): {arms.experimental} — {num(comparison.experimental.gain)} п.п.,{" "}
                    {arms.control} — {num(comparison.control.gain)} п.п. Айырма{" "}
                    <strong>
                      {comparison.gains.diff > 0 ? "+" : ""}
                      {num(comparison.gains.diff)} п.п.
                    </strong>
                    : Welch t({num(comparison.gains.df, 1)}) = {num(comparison.gains.t, 2)},{" "}
                    {pText(comparison.gains.p)}, Cohen d = {num(comparison.gains.d, 2)} (
                    {effectLabel(comparison.gains.d)} әсер).{" "}
                    {comparison.gains.p < 0.05 ? "Айырма статистикалық мәнді." : "Айырма статистикалық мәнді емес."}
                  </p>
                  {comparison.baseline && (
                    <p className={comparison.baseline.p < 0.05 ? "text-amber-600 dark:text-amber-300" : ""}>
                      <strong>Бастапқы деңгей:</strong> {num(comparison.baseline.mean1)}% және{" "}
                      {num(comparison.baseline.mean2)}%, {pText(comparison.baseline.p)}.{" "}
                      {comparison.baseline.p < 0.05
                        ? "Топтар оқуды бастағанда әртүрлі деңгейде болған — өсімді салыстыру абайлап түсіндірілуі керек."
                        : "Топтар бастапқы деңгейі бойынша айтарлықтай ерекшеленбейді."}
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-micro text-slate-500 dark:text-slate-400">
                  Салыстыру үшін әр топта кемінде екі студенттің екі нәтижесі де болуы керек.
                </p>
              )}
            </Card>
          )}

          <p className="text-micro text-slate-500 dark:text-slate-400">
            Ескерту: топтар кездейсоқ бөлінбесе және студент саны аз болса (n &lt; 30), p-мән мен әсер өлшемі
            алдын ала көрсеткіш қана; себеп-салдарлық қорытынды жасау үшін зерттеу дизайнын (кездейсоқтандыру,
            бастапқы деңгейді бақылау) бөлек негіздеу керек.
          </p>
        </>
      )}
    </section>
  );
}
