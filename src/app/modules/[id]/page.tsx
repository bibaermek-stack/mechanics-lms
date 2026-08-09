"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { notFound, useParams, useSearchParams } from "next/navigation";
import {
  BookOpen,
  ListChecks,
  HelpCircle,
  Gamepad2,
  ClipboardList,
  Bot,
  Award,
  Brain,
  Boxes,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { QuizEngine } from "@/components/quiz/QuizEngine";
import { GameRouter } from "@/components/games/GameRouter";
import { RubricAssessment } from "@/components/assessment/RubricAssessment";
import { BOZhSubmissionForm } from "@/components/assignment/BOZhSubmissionForm";
import { AiTutorWidget } from "@/components/ai/AiTutorWidget";
import { ALL_MODULES } from "@/data/modules";
import { useLessons } from "@/components/providers/LessonsProvider";
import { getSimulation } from "@/data/simulations";
import { LAB_WORKS, labsForLesson } from "@/data/labWorks";

// three.js only ships to the browser, and only when this tab is opened.
const SimulationPanel = dynamic(
  () => import("@/components/simulation/SimulationPanel").then((m) => m.SimulationPanel),
  { ssr: false }
);

const TABS = [
  { key: "lecture", label: "Дәріс", icon: BookOpen },
  { key: "simulation", label: "3D Симуляция", icon: Boxes },
  { key: "glossary", label: "Глоссарий", icon: ListChecks },
  { key: "quiz", label: "Викторина", icon: HelpCircle },
  { key: "game", label: "Ойын", icon: Gamepad2 },
  { key: "assignment", label: "БӨЖ тапсырмасы", icon: ClipboardList },
  { key: "ai", label: "AI Тьютор", icon: Bot },
  { key: "assessment", label: "Бағалау", icon: Award },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * A lesson can carry more than one experiment: lesson 2 owns three of the
 * prescribed lab works, lesson 7 owns two. When it does, the scenes are picked
 * from a list rather than assumed to be the one that shares the lesson number.
 */
function LessonSimulations({ lessonId }: { lessonId: number }) {
  // The lesson's own scene first, then any lab work attached to this lesson
  // that runs a different one.
  const sceneIds = Array.from(
    new Set([
      ...(getSimulation(lessonId) ? [lessonId] : []),
      ...labsForLesson(lessonId)
        .map((l) => l.sceneModuleId)
        .filter((id): id is number => id !== null),
    ])
  );
  const [active, setActive] = useState(sceneIds[0]);

  if (sceneIds.length === 0) return <SimulationPanel moduleId={lessonId} />;

  return (
    <div className="space-y-4">
      {sceneIds.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Осы сабақтың тәжірибелері">
          {sceneIds.map((id) => {
            const meta = getSimulation(id);
            const lab = LAB_WORKS.find((l) => l.sceneModuleId === id && l.lessonId === lessonId);
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active === id}
                onClick={() => setActive(id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active === id
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {lab ? `${lab.id}-жұмыс · ` : ""}
                {meta?.title ?? `Сахна ${id}`}
              </button>
            );
          })}
        </div>
      )}
      <SimulationPanel key={active} moduleId={active} />
    </div>
  );
}

export default function ModuleDetailPage() {
  const params = useParams();
  const search = useSearchParams();
  const id = Number(params.id);
  // The teacher's edits, if any, are already merged in here.
  const mod = useLessons().byId(id);
  // The plan links straight at a tab (…?tab=simulation), so a recommendation
  // lands on the experiment rather than on the lecture with the real target
  // one click away.
  const [tab, setTab] = useState<TabKey>(() => {
    const wanted = search?.get("tab");
    return TABS.some((t) => t.key === wanted) ? (wanted as TabKey) : "lecture";
  });

  if (!mod) return notFound();

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Lesson identity: the number, not a decorative gradient. */}
        <div className="surface flex items-start gap-4 p-5 sm:gap-5 sm:p-6">
          <span className="data-num shrink-0 text-display leading-none text-brand-500/25 dark:text-brand-400/25">
            {String(mod.id).padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <p className="text-label uppercase text-brand-600 dark:text-brand-400">
              Сабақ {mod.id} / {ALL_MODULES.length}
            </p>
            <h1 className="mt-1 text-h1">{mod.title}</h1>
            <p className="mt-2 max-w-2xl text-body text-slate-600 dark:text-slate-400">
              {mod.shortDescription}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3 dark:border-white/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors ${
                tab === t.key
                  ? "border-brand-500 bg-brand-500 font-semibold text-white"
                  : "border-slate-200 bg-white font-medium text-slate-600 hover:border-brand-300 hover:bg-brand-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "lecture" && (
          <div className="space-y-4">
            <VideoPlayer
              youtubeId={mod.youtubeId}
              title={mod.title}
              description={mod.shortDescription}
              durationMinutes={mod.videoDurationMinutes}
            />
            <Card>
              <p className="mb-3 text-h3">Оқу мақсаттары</p>
              <ul className="list-disc space-y-1.5 pl-5 text-body text-slate-600 dark:text-slate-300">
                {mod.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </Card>
            <Card>
              <p className="mb-3 flex items-center gap-2 text-h3"><Brain size={16} /> Блум таксономиясы бойынша нәтижелер</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries({
                  "Есте сақтау": mod.bloom.remember,
                  "Түсіну": mod.bloom.understand,
                  "Қолдану": mod.bloom.apply,
                  "Талдау": mod.bloom.analyze,
                  "Бағалау": mod.bloom.evaluate,
                  "Жасау": mod.bloom.create,
                }).map(([label, val]) => (
                  <div key={label} className="surface-sunken p-3 text-xs">
                    <p className="mb-1 font-semibold text-brand-600 dark:text-brand-300">{label}</p>
                    <p className="text-slate-600 dark:text-slate-300">{val}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <p className="mb-3 text-h3">Дәріс мазмұны (қысқаша)</p>
              <div className="space-y-2 text-body text-slate-600 dark:text-slate-300">
                {mod.lectureSummary.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </Card>
            <Card>
              <p className="mb-3 text-h3">Негізгі ұғымдар</p>
              <div className="flex flex-wrap gap-2">
                {mod.keyConcepts.map((c) => (
                  <span key={c} className="badge">{c}</span>
                ))}
              </div>
            </Card>
            <Card>
              <p className="mb-3 text-h3">Рефлексия сұрақтары</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {mod.reflectionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === "glossary" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {mod.glossary.map((g) => (
              <Card key={g.term}>
                <p className="text-h3 text-brand-700 dark:text-brand-300">{g.term}</p>
                <p className="mt-1 text-body text-slate-600 dark:text-slate-300">{g.definition}</p>
              </Card>
            ))}
          </div>
        )}

        {tab === "simulation" && <LessonSimulations lessonId={mod.id} />}

        {tab === "quiz" && <QuizEngine moduleId={mod.id} />}

        {tab === "game" && <GameRouter mod={mod} />}

        {tab === "assignment" && <BOZhSubmissionForm moduleId={mod.id} assignment={mod.assignment} />}

        {tab === "ai" && <AiTutorWidget topic={mod.title} />}

        {tab === "assessment" && <RubricAssessment moduleId={mod.id} />}
      </div>
    </DashboardShell>
  );
}
