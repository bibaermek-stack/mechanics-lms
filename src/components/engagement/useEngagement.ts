"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import {
  getAssignmentSubmissions,
  getCompetencyAssessments,
  getDiagnosticAttempts,
  getGameResults,
  getPredictions,
  getQuizAttempts,
} from "@/lib/dataStore";
import { computeEngagement, dayKey, type Achievement, type EngagementRecords, type EngagementState } from "@/lib/engagement";
import { useLessons } from "@/components/providers/LessonsProvider";

export interface UseEngagement {
  /** `null` until the records have arrived. */
  state: EngagementState | null;
  records: EngagementRecords | null;
  /** The viewer's calendar day; null until the page is on the client. */
  today: string | null;
  /** Achievements earned since this page was opened — what to celebrate. */
  fresh: Achievement[];
  /** Read the records again, e.g. after a game has saved its result. */
  reload: () => void;
}

/**
 * The signed-in student's level, streak and achievements.
 *
 * The day is read on the client only, after mount: the server has no idea which
 * calendar day the viewer is in, and guessing would flash the wrong streak.
 */
export function useEngagement(): UseEngagement {
  const user = useAuthStore((s) => s.user);
  const { modules } = useLessons();
  const [records, setRecords] = useState<EngagementRecords | null>(null);
  const [today, setToday] = useState<string | null>(null);
  // What was already earned when the page first loaded; anything beyond it is new.
  const baseline = useRef<Set<string> | null>(null);

  const reload = useCallback(() => {
    if (!user) return;
    const uid = user.uid;
    Promise.all([
      getQuizAttempts(uid),
      getGameResults(uid),
      getAssignmentSubmissions(uid),
      getCompetencyAssessments(uid),
      getDiagnosticAttempts(uid),
      getPredictions(uid),
    ])
      .then(([quizzes, games, submissions, assessments, diagnostics, predictions]) => {
        setRecords({ quizzes, games, submissions, assessments, diagnostics, predictions });
        setToday(dayKey(new Date()));
      })
      .catch(() => {
        // Offline or a table missing: show an honest empty shelf, not a spinner forever.
        setRecords({ quizzes: [], games: [], submissions: [], assessments: [], diagnostics: [], predictions: [] });
        setToday(dayKey(new Date()));
      });
  }, [user]);

  useEffect(reload, [reload]);

  const state = useMemo(
    () => (records && today ? computeEngagement(records, user?.xp ?? 0, today, modules.length) : null),
    [records, today, user?.xp, modules.length]
  );

  if (state && baseline.current === null) {
    baseline.current = new Set(state.achievements.filter((a) => a.unlocked).map((a) => a.id));
  }
  const fresh = useMemo(
    () => (state && baseline.current ? state.achievements.filter((a) => a.unlocked && !baseline.current!.has(a.id)) : []),
    [state]
  );

  return { state, records, today, fresh, reload };
}
