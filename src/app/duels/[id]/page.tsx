"use client";

// One duel: play your half, then see the comparison.
//
// The board is rebuilt from the stored seed, so the crossword here is the same
// crossword the friend gets — that is the whole fairness guarantee, and it is
// why the seed is passed straight through to GameRouter rather than being
// re-derived from anything local.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Trophy, Clock } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { ALL_MODULES } from "@/data/modules";
import { GameRouter, GAME_LABELS, type GameMode } from "@/components/games/GameRouter";
import { useAuthStore } from "@/lib/authStore";
import { getDuel, recordDuelScore, type Duel } from "@/lib/supabase/duels";

export default function DuelPage() {
  const params = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [duel, setDuel] = useState<Duel | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);
  const [justScored, setJustScored] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user || !params?.id) return;
    try {
      const d = await getDuel(user, params.id);
      setDuel(d ?? "missing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Дуэль жүктелмеді");
      setDuel("missing");
    }
  }, [user, params?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleScore(score: number) {
    if (!user || !duel || duel === "missing") return;
    setJustScored(score);
    try {
      await recordDuelScore(user, duel.id, score);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нәтиже сақталмады");
    }
  }

  if (duel === null) {
    return (
      <DashboardShell role="student">
        <LoadingBlock lines={4} />
      </DashboardShell>
    );
  }

  if (duel === "missing") {
    return (
      <DashboardShell role="student">
        <div className="glass glass-lit mx-auto mt-8 max-w-md rounded-3xl2 p-8 text-center">
          <h1 className="text-h2 text-slate-900 dark:text-white">Дуэль табылмады</h1>
          <p className="mt-2 text-body text-slate-600 dark:text-slate-400">
            {error ?? "Бұл дуэль жойылған немесе сізге қатысы жоқ."}
          </p>
          <Link href="/duels" className="btn-primary mt-6 inline-flex">
            Дуэльдерге оралу
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const mod = ALL_MODULES.find((m) => m.id === duel.moduleId);
  const mode = duel.gameMode as GameMode;
  const played = duel.myScore !== null;

  return (
    <DashboardShell role="student">
      <div className="space-y-6">
        <Link
          href="/duels"
          className="inline-flex items-center gap-1.5 text-label text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          <ArrowLeft size={15} /> Барлық дуэльдер
        </Link>

        <SectionHeader
          as="h1"
          title={`${duel.opponent.fullName}-мен дуэль`}
          description={`${duel.moduleId}. ${mod?.title ?? ""} · ${GAME_LABELS[mode] ?? duel.gameMode}`}
        />

        {/* Scoreboard */}
        <div className="glass glass-lit grid grid-cols-2 gap-px overflow-hidden rounded-3xl2">
          {[
            { label: "Сен", score: duel.myScore },
            { label: duel.opponent.fullName, score: duel.theirScore },
          ].map((side) => (
            <div key={side.label} className="px-6 py-7 text-center">
              <p className="truncate text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {side.label}
              </p>
              <p className="data-num mt-1 text-data text-slate-900 dark:text-white">
                {side.score ?? "—"}
              </p>
            </div>
          ))}
        </div>

        {duel.outcome === "waiting-them" && (
          <p className="flex items-center justify-center gap-2 text-label text-slate-600 dark:text-slate-400">
            <Clock size={15} /> Сен ойнадың. Енді {duel.opponent.fullName} ойнағанша күте тұр.
          </p>
        )}
        {(duel.outcome === "won" || duel.outcome === "lost" || duel.outcome === "draw") && (
          <p className="flex items-center justify-center gap-2 text-label">
            {duel.outcome === "won" && <Trophy size={16} className="text-amber-400" />}
            <Badge
              variant={
                duel.outcome === "won" ? "success" : duel.outcome === "lost" ? "danger" : "default"
              }
            >
              {duel.outcome === "won" ? "Жеңдің" : duel.outcome === "lost" ? "Жеңілдің" : "Тең"}
            </Badge>
          </p>
        )}

        {/* The board — same seed for both players */}
        {!played && mod && (
          <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
            <p className="mb-4 text-label text-slate-600 dark:text-slate-400">
              Бұл тақта досыңдағымен бірдей. Нәтиже бір рет қана жазылады, сондықтан асықпа.
            </p>
            <GameRouter mod={mod} seed={duel.seed} only={mode} onScore={handleScore} />
          </section>
        )}

        {played && justScored !== null && (
          <p className="text-center text-label text-emerald-400">
            Нәтижең жазылды: {justScored} ұпай.
          </p>
        )}

        {played && justScored === null && (
          <p className="text-center text-label text-slate-500 dark:text-slate-400">
            Сен бұл дуэльді ойнап болғансың — қайта ойнауға болмайды.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}
