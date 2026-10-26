import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadStudentStats } from "./studentStats";

// The demo backend keeps its records in localStorage; Node has none, so give it one.
function fakeStorage(seed: Record<string, unknown>) {
  const mem = new Map<string, string>(Object.entries(seed).map(([k, v]) => [`mechanics-lms:${k}`, JSON.stringify(v)]));
  return {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
}

const game = (gameType: string, score: number, moduleId = 1) => ({
  id: `${gameType}${score}${moduleId}`, userId: "u1", moduleId, gameType, score, completedAt: "2026-10-20T10:00:00.000Z",
});
const attempt = (moduleId: number, score: number, total = 10) => ({
  id: `a${moduleId}${score}`, userId: "u1", moduleId, score, total, answers: [], takenAt: "2026-10-20T10:00:00.000Z",
});

describe("the student's figures for the final grade", () => {
  beforeEach(() => vi.stubGlobal("window", {}));
  afterEach(() => vi.unstubAllGlobals());

  const withRecords = (records: Record<string, unknown>) =>
    vi.stubGlobal("window", { localStorage: fakeStorage(records) });

  it("average the lesson games only — a perfect daily challenge does not lift the games mark", () => {
    withRecords({ gameResults: [game("blitz", 40), game("memory", 60, 2), game("daily", 100, 0), game("daily", 100, 0)] });
    return loadStudentStats("u1").then((s) => {
      expect(s.gameAverage).toBe(50); // (40 + 60) / 2, not (40 + 60 + 100 + 100) / 4 = 75
    });
  });

  it("leave the games mark absent, not zero, for someone who has only done the daily challenge", () => {
    withRecords({ gameResults: [game("daily", 80, 0)] });
    return loadStudentStats("u1").then((s) => {
      expect(s.gameAverage).toBeNull();
    });
  });

  it("still count a lesson as passed from 60 %, and not from 59 %", () => {
    withRecords({ quizAttempts: [attempt(1, 6), attempt(2, 59, 100), attempt(3, 10)] });
    return loadStudentStats("u1").then((s) => {
      expect(s.attempted).toBe(3);
      expect(s.completed).toBe(2); // 60 % and 100 %; 59 % falls short
    });
  });
});
