"use client";

// Duel list and challenge form.
//
// The list is ordered by what needs doing: boards waiting on this player first,
// then boards waiting on the friend, then finished results. A duel nobody has
// to act on is history, and history belongs at the bottom.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Swords, Trash2, Trophy, Clock, Play } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { ALL_MODULES } from "@/data/modules";
import { GAME_LABELS, type GameMode } from "@/components/games/GameRouter";
import { availableDerivedGames } from "@/data/gameContent";
import { useAuthStore } from "@/lib/authStore";
import { listFriends } from "@/lib/supabase/friends";
import { createDuel, deleteDuel, listDuels, type Duel, type DuelOutcome } from "@/lib/supabase/duels";
import type { PersonSummary } from "@/lib/types";

/** Games that make a fair duel: same board, same rules, a score out of 100. */
const DUEL_GAMES: GameMode[] = [
  "speedquiz",
  "crossword",
  "wordsearch",
  "fillblank",
  "sorting",
  "matching",
  "memory",
];

const OUTCOME_LABEL: Record<DuelOutcome, { text: string; variant: "success" | "danger" | "warning" | "default" }> = {
  "waiting-me": { text: "Сенің кезегің", variant: "warning" },
  "waiting-them": { text: "Досыңды күтуде", variant: "default" },
  won: { text: "Жеңіс", variant: "success" },
  lost: { text: "Жеңіліс", variant: "danger" },
  draw: { text: "Тең", variant: "default" },
};

const ORDER: Record<DuelOutcome, number> = {
  "waiting-me": 0,
  "waiting-them": 1,
  won: 2,
  draw: 2,
  lost: 2,
};

export default function DuelsPage() {
  const user = useAuthStore((s) => s.user);
  const [duels, setDuels] = useState<Duel[] | null>(null);
  const [friends, setFriends] = useState<PersonSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [friendId, setFriendId] = useState("");
  const [moduleId, setModuleId] = useState(1);
  const [gameMode, setGameMode] = useState<GameMode>("speedquiz");

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const [d, f] = await Promise.all([listDuels(user), listFriends(user)]);
      setDuels(d);
      setFriends(f);
      if (!friendId && f.length) setFriendId(f[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Дуэльдерді жүктеу мүмкін болмады");
      setDuels([]);
    }
  }, [user, friendId]);

  useEffect(() => {
    void reload();
    // reload changes identity with friendId; run it on user change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Only offer games this lesson can actually build a board for.
  const modeOptions = useMemo(() => {
    const mod = ALL_MODULES.find((m) => m.id === moduleId);
    if (!mod) return DUEL_GAMES;
    const derived = availableDerivedGames(mod, moduleId * 7919) as string[];
    return DUEL_GAMES.filter(
      (g) =>
        derived.includes(g) ||
        ((g === "matching" || g === "memory") && Boolean(mod.game.pairs?.length))
    );
  }, [moduleId]);

  useEffect(() => {
    if (!modeOptions.includes(gameMode)) setGameMode(modeOptions[0] ?? "speedquiz");
  }, [modeOptions, gameMode]);

  async function challenge(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const friend = friends.find((f) => f.id === friendId);
    if (!friend) {
      setError("Досты таңдаңыз.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createDuel(user, friend, moduleId, gameMode);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Шақыру жіберілмеді");
    } finally {
      setBusy(false);
    }
  }

  const sorted = useMemo(
    () =>
      (duels ?? [])
        .slice()
        .sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || b.createdAt.localeCompare(a.createdAt)),
    [duels]
  );

  return (
    <DashboardShell role="student">
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Достармен дуэль"
          description="Досыңды шақыр — екеуің де дәл сол тақтаны ойнайсыңдар, сосын нәтиже салыстырылады."
        />

        {error && (
          <p role="alert" className="text-label text-rose-300">
            {error}
          </p>
        )}

        {/* Challenge form */}
        <section className="glass glass-lit rounded-3xl2 p-5 sm:p-6">
          <h2 className="text-h3 text-slate-900 dark:text-white">Жаңа дуэль</h2>
          {friends.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300/60 p-6 text-center text-label text-slate-500 dark:border-white/10 dark:text-slate-400">
              Дуэль үшін алдымен дос керек.{" "}
              <Link href="/connections" className="text-brand-300 underline">
                Топтас қосу
              </Link>
            </p>
          ) : (
            <form onSubmit={challenge} className="mt-4 grid gap-3 sm:grid-cols-4">
              <label className="text-micro uppercase tracking-wider text-slate-500 sm:col-span-1">
                Дос
                <select
                  value={friendId}
                  onChange={(e) => setFriendId(e.target.value)}
                  className="input-glow mt-1 w-full"
                >
                  {friends.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-micro uppercase tracking-wider text-slate-500 sm:col-span-2">
                Сабақ
                <select
                  value={moduleId}
                  onChange={(e) => setModuleId(Number(e.target.value))}
                  className="input-glow mt-1 w-full"
                >
                  {ALL_MODULES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id}. {m.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-micro uppercase tracking-wider text-slate-500 sm:col-span-1">
                Ойын
                <select
                  value={gameMode}
                  onChange={(e) => setGameMode(e.target.value as GameMode)}
                  className="input-glow mt-1 w-full"
                >
                  {modeOptions.map((g) => (
                    <option key={g} value={g}>
                      {GAME_LABELS[g]}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sm:col-span-4">
                <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
                  <Swords size={16} /> {busy ? "Жіберілуде…" : "Шақыру жіберу"}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Duel list */}
        {duels === null ? (
          <LoadingBlock lines={3} />
        ) : sorted.length === 0 ? (
          <EmptyState
            title="Дуэль әлі жоқ"
            hint="Жоғарыдан досыңды таңдап, сабақ пен ойынды белгіле де шақыру жібер. Екеуің де бірдей тақтаны аласыңдар."
          />
        ) : (
          <ul className="space-y-2">
            {sorted.map((d) => {
              const mod = ALL_MODULES.find((m) => m.id === d.moduleId);
              const badge = OUTCOME_LABEL[d.outcome];
              return (
                <li
                  key={d.id}
                  className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-label font-semibold text-slate-900 dark:text-white">
                      {d.opponent.fullName}
                      <span className="ml-2 font-normal text-slate-500">
                        {GAME_LABELS[d.gameMode as GameMode] ?? d.gameMode}
                      </span>
                    </p>
                    <p className="text-micro text-slate-500 dark:text-slate-400">
                      {d.moduleId}. {mod?.title ?? "—"} ·{" "}
                      {d.iChallenged ? "сен шақырдың" : "ол шақырды"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="data-num text-label text-slate-700 dark:text-slate-200">
                      {d.myScore ?? "—"} : {d.theirScore ?? "—"}
                    </span>
                    <Badge variant={badge.variant}>
                      {d.outcome === "waiting-me" ? (
                        <Clock size={13} />
                      ) : d.outcome === "won" ? (
                        <Trophy size={13} />
                      ) : null}
                      {badge.text}
                    </Badge>

                    {d.myScore === null ? (
                      <Link href={`/duels/${d.id}`} className="btn-primary px-3 py-1.5 text-sm">
                        <Play size={14} /> Ойнау
                      </Link>
                    ) : (
                      <Link href={`/duels/${d.id}`} className="btn-secondary px-3 py-1.5 text-sm">
                        Нәтиже
                      </Link>
                    )}

                    {d.iChallenged && d.myScore === null && d.theirScore === null && (
                      <button
                        onClick={async () => {
                          await deleteDuel(d.id);
                          await reload();
                        }}
                        className="btn-ghost text-slate-400 hover:text-rose-300"
                        aria-label="Шақыруды жою"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}
