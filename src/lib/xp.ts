"use client";

// Keeping the signed-in user's XP up to date.
//
// The database does the arithmetic: triggers on every table that feeds the
// total call refresh_xp() (migration 0009), so the stored figure is already
// right by the time a write returns. What this module does is re-read it into
// the auth store, because the dashboard and the leaderboard render from there
// and would otherwise keep showing the number from page load.
//
// The mock branch reimplements the same rule against localStorage. Two copies
// of a scoring rule is a real risk, so the shape is kept deliberately parallel
// to compute_xp() — if you change one, change the other, and the comment in the
// SQL says the same thing from its side.

import { isSupabaseConfigured, supabase } from "./supabase/client";
import { useAuthStore } from "./authStore";
import { getAssignmentSubmissions, getCompetencyAssessments, getGameResults, getQuizAttempts } from "./dataStore";
import { mockDuels } from "./supabase/mock";
import type { AppUser } from "./types";

/** Mirror of compute_xp() in migration 0009. Best-per-lesson throughout. */
async function computeLocalXp(user: AppUser): Promise<number> {
  const [attempts, games, subs, assessments] = await Promise.all([
    getQuizAttempts(user.uid),
    getGameResults(user.uid),
    getAssignmentSubmissions(user.uid),
    getCompetencyAssessments(user.uid),
  ]);

  const bestBy = <T>(rows: T[], key: (r: T) => string, value: (r: T) => number) => {
    const best = new Map<string, number>();
    for (const r of rows) {
      const k = key(r);
      const v = value(r);
      if (!best.has(k) || v > best.get(k)!) best.set(k, v);
    }
    return [...best.values()].reduce((a, b) => a + b, 0);
  };

  const quiz = bestBy(
    attempts,
    (a) => String(a.moduleId),
    (a) => (a.total > 0 ? Math.round((100 * a.score) / a.total) : 0)
  );
  const game = bestBy(
    games,
    (g) => `${g.moduleId}:${g.gameType}`,
    (g) => Math.round(g.score * 0.5)
  );
  const work = subs
    .filter((s) => s.status === "reviewed" && typeof s.grade === "number")
    .reduce((a, s) => a + Math.round((s.grade ?? 0) * 0.8), 0);
  const rubric = bestBy(
    assessments,
    (c) => String(c.moduleId),
    (c) => Math.round(c.percent * 0.4)
  );

  const duel = mockDuels()
    .filter(
      (d) =>
        (d.challengerId === user.uid || d.opponentId === user.uid) &&
        d.challengerScore !== null &&
        d.opponentScore !== null
    )
    .reduce((a, d) => {
      const mine = d.challengerId === user.uid ? d.challengerScore! : d.opponentScore!;
      const theirs = d.challengerId === user.uid ? d.opponentScore! : d.challengerScore!;
      return a + (mine > theirs ? 30 : mine === theirs ? 10 : 0);
    }, 0);

  return quiz + game + work + duel + rubric;
}

/**
 * Recompute and store the current user's XP, then push it into the auth store.
 *
 * Safe to call after any scoring action, and safe to call twice: the total is
 * derived from the records, never incremented.
 */
export async function syncXp(user: AppUser | null): Promise<number | null> {
  if (!user) return null;

  let total: number | null = null;
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("refresh_my_xp");
    // A missing function means migration 0009 has not been applied yet; the
    // rest of the app must keep working, so this stays silent.
    if (error) return null;
    total = typeof data === "number" ? data : null;
  } else {
    total = await computeLocalXp(user);
  }

  if (total !== null) {
    const current = useAuthStore.getState().user;
    if (current && current.uid === user.uid) {
      useAuthStore.getState().setUser({ ...current, xp: total });
    }
  }
  return total;
}
