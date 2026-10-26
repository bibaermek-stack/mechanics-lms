"use client";

// The games hub: every game on one page.
//
// The lesson tabs already carry the games, but a student only meets them one
// lesson at a time and has to know where to look. Here they are in one place —
// pick a lesson, pick a game — with the featured ones on top and a running tally
// of how much of it they have tried. The page holds no game logic of its own: the
// board below is the same GameRouter the lesson uses, so a score earned here is
// a score earned there.

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarCheck, Crosshair, Gamepad2, Sparkles, Swords } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GameRouter, GAME_LABELS, type GameMode } from "@/components/games/GameRouter";
import { NewAchievements } from "@/components/engagement/Achievements";
import { useEngagement } from "@/components/engagement/useEngagement";
import { useLessons } from "@/components/providers/LessonsProvider";
import { isLessonGame } from "@/lib/engagement";

const GAME_COUNT = Object.keys(GAME_LABELS).length;

/** Reads `?lesson=2&game=projectile` once, on the client. */
function readLink(): { lesson?: number; game?: GameMode } {
  const q = new URLSearchParams(window.location.search);
  const lesson = Number(q.get("lesson"));
  const game = q.get("game");
  return {
    lesson: Number.isInteger(lesson) && lesson > 0 ? lesson : undefined,
    game: game && game in GAME_LABELS ? (game as GameMode) : undefined,
  };
}

export default function GamesHubPage() {
  const { modules } = useLessons();
  const { records, fresh, reload } = useEngagement();
  const [lessonId, setLessonId] = useState(2);
  const [initialMode, setInitialMode] = useState<GameMode | undefined>();
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const link = readLink();
    if (link.lesson && modules.some((m) => m.id === link.lesson)) setLessonId(link.lesson);
    if (link.game) setInitialMode(link.game);
    // Only the address at arrival matters; later changes come from the page itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mod = modules.find((m) => m.id === lessonId) ?? modules[0];

  // The daily challenge belongs to no lesson, so it is not one of the games tallied here.
  const tally = useMemo(() => {
    const results = (records?.games ?? []).filter(isLessonGame);
    const plays = results.length;
    const kinds = new Set(results.map((r) => r.gameType)).size;
    const avg = plays ? Math.round(results.reduce((a, r) => a + r.score, 0) / plays) : 0;
    const best = plays ? Math.max(...results.map((r) => r.score)) : 0;
    return { plays, kinds, avg, best };
  }, [records]);

  function open(lesson: number, game: GameMode) {
    setLessonId(lesson);
    setInitialMode(game);
    boardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!mod) return null;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Ойындар"
          description="Әр сабақтың өз ойындары бар: сөз табу, кроссворд, есеп-блиц, шын-өтірік, снаряд атысы және т.б. Ұпайың құзыреттілік бағасына қосылады."
        />

        <NewAchievements fresh={fresh} />

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Ойын статистикасы">
          {[
            { label: "Ойналған ойын", value: tally.plays },
            { label: "Түрлері", value: `${tally.kinds} / ${GAME_COUNT}` },
            { label: "Орташа ұпай", value: tally.plays ? tally.avg : "—" },
            { label: "Ең жоғары ұпай", value: tally.plays ? tally.best : "—" },
          ].map((s) => (
            <div key={s.label} className="surface-card !p-4">
              <dt className="text-micro text-slate-500 dark:text-slate-400">{s.label}</dt>
              <dd className="data-num mt-1 text-h2 text-slate-900 dark:text-white">{s.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => open(2, "projectile")}
            className="surface-card flex flex-col items-start gap-2 text-left transition-colors hover:border-brand-400"
          >
            <Crosshair className="text-brand-500" size={22} />
            <span className="text-h3 text-slate-900 dark:text-white">Снаряд атысы</span>
            <span className="text-body text-slate-600 dark:text-slate-400">
              Бұрыш пен жылдамдықты таңда: Жерде, Айда, Марста және Юпитерде нысанаға ат. Ауырлық күші өзгергенде
              қашықтық қалай өзгереді?
            </span>
          </button>
          <Link
            href="/daily"
            className="surface-card flex flex-col items-start gap-2 text-left transition-colors hover:border-brand-400"
          >
            <CalendarCheck className="text-brand-500" size={22} />
            <span className="flex items-center gap-1 text-h3 text-slate-900 dark:text-white">
              Күнделікті сынақ <ArrowUpRight size={14} />
            </span>
            <span className="text-body text-slate-600 dark:text-slate-400">
              Күн сайын 5 жаңа сұрақ, әр сабақтан бір-бірден. Серия жина!
            </span>
          </Link>
          <Link
            href="/myths"
            className="surface-card flex flex-col items-start gap-2 text-left transition-colors hover:border-brand-400"
          >
            <Sparkles className="text-brand-500" size={22} />
            <span className="flex items-center gap-1 text-h3 text-slate-900 dark:text-white">
              Миф па, шындық па? <ArrowUpRight size={14} />
            </span>
            <span className="text-body text-slate-600 dark:text-slate-400">
              Киноның, ойынның және интернеттің физикасын тексер: оқ, ракета, лифт, көлік.
            </span>
          </Link>
          <Link
            href="/arena"
            className="surface-card flex flex-col items-start gap-2 text-left transition-colors hover:border-brand-400"
          >
            <Gamepad2 className="text-brand-500" size={22} />
            <span className="flex items-center gap-1 text-h3 text-slate-900 dark:text-white">
              Арена <ArrowUpRight size={14} />
            </span>
            <span className="text-body text-slate-600 dark:text-slate-400">
              Физикалық футбол: серпімді соқтығыс, үйкеліс, импульстің сақталуы. Боттармен немесе онлайн.
            </span>
          </Link>
          <Link
            href="/duels"
            className="surface-card flex flex-col items-start gap-2 text-left transition-colors hover:border-brand-400"
          >
            <Swords className="text-brand-500" size={22} />
            <span className="flex items-center gap-1 text-h3 text-slate-900 dark:text-white">
              Дуэльдер <ArrowUpRight size={14} />
            </span>
            <span className="text-body text-slate-600 dark:text-slate-400">
              Досыңа бірдей тақтаны жібер — кім жоғары ұпай жинайды?
            </span>
          </Link>
        </div>

        <section ref={boardRef} className="scroll-mt-24 space-y-4" aria-labelledby="games-lesson-heading">
          <h2 id="games-lesson-heading" className="text-h3">
            Сабақ бойынша ойындар
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Сабақты таңда">
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setLessonId(m.id);
                  setInitialMode(undefined);
                }}
                aria-pressed={m.id === mod.id}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  m.id === mod.id
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                }`}
              >
                {m.id}. {m.title}
              </button>
            ))}
          </div>
          <GameRouter key={`${mod.id}-${initialMode ?? ""}`} mod={mod} initialMode={initialMode} onSaved={reload} />
        </section>
      </div>
    </DashboardShell>
  );
}
