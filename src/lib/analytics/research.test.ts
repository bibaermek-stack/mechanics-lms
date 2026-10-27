import { describe, expect, it } from "vitest";
import type { StudentRow } from "@/data/cohort";
import { compareArms, groupStats, pairedScores, researchCsvRows, researchTable, rosterCsvRows } from "./research";

const row = (id: string, group: string, pre: number | null, post: number | null): StudentRow => ({
  id,
  fullName: `Student ${id}`,
  group,
  scores: Array.from({ length: 10 }, () => null),
  weekly: [0, 0, 0, 0, 0, 0, 0],
  daysSinceActive: 1,
  ungraded: 0,
  pre,
  post,
});

// Group A gains 20, 20, 30; group B gains 10, 5, 10, 5.
const rows: StudentRow[] = [
  row("a1", "A", 40, 60),
  row("a2", "A", 50, 70),
  row("a3", "A", 60, 90),
  row("b1", "B", 40, 50),
  row("b2", "B", 50, 55),
  row("b3", "B", 60, 70),
  row("b4", "B", 70, 75),
];

describe("pairedScores", () => {
  it("keeps only students who have both scores, aligned", () => {
    const { pre, post } = pairedScores([
      row("1", "A", 40, 60),
      row("2", "A", 50, null),
      row("3", "A", null, 70),
      row("4", "A", 30, 45),
    ]);
    expect(pre).toEqual([40, 30]);
    expect(post).toEqual([60, 45]);
  });

  it("treats a score of 0 as a score, not as missing", () => {
    expect(pairedScores([row("1", "A", 0, 10)])).toEqual({ pre: [0], post: [10] });
  });
});

describe("groupStats", () => {
  const a = groupStats("A", rows.filter((r) => r.group === "A"));

  it("computes the group's means, gain and Hake g by hand", () => {
    expect(a.students).toBe(3);
    expect(a.paired).toBe(3);
    expect(a.preMean).toBeCloseTo(50, 10);
    expect(a.postMean).toBeCloseTo(220 / 3, 10);
    expect(a.gain).toBeCloseTo(70 / 3, 10);
    // (73.33 − 50) / (100 − 50)
    expect(a.hake).toBeCloseTo(7 / 15, 10);
  });

  it("paired t: mean gain 23.33, SD 5.7735, t = 7 on 2 df", () => {
    expect(a.test!.t).toBeCloseTo(7, 9);
    expect(a.test!.df).toBe(2);
    // For df = 2 the p-value has a closed form: 1 − t / sqrt(t² + 2).
    expect(a.test!.p).toBeCloseTo(1 - 7 / Math.sqrt(51), 9);
    expect(a.test!.dz).toBeCloseTo(70 / 3 / Math.sqrt(100 / 3), 9);
  });

  it("reports unpaired students in n but does not use them", () => {
    const g = groupStats("A", [row("1", "A", 40, 60), row("2", "A", 50, null), row("3", "A", 55, 80)]);
    expect(g.students).toBe(3);
    expect(g.paired).toBe(2);
    expect(g.preMean).toBe(47.5);
  });

  it("has nothing to report for a group with no complete pairs", () => {
    const g = groupStats("C", [row("1", "C", 40, null)]);
    expect(g).toMatchObject({ paired: 0, preMean: null, postMean: null, gain: null, hake: null, test: null });
  });

  it("gives no test for a single pair", () => {
    expect(groupStats("C", [row("1", "C", 40, 60)]).test).toBeNull();
  });
});

describe("researchTable", () => {
  it("lists each study group then the whole cohort", () => {
    const t = researchTable(rows);
    expect(t.map((g) => g.group)).toEqual(["A", "B", "Барлығы"]);
    expect(t[2].students).toBe(7);
    expect(t[2].paired).toBe(7);
  });
});

describe("compareArms", () => {
  it("compares the groups' gains with Welch's test (reference values computed independently)", () => {
    const c = compareArms(rows, "A", "B")!;
    expect(c.gains!.diff).toBeCloseTo(70 / 3 - 7.5, 10);
    expect(c.gains!.t).toBeCloseTo(4.358899, 5);
    expect(c.gains!.df).toBeCloseTo(2.755725, 5);
    expect(c.gains!.p).toBeCloseTo(0.026518, 5);
    expect(c.gains!.d).toBeCloseTo(3.69787, 4);
  });

  it("checks the groups started level on the pre-test", () => {
    const c = compareArms(rows, "A", "B")!;
    expect(c.baseline!.t).toBeCloseTo(-0.57735, 5);
    expect(c.baseline!.p).toBeCloseTo(0.588922, 5);
  });

  it("refuses to compare a group with itself", () => {
    expect(compareArms(rows, "A", "A")).toBeNull();
  });

  it("returns no test when a group is too small", () => {
    const c = compareArms([row("a1", "A", 40, 60), ...rows.filter((r) => r.group === "B")], "A", "B")!;
    expect(c.gains).toBeNull();
  });
});

describe("exports", () => {
  it("roster CSV has one row per student plus the header, and the diagnostic columns", () => {
    const csv = rosterCsvRows(rows);
    expect(csv).toHaveLength(rows.length + 1);
    const header = csv[0] as string[];
    expect(header).toContain("Бастапқы диагностика, %");
    const iPre = header.indexOf("Бастапқы диагностика, %");
    expect(csv[1][iPre]).toBe(40);
    expect(csv[1][iPre + 1]).toBe(60);
    expect(csv[1][iPre + 2]).toBe(20); // gain
  });

  it("leaves the gain empty when a student lacks one of the scores", () => {
    const csv = rosterCsvRows([row("x", "A", 40, null)]);
    const iPre = (csv[0] as string[]).indexOf("Бастапқы диагностика, %");
    expect(csv[1][iPre + 2]).toBeNull();
  });

  it("never prints a tiny p-value as 0", () => {
    const big = Array.from({ length: 20 }, (_, i) => row(`s${i}`, "A", 30 + (i % 5), 80 + (i % 3)));
    const table = researchTable(big);
    expect(table[0].test!.p).toBeLessThan(0.001);
    const cells = researchCsvRows(table, null)[1];
    expect(cells).toContain("<0,001");
    expect(cells).not.toContain(0);
  });

  it("research CSV carries the group table and, when asked, the comparison", () => {
    const t = researchTable(rows);
    const plain = researchCsvRows(t, null);
    expect(plain).toHaveLength(1 + t.length);
    const withArms = researchCsvRows(t, compareArms(rows, "A", "B"));
    expect(withArms.length).toBeGreaterThan(plain.length + 3);
    expect(JSON.stringify(withArms)).toContain("Эксперименттік");
  });
});
