"use client";

import { useState } from "react";
import { notFound, useParams } from "next/navigation";
import {
  BookOpen,
  ListChecks,
  HelpCircle,
  Gamepad2,
  ClipboardList,
  Bot,
  Award,
  Brain,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { VideoPlayer } from "@/components/video/VideoPlayer";
import { QuizEngine } from "@/components/quiz/QuizEngine";
import { GameRouter } from "@/components/games/GameRouter";
import { RubricAssessment } from "@/components/assessment/RubricAssessment";
import { BOZhSubmissionForm } from "@/components/assignment/BOZhSubmissionForm";
import { AiTutorWidget } from "@/components/ai/AiTutorWidget";
import { getModuleById } from "@/data/modules";

const TABS = [
  { key: "lecture", label: "Дәріс", icon: BookOpen },
  { key: "glossary", label: "Глоссарий", icon: ListChecks },
  { key: "quiz", label: "Викторина", icon: HelpCircle },
  { key: "game", label: "Ойын", icon: Gamepad2 },
  { key: "assignment", label: "БӨЖ тапсырмасы", icon: ClipboardList },
  { key: "ai", label: "AI Тьютор", icon: Bot },
  { key: "assessment", label: "Бағалау", icon: Award },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ModuleDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const mod = getModuleById(id);
  const [tab, setTab] = useState<TabKey>("lecture");

  if (!mod) return notFound();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className={`rounded-xl2 bg-gradient-to-br ${mod.colorFrom} ${mod.colorTo} p-6 text-white`}>
          <p className="text-xs uppercase opacity-80">Сабақ {mod.id} / 10</p>
          <h1 className="mt-1 text-2xl font-bold">{mod.title}</h1>
          <p className="mt-2 max-w-2xl text-sm opacity-90">{mod.shortDescription}</p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-200/60 pb-2 dark:border-white/10">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-brand-500 text-white shadow"
                  : "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300"
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
            <GlassCard>
              <p className="mb-2 font-semibold">Оқу мақсаттары</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {mod.objectives.map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </GlassCard>
            <GlassCard>
              <p className="mb-3 flex items-center gap-2 font-semibold"><Brain size={16} /> Блум таксономиясы бойынша нәтижелер</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries({
                  "Есте сақтау": mod.bloom.remember,
                  "Түсіну": mod.bloom.understand,
                  "Қолдану": mod.bloom.apply,
                  "Талдау": mod.bloom.analyze,
                  "Бағалау": mod.bloom.evaluate,
                  "Жасау": mod.bloom.create,
                }).map(([label, val]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/5">
                    <p className="mb-1 font-semibold text-brand-600 dark:text-brand-300">{label}</p>
                    <p className="text-slate-600 dark:text-slate-300">{val}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <p className="mb-2 font-semibold">Дәріс мазмұны (қысқаша)</p>
              <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                {mod.lectureSummary.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <p className="mb-2 font-semibold">Негізгі ұғымдар</p>
              <div className="flex flex-wrap gap-2">
                {mod.keyConcepts.map((c) => (
                  <span key={c} className="badge">{c}</span>
                ))}
              </div>
            </GlassCard>
            <GlassCard>
              <p className="mb-2 font-semibold">Рефлексия сұрақтары</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {mod.reflectionQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </GlassCard>
          </div>
        )}

        {tab === "glossary" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {mod.glossary.map((g) => (
              <GlassCard key={g.term}>
                <p className="font-semibold text-brand-600 dark:text-brand-300">{g.term}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{g.definition}</p>
              </GlassCard>
            ))}
          </div>
        )}

        {tab === "quiz" && <QuizEngine moduleId={mod.id} />}

        {tab === "game" && <GameRouter mod={mod} />}

        {tab === "assignment" && <BOZhSubmissionForm moduleId={mod.id} assignment={mod.assignment} />}

        {tab === "ai" && <AiTutorWidget topic={mod.title} />}

        {tab === "assessment" && <RubricAssessment moduleId={mod.id} />}
      </div>
    </DashboardShell>
  );
}
