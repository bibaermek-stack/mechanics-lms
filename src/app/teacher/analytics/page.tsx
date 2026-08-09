"use client";

import dynamic from "next/dynamic";
import { FileDown, Sheet, Sparkles, TrendingUp, Clock, Grid } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ActivityBarChart } from "@/components/charts/ActivityBarChart";
import { CompetencyRadarChart } from "@/components/charts/CompetencyRadarChart";
import { LessonScoreChart } from "@/components/charts/LessonScoreChart";
import { ProgressDistributionChart } from "@/components/charts/ProgressDistributionChart";
import { CompletionFunnel } from "@/components/charts/CompletionFunnel";
import { ActionList } from "@/components/ui/ActionList";
import { WeeklyHeatmapChart } from "@/components/charts/WeeklyHeatmapChart";
import { LessonScatterChart } from "@/components/charts/LessonScatterChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { ALL_MODULES } from "@/data/modules";
import {
  COHORT,
  cohortSummary,
  cohortWeekly,
  lessonAverages,
  lessonCompletion,
  progressDistribution,
  studentAverage,
  studentProgress,
  type StudentRow,
} from "@/data/cohort";
import { buildActions } from "@/data/recommendations";

// Dynamic imports for Three.js components
const ScoreMatrix3D = dynamic(
  () => import("@/components/charts/ScoreMatrix3D").then((m) => m.ScoreMatrix3D),
  {
    ssr: false,
    loading: () => (
      <div className="surface-sunken flex h-[360px] items-center justify-center text-body text-slate-500">
        3D Матрица диаграммасы дайындалуда…
      </div>
    ),
  }
);

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

const COMPETENCY = [4.2, 3.8, 4.5, 3.2, 3.9, 4.1, 3.5, 3.0, 4.0, 3.7];

export default function TeacherAnalyticsPage() {
  const summary = cohortSummary();
  const averages = lessonAverages();
  const completion = lessonCompletion();
  const actions = buildActions();

  const known = averages.filter((a): a is number => a !== null);
  const weakest = averages.indexOf(Math.min(...known));
  const strongest = averages.indexOf(Math.max(...known));

  const columns: Column<StudentRow>[] = [
    { key: "name", header: "Студент", render: (r) => r.fullName },
    { key: "group", header: "Топ", width: "80px", render: (r) => r.group },
    {
      key: "progress",
      header: "Прогресс",
      numeric: true,
      render: (r) => `${studentProgress(r)}%`,
    },
    { key: "avg", header: "Орташа ұпай", numeric: true, render: (r) => `${studentAverage(r)}%` },
    {
      key: "active",
      header: "Соңғы кіру",
      numeric: true,
      render: (r) => (r.daysSinceActive === 0 ? "бүгін" : `${r.daysSinceActive} күн`),
    },
    {
      key: "status",
      header: "Мәртебе",
      width: "150px",
      render: (r) => {
        const p = studentProgress(r);
        const a = studentAverage(r);
        if (p < 50 && a < 65) return <Badge variant="danger">Қауіп тобы</Badge>;
        if (r.daysSinceActive >= 7) return <Badge variant="warning">Белсенді емес</Badge>;
        return <Badge variant="success">Белсенді</Badge>;
      },
    },
  ];

  return (
    <DashboardShell role="teacher">
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Есептер мен аналитика"
          description={`${summary.students} студент · ${ALL_MODULES.length} сабақ · апталық белсенділік ${summary.weeklyMinutes} минут`}
          action={
            <div className="flex gap-2">
              <button className="btn-secondary px-4 py-2 text-sm">
                <Sheet size={16} /> Excel экспорт
              </button>
              <button onClick={() => window.print()} className="btn-secondary px-4 py-2 text-sm">
                <FileDown size={16} /> PDF экспорт
              </button>
            </div>
          }
        />

        {/* Actionable Work Planner Widget ("Не істеу керек") */}
        <section className="space-y-3">
          <SectionHeader
            title="Не істеу керек"
            description="Аналитика көрсеткіштерінен алынған, маңыздылығы мен басымдығы бойынша реттелген мұғалімнің тапсырмалар тізімі."
          />
          <ActionList items={actions} />
        </section>

        {/* Key Metrics Stats Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Орташа курс прогресі"
            value={summary.avgProgress}
            unit="%"
            context={`${summary.students} студент бойынша`}
            tone="brand"
          />
          <StatCard
            label="Орташа викторина ұпайы"
            value={summary.avgScore}
            unit="%"
            context={`Ең әлсіз: ${weakest + 1}-сабақ (${averages[weakest]}%)`}
            tone="emerald"
          />
          <StatCard
            label="Орташа құзыреттілік"
            value={summary.avgCompetency}
            unit="/ 5"
            context="10 критерийлі рубрика"
            tone="amber"
          />
          <StatCard
            label="Тексерілмеген тапсырма"
            value={summary.ungraded}
            context="БӨЖ кері байланыс күтуде"
            tone={summary.ungraded > 0 ? "rose" : "default"}
          />
        </div>

        {/* 3D Visualizations Section ----------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 3D Score Matrix */}
          <Card>
            <SectionHeader
              title="Студенттер × сабақтар: 3D Ұпай Матрицасы"
              description="Студенттер мен сабақтар нәтижелерін 3D бағандар немесе рельефтік тор түрінде айналдырып визуализациялау."
            />
            <div className="mt-4">
              <ScoreMatrix3D rows={COHORT} />
            </div>
          </Card>

          {/* 3D Competency Globe */}
          <Card>
            <SectionHeader
              title="3D Құзыреттілік Сферасы"
              description="Курстың 10 негізгі физика-инженерлік құзыреттілігінің студенттер арасында меңгерілу деңгейі."
            />
            <div className="mt-4">
              <CompetencyGlobe3D values={COMPETENCY} />
            </div>
          </Card>
        </div>

        {/* Advanced 2D Charts Grid ------------------------------------------- */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Time Series Trend Line Chart */}
          <Card>
            <SectionHeader
              title="Үлгерім мен Белсенділік Тренды"
              description="Апталар бойынша орташа викторина ұпайы мен студенттердің оқу сағаттарының өсу динамикасы."
            />
            <div className="mt-4">
              <TrendLineChart />
            </div>
          </Card>

          {/* Weekly Heatmap Activity Chart */}
          <Card>
            <SectionHeader
              title="Апталық Сабақ Оқу Жүктемесі (Heatmap)"
              description="Апта күндері мен сағаттары бойынша платформаны пайдалану тығыздығы."
            />
            <div className="mt-4">
              <WeeklyHeatmapChart />
            </div>
          </Card>

          {/* Lesson Scatter/Bubble Chart */}
          <Card className="lg:col-span-2">
            <SectionHeader
              title="Сабақтар Күрделілігі мен Жұмсалған Уақыт Анализы"
              description="Орташа ұпай (X) vs Жұмсалған уақыт (Y) vs Студенттердің жетпей шығып қалуы (Шар өлшемі)."
            />
            <div className="mt-4">
              <LessonScatterChart />
            </div>
          </Card>

          {/* Lesson Scores Bar Chart */}
          <Card>
            <p className="mb-1 text-h3">Сабақтар бойынша орташа ұпай</p>
            <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
              Ең жоғары: {strongest + 1}-сабақ ({averages[strongest]}%) · ең төмен: {weakest + 1}-сабақ (
              {averages[weakest]}%)
            </p>
            <LessonScoreChart values={averages} />
          </Card>

          {/* Progress Distribution */}
          <Card>
            <p className="mb-1 text-h3">Прогресс таралуы</p>
            <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
              Орташа мән топтың біркелкі екенін көрсетпейді — таралу көрсетеді.
            </p>
            <ProgressDistributionChart buckets={progressDistribution()} />
          </Card>

          {/* Completion Funnel */}
          <Card>
            <p className="mb-1 text-h3">Сабақтарды аяқтау және шығып қалу</p>
            <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
              Оң жақтағы қызыл сан — алдыңғы сабақпен салыстырғанда жетпеген студент саны.
            </p>
            <CompletionFunnel counts={completion} total={COHORT.length} />
          </Card>

          {/* Weekly Minutes Activity */}
          <Card>
            <p className="mb-4 text-h3">Топтың апталық белсенділігі (минут)</p>
            <ActivityBarChart values={cohortWeekly()} />
          </Card>
        </div>

        {/* Roster Table ------------------------------------------------------ */}
        <section>
          <SectionHeader
            title="Студенттер тізімі"
            description="Мәртебе жоғарыдағы «не істеу керек» тізімімен бір ережеден есептеледі."
          />
          <div className="mt-3">
            <DataTable columns={columns} rows={COHORT} rowKey={(r) => r.id} />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
