// Cohort figures behind the teacher analytics pages.
//
// This file is two things. The *shapes* and *derivations* (StudentRow,
// lessonAverages, studentProgress, …) are what the live analytics are built
// from, in src/lib/analytics/cohort.ts. The *dataset* (COHORT and the DEMO_*
// constants) is a synthetic class that only ever appears in demo mode, when no
// Supabase backend is configured, and the pages say so on screen — nothing here
// is a measurement of real students.
//
// The synthetic class is generated from an explicit ability-per-student and
// difficulty-per-lesson model rather than typed out at random, which means the
// charts tell a consistent story: the same students are weak everywhere, and
// the same lessons are hard for everyone.

import { ALL_MODULES } from "./modules";

export interface StudentRow {
  id: string;
  fullName: string;
  group: string;
  /** Quiz percentage per lesson, index 0 = lesson 1. `null` = not attempted. */
  scores: (number | null)[];
  /**
   * Activity per weekday, Monday first. Minutes in the demo cohort; in live
   * data, the number of recorded actions (see CohortData.activityUnit) — the
   * platform does not time how long a student has a page open.
   */
  weekly: number[];
  /** Days since the student's last recorded action; `null` if they have none. */
  daysSinceActive: number | null;
  /** Assignments handed in but not yet graded. */
  ungraded: number;
  /**
   * Whether the student has opened the 3D lab at least once. Left `undefined`
   * in live data: opening a simulation is not recorded anywhere, and "unknown"
   * must not be reported as "has not".
   */
  openedSimulation?: boolean;
  /** Diagnostic test result in percent; `null` or absent until taken. */
  pre?: number | null;
  post?: number | null;
}

/** Deterministic generator so the page renders the same figures every load. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NAMES: [string, string][] = [
  ["Айгерім Болатқызы", "МТ-21"],
  ["Динара Нұрланқызы", "МТ-21"],
  ["Ерасыл Тоқтарұлы", "МТ-22"],
  ["Мадина Сәрсенқызы", "МТ-21"],
  ["Асхат Жомартұлы", "МТ-22"],
  ["Нұрлан Серікұлы", "МТ-21"],
  ["Жанель Қайратқызы", "МТ-22"],
  ["Бекзат Мұратұлы", "МТ-21"],
  ["Аружан Ғалымқызы", "МТ-22"],
  ["Дәулет Асқарұлы", "МТ-22"],
  ["Сымбат Ерланқызы", "МТ-21"],
  ["Тимур Бақытұлы", "МТ-22"],
];

/** 0..1 — how well each student generally does. */
const ABILITY = [0.74, 0.95, 0.88, 0.55, 0.42, 0.81, 0.9, 0.66, 0.85, 0.49, 0.78, 0.6];

/**
 * 0..1 — how hard each lesson is for the cohort. Динамика (3), Импульс (6) and
 * Инженерлік механика (10) are the ones that historically cost the most time.
 */
const DIFFICULTY = [0.1, 0.18, 0.38, 0.24, 0.22, 0.4, 0.3, 0.26, 0.2, 0.44];

export function buildCohort(): StudentRow[] {
  const rnd = seeded(20240807);
  // Its own stream: adding the diagnostic scores must not shift every other
  // figure the page already showed.
  const diag = seeded(7770042);
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(100, v)));
  return NAMES.map(([fullName, group], i) => {
    const ability = ABILITY[i];
    // Weaker students get through markedly fewer lessons — the earlier curve
    // was too flat and nobody ever fell into the at-risk band.
    const reached = Math.max(3, Math.round(ALL_MODULES.length * (0.05 + ability * 0.95)));
    const scores = ALL_MODULES.map((_, l) => {
      if (l >= reached) return null;
      const raw = ability - DIFFICULTY[l] + (rnd() - 0.5) * 0.18;
      return Math.round(Math.max(0.25, Math.min(1, raw + 0.28)) * 100);
    });
    const weekly = Array.from({ length: 7 }, (_, d) => {
      const weekend = d >= 5 ? 0.35 : 1;
      return Math.round(ability * weekend * (25 + rnd() * 45));
    });
    const pre = clamp(24 + ability * 34 + (diag() - 0.5) * 14);
    // Hake gain of roughly 0.3–0.6, rising with ability. The weakest students
    // have not got far enough through the course for the post-test to open.
    const gain = 0.28 + ability * 0.3 + (diag() - 0.5) * 0.12;
    const post = reached >= 8 ? clamp(pre + (100 - pre) * gain) : null;
    return {
      id: `st-${i + 1}`,
      fullName,
      group,
      scores,
      weekly,
      daysSinceActive: ability > 0.6 ? Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 9),
      ungraded: rnd() > 0.72 ? 1 + Math.floor(rnd() * 2) : 0,
      openedSimulation: ability > 0.52 || rnd() > 0.6,
      pre,
      post,
    };
  });
}

export const COHORT = buildCohort();

/** Demo only: average quiz attempts per student, per lesson. */
export const DEMO_ATTEMPTS: (number | null)[] = [1.2, 1.4, 1.9, 1.6, 1.5, 2.0, 1.7, 1.6, 1.4, 2.2];

/** Demo only: activity intensity (0–100) by weekday (Monday first) × two-hour slot from 08:00. */
export const DEMO_HEAT: number[][] = [
  [15, 35, 75, 90, 85, 60, 40, 20],
  [20, 45, 80, 95, 90, 70, 50, 25],
  [10, 30, 65, 85, 80, 65, 45, 15],
  [25, 50, 85, 100, 95, 75, 55, 30],
  [30, 60, 90, 80, 70, 50, 35, 10],
  [5, 15, 40, 60, 55, 45, 30, 5],
  [0, 10, 25, 40, 50, 40, 25, 5],
];

/** Demo only: course trend by week. */
export const DEMO_TREND: TrendPoint[] = [
  { week: "1-апта", progress: 20, score: 68, activity: 42 },
  { week: "2-апта", progress: 38, score: 72, activity: 58 },
  { week: "3-апта", progress: 54, score: 65, activity: 64 },
  { week: "4-апта", progress: 68, score: 78, activity: 72 },
  { week: "5-апта", progress: 82, score: 81, activity: 85 },
  { week: "6-апта", progress: 91, score: 86, activity: 90 },
];

/** Demo only: mean level (1–5) on each of the ten rubric criteria. */
export const DEMO_COMPETENCY = [4.2, 3.8, 4.5, 3.2, 3.9, 4.1, 3.5, 3.0, 4.0, 3.7];

/** One week of the trend chart. `score` is `null` in a week with no quiz attempts. */
export interface TrendPoint {
  week: string;
  /** Mean share of the course reached by the end of the week, percent. */
  progress: number;
  /** Mean quiz percentage of the attempts made that week. */
  score: number | null;
  /** Activity that week — minutes in demo data, recorded actions in live data. */
  activity: number;
}

// ---------------------------------------------------------------------------
// Derived figures — every chart and recommendation reads from these
// ---------------------------------------------------------------------------

export const LESSON_LABELS = ALL_MODULES.map((m) => `${m.id}. ${m.title}`);
export const LESSON_SHORT = ALL_MODULES.map((m) => String(m.id));

/**
 * Average quiz score per lesson, over the students who attempted it. `null`
 * means nobody has — kept distinct from a low score so a chart can grey out
 * "not reached yet" instead of colouring it as a failing average.
 */
export function lessonAverages(rows: StudentRow[] = COHORT): (number | null)[] {
  return ALL_MODULES.map((_, l) => {
    const taken = rows.map((r) => r.scores[l]).filter((s): s is number => s !== null);
    if (taken.length === 0) return null;
    return Math.round(taken.reduce((a, b) => a + b, 0) / taken.length);
  });
}

/** How many students have completed each lesson — the drop-off curve. */
export function lessonCompletion(rows: StudentRow[] = COHORT): number[] {
  return ALL_MODULES.map((_, l) => rows.filter((r) => r.scores[l] !== null).length);
}

export function studentProgress(row: StudentRow): number {
  const done = row.scores.filter((s) => s !== null).length;
  return Math.round((done / row.scores.length) * 100);
}

export function studentAverage(row: StudentRow): number {
  const taken = row.scores.filter((s): s is number => s !== null);
  if (taken.length === 0) return 0;
  return Math.round(taken.reduce((a, b) => a + b, 0) / taken.length);
}

/** Progress split into five buckets, for the distribution chart. */
export const PROGRESS_BUCKETS = ["0–20%", "21–40%", "41–60%", "61–80%", "81–100%"];

export function progressDistribution(rows: StudentRow[] = COHORT): number[] {
  const buckets = [0, 0, 0, 0, 0];
  for (const r of rows) {
    const p = studentProgress(r);
    buckets[Math.min(4, Math.floor(p / 20.001))] += 1;
  }
  return buckets;
}

export function cohortWeekly(rows: StudentRow[] = COHORT): number[] {
  if (rows.length === 0) return Array.from({ length: 7 }, () => 0);
  return Array.from({ length: 7 }, (_, d) =>
    Math.round((rows.reduce((a, r) => a + r.weekly[d], 0) / rows.length) * 10) / 10
  );
}

/**
 * Headline numbers. `competencyLevel` is the mean rubric level (1–5) from real
 * assessments, or `null` when nobody has been assessed; left out, it is
 * estimated from the quiz average, which is only what the demo cohort has.
 */
export function cohortSummary(rows: StudentRow[] = COHORT, competencyLevel?: number | null) {
  const n = rows.length;
  const avgProgress = n ? Math.round(rows.reduce((a, r) => a + studentProgress(r), 0) / n) : 0;
  const avgScore = n ? Math.round(rows.reduce((a, r) => a + studentAverage(r), 0) / n) : 0;
  const weeklyActivity = rows.reduce((a, r) => a + r.weekly.reduce((x, y) => x + y, 0), 0);
  return {
    students: n,
    avgProgress,
    avgScore,
    avgCompetency:
      competencyLevel === undefined
        ? Math.round((avgScore / 100) * 5 * 10) / 10
        : competencyLevel === null
          ? null
          : Math.round(competencyLevel * 10) / 10,
    weeklyActivity,
    ungraded: rows.reduce((a, r) => a + r.ungraded, 0),
  };
}
