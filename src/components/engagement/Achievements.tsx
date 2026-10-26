"use client";

import clsx from "clsx";
import {
  Brain,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Crosshair,
  FileText,
  Flame,
  Footprints,
  Gamepad2,
  GraduationCap,
  Lock,
  Medal,
  Puzzle,
  Rocket,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Achievement } from "@/lib/engagement";

const ICONS: Record<string, LucideIcon> = {
  Brain, CalendarCheck, CheckCircle2, ClipboardCheck, Crosshair, Eye, FileText, Flame, Footprints,
  Gamepad2, GraduationCap, Medal, Puzzle, Rocket, Sparkles, Star, TrendingUp, Trophy, Zap,
};

export function AchievementIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Star;
  return <Icon size={size} aria-hidden />;
}

/** Every achievement: the earned ones lit, the rest greyed with how far along they are. */
export function AchievementShelf({ achievements }: { achievements: Achievement[] }) {
  const earned = achievements.filter((a) => a.unlocked).length;
  return (
    <div>
      <p className="mb-3 text-label text-slate-600 dark:text-slate-400">
        Ашылды: <span className="data-num font-semibold text-slate-900 dark:text-white">{earned}</span> / {achievements.length}
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {achievements.map((a) => (
          <li
            key={a.id}
            className={clsx(
              "flex items-start gap-3 rounded-xl border p-3",
              a.unlocked
                ? "border-amber-400/50 bg-amber-500/10"
                : "border-slate-200 dark:border-white/10"
            )}
          >
            <span
              className={clsx(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                a.unlocked
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 text-slate-400 dark:bg-white/10 dark:text-slate-500"
              )}
            >
              {a.unlocked ? <AchievementIcon name={a.icon} /> : <Lock size={16} aria-hidden />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {a.title}
                <span className="sr-only">{a.unlocked ? " — ашылды" : " — әлі ашылған жоқ"}</span>
              </p>
              <p className="text-micro text-slate-600 dark:text-slate-400">{a.description}</p>
              {!a.unlocked && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${(100 * a.progress) / a.target}%` }}
                    />
                  </div>
                  <span className="data-num text-micro text-slate-500 dark:text-slate-400">
                    {a.progress} / {a.target}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A banner for what has just been earned. Renders nothing when there is nothing new. */
export function NewAchievements({ fresh }: { fresh: Achievement[] }) {
  if (fresh.length === 0) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/60 bg-amber-500/10 px-4 py-3"
    >
      <Trophy className="shrink-0 text-amber-500" size={22} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {fresh.length === 1 ? "Жаңа жетістік!" : `${fresh.length} жаңа жетістік!`}
        </p>
        <p className="text-sm text-slate-700 dark:text-slate-300">{fresh.map((a) => a.title).join(" · ")}</p>
      </div>
    </div>
  );
}
