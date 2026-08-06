"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { ALL_MODULES } from "@/data/modules";
import { useAuthStore } from "@/lib/authStore";
import { getQuizAttempts } from "@/lib/dataStore";
import { BookOpen, Flame, Trophy, Target, ArrowRight } from "lucide-react";

export default function StudentDashboard() {
  const user = useAuthStore((s) => s.user);
  const [completedModuleIds, setCompletedModuleIds] = useState<number[]>([]);

  useEffect(() => {
    if (!user) return;
    getQuizAttempts(user.uid).then((attempts) => {
      const ids = Array.from(new Set(attempts.filter((a) => a.score >= a.total * 0.6).map((a) => a.moduleId)));
      setCompletedModuleIds(ids);
    });
  }, [user]);

  const progressPercent = Math.round((completedModuleIds.length / ALL_MODULES.length) * 100);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Қош келдің, {user?.fullName?.split(" ")[0] ?? "Студент"}! 👋</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Механика курсындағы прогресіңді осында бақыла.</p>
          </div>
          <Link href="/modules" className="btn-primary">
            Оқуды жалғастыру <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <GlassCard>
            <BookOpen className="mb-2 text-brand-500" />
            <p className="text-2xl font-bold">{completedModuleIds.length}/{ALL_MODULES.length}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Аяқталған сабақтар</p>
          </GlassCard>
          <GlassCard>
            <Target className="mb-2 text-emerald-500" />
            <p className="text-2xl font-bold">{user?.competencyScore ?? 0}%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Құзыреттілік деңгейі</p>
          </GlassCard>
          <GlassCard>
            <Trophy className="mb-2 text-amber-500" />
            <p className="text-2xl font-bold">{user?.xp ?? 0}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Жинаған XP ұпайы</p>
          </GlassCard>
          <GlassCard>
            <Flame className="mb-2 text-rose-500" />
            <p className="text-2xl font-bold">5 күн</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Оқу серия (streak)</p>
          </GlassCard>
        </div>

        <GlassCard>
          <p className="mb-2 font-semibold">Жалпы курс прогресі</p>
          <ProgressBar value={progressPercent} label="Барлық сабақтар бойынша" />
        </GlassCard>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Оқу сабақтары</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_MODULES.map((m) => {
              const done = completedModuleIds.includes(m.id);
              return (
                <Link key={m.id} href={`/modules/${m.id}`} className="glass-card block">
                  <div className={`mb-3 h-24 rounded-xl bg-gradient-to-br ${m.colorFrom} ${m.colorTo} p-3 text-white`}>
                    <p className="text-xs opacity-80">Сабақ {m.id}</p>
                    <p className="font-semibold">{m.title}</p>
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{m.shortDescription}</p>
                  <div className="mt-3 flex items-center justify-between">
                    {done ? <Badge variant="success">Аяқталды</Badge> : <Badge>Оқу керек</Badge>}
                    <span className="text-xs text-slate-400">{m.videoDurationMinutes} мин</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {user?.badges && user.badges.length > 0 && (
          <GlassCard>
            <p className="mb-2 font-semibold">Жетістіктерің</p>
            <div className="flex flex-wrap gap-2">
              {user.badges.map((b) => (
                <Badge key={b}>🏅 {b}</Badge>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </DashboardShell>
  );
}
