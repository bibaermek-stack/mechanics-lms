import { describe, expect, it } from "vitest";
import {
  LEVEL_NAMES,
  MAX_LEVEL,
  PASS_PERCENT,
  activityDays,
  computeEngagement,
  dailyHistory,
  dailyToday,
  dayKey,
  dayKeyOf,
  isLessonGame,
  levelFor,
  nextUp,
  shiftDay,
  streakOf,
  xpAtLevel,
  type Achievement,
  type EngagementRecords,
} from "./engagement";
import type { AssignmentSubmission, CompetencyAssessment, DiagnosticAttempt, GameResult, PredictionAttempt, QuizAttempt, SensorKind, SensorResult } from "./types";

// Timestamps are built from the *local* calendar and read back through it, so none
// of this depends on the time zone the tests happen to run in.
const at = (day: string, hour = 12) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
};

const quiz = (moduleId: number, score: number, total = 10, day = "2026-10-01"): QuizAttempt => ({
  id: `q${moduleId}-${score}-${day}`, moduleId, userId: "u", score, total, answers: [], takenAt: at(day),
});
const game = (gameType: string, score: number, day = "2026-10-01", moduleId = 1): GameResult => ({
  id: `g${gameType}-${score}-${day}-${moduleId}`, moduleId, userId: "u", gameType: gameType as GameResult["gameType"], score, completedAt: at(day),
});
const sub = (over: Partial<AssignmentSubmission> = {}): AssignmentSubmission => ({
  id: "s", moduleId: 1, userId: "u", type: "text", content: "x", submittedAt: at("2026-10-01"), status: "pending", ...over,
});
const assess = (day = "2026-10-01"): CompetencyAssessment => ({
  id: "a", userId: "u", moduleId: 1, scores: [], averageLevel: 3, percent: 60, assessedAt: at(day), assessorType: "self",
});
const diag = (phase: "pre" | "post", score: number, total = 20, day = "2026-10-01"): DiagnosticAttempt => ({
  id: `d${phase}`, userId: "u", phase, score, total, answers: [], takenAt: at(day),
});
const empty = (): EngagementRecords => ({ quizzes: [], games: [], submissions: [], assessments: [], diagnostics: [] });
const rec = (over: Partial<EngagementRecords>): EngagementRecords => ({ ...empty(), ...over });

const TODAY = "2026-10-26";
const state = (r: EngagementRecords, xp = 0, today = TODAY, lessons = 10) => computeEngagement(r, xp, today, lessons);
const ach = (s: ReturnType<typeof state>, id: string): Achievement => s.achievements.find((a) => a.id === id)!;
const days = (n: number, end = TODAY) => Array.from({ length: n }, (_, i) => shiftDay(end, -i));

describe("levels", () => {
  it("start at 0, 100, 400, 900, … — a square law, each level 200 dearer than the last", () => {
    expect([1, 2, 3, 4, 5, 10].map(xpAtLevel)).toEqual([0, 100, 400, 900, 1600, 8100]);
    const gaps = [1, 2, 3, 4, 5].map((l) => xpAtLevel(l + 1) - xpAtLevel(l));
    expect(gaps).toEqual([100, 300, 500, 700, 900]);
  });

  it("change exactly on the threshold, not a point before", () => {
    const at = (xp: number) => levelFor(xp).level;
    expect([0, 99, 100, 399, 400, 899, 900, 1599, 1600, 8099, 8100].map(at)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 9, 10]);
  });

  it("works out progress inside a level by hand: the demo student's 1 280 XP", () => {
    const l = levelFor(1280); // level 4 runs 900 → 1600
    expect(l.level).toBe(4);
    expect(l.name).toBe("Тәжірибеші");
    expect([l.floor, l.next, l.into, l.span]).toEqual([900, 1600, 380, 700]);
    expect(l.fraction).toBeCloseTo(380 / 700, 12);
  });

  it("tops out at the last level and stays there", () => {
    for (const xp of [8100, 20000, 1e9]) {
      const l = levelFor(xp);
      expect(l.level).toBe(MAX_LEVEL);
      expect(l.name).toBe("Академик");
      expect(l.next).toBeNull();
      expect(l.span).toBeNull();
      expect(l.fraction).toBe(1);
    }
  });

  it("treats nonsense as zero XP rather than a broken bar", () => {
    for (const xp of [-50, NaN, Infinity, -Infinity]) {
      const l = levelFor(xp);
      expect(l.level).toBe(1);
      expect(l.xp).toBe(0);
      expect(l.fraction).toBe(0);
    }
  });

  it("has a distinct name for every level", () => {
    expect(new Set(LEVEL_NAMES).size).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(10);
  });
});

describe("calendar days", () => {
  it("a moment's day is the viewer's own, zero-padded", () => {
    expect(dayKey(new Date(2026, 9, 26, 23, 59, 59))).toBe("2026-10-26");
    expect(dayKey(new Date(2026, 0, 5, 0, 0, 0))).toBe("2026-01-05");
  });

  it("reads a stored timestamp in the viewer's day, and rejects garbage", () => {
    expect(dayKeyOf(new Date(2026, 9, 26, 12).toISOString())).toBe("2026-10-26");
    expect(dayKeyOf("not a date")).toBeNull();
    expect(dayKeyOf("")).toBeNull();
  });

  it("shifts across month ends, leap days and new year", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2024-03-01", -1)).toBe("2024-02-29");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-10-26", 0)).toBe("2026-10-26");
    expect(shiftDay("2026-10-26", -30)).toBe("2026-09-26");
  });

  it("is not bent by the clocks changing: 25-hour and 23-hour days still step by one", () => {
    expect(shiftDay("2026-03-29", 1)).toBe("2026-03-30"); // EU spring forward
    expect(shiftDay("2026-10-25", 1)).toBe("2026-10-26"); // EU fall back
    expect(shiftDay("2026-03-08", 1)).toBe("2026-03-09"); // US spring forward
  });
});

describe("streaks", () => {
  const set = (...d: string[]) => new Set(d);

  it("no activity, no streak", () => {
    expect(streakOf(set(), TODAY)).toEqual({ current: 0, longest: 0, activeToday: false, atRisk: false });
  });

  it("today alone is a streak of one and not at risk", () => {
    expect(streakOf(set(TODAY), TODAY)).toEqual({ current: 1, longest: 1, activeToday: true, atRisk: false });
  });

  it("yesterday alone is still alive but ends tonight", () => {
    expect(streakOf(set("2026-10-25"), TODAY)).toEqual({ current: 1, longest: 1, activeToday: false, atRisk: true });
  });

  it("a day missed ends it: two days ago alone is no current streak", () => {
    expect(streakOf(set("2026-10-24"), TODAY)).toEqual({ current: 0, longest: 1, activeToday: false, atRisk: false });
  });

  it("counts the run ending today and remembers a longer one in the past", () => {
    const old = days(8, "2026-10-10"); // 10-03 … 10-10, eight days
    const now = days(5, TODAY); // 10-22 … 10-26
    const s = streakOf(new Set([...old, ...now]), TODAY);
    expect(s.current).toBe(5);
    expect(s.longest).toBe(8);
  });

  it("a single missing day splits a run in two", () => {
    expect(streakOf(set(TODAY, "2026-10-24", "2026-10-23"), TODAY).current).toBe(1);
    expect(streakOf(set(TODAY, "2026-10-25", "2026-10-23"), TODAY).current).toBe(2);
  });

  it("runs across a month end", () => {
    const s = streakOf(set("2026-02-27", "2026-02-28", "2026-03-01"), "2026-03-01");
    expect(s.current).toBe(3);
  });

  it("a wrong clock cannot buy a streak: days after today are ignored", () => {
    const s = streakOf(set(TODAY, "2026-10-27", "2026-10-28", "2026-10-29"), TODAY);
    expect(s).toEqual({ current: 1, longest: 1, activeToday: true, atRisk: false });
  });

  it("is told by the records, any kind, in the viewer's days", () => {
    const r = rec({
      quizzes: [quiz(1, 5, 10, "2026-10-20")],
      games: [game("memory", 50, "2026-10-21")],
      submissions: [sub({ submittedAt: at("2026-10-22") })],
      assessments: [assess("2026-10-23")],
      diagnostics: [diag("pre", 10, 20, "2026-10-24")],
    });
    expect([...activityDays(r)].sort()).toEqual(["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"]);
    expect(streakOf(activityDays(r), "2026-10-24").current).toBe(5);
  });

  it("skips records whose timestamp is unreadable instead of failing", () => {
    const bad = { ...quiz(1, 5), takenAt: "yesterday-ish" };
    expect(activityDays(rec({ quizzes: [bad] })).size).toBe(0);
  });
});

describe("the daily challenge among the records", () => {
  it("is not a lesson game — nor is the myth game", () => {
    expect(isLessonGame(game("daily", 80))).toBe(false);
    expect(isLessonGame(game("myth", 80))).toBe(false);
    expect(isLessonGame(game("blitz", 80))).toBe(true);
  });

  it("today's result is found by the viewer's day, the first of several, and no other day's", () => {
    const games = [
      game("daily", 40, "2026-10-25"),
      { ...game("daily", 60, TODAY), completedAt: at(TODAY, 18) },
      { ...game("daily", 80, TODAY), completedAt: at(TODAY, 9) },
      game("blitz", 100, TODAY),
    ];
    expect(dailyToday(games, TODAY)?.score).toBe(80);
    expect(dailyToday(games, "2026-10-24")).toBeNull();
    expect(dailyToday([game("blitz", 100, TODAY)], TODAY)).toBeNull();
  });

  it("history is the last N days, oldest first, ending today, with the day's best score", () => {
    const games = [game("daily", 40, TODAY), game("daily", 100, TODAY), game("daily", 60, "2026-10-24"), game("blitz", 90, "2026-10-25")];
    const h = dailyHistory(games, TODAY, 4);
    expect(h.map((d) => d.day)).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26"]);
    expect(h.map((d) => d.score)).toEqual([null, 60, null, 100]);
    expect(dailyHistory([], TODAY).length).toBe(7);
  });
});

describe("achievements", () => {
  it("a new student has none; every one shows no progress of a real target — bar the level one, since everyone starts on level 1", () => {
    const s = state(empty());
    expect(s.unlocked).toBe(0);
    for (const a of s.achievements) {
      expect(a.unlocked).toBe(false);
      expect(a.progress).toBe(a.id === "level-5" ? 1 : 0);
      expect(a.target).toBeGreaterThan(0);
      expect(a.title.length).toBeGreaterThan(2);
      expect(a.description.length).toBeGreaterThan(10);
      expect(a.icon).toMatch(/^[A-Z][A-Za-z0-9]+$/);
    }
    expect(new Set(s.achievements.map((a) => a.id)).size).toBe(s.achievements.length);
  });

  it("first quiz: one attempt is enough", () => {
    expect(ach(state(rec({ quizzes: [quiz(3, 2)] })), "first-quiz").unlocked).toBe(true);
  });

  it("a perfect quiz is 100 %, not 90 %, and not an empty one", () => {
    expect(ach(state(rec({ quizzes: [quiz(1, 9)] })), "quiz-perfect").unlocked).toBe(false);
    expect(ach(state(rec({ quizzes: [quiz(1, 10)] })), "quiz-perfect").unlocked).toBe(true);
    expect(ach(state(rec({ quizzes: [quiz(1, 0, 0)] })), "quiz-perfect").unlocked).toBe(false);
  });

  it("the course is mastered lesson by lesson, best attempt counting, 60 % being a pass", () => {
    expect(PASS_PERCENT).toBe(60);
    const nine = Array.from({ length: 9 }, (_, i) => quiz(i + 1, 8));
    expect(ach(state(rec({ quizzes: nine })), "lessons-passed")).toMatchObject({ progress: 9, target: 10, unlocked: false });
    expect(ach(state(rec({ quizzes: [...nine, quiz(10, 8)] })), "lessons-passed").unlocked).toBe(true);
    // 59 % fails, 60 % passes
    expect(ach(state(rec({ quizzes: [quiz(1, 59, 100)] })), "lessons-passed").progress).toBe(0);
    expect(ach(state(rec({ quizzes: [quiz(1, 60, 100)] })), "lessons-passed").progress).toBe(1);
    // a failed try and a pass on the same lesson count once; two passes on one lesson count once
    expect(ach(state(rec({ quizzes: [quiz(1, 2), quiz(1, 9), quiz(1, 10)] })), "lessons-passed").progress).toBe(1);
    // the target follows the size of the course
    const three = [quiz(1, 9), quiz(2, 9), quiz(3, 9)];
    expect(ach(state(rec({ quizzes: three }), 0, TODAY, 3), "lessons-passed").unlocked).toBe(true);
  });

  it("variety counts kinds of game, 8 of them, and never the daily challenge", () => {
    const kinds = ["memory", "matching", "crossword", "wordsearch", "blitz", "truefalse", "order", "projectile"];
    const seven = kinds.slice(0, 7).map((k) => game(k, 50));
    expect(ach(state(rec({ games: seven })), "game-variety")).toMatchObject({ progress: 7, unlocked: false });
    expect(ach(state(rec({ games: [...seven, game("daily", 90)] })), "game-variety").unlocked).toBe(false);
    expect(ach(state(rec({ games: kinds.map((k) => game(k, 50)) })), "game-variety").unlocked).toBe(true);
    // the same game fifty times is one kind
    const many = Array.from({ length: 50 }, (_, i) => game("memory", 50, shiftDay("2026-08-01", i)));
    expect(ach(state(rec({ games: many })), "game-variety").progress).toBe(1);
  });

  it("the daily challenge is not a first game, nor part of the 25, nor a perfect game", () => {
    const onlyDaily = state(rec({ games: [game("daily", 100)] }));
    expect(ach(onlyDaily, "first-game").unlocked).toBe(false);
    expect(ach(onlyDaily, "game-perfect").unlocked).toBe(false);
    expect(ach(onlyDaily, "game-25").progress).toBe(0);
    expect(ach(onlyDaily, "daily-1").unlocked).toBe(true);
    expect(ach(onlyDaily, "daily-perfect").unlocked).toBe(true);
  });

  it("the myth game earns its own award at 75, and counts as no lesson game at all", () => {
    expect(ach(state(rec({ games: [game("myth", 74)] })), "myth-hunter").unlocked).toBe(false);
    expect(ach(state(rec({ games: [game("myth", 50), game("myth", 75)] })), "myth-hunter").unlocked).toBe(true);
    expect(ach(state(rec({ games: [game("blitz", 100)] })), "myth-hunter").progress).toBe(0);
    const only = state(rec({ games: [game("myth", 100)] }));
    expect(ach(only, "first-game").unlocked).toBe(false);
    expect(ach(only, "game-perfect").unlocked).toBe(false);
    expect(ach(only, "game-variety").progress).toBe(0);
    expect(ach(only, "game-25").progress).toBe(0);
  });

  it("the journey's stars add up across lessons, and a game without a passed quiz adds none", () => {
    const q = (m: number, score: number) => ({ id: `q${m}${score}`, moduleId: m, userId: "u", score, total: 10, answers: [], takenAt: at("2026-10-01") });
    const stars = (r: Partial<EngagementRecords>) => ach(state(rec(r)), "campaign-stars").progress;
    expect(stars({})).toBe(0);
    expect(stars({ quizzes: [q(1, 7)] })).toBe(1);
    expect(stars({ quizzes: [q(1, 9), q(2, 6)], games: [game("memory", 80, "2026-10-02", 1)] })).toBe(4); // 1: quiz+game+mastery = 3, 2: quiz = 1
    expect(stars({ games: [game("memory", 100, "2026-10-02", 1)] })).toBe(0);
    expect(ach(state(rec({ quizzes: Array.from({ length: 5 }, (_, i) => q(i + 1, 9)), games: Array.from({ length: 5 }, (_, i) => game("memory", 90, "2026-10-02", i + 1)) })), "campaign-stars").unlocked).toBe(true);
  });

  it("the folk-games master needs all four traditional games at 60 or more, each counted once", () => {
    const four = ["bow", "asyq", "tug", "rocket"].map((k) => game(k, 60));
    expect(ach(state(rec({ games: four.slice(0, 3) })), "folk-master")).toMatchObject({ progress: 3, unlocked: false });
    expect(ach(state(rec({ games: four })), "folk-master").unlocked).toBe(true);
    expect(ach(state(rec({ games: [...four.slice(0, 3), game("bow", 100), game("bow", 90), game("rocket", 59)] })), "folk-master").progress).toBe(3);
    expect(ach(state(rec({ games: [game("blitz", 100), game("projectile", 100)] })), "folk-master").progress).toBe(0);
  });

  it("coaster engineer is earned at 67 points of the coaster game, which counts as a lesson game", () => {
    expect(ach(state(rec({ games: [game("coaster", 66)] })), "coaster-engineer")).toMatchObject({ progress: 66, unlocked: false });
    expect(ach(state(rec({ games: [game("coaster", 40), game("coaster", 67)] })), "coaster-engineer").unlocked).toBe(true);
    expect(ach(state(rec({ games: [game("blitz", 100)] })), "coaster-engineer").progress).toBe(0);
    expect(ach(state(rec({ games: [game("coaster", 10)] })), "first-game").unlocked).toBe(true);
  });

  it("predictor counts only FIRST predictions that were right, eight of them", () => {
    const pred = (item: string, correct: boolean, day: string, id = item + day): PredictionAttempt =>
      ({ id, userId: "u", itemId: item, optionId: "x", correct, misconception: correct ? null : "m", confidence: 2, createdAt: at(day === "0" ? "2026-10-26" : "2026-10-27") });
    const right = (n: number) => Array.from({ length: n }, (_, i) => pred(`item-${i}`, true, "0"));
    expect(ach(state(rec({ predictions: right(7) })), "predictor")).toMatchObject({ progress: 7, unlocked: false });
    expect(ach(state(rec({ predictions: right(8) })), "predictor").unlocked).toBe(true);
    // a retake that got it right does not repair a first attempt that was wrong
    const retaken = [pred("a", false, "0"), pred("a", true, "1"), ...right(7).map((p, i) => ({ ...p, itemId: `b${i}` }))];
    expect(ach(state(rec({ predictions: retaken })), "predictor").progress).toBe(7);
    // and the same item right twice counts once
    expect(ach(state(rec({ predictions: [pred("a", true, "0"), pred("a", true, "1")] })), "predictor").progress).toBe(1);
  });

  it("a prediction is a day of study, whatever else was done", () => {
    const p: PredictionAttempt = { id: "p", userId: "u", itemId: "x", optionId: "y", correct: true, misconception: null, confidence: 1, createdAt: at("2026-10-26") };
    expect([...activityDays(rec({ predictions: [p] }))]).toEqual(["2026-10-26"]);
    expect(activityDays(rec({})).size).toBe(0);
  });

  it("phone scientist needs three different kinds of measurement, however many of one", () => {
    const sens = (kind: SensorKind, day = "2026-10-26"): SensorResult =>
      ({ id: kind + day, userId: "u", kind, value: 1, unit: "m", details: {}, createdAt: at(day) });
    expect(ach(state(rec({})), "phone-scientist")).toMatchObject({ progress: 0, unlocked: false });
    const many = Array.from({ length: 6 }, (_, i) => sens("jump", shiftDay("2026-10-01", i)));
    expect(ach(state(rec({ sensors: many })), "phone-scientist")).toMatchObject({ progress: 1, unlocked: false });
    expect(ach(state(rec({ sensors: [sens("jump"), sens("rest-g")] })), "phone-scientist").unlocked).toBe(false);
    expect(ach(state(rec({ sensors: [sens("jump"), sens("rest-g"), sens("pendulum")] })), "phone-scientist").unlocked).toBe(true);
  });

  it("a phone measurement is a day of study", () => {
    const m: SensorResult = { id: "s", userId: "u", kind: "rest-g", value: 9.8, unit: "m/s²", details: {}, createdAt: at("2026-10-25") };
    expect([...activityDays(rec({ sensors: [m] }))]).toEqual(["2026-10-25"]);
  });

  it("25 games is 25: 24 does not do", () => {
    const g = (n: number) => Array.from({ length: n }, (_, i) => game("memory", 10, shiftDay("2026-08-01", i)));
    expect(ach(state(rec({ games: g(24) })), "game-25").unlocked).toBe(false);
    expect(ach(state(rec({ games: g(25) })), "game-25").unlocked).toBe(true);
  });

  it("perfect game: 99 no, 100 yes", () => {
    expect(ach(state(rec({ games: [game("order", 99)] })), "game-perfect").unlocked).toBe(false);
    expect(ach(state(rec({ games: [game("order", 100)] })), "game-perfect").unlocked).toBe(true);
  });

  it("the projectile and blitz awards read their own game's best score, at 80 and 75", () => {
    expect(ach(state(rec({ games: [game("projectile", 79)] })), "projectile-ace").unlocked).toBe(false);
    expect(ach(state(rec({ games: [game("projectile", 40), game("projectile", 80)] })), "projectile-ace").unlocked).toBe(true);
    expect(ach(state(rec({ games: [game("blitz", 100)] })), "projectile-ace").progress).toBe(0);
    expect(ach(state(rec({ games: [game("blitz", 74)] })), "blitz-75").unlocked).toBe(false);
    expect(ach(state(rec({ games: [game("blitz", 75)] })), "blitz-75").unlocked).toBe(true);
    expect(ach(state(rec({ games: [game("projectile", 100)] })), "blitz-75").progress).toBe(0);
  });

  it("streak awards go by the longest run, at 3, 7 and 30 days, and keep once earned", () => {
    const run = (n: number, end = TODAY) => rec({ games: days(n, end).map((d) => game("memory", 50, d)) });
    const s2 = state(run(2));
    expect([ach(s2, "streak-3").unlocked, ach(s2, "streak-3").progress]).toEqual([false, 2]);
    expect(ach(state(run(3)), "streak-3").unlocked).toBe(true);
    expect(ach(state(run(6)), "streak-7").unlocked).toBe(false);
    expect(ach(state(run(7)), "streak-7").unlocked).toBe(true);
    expect(ach(state(run(29)), "streak-30").unlocked).toBe(false);
    expect(ach(state(run(30)), "streak-30").unlocked).toBe(true);
    // a week-long run in the past, nothing since: the badge stays
    const past = state(run(7, "2026-09-10"));
    expect(past.streak.current).toBe(0);
    expect(ach(past, "streak-7").unlocked).toBe(true);
  });

  it("daily awards count different days: seven days, not seven sittings", () => {
    const sameDay = Array.from({ length: 9 }, () => game("daily", 50, TODAY));
    expect(ach(state(rec({ games: sameDay })), "daily-7").progress).toBe(1);
    const six = days(6).map((d) => game("daily", 50, d));
    expect(ach(state(rec({ games: six })), "daily-7").unlocked).toBe(false);
    expect(ach(state(rec({ games: days(7).map((d) => game("daily", 50, d)) })), "daily-7").unlocked).toBe(true);
    expect(ach(state(rec({ games: [game("daily", 99)] })), "daily-perfect").unlocked).toBe(false);
  });

  it("the diagnostic: taking the pre-test counts; growth needs a post-test that is higher, in share", () => {
    expect(ach(state(rec({ diagnostics: [diag("pre", 8)] })), "diagnostic").unlocked).toBe(true);
    expect(ach(state(rec({ diagnostics: [diag("post", 8)] })), "diagnostic").unlocked).toBe(false);
    const growth = (pre: DiagnosticAttempt, post?: DiagnosticAttempt) =>
      ach(state(rec({ diagnostics: post ? [pre, post] : [pre] })), "growth").unlocked;
    expect(growth(diag("pre", 10), diag("post", 12))).toBe(true);
    expect(growth(diag("pre", 10), diag("post", 10))).toBe(false);
    expect(growth(diag("pre", 10), diag("post", 9))).toBe(false);
    expect(growth(diag("pre", 10))).toBe(false);
    // different lengths compare by share: 10/20 = 50 % vs 6/10 = 60 %
    expect(growth(diag("pre", 10, 20), diag("post", 6, 10))).toBe(true);
  });

  it("work: any submission counts; the high mark needs a teacher's 80 or more, reviewed", () => {
    expect(ach(state(rec({ submissions: [sub()] })), "first-work").unlocked).toBe(true);
    const graded = (status: "pending" | "reviewed", grade?: number) =>
      ach(state(rec({ submissions: [sub({ status, grade })] })), "work-graded").unlocked;
    expect(graded("reviewed", 79)).toBe(false);
    expect(graded("reviewed", 80)).toBe(true);
    expect(graded("pending", 95)).toBe(false);
    expect(graded("reviewed", undefined)).toBe(false);
  });

  it("self-assessment and level 5 (1 600 XP, not 1 599)", () => {
    expect(ach(state(rec({ assessments: [assess()] })), "self-assess").unlocked).toBe(true);
    expect(ach(state(empty(), 1599), "level-5").unlocked).toBe(false);
    expect(ach(state(empty(), 1600), "level-5").unlocked).toBe(true);
  });

  it("progress never exceeds the target", () => {
    const many = Array.from({ length: 60 }, (_, i) => game("memory", 100, shiftDay("2026-06-01", i)));
    const s = state(rec({ games: many }));
    for (const a of s.achievements) expect(a.progress).toBeLessThanOrEqual(a.target);
    expect(ach(s, "game-25")).toMatchObject({ progress: 25, unlocked: true });
  });

  it("the headline count is the number unlocked", () => {
    const s = state(rec({ quizzes: [quiz(1, 10)], games: [game("blitz", 100)] }), 0);
    expect(s.unlocked).toBe(s.achievements.filter((a) => a.unlocked).length);
    expect(s.unlocked).toBeGreaterThan(2);
  });

  it("leaves its input alone", () => {
    const r = rec({
      quizzes: [quiz(1, 10), quiz(2, 3)],
      games: [game("daily", 60, TODAY), game("daily", 80, TODAY), game("memory", 20)],
      diagnostics: [diag("pre", 5), diag("post", 9)],
    });
    Object.values(r).forEach((a) => Object.freeze(a));
    const before = JSON.stringify(r);
    expect(() => {
      state(r, 500);
      dailyToday(r.games, TODAY);
      dailyHistory(r.games, TODAY);
    }).not.toThrow();
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe("what to aim at next", () => {
  const mk = (id: string, progress: number, target: number): Achievement => ({
    id, title: id, description: "", icon: "Star", progress, target, unlocked: progress >= target,
  });

  it("skips what is earned and leads with the nearest", () => {
    const list = [mk("done", 5, 5), mk("far", 1, 10), mk("near", 9, 10), mk("mid", 5, 10)];
    expect(nextUp(list, 3).map((a) => a.id)).toEqual(["near", "mid", "far"]);
    expect(nextUp(list, 1).map((a) => a.id)).toEqual(["near"]);
  });

  it("breaks ties by the order the shelf lists them, and copes with fewer than asked", () => {
    const list = [mk("a", 0, 3), mk("b", 0, 3), mk("c", 0, 3)];
    expect(nextUp(list, 2).map((a) => a.id)).toEqual(["a", "b"]);
    expect(nextUp([mk("x", 3, 3)], 3)).toEqual([]);
  });

  it("works on the real shelf: a student one game from a perfect streak badge is pointed at it", () => {
    const s = state(rec({ games: days(2).map((d) => game("memory", 50, d)) }));
    expect(nextUp(s.achievements, 3)[0].id).toBe("streak-3");
  });
});
