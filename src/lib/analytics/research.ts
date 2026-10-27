// The pre/post analysis: what the thesis reports.
//
// Pure functions over StudentRow[], so the panel on the analytics page and the
// CSV export are guaranteed to print the same figures, and so each of them can
// be checked in a test against a hand calculation.
//
// Only students with *both* a pre and a post score enter any paired figure.
// A student who has taken one of the two is counted in `students` but not in
// `paired`, and the panel shows both numbers: silently dropping people is how a
// sample size ends up different from the one in the methods section.

import { LESSON_SHORT, studentAverage, studentProgress, type StudentRow } from "@/data/cohort";
import { hakeGain, mean, pairedT, sd, welchT, type PairedResult, type WelchResult } from "@/lib/stats";
import type { Cell } from "@/lib/csv";

export interface GroupStats {
  group: string;
  /** Everyone in the group. */
  students: number;
  /** Those with both a pre and a post score — the sample every figure below uses. */
  paired: number;
  preMean: number | null;
  preSd: number | null;
  postMean: number | null;
  postSd: number | null;
  /** Mean of (post − pre), percentage points. */
  gain: number | null;
  /** Hake's normalised gain computed on the group means. */
  hake: number | null;
  test: PairedResult | null;
}

/** Pairs of (pre, post) for students who have both, index-aligned. */
export function pairedScores(rows: StudentRow[]): { pre: number[]; post: number[] } {
  const pre: number[] = [];
  const post: number[] = [];
  for (const r of rows) {
    if (typeof r.pre === "number" && typeof r.post === "number") {
      pre.push(r.pre);
      post.push(r.post);
    }
  }
  return { pre, post };
}

export function groupStats(group: string, rows: StudentRow[]): GroupStats {
  const { pre, post } = pairedScores(rows);
  const n = pre.length;
  const preMean = n ? mean(pre) : null;
  const postMean = n ? mean(post) : null;
  return {
    group,
    students: rows.length,
    paired: n,
    preMean,
    preSd: n ? sd(pre) : null,
    postMean,
    postSd: n ? sd(post) : null,
    gain: preMean !== null && postMean !== null ? postMean - preMean : null,
    hake: preMean !== null && postMean !== null ? hakeGain(preMean, postMean) : null,
    test: n >= 2 ? pairedT(pre, post) : null,
  };
}

/** The study groups present, in first-seen order. */
export function groupNames(rows: StudentRow[]): string[] {
  return [...new Set(rows.map((r) => r.group))];
}

/** One entry per study group, then the whole cohort ("Барлығы") last. */
export function researchTable(rows: StudentRow[]): GroupStats[] {
  const byGroup = groupNames(rows).map((g) =>
    groupStats(g, rows.filter((r) => r.group === g))
  );
  return [...byGroup, groupStats("Барлығы", rows)];
}

export interface ArmComparison {
  experimental: GroupStats;
  control: GroupStats;
  /**
   * Welch's test on the *pre* scores. A difference here means the groups did
   * not start level, which undermines a comparison of how they finished.
   */
  baseline: WelchResult | null;
  /** Welch's test on each student's gain (post − pre), experimental − control. */
  gains: WelchResult | null;
}

/** Compares two study groups' gains. The groups must be different. */
export function compareArms(rows: StudentRow[], experimental: string, control: string): ArmComparison | null {
  if (experimental === control) return null;
  const a = rows.filter((r) => r.group === experimental);
  const b = rows.filter((r) => r.group === control);
  const gainsOf = (rs: StudentRow[]) => {
    const { pre, post } = pairedScores(rs);
    return post.map((v, i) => v - pre[i]);
  };
  return {
    experimental: groupStats(experimental, a),
    control: groupStats(control, b),
    baseline: welchT(pairedScores(a).pre, pairedScores(b).pre),
    gains: welchT(gainsOf(a), gainsOf(b)),
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** A p-value for a table: rounded, and "<0,001" rather than a misleading 0. */
const pCell = (p: number | null | undefined): Cell =>
  p === null || p === undefined || !Number.isFinite(p) ? null : p < 0.001 ? "<0,001" : Math.round(p * 10000) / 10000;

const round1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

/** One row per student, with the ten lesson scores and the diagnostic results. */
export function rosterCsvRows(rows: StudentRow[]): Cell[][] {
  const header: Cell[] = [
    "Студент",
    "Топ",
    "Прогресс, %",
    "Орташа ұпай, %",
    ...LESSON_SHORT.map((n) => `${n}-сабақ, %`),
    "Бастапқы диагностика, %",
    "Қорытынды диагностика, %",
    "Өсім, п.п.",
    "Соңғы әрекет, күн бұрын",
    "Тексерілмеген БӨЖ",
  ];
  const body = rows.map((r): Cell[] => {
    const gain = typeof r.pre === "number" && typeof r.post === "number" ? r.post - r.pre : null;
    return [
      r.fullName,
      r.group,
      studentProgress(r),
      studentAverage(r),
      ...r.scores,
      r.pre ?? null,
      r.post ?? null,
      gain,
      r.daysSinceActive,
      r.ungraded,
    ];
  });
  return [header, ...body];
}

/** The group table, as it would go into a thesis. */
export function researchCsvRows(table: GroupStats[], arms: ArmComparison | null): Cell[][] {
  const out: Cell[][] = [
    [
      "Топ",
      "Студент саны",
      "Жұп (pre+post)",
      "Pre, орташа",
      "Pre, SD",
      "Post, орташа",
      "Post, SD",
      "Өсім, п.п.",
      "Hake g",
      "t",
      "df",
      "p",
      "Cohen d_z",
    ],
    ...table.map((g): Cell[] => [
      g.group,
      g.students,
      g.paired,
      round1(g.preMean),
      round1(g.preSd),
      round1(g.postMean),
      round1(g.postSd),
      round1(g.gain),
      round2(g.hake),
      round2(g.test?.t ?? null),
      g.test?.df ?? null,
      pCell(g.test?.p),
      round2(g.test?.dz ?? null),
    ]),
  ];
  if (arms) {
    out.push([]);
    out.push(["Эксперименттік және бақылау топтарын салыстыру"]);
    out.push(["Эксперименттік топ", arms.experimental.group, "Бақылау тобы", arms.control.group]);
    const row = (label: string, w: WelchResult | null): Cell[] => [
      label,
      w ? round2(w.diff) : null,
      w ? round2(w.t) : null,
      w ? round2(w.df) : null,
      pCell(w?.p),
      w ? round2(w.d) : null,
    ];
    out.push(["", "Айырма", "t", "df", "p", "Cohen d"]);
    out.push(row("Бастапқы нәтиже (pre)", arms.baseline));
    out.push(row("Өсім (post − pre)", arms.gains));
  }
  return out;
}
