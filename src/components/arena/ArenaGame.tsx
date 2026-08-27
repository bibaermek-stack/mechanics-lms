"use client";

// The arena as a lesson game.
//
// Shorter and smaller than the full version — two a side, ninety seconds, first
// to three — because it sits in a tab beside a quiz, not on a page of its own.
// It only appears on the lessons whose physics it actually demonstrates; on a
// kinematics or a fluids lesson it would be a game with no lesson in it.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { ArenaMatch } from "./ArenaMatch";
import { makeIsBot, practiceDiscs } from "@/lib/arena/setup";
import type { MatchConfig, Team } from "@/lib/arena/types";

/** Lessons where a collision game is the lesson: dynamics, the three laws,
 *  energy and momentum. */
export const ARENA_LESSONS = [3, 4, 5, 6];

const LESSON_CONFIG: MatchConfig = { perSide: 2, duration: 90, goalLimit: 3 };

/**
 * A result out of 100, from a scoreline.
 *
 * A win is a win whatever the margin, a draw is worth more than a defeat, and a
 * defeat still earns something for the goals scored — otherwise a student who
 * lost 3–2 to the bots would be marked the same as one who never touched the
 * ball.
 */
export function arenaScore(mine: number, theirs: number): number {
  if (mine > theirs) return 100;
  if (mine === theirs) return 55;
  return Math.min(45, 15 + mine * 10);
}

export function ArenaGame({
  moduleId,
  onComplete,
}: {
  moduleId: number;
  onComplete: (score: number) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const [team] = useState<Team>(0);
  const [result, setResult] = useState<{ score: number; line: string } | null>(null);

  const me = useMemo(
    () => ({ id: user?.uid ?? "me", name: user?.fullName?.split(" ")[0] ?? "Мен" }),
    [user?.uid, user?.fullName]
  );
  const discs = useMemo(() => practiceDiscs(me, team, LESSON_CONFIG), [me, team]);
  const isBot = useMemo(() => makeIsBot(new Set([me.id])), [me.id]);

  const handleEnd = useCallback(
    (score: [number, number]) => {
      const mine = score[team];
      const theirs = score[team === 0 ? 1 : 0];
      const value = arenaScore(mine, theirs);
      setResult({ score: value, line: `${mine} : ${theirs}` });
      onComplete(value);
    },
    [onComplete, team]
  );

  return (
    <div className="space-y-3">
      <ArenaMatch
        config={LESSON_CONFIG}
        discs={discs}
        localId={me.id}
        isBot={isBot}
        onEnd={handleEnd}
        compact
      />

      {result && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-body font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
          Нәтиже {result.line} · {result.score} ұпай
        </p>
      )}

      <p className="text-micro leading-relaxed text-slate-500 dark:text-slate-400">
        Экранның астындағы «Физика» панелінде әр соқтығыстың импульсі көрсетіледі:
        Δp = 0 — импульс сақталады, ал кинетикалық энергия серпімділік коэффициенті
        e &lt; 1 болғандықтан кемиді. Толық нұсқасы —{" "}
        <Link href="/arena" className="inline-flex items-center gap-0.5 text-brand-600 underline dark:text-brand-300">
          Арена бетінде <ArrowUpRight size={11} />
        </Link>
        , онда сыныптастарыңмен онлайн ойнауға болады.
      </p>
    </div>
  );
}

export default ArenaGame;
