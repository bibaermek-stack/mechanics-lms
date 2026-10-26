"use client";

import Link from "next/link";
import { ArrowRight, CalendarCheck, Flame } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { dailyToday, nextUp } from "@/lib/engagement";
import { AchievementIcon } from "./Achievements";
import { useEngagement } from "./useEngagement";

/** Where the student stands — level, streak, today's challenge, what to earn next. */
export function EngagementCard() {
  const { state, records, today } = useEngagement();
  if (!state || !records || !today) {
    return <Card className="h-40 animate-pulse" aria-busy="true"><span className="sr-only">Жүктелуде…</span></Card>;
  }

  const { level, streak, achievements, unlocked } = state;
  const done = dailyToday(records.games, today);
  const upcoming = nextUp(achievements, 3);

  return (
    <Card className="space-y-5">
      <div className="grid gap-5 md:grid-cols-3">
        {/* Level */}
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-h2 text-white"
            aria-hidden
          >
            {level.level}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-label text-slate-600 dark:text-slate-400">{level.level}-деңгей</p>
            <p className="truncate text-h3 text-slate-900 dark:text-white">{level.name}</p>
            <ProgressBar
              className="mt-2"
              value={level.fraction * 100}
              tone="brand"
            />
            <p className="data-num mt-1 text-micro text-slate-500 dark:text-slate-400">
              {level.next === null ? `${level.xp} XP · ең жоғары деңгей` : `${level.into} / ${level.span} XP — келесі деңгейге`}
            </p>
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              streak.current > 0 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-400 dark:bg-white/10"
            }`}
            aria-hidden
          >
            <Flame size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-h3 text-slate-900 dark:text-white">
              <span className="data-num">{streak.current}</span> күн қатарынан
            </p>
            <p className="text-micro text-slate-600 dark:text-slate-400">
              {streak.atRisk
                ? "Серия бүгін түнде үзіледі — бір ойын немесе сынақ жеткілікті."
                : streak.activeToday
                  ? "Бүгін белсендісің. Ертең жалғастыр!"
                  : "Бүгін бір әрекет жаса — серия басталады."}
            </p>
            <p className="data-num text-micro text-slate-500 dark:text-slate-400">Ең ұзақ серия: {streak.longest}</p>
          </div>
        </div>

        {/* Daily challenge */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" aria-hidden>
            <CalendarCheck size={26} />
          </div>
          <div className="min-w-0">
            <p className="text-h3 text-slate-900 dark:text-white">Күнделікті сынақ</p>
            {done ? (
              <p className="text-micro text-slate-600 dark:text-slate-400">
                Бүгін орындалды: <span className="data-num font-semibold">{done.score}</span> / 100. Ертең жаңа сұрақтар.
              </p>
            ) : (
              <Link href="/daily" className="btn-primary mt-1 !px-3 !py-1.5 text-sm">
                5 сұрақ — бүгінгі сынақ <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>
      </div>

      {upcoming.length > 0 && (
        <div className="border-t border-slate-200 pt-4 dark:border-white/10">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-label font-semibold text-slate-900 dark:text-white">Келесі жетістіктер</p>
            <Link href="/profile" className="text-micro text-brand-600 hover:underline dark:text-brand-300">
              Барлығы: {unlocked} / {achievements.length} <ArrowRight size={11} className="inline" />
            </Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-3">
            {upcoming.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-xl bg-slate-100 p-3 dark:bg-white/5">
                <span className="text-slate-500 dark:text-slate-400">
                  <AchievementIcon name={a.icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{a.title}</p>
                  <p className="data-num text-micro text-slate-500 dark:text-slate-400">
                    {a.progress} / {a.target}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
