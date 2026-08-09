"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LessonCard } from "@/components/ui/LessonCard";
import { ActionList } from "@/components/ui/ActionList";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { LessonScoreChart } from "@/components/charts/LessonScoreChart";
import { ALL_MODULES } from "@/data/modules";
import { useAuthStore } from "@/lib/authStore";
import { buildStudentPlan, studentLessonScores } from "@/lib/studentPlan";
import type { ActionItem } from "@/lib/types";
import { ArrowRight } from "lucide-react";

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const [completedModuleIds, setCompletedModuleIds] = useState<number[]>([]);
  const [scores, setScores] = useState<(number | null)[] | null>(null);
  const [plan, setPlan] = useState<ActionItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    studentLessonScores(user.uid).then((s) => {
      setScores(s);
      setCompletedModuleIds(
        ALL_MODULES.filter((_, i) => (s[i] ?? -1) >= 60).map((m) => m.id)
      );
    });
    buildStudentPlan(user.uid).then(setPlan);
  }, [user]);

  const progressPercent = Math.round((completedModuleIds.length / ALL_MODULES.length) * 100);

  return (
    <DashboardShell role="student">
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title={`Қош келдің, ${user?.fullName?.split(" ")[0] ?? "Студент"}`}
          description="Механика курсындағы прогресіңді осында бақыла."
          action={
            <Link href="/modules" className="btn-primary">
              Оқуды жалғастыру <ArrowRight size={16} />
            </Link>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Аяқталған сабақтар"
            value={`${completedModuleIds.length}/${ALL_MODULES.length}`}
            context={`Курстың ${progressPercent}%-ы`}
            tone="brand"
          />
          <StatCard
            label="Құзыреттілік деңгейі"
            value={user?.competencyScore ?? 0}
            unit="%"
            context="10 критерий бойынша рубрика"
            tone="emerald"
          />
          <StatCard
            label="Жинаған ұпай"
            value={user?.xp ?? 0}
            unit="XP"
            context="Викторина, ойын және БӨЖ үшін"
            tone="amber"
          />
          <StatCard label="Оқу сериясы" value={5} unit="күн" context="Қатарынан белсенді күн" />
        </div>

        <Card>
          <p className="mb-3 text-h3">Жалпы курс прогресі</p>
          <ProgressBar
            value={progressPercent}
            segments={ALL_MODULES.length}
            tone="emerald"
            label="Аяқталған сабақтар"
          />
        </Card>

        {/* Personal plan — the same "what to do next" idea the teacher sees
            for the whole cohort, but built from this student's own quiz
            attempts and submissions (see src/lib/studentPlan.ts), so it never
            contradicts the progress numbers above it. */}
        <section>
          <SectionHeader
            title="Өзіндік жұмыс жоспары"
            description="Соңғы нәтижелерің бойынша жасалған жеке ұсыныстар — келесі не істеу керегін осыдан көресің."
          />
          <div className="mt-3">
            {plan ? (
              <ActionList items={plan} emptyMessage="Қазір бәрі ретте — жаңа тапсырма пайда болғанда осында көрінеді." />
            ) : (
              <LoadingBlock lines={3} />
            )}
          </div>
        </section>

        <Card>
          <p className="mb-1 text-h3">Сабақтар бойынша ұпайларың</p>
          <p className="mb-4 text-micro text-slate-600 dark:text-slate-400">
            Әр бағанға тінтуірді апарып нақты пайызды көр. Сұр баған — әлі тапсырылмаған сабақ.
          </p>
          {scores ? (
            <LessonScoreChart values={scores} label="Ұпайың, %" />
          ) : (
            <LoadingBlock lines={3} />
          )}
        </Card>

        <div>
          <SectionHeader title="Оқу сабақтары" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_MODULES.map((m) => (
              <LessonCard
                key={m.id}
                id={m.id}
                title={m.title}
                description={m.shortDescription}
                minutes={m.videoDurationMinutes}
                done={completedModuleIds.includes(m.id)}
              />
            ))}
          </div>
        </div>

        {user?.badges && user.badges.length > 0 && (
          <Card>
            <p className="mb-3 text-h3">Жетістіктерің</p>
            <div className="flex flex-wrap gap-2">
              {user.badges.map((b, i) => (
                <Badge key={b} variant="default" marker={String(i + 1)}>
                  {b}
                </Badge>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
}
