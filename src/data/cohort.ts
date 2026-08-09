// Cohort dataset behind the teacher analytics page.
//
// This dataset predates real accounts: the numbers stand in for a cohort-wide
// aggregation that now has real records behind it (see migration 0008). They
// are generated from an explicit ability-per-student and difficulty-per-lesson
// model rather than typed out at random, which means the charts tell a
// consistent story: the same students are weak everywhere, and the same lessons
// are hard for everyone. Swap `buildCohort()` for a real query and every chart
// and recommendation on the page follows.

import { ALL_MODULES } from "./modules";

export interface StudentRow {
  id: string;
  fullName: string;
  group: string;
  /** Quiz percentage per lesson, index 0 = lesson 1. `null` = not attempted. */
  scores: (number | null)[];
  /** Minutes of activity, Monday first. */
  weekly: number[];
  /** Days since the student last opened the course. */
  daysSinceActive: number;
  /** Assignments handed in but not yet graded. */
  ungraded: number;
  /** Whether the student has opened the 3D lab at least once. */
  openedSimulation: boolean;
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
    return {
      id: `st-${i + 1}`,
      fullName,
      group,
      scores,
      weekly,
      daysSinceActive: ability > 0.6 ? Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 9),
      ungraded: rnd() > 0.72 ? 1 + Math.floor(rnd() * 2) : 0,
      openedSimulation: ability > 0.52 || rnd() > 0.6,
    };
  });
}

export const COHORT = buildCohort();

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
  return Array.from({ length: 7 }, (_, d) =>
    Math.round(rows.reduce((a, r) => a + r.weekly[d], 0) / rows.length)
  );
}

export function cohortSummary(rows: StudentRow[] = COHORT) {
  const avgProgress = Math.round(
    rows.reduce((a, r) => a + studentProgress(r), 0) / rows.length
  );
  const avgScore = Math.round(rows.reduce((a, r) => a + studentAverage(r), 0) / rows.length);
  const totalMinutes = rows.reduce((a, r) => a + r.weekly.reduce((x, y) => x + y, 0), 0);
  return {
    students: rows.length,
    avgProgress,
    avgScore,
    avgCompetency: Math.round((avgScore / 100) * 5 * 10) / 10,
    weeklyMinutes: totalMinutes,
    ungraded: rows.reduce((a, r) => a + r.ungraded, 0),
  };
}
