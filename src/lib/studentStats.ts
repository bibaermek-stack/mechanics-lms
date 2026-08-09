"use client";

// Everything the student analytics page shows, derived from that student's own
// records.
//
// The page used to render module-level constants — a fixed 85.4%, a fixed 68%
// progress bar, a fixed radar. That is fine for a design mock and wrong the
// moment real accounts exist: somebody signing up for the first time was shown
// a stranger's transcript. Nothing here invents a number. Where a figure has no
// source yet, the field is null and the page says so.

import { ALL_MODULES } from "@/data/modules";
import {
  getAnalyticsSnapshot,
  getAssignmentSubmissions,
  getCompetencyAssessments,
  getGameResults,
  getQuizAttempts,
} from "./dataStore";
import { RUBRIC_CRITERIA, computePartialGrade, rubricLevelToPercent } from "./competency";
import type { FinalGradeBreakdown, FinalGradeResult } from "./types";

/** A lesson counts as done once its best quiz reaches this. */
const PASS = 60;

export interface StudentStats {
  /** Best quiz % per lesson, module order. null = never attempted. */
  lessonScores: (number | null)[];
  attempted: number;
  completed: number;
  progressPercent: number;

  /** null until there is at least one record of that kind. */
  quizAverage: number | null;
  gameAverage: number | null;
  assignmentAverage: number | null;
  pendingSubmissions: number;

  /** Ten rubric levels (1–5) in RUBRIC_CRITERIA order; null if never assessed. */
  competency: number[] | null;
  competencyPercent: number | null;
  assessmentCount: number;

  /** Minutes per weekday, Monday first. All-zero means "not recorded". */
  weeklyMinutes: number[];
  totalMinutes: number;
  hasActivityLog: boolean;

  /** Renormalised over the components that exist; null when none do. */
  grade: (FinalGradeResult & { coveredWeight: number }) | null;

  /** False for a brand-new account — the page shows a first-run state. */
  hasAnyActivity: boolean;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export async function loadStudentStats(userId: string): Promise<StudentStats> {
  const [attempts, games, submissions, assessments, snapshot] = await Promise.all([
    getQuizAttempts(userId),
    getGameResults(userId),
    getAssignmentSubmissions(userId),
    getCompetencyAssessments(userId),
    getAnalyticsSnapshot(userId),
  ]);

  // Best rather than latest attempt: a retake after revision should count.
  const best = new Map<number, number>();
  for (const a of attempts) {
    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
    const prev = best.get(a.moduleId);
    if (prev === undefined || pct > prev) best.set(a.moduleId, pct);
  }
  const lessonScores = ALL_MODULES.map((m) => best.get(m.id) ?? null);
  const scored = lessonScores.filter((s): s is number => s !== null);
  const completed = scored.filter((s) => s >= PASS).length;

  const gradedSubmissions = submissions.filter(
    (s) => s.status === "reviewed" && typeof s.grade === "number"
  );

  // Latest assessment per criterion, so a re-assessment supersedes the old one
  // rather than being averaged with it.
  const latestByCriterion = new Map<string, { level: number; at: string }>();
  for (const a of assessments) {
    for (const s of a.scores) {
      const prev = latestByCriterion.get(s.criterion);
      if (!prev || a.assessedAt > prev.at) {
        latestByCriterion.set(s.criterion, { level: s.level, at: a.assessedAt });
      }
    }
  }
  const competency =
    latestByCriterion.size > 0
      ? RUBRIC_CRITERIA.map((c) => latestByCriterion.get(c.key)?.level ?? 0)
      : null;
  const assessedLevels = competency?.filter((v) => v > 0) ?? [];
  const competencyPercent =
    assessedLevels.length > 0
      ? rubricLevelToPercent(assessedLevels.reduce((a, b) => a + b, 0) / assessedLevels.length)
      : null;

  const quizAverage = mean(scored);
  const gameAverage = mean(games.map((g) => g.score));
  const assignmentAverage = mean(gradedSubmissions.map((s) => s.grade!));

  // Only the components with a real source are offered to the grader. The rest
  // (video watch time, Google Form, forum, portfolio, final project, reflection
  // journal) have no recording path in the app yet, so they stay absent instead
  // of defaulting to zero and dragging the mark down.
  const partial: Partial<FinalGradeBreakdown> = {};
  if (quizAverage !== null) partial.quiz = quizAverage;
  if (gameAverage !== null) partial.games = gameAverage;
  if (assignmentAverage !== null) partial.bozh = assignmentAverage;

  const weeklyMinutes = snapshot.weeklyActivityMinutes ?? [0, 0, 0, 0, 0, 0, 0];
  const totalMinutes = snapshot.timeSpentTotalMinutes ?? 0;

  return {
    lessonScores,
    attempted: scored.length,
    completed,
    progressPercent: Math.round((completed / ALL_MODULES.length) * 100),
    quizAverage,
    gameAverage,
    assignmentAverage,
    pendingSubmissions: submissions.filter((s) => s.status === "pending").length,
    competency,
    competencyPercent,
    assessmentCount: assessments.length,
    weeklyMinutes,
    totalMinutes,
    hasActivityLog: weeklyMinutes.some((m) => m > 0) || totalMinutes > 0,
    grade: computePartialGrade(userId, partial),
    hasAnyActivity:
      attempts.length > 0 ||
      games.length > 0 ||
      submissions.length > 0 ||
      assessments.length > 0,
  };
}

/** "14 сағ 20 мин" / "35 мин" / null when nothing has been recorded. */
export function formatMinutes(total: number): string | null {
  if (total <= 0) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h} сағ ${m} мин` : `${m} мин`;
}
