import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_QUESTIONS, POST_UNLOCK_LESSONS } from "@/data/diagnostic";
import { diagnosticPercent, diagnosticStatus, gradeDiagnostic, lessonsAttempted } from "./diagnostic";
import type { DiagnosticAttempt, QuizAttempt } from "./types";

const quiz = (moduleId: number): QuizAttempt => ({
  id: `q${moduleId}`,
  userId: "u",
  moduleId,
  score: 7,
  total: 10,
  answers: [],
  takenAt: "2025-01-01T00:00:00Z",
});

const sitting = (phase: "pre" | "post"): DiagnosticAttempt => ({
  id: phase,
  userId: "u",
  phase,
  score: 10,
  total: 20,
  answers: [],
  takenAt: "2025-01-01T00:00:00Z",
});

describe("the diagnostic instrument", () => {
  it("has 20 items, two per lesson topic", () => {
    expect(DIAGNOSTIC_QUESTIONS).toHaveLength(20);
    for (let topic = 1; topic <= 10; topic++) {
      expect(DIAGNOSTIC_QUESTIONS.filter((q) => q.topic === topic)).toHaveLength(2);
    }
  });

  it("is well formed: unique ids, four distinct options, the key points at one of them", () => {
    const ids = new Set<string>();
    for (const q of DIAGNOSTIC_QUESTIONS) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.question.trim().length).toBeGreaterThan(10);
    }
  });

  it("does not give the answer away by position", () => {
    const counts = [0, 0, 0, 0];
    for (const q of DIAGNOSTIC_QUESTIONS) counts[q.correctIndex]++;
    // Every position is used, and none dominates.
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(3);
      expect(c).toBeLessThanOrEqual(7);
    }
  });
});

describe("gradeDiagnostic", () => {
  it("scores a perfect sitting", () => {
    const all = Object.fromEntries(DIAGNOSTIC_QUESTIONS.map((q) => [q.id, q.correctIndex]));
    const g = gradeDiagnostic(all);
    expect(g.score).toBe(20);
    expect(g.total).toBe(20);
    expect(g.answers.every((a) => a.correct)).toBe(true);
  });

  it("counts a skipped question as wrong and records it as -1", () => {
    const g = gradeDiagnostic({});
    expect(g.score).toBe(0);
    expect(g.answers.every((a) => a.chosenIndex === -1 && !a.correct)).toBe(true);
  });

  it("marks only the correct ones", () => {
    const [a, b, c] = DIAGNOSTIC_QUESTIONS;
    const wrong = (a.correctIndex + 1) % 4;
    const g = gradeDiagnostic({ [a.id]: a.correctIndex, [b.id]: (b.correctIndex + 1) % 4, [c.id]: c.correctIndex });
    expect(g.score).toBe(2);
    expect(g.answers[0]).toEqual({ questionId: a.id, chosenIndex: a.correctIndex, correct: true });
    expect(g.answers[1].correct).toBe(false);
    expect(wrong).not.toBe(a.correctIndex);
  });

  it("converts to a rounded percentage", () => {
    expect(diagnosticPercent({ score: 14, total: 20 })).toBe(70);
    expect(diagnosticPercent({ score: 1, total: 3 })).toBe(33);
  });
});

describe("diagnosticStatus", () => {
  it("opens the pre-test first", () => {
    const s = diagnosticStatus([], []);
    expect(s.next).toBe("pre");
    expect(s.postLockedReason).toBeNull();
  });

  it("keeps the post-test closed until enough lessons have been tried", () => {
    const few = Array.from({ length: POST_UNLOCK_LESSONS - 1 }, (_, i) => quiz(i + 1));
    const s = diagnosticStatus([sitting("pre")], few);
    expect(s.next).toBeNull();
    expect(s.postLockedReason).toContain(String(POST_UNLOCK_LESSONS));
    expect(s.lessonsDone).toBe(POST_UNLOCK_LESSONS - 1);
  });

  it("opens the post-test once the threshold is met, counting lessons not attempts", () => {
    const enough = Array.from({ length: POST_UNLOCK_LESSONS }, (_, i) => quiz(i + 1));
    expect(diagnosticStatus([sitting("pre")], enough).next).toBe("post");
    // Ten attempts at one lesson is still one lesson.
    const repeats = Array.from({ length: 10 }, () => quiz(1));
    expect(lessonsAttempted(repeats)).toBe(1);
    expect(diagnosticStatus([sitting("pre")], repeats).next).toBeNull();
  });

  it("offers nothing once both are done", () => {
    const s = diagnosticStatus([sitting("pre"), sitting("post")], []);
    expect(s.next).toBeNull();
    expect(s.postLockedReason).toBeNull();
  });
});
