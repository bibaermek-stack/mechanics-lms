import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncXp } from "./xp";
import { useAuthStore } from "./authStore";
import type { AppUser } from "./types";

// The same records as supabase/tests/0009_xp.sql, which expects the same total from
// the SQL rule. The XP rule lives in two places — compute_xp() in the database and
// computeLocalXp() here for the demo — and this is what keeps them from drifting.
//
//   quizzes   lesson 1 best 9/10 -> 90, lesson 2 10/10 -> 100             190
//   games     memory best 70 -> 35, blitz 100 -> 50, daily 80 -> 40       125
//   БӨЖ       reviewed 85 -> 68, reviewed 50 -> 40, pending (graded) -> 0 108
//   rubric    lesson 1 best 80 -> 32, lesson 2 70 -> 28                    60
//                                                                          ---
//                                                                          483
const U = "u1";
const at = "2026-10-20T10:00:00.000Z";
const quiz = (moduleId: number, score: number, total: number) => ({ id: `q${moduleId}${score}`, userId: U, moduleId, score, total, answers: [], takenAt: at });
const game = (moduleId: number, gameType: string, score: number) => ({ id: `g${moduleId}${gameType}${score}`, userId: U, moduleId, gameType, score, completedAt: at });
const work = (moduleId: number, status: string, grade: number | undefined) => ({ id: `w${moduleId}`, userId: U, moduleId, type: "text", content: "x", submittedAt: at, status, grade });
const rubric = (moduleId: number, percent: number) => ({ id: `r${moduleId}${percent}`, userId: U, moduleId, scores: [], averageLevel: 3, percent, assessedAt: at, assessorType: "self" });

const DATASET = {
  quizAttempts: [quiz(1, 6, 10), quiz(1, 9, 10), quiz(2, 10, 10)],
  gameResults: [game(1, "memory", 50), game(1, "memory", 70), game(1, "blitz", 100), game(0, "daily", 80)],
  assignmentSubmissions: [work(1, "reviewed", 85), work(2, "reviewed", 50), work(3, "pending", 100)],
  competencyAssessments: [rubric(1, 60), rubric(1, 80), rubric(2, 70)],
};

function storage(seed: Record<string, unknown>) {
  const mem = new Map<string, string>(Object.entries(seed).map(([k, v]) => [`mechanics-lms:${k}`, JSON.stringify(v)]));
  return { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
}
const me = { uid: U, fullName: "A", email: "a@b.kz", role: "student", createdAt: at, xp: 0 } as AppUser;

describe("the XP rule, demo copy", () => {
  beforeEach(() => vi.stubGlobal("window", {}));
  afterEach(() => vi.unstubAllGlobals());
  const sync = (data: Record<string, unknown>) => {
    vi.stubGlobal("window", { localStorage: storage(data) });
    return syncXp(me);
  };

  it("gives 483 for the records the SQL rule gives 483 for", async () => {
    expect(await sync(DATASET)).toBe(483);
  });

  it("writes the figure into the signed-in user", async () => {
    useAuthStore.getState().setUser(me);
    await sync(DATASET);
    expect(useAuthStore.getState().user?.xp).toBe(483);
  });

  it("follows the same replay rules: a worse score changes nothing, a better one adds the difference", async () => {
    expect(await sync({ ...DATASET, gameResults: [...DATASET.gameResults, game(1, "memory", 10)] })).toBe(483);
    expect(await sync({ ...DATASET, gameResults: [...DATASET.gameResults, game(1, "memory", 100)] })).toBe(498);
  });

  it("rounds halves up like the database: 75 x 0,5 -> 38 and 1 of 8 -> 13", async () => {
    expect(await sync({ ...DATASET, gameResults: [...DATASET.gameResults, game(5, "order", 75)] })).toBe(483 + 38);
    expect(await sync({ ...DATASET, quizAttempts: [...DATASET.quizAttempts, quiz(7, 1, 8)] })).toBe(483 + 13);
  });

  it("does not count work that is still pending, graded or not", async () => {
    const onlyPending = { ...DATASET, assignmentSubmissions: [work(3, "pending", 100)] };
    expect(await sync(onlyPending)).toBe(483 - 108);
  });

  it("is zero for someone with no records", async () => {
    expect(await sync({})).toBe(0);
  });
});
