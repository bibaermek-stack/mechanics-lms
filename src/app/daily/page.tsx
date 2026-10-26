"use client";

// The daily challenge: five questions a day, the same five for everyone, once.
//
// Once, because a score that can be retaken until it is perfect measures nothing,
// and because the point is the habit — a short thing that is worth doing every
// day, with a streak that rewards doing it.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Flame } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { DailyChallenge } from "@/components/games/DailyChallenge";
import { NewAchievements } from "@/components/engagement/Achievements";
import { useEngagement } from "@/components/engagement/useEngagement";
import { useLessons } from "@/components/providers/LessonsProvider";
import { useAuthStore } from "@/lib/authStore";
import { saveGameResult, generateId } from "@/lib/dataStore";
import { DAILY_MODULE_ID, dailyHistory, dailyToday } from "@/lib/engagement";
import { buildDaily } from "@/data/daily";

const WEEKDAY = ["Жс", "Дс", "Сс", "Ср", "Бс", "Жм", "Сн"];
const weekdayOf = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return WEEKDAY[new Date(y, m - 1, d).getDay()];
};

export default function DailyPage() {
  const user = useAuthStore((s) => s.user);
  const { modules } = useLessons();
  const { state, records, today, fresh, reload } = useEngagement();
  // Set once the student finishes here, so the page keeps showing their review rather than jumping to "already done".
  const [sitting, setSitting] = useState(false);

  const board = useMemo(() => (today ? buildDaily(today, modules) : null), [today, modules]);
  const done = records && today ? dailyToday(records.games, today) : null;
  const history = records && today ? dailyHistory(records.games, today, 7) : [];

  async function finish(score: number) {
    if (!user) return;
    await saveGameResult({
      id: generateId("game"),
      moduleId: DAILY_MODULE_ID,
      userId: user.uid,
      gameType: "daily",
      score,
      completedAt: new Date().toISOString(),
    });
    reload();
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader
          as="h1"
          title="Күнделікті сынақ"
          description="Күн сайын 5 жаңа сұрақ — әр сабақтан бір-бірден. Барлығына бірдей, күніне бір рет. Серияңды үзбе!"
        />

        <NewAchievements fresh={fresh} />

        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                state && state.streak.current > 0 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-400 dark:bg-white/10"
              }`}
              aria-hidden
            >
              <Flame size={24} />
            </span>
            <div>
              <p className="text-h3 text-slate-900 dark:text-white">
                <span className="data-num">{state?.streak.current ?? 0}</span> күн қатарынан
              </p>
              <p className="data-num text-micro text-slate-500 dark:text-slate-400">
                Ең ұзақ серия: {state?.streak.longest ?? 0}
              </p>
            </div>
          </div>

          <ol className="flex gap-1.5" aria-label="Соңғы 7 күн">
            {history.map((h) => (
              <li key={h.day} className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-micro ${
                    h.score !== null
                      ? "bg-emerald-500 text-white"
                      : h.day === today
                        ? "border-2 border-dashed border-brand-400"
                        : "bg-slate-200 dark:bg-white/10"
                  }`}
                  aria-label={`${h.day}: ${h.score !== null ? `${h.score} ұпай` : "ойналмаған"}`}
                >
                  {h.score !== null && <Check size={14} aria-hidden />}
                </span>
                <span className="text-micro text-slate-500 dark:text-slate-400">{weekdayOf(h.day)}</span>
              </li>
            ))}
          </ol>
        </Card>

        {!board || !records ? (
          <Card className="h-40 animate-pulse" aria-busy="true">
            <span className="sr-only">Жүктелуде…</span>
          </Card>
        ) : done && !sitting ? (
          <Card className="space-y-2 text-center">
            <p className="text-h2 text-slate-900 dark:text-white">
              <span className="data-num">{done.score}</span> / 100
            </p>
            <p className="text-body text-slate-600 dark:text-slate-400">
              Бүгінгі сынақ орындалды. Ертең жаңа 5 сұрақ шығады.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link href="/games" className="btn-primary">
                Ойындарға өту
              </Link>
              <Link href="/modules" className="btn-ghost">
                Сабақтарға оралу
              </Link>
            </div>
          </Card>
        ) : (
          <DailyChallenge
            board={board}
            onComplete={(score) => {
              setSitting(true);
              void finish(score);
            }}
          />
        )}
      </div>
    </DashboardShell>
  );
}
