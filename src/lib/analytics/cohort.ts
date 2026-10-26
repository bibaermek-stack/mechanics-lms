// Builds the teacher's analytics model from the learning records themselves.
//
// This is the "swap buildCohort() for a real query" that src/data/cohort.ts has
// always said was coming. The function below is pure — records in, figures out,
// no network and no clock except the `now` it is handed — so every number on
// the analytics page can be reproduced in a unit test from a handful of rows.
//
// Two things the platform does not record, and so this file does not invent:
//   • how long a page was open — "activity" is therefore a count of recorded
//     actions (a quiz attempt, a game, a submission, a diagnostic, an
//     assessment), and the pages label it that way;
//   • whether a student opened a 3D simulation — left undefined, never false.

import { ALL_MODULES } from "@/data/modules";
import {
  COHORT,
  DEMO_ATTEMPTS,
  DEMO_COMPETENCY,
  DEMO_HEAT,
  DEMO_TREND,
  type StudentRow,
  type TrendPoint,
} from "@/data/cohort";
import { RUBRIC_CRITERIA } from "@/lib/competency";
import type {
  AssignmentSubmission,
  CompetencyAssessment,
  DiagnosticAttempt,
  GameResult,
  QuizAttempt,
} from "@/lib/types";

/** A student the teacher has accepted — all the page needs to name them. */
export interface CohortStudent {
  id: string;
  fullName: string;
  group: string | null;
}

/** Everything the teacher is allowed to read about those students. */
export interface CohortRecords {
  quiz: QuizAttempt[];
  games: GameResult[];
  submissions: AssignmentSubmission[];
  assessments: CompetencyAssessment[];
  diagnostics: DiagnosticAttempt[];
}

export interface CohortData {
  /** `demo` is the synthetic class shown when no backend is configured. */
  source: "live" | "demo";
  rows: StudentRow[];
  /** What `StudentRow.weekly` and `TrendPoint.activity` are counted in. */
  activityUnit: "minutes" | "actions";
  /** Mean quiz attempts per student who attempted the lesson; `null` if nobody has. */
  attempts: (number | null)[];
  /** Weekday (Monday first) × two-hour slot from 08:00, scaled so the busiest is 100. */
  heat: number[][];
  trend: TrendPoint[];
  /** Mean level (1–5) per rubric criterion, in RUBRIC_CRITERIA order; `null` if nobody was assessed. */
  competency: number[] | null;
  /** Mean of the assessments' average levels, 1–5. */
  competencyLevel: number | null;
  /** How many students have at least one assessment. */
  assessed: number;
}

const DAY = 86_400_000;
export const HEAT_WINDOW_DAYS = 28;
export const TREND_WEEKS = 6;
const HEAT_FIRST_HOUR = 8;
const HEAT_SLOTS = 8;

const percent = (score: number, total: number) => Math.round((100 * score) / total);

/** Monday = 0 … Sunday = 6, in the viewer's local time. */
function weekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

interface Event {
  userId: string;
  at: number;
}

function eventsOf(records: CohortRecords): Event[] {
  const ev: Event[] = [];
  const add = (userId: string, iso: string) => {
    const at = Date.parse(iso);
    if (Number.isFinite(at)) ev.push({ userId, at });
  };
  for (const r of records.quiz) add(r.userId, r.takenAt);
  for (const r of records.games) add(r.userId, r.completedAt);
  for (const r of records.submissions) add(r.userId, r.submittedAt);
  for (const r of records.assessments) add(r.userId, r.assessedAt);
  for (const r of records.diagnostics) add(r.userId, r.takenAt);
  return ev;
}

const lessonIds = () => ALL_MODULES.map((m) => m.id);

export function buildCohortData(
  students: CohortStudent[],
  records: CohortRecords,
  now: Date = new Date()
): CohortData {
  const nowMs = now.getTime();
  const lessons = lessonIds();
  const known = new Set(students.map((s) => s.id));
  const inCohort = <T extends { userId: string }>(xs: T[]) => xs.filter((x) => known.has(x.userId));

  // Records of anybody who is not an accepted student are ignored. RLS already
  // guarantees there are none, but a cohort figure must not depend on that.
  const quiz = inCohort(records.quiz);
  const submissions = inCohort(records.submissions);
  const assessments = inCohort(records.assessments);
  const diagnostics = inCohort(records.diagnostics);
  const events = eventsOf({ ...records, quiz, submissions, assessments, diagnostics, games: inCohort(records.games) });

  const rows: StudentRow[] = students.map((s) => {
    // Best attempt per lesson — the same rule compute_xp() uses, so the
    // teacher's numbers and the student's XP never tell different stories.
    const scores: (number | null)[] = lessons.map((id) => {
      const mine = quiz.filter((q) => q.userId === s.id && q.moduleId === id);
      return mine.length ? Math.max(...mine.map((q) => percent(q.score, q.total))) : null;
    });

    const mineEvents = events.filter((e) => e.userId === s.id);
    const weekly = [0, 0, 0, 0, 0, 0, 0];
    for (const e of mineEvents) {
      if (nowMs - e.at <= 7 * DAY && e.at <= nowMs) weekly[weekday(new Date(e.at))] += 1;
    }
    const last = mineEvents.length ? Math.max(...mineEvents.map((e) => e.at)) : null;

    const diag = (phase: "pre" | "post") => {
      const mine = diagnostics.filter((d) => d.userId === s.id && d.phase === phase);
      if (!mine.length) return null;
      // The database allows one per phase; take the earliest if a demo store has more.
      const first = mine.reduce((a, b) => (a.takenAt <= b.takenAt ? a : b));
      return percent(first.score, first.total);
    };

    return {
      id: s.id,
      fullName: s.fullName,
      group: s.group ?? "—",
      scores,
      weekly,
      daysSinceActive: last === null ? null : Math.max(0, Math.floor((nowMs - last) / DAY)),
      ungraded: submissions.filter((x) => x.userId === s.id && x.status === "pending").length,
      pre: diag("pre"),
      post: diag("post"),
    };
  });

  // Attempts per lesson.
  const attempts = lessons.map((id) => {
    const byStudent = new Map<string, number>();
    for (const q of quiz) if (q.moduleId === id) byStudent.set(q.userId, (byStudent.get(q.userId) ?? 0) + 1);
    if (byStudent.size === 0) return null;
    return Math.round(([...byStudent.values()].reduce((a, b) => a + b, 0) / byStudent.size) * 10) / 10;
  });

  // Heat map: when the cohort works. Actions outside 08:00–24:00 fall out of
  // the grid, which is what the chart's rows cover.
  const heatCounts = Array.from({ length: 7 }, () => Array.from({ length: HEAT_SLOTS }, () => 0));
  for (const e of events) {
    if (nowMs - e.at > HEAT_WINDOW_DAYS * DAY || e.at > nowMs) continue;
    const d = new Date(e.at);
    const slot = Math.floor((d.getHours() - HEAT_FIRST_HOUR) / 2);
    if (slot >= 0 && slot < HEAT_SLOTS) heatCounts[weekday(d)][slot] += 1;
  }
  const peak = Math.max(0, ...heatCounts.flat());
  const heat = heatCounts.map((r) => r.map((c) => (peak ? Math.round((100 * c) / peak) : 0)));

  // Trend: the last TREND_WEEKS weeks, oldest first.
  const trend: TrendPoint[] = Array.from({ length: TREND_WEEKS }, (_, i) => {
    const end = nowMs - (TREND_WEEKS - 1 - i) * 7 * DAY;
    const start = end - 7 * DAY;
    const inWeek = quiz.filter((q) => {
      const t = Date.parse(q.takenAt);
      return t > start && t <= end;
    });
    // Share of the course reached by the end of the week: lessons with an
    // attempt on or before it, averaged over the whole cohort.
    const reached = students.length
      ? students.reduce((acc, s) => {
          const done = new Set(
            quiz.filter((q) => q.userId === s.id && Date.parse(q.takenAt) <= end).map((q) => q.moduleId)
          );
          return acc + done.size / lessons.length;
        }, 0) / students.length
      : 0;
    return {
      week: `${i + 1}-апта`,
      progress: Math.round(reached * 100),
      score: inWeek.length
        ? Math.round(inWeek.reduce((a, q) => a + percent(q.score, q.total), 0) / inWeek.length)
        : null,
      activity: events.filter((e) => e.at > start && e.at <= end).length,
    };
  });

  // Competency: the latest assessment per student per lesson, averaged per criterion.
  const latest = new Map<string, CompetencyAssessment>();
  for (const a of assessments) {
    const key = `${a.userId}:${a.moduleId}`;
    const prev = latest.get(key);
    if (!prev || a.assessedAt > prev.assessedAt) latest.set(key, a);
  }
  const used = [...latest.values()];
  const competency = used.length
    ? RUBRIC_CRITERIA.map((c) => {
        const levels = used.flatMap((a) => a.scores.filter((s) => s.criterion === c.key).map((s) => s.level));
        return levels.length ? Math.round((levels.reduce((x, y) => x + y, 0) / levels.length) * 100) / 100 : 0;
      })
    : null;

  return {
    source: "live",
    rows,
    activityUnit: "actions",
    attempts,
    heat,
    trend,
    competency,
    competencyLevel: used.length ? used.reduce((a, x) => a + x.averageLevel, 0) / used.length : null,
    assessed: new Set(used.map((a) => a.userId)).size,
  };
}

/** The synthetic class for demo mode — see the banner the pages show with it. */
export function demoCohortData(): CohortData {
  return {
    source: "demo",
    rows: COHORT,
    activityUnit: "minutes",
    attempts: DEMO_ATTEMPTS,
    heat: DEMO_HEAT,
    trend: DEMO_TREND,
    competency: DEMO_COMPETENCY,
    competencyLevel: DEMO_COMPETENCY.reduce((a, b) => a + b, 0) / DEMO_COMPETENCY.length,
    assessed: COHORT.length,
  };
}
