"use client";

// Ranking among the student's own group.
//
// This used to be a five-name constant, which meant a new account saw
// strangers ranked above them and no row of their own. The list now comes from
// the link graph: the people accepted by the same teacher. Until a teacher has
// accepted the student there is no group to rank, and the page says that
// instead of filling the gap.

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { useAuthStore } from "@/lib/authStore";
import { listClassmates } from "@/lib/supabase/links";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardPage() {
  const user = useAuthStore((s) => s.user);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listClassmates(user)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Тізім жүктелмеді");
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Only the student's own row means nobody else shares their teacher yet.
  const alone = entries !== null && entries.length <= 1;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-h1">Көшбасшылар кестесі</h1>
          <p className="text-body text-slate-600 dark:text-slate-400">
            Бір оқытушыға қосылған топтастарыңмен жарысып, XP ұпайын жина.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-label text-rose-300">
            {error}
          </p>
        )}

        {entries === null && !error ? (
          <LoadingBlock lines={4} />
        ) : alone ? (
          <EmptyState
            title="Топ әлі құралмаған"
            hint="Кесте бір оқытушыға қосылған студенттерден жиналады. Оқытушыңызды тауып, қосылу сұранысын жіберіңіз — сонда топтастарыңыз осында шығады."
            href="/connections"
            cta="Оқытушы табу"
          />
        ) : (
          <>
            <LeaderboardTable entries={entries!} currentUserId={user?.uid} />
            <p className="text-micro text-slate-500 dark:text-slate-400">
              Тізімде {entries!.length} студент. XP викторина, ойын және БӨЖ нәтижелерінен
              жиналады.
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
