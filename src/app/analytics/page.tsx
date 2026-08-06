"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CompetencyRadarChart } from "@/components/charts/CompetencyRadarChart";
import { ActivityBarChart } from "@/components/charts/ActivityBarChart";
import { GradeBreakdownPieChart } from "@/components/charts/GradeBreakdownPieChart";
import { useAuthStore } from "@/lib/authStore";
import { computeFinalGrade, GRADE_WEIGHTS } from "@/lib/competency";
import { FileDown, Sheet } from "lucide-react";
import type { FinalGradeBreakdown } from "@/lib/types";

const MOCK_BREAKDOWN: FinalGradeBreakdown = {
  video: 90,
  quiz: 82,
  games: 88,
  bozh: 76,
  googleForm: 85,
  aiActivity: 95,
  forum: 60,
  portfolio: 70,
  finalProject: 65,
  reflectionJournal: 80,
};

const MOCK_RADAR = [4, 3, 4, 3, 4, 5, 4, 3, 4, 4]; // matches RUBRIC_CRITERIA order
const MOCK_WEEKLY = [35, 50, 20, 60, 45, 10, 25];

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const [grade, setGrade] = useState(computeFinalGrade(user?.uid ?? "demo", MOCK_BREAKDOWN));

  useEffect(() => {
    setGrade(computeFinalGrade(user?.uid ?? "demo", MOCK_BREAKDOWN));
  }, [user]);

  function exportCsv() {
    const rows = [
      ["Критерий", "Салмағы (%)", "Балл (%)"],
      ...(Object.keys(GRADE_WEIGHTS) as (keyof FinalGradeBreakdown)[]).map((k) => [
        k,
        String(GRADE_WEIGHTS[k]),
        String(MOCK_BREAKDOWN[k]),
      ]),
      ["ҚОРЫТЫНДЫ БАҒА", "100", String(grade.weightedTotal)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics_report.csv";
    a.click();
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Оқу аналитикасы</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Прогресс, құзыреттілік өсуі және белсенділік көрсеткіштері.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="btn-secondary text-sm"><Sheet size={16} /> Excel (CSV) экспорт</button>
            <button onClick={() => window.print()} className="btn-secondary text-sm"><FileDown size={16} /> PDF экспорт</button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlassCard>
            <p className="mb-1 text-sm text-slate-500 dark:text-slate-400">Қорытынды баға</p>
            <p className="text-3xl font-bold text-brand-600 dark:text-brand-300">{grade.weightedTotal}%</p>
            <p className="mt-1 text-sm">{grade.competencyLevel} деңгей</p>
          </GlassCard>
          <GlassCard>
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Курс прогресі</p>
            <ProgressBar value={68} label="10 сабақтың 6.8-і аяқталды" />
          </GlassCard>
          <GlassCard>
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">Жалпы оқу уақыты</p>
            <p className="text-3xl font-bold">14 сағ 20 мин</p>
          </GlassCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-3 font-semibold">Құзыреттілік радары (10 критерий)</p>
            <CompetencyRadarChart values={MOCK_RADAR} />
          </GlassCard>
          <GlassCard>
            <p className="mb-3 font-semibold">Апталық белсенділік</p>
            <ActivityBarChart values={MOCK_WEEKLY} />
          </GlassCard>
        </div>

        <GlassCard>
          <p className="mb-3 font-semibold">Қорытынды баға құрылымы (салмақтар)</p>
          <div className="mx-auto max-w-md">
            <GradeBreakdownPieChart />
          </div>
        </GlassCard>
      </div>
    </DashboardShell>
  );
}
