"use client";

// Where the league's members come from.
//
// Live: league_week() in the database, which alone may add up a classmate's week.
// Demo: the same classmates as the leaderboard (the local link graph), their
// records read from this browser's own store and scored by the same rule in
// src/lib/league.ts.

import type { AppUser } from "./types";
import { isSupabaseConfigured, supabase } from "./supabase/client";
import { listClassmates } from "./supabase/links";
import { mockPerson } from "./supabase/mock";
import {
  getAssignmentSubmissions,
  getCompetencyAssessments,
  getDiagnosticAttempts,
  getGameResults,
  getQuizAttempts,
} from "./dataStore";
import { participationPoints, type LeagueMember } from "./league";

export async function loadLeagueWeek(me: AppUser, weekStart: Date): Promise<LeagueMember[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("league_week", { week_start: weekStart.toISOString() });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      userId: r.id,
      fullName: r.full_name,
      group: r.study_group ?? null,
      isMe: Boolean(r.is_me),
      points: r.points ?? 0,
      activeDays: r.active_days ?? 0,
    }));
  }

  const classmates = await listClassmates(me);
  return Promise.all(
    classmates.map(async (c): Promise<LeagueMember> => {
      const [quizzes, games, submissions, assessments, diagnostics] = await Promise.all([
        getQuizAttempts(c.userId),
        getGameResults(c.userId),
        getAssignmentSubmissions(c.userId),
        getCompetencyAssessments(c.userId),
        getDiagnosticAttempts(c.userId),
      ]);
      const { points, activeDays } = participationPoints(
        { quizzes, games, submissions, assessments, diagnostics },
        weekStart
      );
      return {
        userId: c.userId,
        fullName: c.fullName,
        group: mockPerson(c.userId)?.studyGroup ?? (c.userId === me.uid ? me.group ?? null : null),
        isMe: c.userId === me.uid,
        points,
        activeDays,
      };
    })
  );
}
