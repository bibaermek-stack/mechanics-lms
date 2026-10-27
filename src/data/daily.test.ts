import { describe, expect, it } from "vitest";
import { DAILY_QUESTIONS, buildDaily } from "./daily";
import { ALL_MODULES } from "./modules";
import { shiftDay } from "@/lib/engagement";

const DAYS = Array.from({ length: 300 }, (_, i) => shiftDay("2026-01-01", i));
const originalOf = (id: string) => ALL_MODULES.flatMap((m) => m.quiz).find((q) => q.id === id)!;

describe("the daily challenge", () => {
  it("is five questions", () => {
    expect(DAILY_QUESTIONS).toBe(5);
    for (const d of DAYS.slice(0, 40)) expect(buildDaily(d).questions).toHaveLength(5);
  });

  it("is the same set for the same day, for anyone, any time", () => {
    for (const d of DAYS.slice(0, 20)) expect(buildDaily(d)).toEqual(buildDaily(d));
  });

  it("is a different set from one day to the next", () => {
    const sets = new Set(DAYS.map((d) => buildDaily(d).questions.map((q) => q.id).join("|")));
    expect(sets.size).toBeGreaterThan(290);
    // and tomorrow is never the same set as today
    for (let i = 0; i < 60; i++) {
      const a = buildDaily(DAYS[i]).questions.map((q) => q.id).join();
      const b = buildDaily(DAYS[i + 1]).questions.map((q) => q.id).join();
      expect(a).not.toBe(b);
    }
  });

  it("takes each question from a different lesson", () => {
    for (const d of DAYS) {
      const lessons = buildDaily(d).questions.map((q) => q.moduleId);
      expect(new Set(lessons).size).toBe(5);
      for (const q of buildDaily(d).questions) {
        expect(ALL_MODULES.find((m) => m.id === q.moduleId)!.quiz.some((x) => x.id === q.id)).toBe(true);
      }
    }
  });

  it("spreads over the whole course: over 300 days every lesson comes up about half the time", () => {
    const seen = new Map<number, number>();
    for (const d of DAYS) for (const q of buildDaily(d).questions) seen.set(q.moduleId, (seen.get(q.moduleId) ?? 0) + 1);
    expect(seen.size).toBe(ALL_MODULES.length);
    // 5 of 10 lessons a day: expected 150 each, sd about 9
    for (const [, n] of seen) {
      expect(n).toBeGreaterThan(105);
      expect(n).toBeLessThan(195);
    }
  });

  it("shuffles the options without losing which one is right", () => {
    for (const d of DAYS) {
      for (const q of buildDaily(d).questions) {
        const orig = originalOf(q.id);
        expect(q.options).toHaveLength(orig.options.length);
        expect([...q.options].sort()).toEqual([...orig.options].sort());
        expect(q.options[q.correctIndex]).toBe(orig.options[orig.correctIndex]);
        expect(q.question).toBe(orig.question);
        expect(q.explanation).toBe(orig.explanation);
      }
    }
  });

  it("does not favour a position for the right answer", () => {
    const at = [0, 0, 0, 0];
    for (const d of DAYS) for (const q of buildDaily(d).questions) at[q.correctIndex]++;
    const total = at.reduce((a, b) => a + b, 0);
    for (const n of at) {
      expect(n / total).toBeGreaterThan(0.18);
      expect(n / total).toBeLessThan(0.32);
    }
  });

  it("has no repeated question within a day", () => {
    for (const d of DAYS) {
      const texts = buildDaily(d).questions.map((q) => q.question);
      expect(new Set(texts).size).toBe(5);
    }
  });

  it("follows the lessons it is given — a teacher's edited quiz is what students are asked", () => {
    const edited = ALL_MODULES.map((m) => ({
      ...m,
      quiz: m.quiz.map((q) => ({ ...q, question: `EDITED ${q.question}` })),
    }));
    for (const q of buildDaily(DAYS[0], edited).questions) expect(q.question.startsWith("EDITED ")).toBe(true);
    // and a lesson with no quiz is never drawn from
    const bare = ALL_MODULES.map((m, i) => (i < 3 ? { ...m, quiz: [] } : m));
    for (const d of DAYS.slice(0, 50)) {
      for (const q of buildDaily(d, bare).questions) expect([1, 2, 3]).not.toContain(q.moduleId);
    }
  });
});
