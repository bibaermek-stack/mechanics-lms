import { describe, expect, it } from "vitest";
import { buildCohortData, demoCohortData, type CohortRecords, type CohortStudent } from "./cohort";
import type { CompetencyAssessment, DiagnosticAttempt, QuizAttempt, AssignmentSubmission } from "@/lib/types";

// All dates are built in local time so that "Monday 10:30" means Monday 10:30
// wherever the tests run — the heat map and the weekday bars are local-time.
const at = (m: number, d: number, h = 12, min = 0) => new Date(2025, m - 1, d, h, min).toISOString();
// Wednesday 12 March 2025, midday.
const NOW = new Date(2025, 2, 12, 12, 0);

const students: CohortStudent[] = [
  { id: "a", fullName: "A", group: "МТ-21" },
  { id: "b", fullName: "B", group: "МТ-22" },
  { id: "c", fullName: "C", group: null },
];

const quiz = (id: string, userId: string, moduleId: number, score: number, takenAt: string): QuizAttempt => ({
  id, userId, moduleId, score, total: 10, answers: [], takenAt,
});
const diag = (id: string, userId: string, phase: "pre" | "post", score: number, takenAt: string): DiagnosticAttempt => ({
  id, userId, phase, score, total: 20, answers: [], takenAt,
});
const sub = (id: string, userId: string, status: "pending" | "reviewed", submittedAt: string): AssignmentSubmission => ({
  id, userId, moduleId: 1, type: "text", content: "", status, submittedAt,
});
const assess = (id: string, userId: string, level: 1 | 2 | 3 | 4 | 5, assessedAt: string): CompetencyAssessment => ({
  id, userId, moduleId: 1, averageLevel: level, percent: level * 20, assessedAt, assessorType: "self",
  scores: ["knowledge", "ict", "infoSearch", "digitalComm", "criticalThinking", "independentLearning", "aiUsage", "practicalApplication", "creativity", "reflection"].map(
    (criterion) => ({ criterion: criterion as never, level })
  ),
});

const records: CohortRecords = {
  quiz: [
    quiz("q1", "a", 1, 6, at(3, 10, 10, 30)), // Mon
    quiz("q2", "a", 1, 9, at(3, 11, 15, 0)), // Tue — the best attempt at lesson 1
    quiz("q3", "a", 2, 5, at(3, 11, 15, 5)), // Tue
    quiz("q4", "b", 1, 10, at(2, 20, 9, 0)), // Thu, 20 days ago
  ],
  games: [],
  submissions: [
    sub("s1", "a", "pending", at(3, 9, 20, 0)), // Sun
    sub("s2", "a", "reviewed", at(3, 2, 12, 0)), // Sun, outside the last 7 days
  ],
  assessments: [
    assess("c1", "a", 2, at(3, 1, 9, 0)), // superseded by c2
    assess("c2", "a", 4, at(3, 5, 9, 0)),
    assess("c3", "b", 2, at(3, 6, 14, 0)),
  ],
  diagnostics: [
    diag("d1", "a", "pre", 8, at(2, 1, 10, 0)),
    diag("d2", "a", "post", 14, at(3, 11, 16, 0)),
    diag("d3", "b", "pre", 10, at(2, 10, 10, 0)),
  ],
};

describe("buildCohortData (live)", () => {
  const data = buildCohortData(students, records, NOW);
  const [a, b, c] = data.rows;

  it("is flagged as live data counted in actions, not minutes", () => {
    expect(data.source).toBe("live");
    expect(data.activityUnit).toBe("actions");
  });

  it("takes each student's best quiz result per lesson", () => {
    expect(a.scores.slice(0, 3)).toEqual([90, 50, null]);
    expect(a.scores.slice(2).every((s) => s === null)).toBe(true);
    expect(b.scores[0]).toBe(100);
    expect(c.scores.every((s) => s === null)).toBe(true);
  });

  it("reads the diagnostic percentages and leaves a missing one null", () => {
    expect([a.pre, a.post]).toEqual([40, 70]);
    expect([b.pre, b.post]).toEqual([50, null]);
    expect([c.pre, c.post]).toEqual([null, null]);
  });

  it("counts ungraded work as the pending submissions", () => {
    expect(a.ungraded).toBe(1);
    expect(b.ungraded).toBe(0);
  });

  it("counts the last seven days of actions by weekday (Monday first)", () => {
    // Mon: 1 quiz · Tue: 2 quizzes + the post-test · Sun: 1 submission.
    expect(a.weekly).toEqual([1, 3, 0, 0, 0, 0, 1]);
    // B's one action this week is an assessment on Thursday.
    expect(b.weekly).toEqual([0, 0, 0, 1, 0, 0, 0]);
    expect(c.weekly).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("measures days since the last action, and says 'never' as null", () => {
    expect(a.daysSinceActive).toBe(0); // post-test yesterday at 16:00 is 20 hours ago
    expect(b.daysSinceActive).toBe(5); // assessment on 6 March
    expect(c.daysSinceActive).toBeNull();
  });

  it("does not claim to know whether a simulation was opened", () => {
    expect(a.openedSimulation).toBeUndefined();
  });

  it("gives a student with no study group a placeholder, not undefined", () => {
    expect(c.group).toBe("—");
  });

  it("averages attempts per student who tried the lesson", () => {
    expect(data.attempts[0]).toBe(1.5); // a: 2 attempts, b: 1
    expect(data.attempts[1]).toBe(1);
    expect(data.attempts[2]).toBeNull();
  });

  it("uses each student's latest assessment per lesson for competency", () => {
    // a's latest is level 4 (the level-2 one is superseded), b's is level 2.
    expect(data.assessed).toBe(2);
    expect(data.competencyLevel).toBe(3);
    expect(data.competency).toHaveLength(10);
    expect(data.competency!.every((v) => v === 3)).toBe(true);
  });

  it("scales the heat map so the busiest slot is 100", () => {
    expect(data.heat).toHaveLength(7);
    expect(data.heat.every((r) => r.length === 8)).toBe(true);
    // Tuesday 14:00–16:00 holds two quizzes: the peak.
    expect(data.heat[1][3]).toBe(100);
    // Monday 10:00–12:00 holds one: half of it.
    expect(data.heat[0][1]).toBe(50);
    expect(Math.max(...data.heat.flat())).toBe(100);
  });

  it("builds six weekly trend points, oldest first, with gaps where nothing was attempted", () => {
    expect(data.trend).toHaveLength(6);
    const last = data.trend[5];
    // This week: 60, 90 and 50 → mean 66.7. Progress: a has 2 of 10 lessons, b 1, c 0 → 10 %.
    expect(last.score).toBe(67);
    expect(last.progress).toBe(10);
    expect(last.activity).toBe(6); // 5 actions by a, 1 by b — the same as the weekday bars
    // b's lesson-1 quiz, 20 days ago, falls in the fourth of the six weeks.
    expect(data.trend[3].score).toBe(100);
    expect(data.trend[0].score).toBeNull();
  });
});

describe("buildCohortData (edge cases)", () => {
  it("is empty and finite with no students", () => {
    const d = buildCohortData([], { quiz: [], games: [], submissions: [], assessments: [], diagnostics: [] }, NOW);
    expect(d.rows).toEqual([]);
    expect(d.competency).toBeNull();
    expect(d.competencyLevel).toBeNull();
    expect(d.trend.every((t) => t.progress === 0 && t.score === null)).toBe(true);
    expect(d.heat.flat().every((v) => v === 0)).toBe(true);
  });

  it("ignores records belonging to anyone who is not an accepted student", () => {
    const d = buildCohortData(
      [students[0]],
      {
        ...records,
        quiz: [...records.quiz, quiz("x", "stranger", 1, 10, at(3, 11, 10, 0))],
        diagnostics: [...records.diagnostics, diag("x", "stranger", "pre", 20, at(3, 11, 10, 0))],
      },
      NOW
    );
    expect(d.rows).toHaveLength(1);
    expect(d.attempts[0]).toBe(2); // a alone: two attempts, the stranger's is not averaged in
  });

  it("does not count activity from the future", () => {
    const d = buildCohortData(
      [students[0]],
      { quiz: [quiz("f", "a", 1, 10, at(3, 20, 12, 0))], games: [], submissions: [], assessments: [], diagnostics: [] },
      NOW
    );
    expect(d.rows[0].weekly).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(d.heat.flat().every((v) => v === 0)).toBe(true);
  });

  it("survives a malformed timestamp", () => {
    const d = buildCohortData(
      [students[0]],
      { quiz: [quiz("m", "a", 1, 10, "not a date")], games: [], submissions: [], assessments: [], diagnostics: [] },
      NOW
    );
    expect(d.rows[0].daysSinceActive).toBeNull();
  });
});

describe("demoCohortData", () => {
  it("is flagged as demo, with two study groups to compare", () => {
    const d = demoCohortData();
    expect(d.source).toBe("demo");
    expect(new Set(d.rows.map((r) => r.group)).size).toBe(2);
  });

  it("has diagnostic scores for the research panel, and a student the post-test has not opened for", () => {
    const d = demoCohortData();
    expect(d.rows.every((r) => typeof r.pre === "number")).toBe(true);
    expect(d.rows.some((r) => r.post === null)).toBe(true);
    expect(d.rows.some((r) => typeof r.post === "number")).toBe(true);
  });
});
