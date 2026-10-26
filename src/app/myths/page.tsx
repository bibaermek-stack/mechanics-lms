"use client";

// «Миф па, шындық па?» — the claims of films, games and the internet, tried against
// the physics. Eight a round, half of them true; the answer to each comes with the
// calculation that settles it (src/data/facts.ts).
//
// It is practice, not coursework: the result is stored (so it can earn an
// achievement and count for the league) but never reaches the final grade.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Card } from "@/components/ui/Card";
import { TrueFalseGame, type TrueFalseLabels } from "@/components/games/TrueFalseGame";
import { NewAchievements } from "@/components/engagement/Achievements";
import { useEngagement } from "@/components/engagement/useEngagement";
import { useAuthStore } from "@/lib/authStore";
import { saveGameResult, generateId } from "@/lib/dataStore";
import { DAILY_MODULE_ID } from "@/lib/engagement";
import { buildMythBoard } from "@/data/facts";

const LABELS: TrueFalseLabels = {
  prompt: "Қайдан білеміз?",
  claim: "Мәлімдеме",
  trueButton: "Шындық",
  falseButton: "Миф",
  verdict: (isTrue) => (isTrue ? "Бұл — шындық." : "Бұл — миф."),
  best: "Ең ұзақ серия",
};

export default function MythsPage() {
  const user = useAuthStore((s) => s.user);
  const { fresh, reload, records } = useEngagement();
  // Drawn after mount: a clock read during render would differ between server and browser.
  const [seed, setSeed] = useState<number | null>(null);
  const [done, setDone] = useState<number | null>(null);
  useEffect(() => setSeed(Date.now() % 2_147_483_647), []);
  const board = useMemo(() => (seed === null ? null : buildMythBoard(seed)), [seed]);

  const best = useMemo(() => {
    const mine = (records?.games ?? []).filter((g) => g.gameType === "myth").map((g) => g.score);
    return mine.length ? Math.max(...mine) : null;
  }, [records]);

  async function finish(score: number) {
    setDone(score);
    if (!user) return;
    await saveGameResult({
      id: generateId("game"),
      moduleId: DAILY_MODULE_ID, // like the daily challenge, it belongs to no lesson
      userId: user.uid,
      gameType: "myth",
      score,
      completedAt: new Date().toISOString(),
    });
    reload();
  }

  function again() {
    setDone(null);
    setSeed(Date.now() % 2_147_483_647);
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <SectionHeader
          as="h1"
          title="Миф па, шындық па?"
          description="Кино, ойын және интернет мәлімдемелерін физикамен тексер. Әр раундта 8 мәлімдеме, жартысы шындық. Жауаптың артында — оны шешетін есептеу."
          action={best !== null ? <span className="data-num text-label text-slate-600 dark:text-slate-400">Үздік нәтиже: {best}</span> : undefined}
        />

        <NewAchievements fresh={fresh} />

        {board === null ? (
          <Card className="h-40 animate-pulse" aria-busy="true">
            <span className="sr-only">Жүктелуде…</span>
          </Card>
        ) : (
          <>
            <TrueFalseGame key={seed} board={board} labels={LABELS} onComplete={(s) => void finish(s)} />

            {done !== null && (
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-label text-slate-700 dark:text-slate-300">Бұл раундтағы мәлімдемелер мен олар байланысты сабақтар:</p>
                  <button onClick={again} className="btn-primary">
                    <RotateCcw size={14} /> Жаңа раунд
                  </button>
                </div>
                <ul className="space-y-2 text-sm">
                  {board.cards.map((c) => (
                    <li key={c.id} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold ${
                          c.isTrue ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {c.isTrue ? "Шындық" : "Миф"}
                      </span>
                      <span className="min-w-0 flex-1 text-slate-700 dark:text-slate-300">
                        {c.claim}{" "}
                        <Link href={`/modules/${board.meta[c.id].lesson}`} className="whitespace-nowrap text-brand-600 hover:underline dark:text-brand-300">
                          {board.meta[c.id].lesson}-сабақ
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
