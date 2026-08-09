"use client";

// The student's own analytics.
//
// Every figure on this page comes from that student's records. A new account
// therefore sees empty panels that name the action which would fill them,
// rather than a stranger's transcript — which is what the previous
// module-level MOCK_* constants produced once real sign-ups existed.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { FileDown, Sheet, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { CompetencyRadarChart } from "@/components/charts/CompetencyRadarChart";
import { ActivityBarChart } from "@/components/charts/ActivityBarChart";
import { LessonScoreChart } from "@/components/charts/LessonScoreChart";
import { GradeBreakdownPieChart } from "@/components/charts/GradeBreakdownPieChart";
import { useAuthStore } from "@/lib/authStore";
import { GRADE_WEIGHTS } from "@/lib/competency";
import { formatMinutes, loadStudentStats, type StudentStats } from "@/lib/studentStats";
import { ALL_MODULES } from "@/data/modules";
import type { FinalGradeBreakdown } from "@/lib/types";

const CompetencyGlobe3D = dynamic(
  () => import("@/components/charts/CompetencyGlobe3D").then((m) => m.CompetencyGlobe3D),
  {
    ssr: false,
    loading: () => (
      <div className="surface-sunken flex h-[360px] items-center justify-center text-body text-slate-500">
        3D Құзыреттілік сферасы дайындалуда…
      </div>
    ),
  }
);

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<StudentStats | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    loadStudentStats(user.uid).then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function exportCsv() {
    if (!stats) return;
    const b = stats.grade?.breakdown;
    const rows = [
      ["Критерий", "Салмағы (%)", "Балл (%)"],
      ...(Object.keys(GRADE_WEIGHTS) as (keyof FinalGradeBreakdown)[]).map((k) => [
        k,
        String(GRADE_WEIGHTS[k]),
        // An untouched component exports as "—", not as a zero it never earned.
        b && b[k] > 0 ? String(b[k]) : "—",
      ]),
      ["ЕСЕПТЕЛГЕН БАҒА", String(stats.grade?.coveredWeight ?? 0), String(stats.grade?.weightedTotal ?? "—")],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    // BOM so Excel opens the Cyrillic headers in the right encoding.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const studyTime = stats ? formatMinutes(stats.totalMinutes) : null;

  return (
    <DashboardShell role="student">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-h1">Оқу аналитикасы</h1>
            <p className="text-body text-slate-600 dark:text-slate-400">
              Прогресс, құзыреттілік өсуі және белсенділік көрсеткіштері.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              disabled={!stats?.grade}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              <Sheet size={16} /> Excel (CSV) экспорт
            </button>
            <button onClick={() => window.print()} className="btn-secondary text-sm">
              <FileDown size={16} /> PDF экспорт
            </button>
          </div>
        </div>

        {!stats ? (
          <LoadingBlock />
        ) : !stats.hasAnyActivity ? (
          <Card>
            <EmptyState
              title="Әзірге көрсететін дерек жоқ"
              hint="Аналитика сіздің өз нәтижелеріңізден құралады: викторина тапсырсаңыз, ойын ойнасаңыз немесе БӨЖ жіберсеңіз, осы бет толады."
              href="/modules/1"
              cta="Бірінші сабақтан бастау"
            />
          </Card>
        ) : null}

        {stats && stats.hasAnyActivity && (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <p className="mb-1 text-body text-slate-600 dark:text-slate-400">
                  Есептелген баға
                </p>
                {stats.grade ? (
                  <>
                    <p className="text-3xl font-bold text-brand-600 dark:text-brand-300">
                      {stats.grade.weightedTotal}%
                    </p>
                    <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {stats.grade.competencyLevel} деңгей
                    </p>
                    {/* The honest caveat: this is a mark out of the part of the
                        course that has been recorded, not the final one. */}
                    <p className="mt-2 text-micro text-slate-500 dark:text-slate-400">
                      Қорытынды бағаның {stats.grade.coveredWeight}%-ы есептелді
                      {stats.grade.coveredWeight < 100 && " — қалғаны әлі тапсырылмаған"}
                    </p>
                  </>
                ) : (
                  <p className="text-3xl font-bold text-slate-400">—</p>
                )}
              </Card>

              <Card>
                <p className="mb-2 text-body text-slate-600 dark:text-slate-400">Курс прогресі</p>
                <ProgressBar
                  value={stats.progressPercent}
                  segments={ALL_MODULES.length}
                  label={`${ALL_MODULES.length} сабақтың ${stats.completed}-і аяқталды`}
                />
                <p className="mt-2 text-micro text-slate-500 dark:text-slate-400">
                  {stats.attempted} сабақтың викторинасы тапсырылды
                </p>
              </Card>

              <Card>
                <p className="mb-2 text-body text-slate-600 dark:text-slate-400">
                  Жалпы оқу уақыты
                </p>
                {studyTime ? (
                  <p className="text-3xl font-bold">{studyTime}</p>
                ) : (
                  <>
                    <p className="text-3xl font-bold text-slate-400">—</p>
                    <p className="mt-1 text-micro text-slate-500 dark:text-slate-400">
                      Уақыт есебі әзірге жүргізілмейді
                    </p>
                  </>
                )}
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <p className="mb-3 flex items-center gap-2 font-semibold">
                  <Sparkles size={18} className="text-brand-600 dark:text-brand-400" />
                  Жеке 3D Құзыреттілік Сферасы
                </p>
                {stats.competency ? (
                  <CompetencyGlobe3D values={stats.competency} />
                ) : (
                  <EmptyState
                    title="Құзыреттілік әлі бағаланбаған"
                    hint="Сабақ бетіндегі «Құзыреттілік» бөлімінде 10 критерий бойынша өзін-өзі бағалаудан өтіңіз — сфера сол деңгейлерден құралады."
                    href="/modules/1"
                    cta="Бағалаудан өту"
                  />
                )}
              </Card>

              <Card>
                <p className="mb-3 font-semibold">Құзыреттілік радары (10 критерий)</p>
                {stats.competency ? (
                  <>
                    <CompetencyRadarChart values={stats.competency} />
                    <p className="mt-2 text-micro text-slate-500 dark:text-slate-400">
                      {stats.assessmentCount} бағалау негізінде
                      {stats.competencyPercent !== null && ` · орташа ${stats.competencyPercent}%`}
                    </p>
                  </>
                ) : (
                  <EmptyState
                    title="Радар үшін дерек жоқ"
                    hint="Өзін-өзі бағалаудан өткен соң осында сіздің 10 критерий бойынша профиліңіз шығады."
                    compact
                  />
                )}
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <p className="mb-3 font-semibold">Сабақтар бойынша ұпай</p>
                {stats.attempted > 0 ? (
                  <LessonScoreChart values={stats.lessonScores} label="Менің ұпайым" />
                ) : (
                  <EmptyState title="Әлі бірде-бір викторина тапсырылмаған" compact />
                )}
              </Card>

              <Card>
                <p className="mb-3 font-semibold">Апталық белсенділік</p>
                {stats.hasActivityLog ? (
                  <ActivityBarChart values={stats.weeklyMinutes} />
                ) : (
                  <EmptyState
                    title="Белсенділік уақыты жазылмайды"
                    hint="Бұл көрсеткіш үшін сеанс уақытын жазатын модуль әлі қосылмаған."
                    compact
                  />
                )}
              </Card>
            </div>

            <Card>
              <p className="mb-1 font-semibold">Қорытынды баға құрылымы (салмақтар)</p>
              <p className="mb-3 text-micro text-slate-500 dark:text-slate-400">
                Курстың бағалау схемасы. Қазір бұлардың{" "}
                {stats.grade?.coveredWeight ?? 0}%-ы бойынша нәтижеңіз бар.
              </p>
              <div className="mx-auto max-w-md">
                <GradeBreakdownPieChart />
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
