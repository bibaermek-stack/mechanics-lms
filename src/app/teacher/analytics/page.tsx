"use client";

import dynamic from "next/dynamic";
import { FileDown, Sheet } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { ActivityBarChart } from "@/components/charts/ActivityBarChart";
import { LessonScoreChart } from "@/components/charts/LessonScoreChart";
import { ProgressDistributionChart } from "@/components/charts/ProgressDistributionChart";
import { CompletionFunnel } from "@/components/charts/CompletionFunnel";
import { ActionList } from "@/components/ui/ActionList";
import { WeeklyHeatmapChart } from "@/components/charts/WeeklyHeatmapChart";
import { LessonScatterChart } from "@/components/charts/LessonScatterChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { ResearchPanel } from "@/components/analytics/ResearchPanel";
import { useCohort } from "@/components/analytics/useCohort";
import { ALL_MODULES } from "@/data/modules";
import {
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
import { useAuthStore } from "@/lib/authStore";
import { downloadCsv } from "@/lib/csv";
import { rosterCsvRows } from "@/lib/analytics/research";
import type { CohortData } from "@/lib/analytics/cohort";

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

export default function TeacherAnalyticsPage() {
  return (
    <DashboardShell role="teacher">
      {/* A separate component, so the cohort is only fetched once RequireAuth
          has let a teacher through. */}
      <AnalyticsBody />
    </DashboardShell>
  );
}

function AnalyticsBody() {
  const user = useAuthStore((s) => s.user);
  const { data, loading, error, reload } = useCohort(user);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" title="Есептер мен аналитика" />
        <LoadingBlock label="Студенттердің нәтижелері жүктелуде…" lines={4} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" title="Есептер мен аналитика" />
        <div className="surface-sunken p-6 text-center">
          <p className="text-body text-rose-600 dark:text-rose-300">{error ?? "Деректер жоқ."}</p>
          <button onClick={() => void reload()} className="btn-secondary mt-4 px-4 py-2 text-sm">
            Қайта көру
          </button>
        </div>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" title="Есептер мен аналитика" />
        <EmptyState
          title="Әлі бірде-бір студент қосылмаған"
          hint="Аналитика сіз қабылдаған студенттердің нәтижелерінен құралады. Студент сіздің кодыңызбен сұраныс жібергенде, оны қабылдаңыз."
          href="/teacher/students"
          cta="Студенттер бөліміне өту"
        />
      </div>
    );
  }

  return <Analytics data={data} ownerId={user!.uid} />;
}

function Analytics({ data, ownerId }: { data: CohortData; ownerId: string }) {
  const rows = data.rows;
  const isDemo = data.source === "demo";
  const unit = data.activityUnit === "minutes" ? "минут" : "әрекет";

  const summary = cohortSummary(rows, data.competencyLevel);
  const averages = lessonAverages(rows);
  const completion = lessonCompletion(rows);
  const actions = buildActions(rows);

  const known = averages.filter((a): a is number => a !== null);
  const weakest = known.length ? averages.indexOf(Math.min(...known)) : -1;
  const strongest = known.length ? averages.indexOf(Math.max(...known)) : -1;

  const exportRoster = () => downloadCsv("studentter", rosterCsvRows(rows));

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
      key: "diag",
      header: "Диагностика (бастапқы → қорытынды)",
      numeric: true,
      render: (r) =>
        `${typeof r.pre === "number" ? `${r.pre}%` : "—"} → ${typeof r.post === "number" ? `${r.post}%` : "—"}`,
    },
    {
      key: "active",
      header: "Соңғы кіру",
      numeric: true,
      render: (r) =>
        r.daysSinceActive === null ? "—" : r.daysSinceActive === 0 ? "бүгін" : `${r.daysSinceActive} күн`,
    },
    {
      key: "status",
      header: "Мәртебе",
      width: "150px",
      render: (r) => {
        const p = studentProgress(r);
        const a = studentAverage(r);
        if (p < 50 && a < 65) return <Badge variant="danger">Қауіп тобы</Badge>;
        if (r.daysSinceActive === null || r.daysSinceActive >= 7) return <Badge variant="warning">Белсенді емес</Badge>;
        return <Badge variant="success">Белсенді</Badge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Есептер мен аналитика"
        description={`${summary.students} студент · ${ALL_MODULES.length} сабақ · соңғы аптадағы белсенділік ${summary.weeklyActivity} ${unit}`}
        action={
          <div className="flex gap-2">
            <button onClick={exportRoster} className="btn-secondary px-4 py-2 text-sm">
              <Sheet size={16} /> Excel (CSV)
            </button>
            <button onClick={() => window.print()} className="btn-secondary px-4 py-2 text-sm">
              <FileDown size={16} /> PDF экспорт
            </button>
          </div>
        }
      />

      {isDemo && (
        <div
          role="note"
          className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-body text-amber-900 dark:border-amber-400/25 dark:bg-amber-900/20 dark:text-amber-100"
        >
          <strong>Демо деректер.</strong> Сервер қосылмағандықтан, төмендегі студенттер мен сандар ойдан құрастырылған.
          Нақты нәтижелер көру үшін Supabase қосыңыз (DEPLOYMENT.md).
        </div>
      )}

      {/* Actionable Work Planner Widget ("Не істеу керек") */}
      <section className="space-y-3">
        <SectionHeader
          title="Не істеу керек"
          description="Аналитика көрсеткіштерінен алынған, маңыздылығы мен басымдығы бойынша реттелген мұғалімнің тапсырмалар тізімі."
        />
        <ActionList items={actions} />
      </section>

      {/* Key Metrics Stats Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Орташа курс прогресі"
          value={summary.avgProgress}
          unit="%"
          context={`${summary.students} студент бойынша`}
          tone="brand"
        />
        <StatCard
          label="Орташа викторина ұпайы"
          value={known.length ? summary.avgScore : "—"}
          unit={known.length ? "%" : undefined}
          context={weakest >= 0 ? `Ең әлсіз: ${weakest + 1}-сабақ (${averages[weakest]}%)` : "Әлі викторина тапсырылмаған"}
          tone="emerald"
        />
        <StatCard
          label="Орташа құзыреттілік"
          value={summary.avgCompetency ?? "—"}
          unit={summary.avgCompetency === null ? undefined : "/ 5"}
          context={
            data.competency
              ? `10 критерийлі рубрика · ${data.assessed} студент бағаланған`
              : "Рубрика бойынша бағалау әлі жоқ"
          }
          tone="amber"
        />
        <StatCard
          label="Тексерілмеген тапсырма"
          value={summary.ungraded}
          context="БӨЖ кері байланыс күтуде"
          tone={summary.ungraded > 0 ? "rose" : "default"}
        />
      </div>

      {/* Pre/post — the thesis result */}
      <ResearchPanel rows={rows} ownerId={ownerId} isDemo={isDemo} onExportRoster={exportRoster} />

      {/* 3D Visualizations Section ----------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader
            title="Студенттер × сабақтар: 3D Ұпай Матрицасы"
            description="Студенттер мен сабақтар нәтижелерін 3D бағандар немесе рельефтік тор түрінде айналдырып визуализациялау."
          />
          <div className="mt-4">
            <ScoreMatrix3D rows={rows} />
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="3D Құзыреттілік Сферасы"
            description="Рубриканың 10 критерийі бойынша студенттердің орташа деңгейі (1–5)."
          />
          <div className="mt-4">
            {data.competency ? (
              <CompetencyGlobe3D values={data.competency} />
            ) : (
              <EmptyState
                compact
                title="Құзыреттілік бағалауы әлі жоқ"
                hint="Студенттер сабақтағы «Бағалау» бөлімінде рубриканы толтырғанда, критерийлер бойынша орташа деңгей осында шығады."
              />
            )}
          </div>
        </Card>
      </div>

      {/* Advanced 2D Charts Grid ------------------------------------------- */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <SectionHeader
            title="Үлгерім мен Белсенділік Тренды"
            description="Соңғы 6 апта: орташа викторина ұпайы, курс прогресі және белсенділік."
          />
          <div className="mt-4">
            <TrendLineChart
              data={data.trend}
              activityLabel={data.activityUnit === "minutes" ? "Оқу уақыты (мин)" : "Әрекет саны"}
              activityUnit={data.activityUnit === "minutes" ? "мин" : "әр."}
            />
          </div>
        </Card>

        <Card>
          <SectionHeader
            title="Апталық Сабақ Оқу Жүктемесі (Heatmap)"
            description={
              isDemo
                ? "Апта күндері мен сағаттары бойынша платформаны пайдалану тығыздығы."
                : "Соңғы 28 күндегі әрекеттердің (викторина, ойын, тапсырма, тест) апта күні мен сағаты бойынша таралуы."
            }
          />
          <div className="mt-4">
            <WeeklyHeatmapChart data={data.heat} />
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader
            title="Сабақтар Күрделілігі Анализы"
            description="Орташа ұпай (X) vs викторинаны қайта тапсыру саны (Y) vs алдыңғы сабақпен салыстырғанда жетпей қалған студенттер (шар өлшемі)."
          />
          <div className="mt-4">
            <LessonScatterChart rows={rows} attempts={data.attempts} />
          </div>
        </Card>

        <Card>
          <p className="mb-1 text-h3">Сабақтар бойынша орташа ұпай</p>
          <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
            {weakest >= 0
              ? `Ең жоғары: ${strongest + 1}-сабақ (${averages[strongest]}%) · ең төмен: ${weakest + 1}-сабақ (${averages[weakest]}%)`
              : "Әлі ешкім викторина тапсырмаған."}
          </p>
          <LessonScoreChart values={averages} />
        </Card>

        <Card>
          <p className="mb-1 text-h3">Прогресс таралуы</p>
          <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
            Орташа мән топтың біркелкі екенін көрсетпейді — таралу көрсетеді.
          </p>
          <ProgressDistributionChart buckets={progressDistribution(rows)} />
        </Card>

        <Card>
          <p className="mb-1 text-h3">Сабақтарды аяқтау және шығып қалу</p>
          <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
            Оң жақтағы қызыл сан — алдыңғы сабақпен салыстырғанда жетпеген студент саны.
          </p>
          <CompletionFunnel counts={completion} total={rows.length} />
        </Card>

        <Card>
          <p className="mb-1 text-h3">Топтың апталық белсенділігі ({unit})</p>
          {!isDemo && (
            <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
              Платформа бет ашық тұрған уақытты өлшемейді, сондықтан белсенділік — соңғы 7 күндегі әрекеттер саны
              (студентке орта есеппен).
            </p>
          )}
          <ActivityBarChart values={cohortWeekly(rows)} unit={unit} />
        </Card>
      </div>

      {/* Roster Table ------------------------------------------------------ */}
      <section>
        <SectionHeader
          title="Студенттер тізімі"
          description="Мәртебе жоғарыдағы «не істеу керек» тізімімен бір ережеден есептеледі."
        />
        <div className="mt-3">
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
        </div>
      </section>
    </div>
  );
}
