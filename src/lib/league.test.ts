import { describe, expect, it } from "vitest";
import {
  DAY_CAP,
  LEAGUE_POINTS,
  MIN_GROUP_SIZE,
  champions,
  groupKey,
  groupStandings,
  individualStandings,
  myShare,
  participationPoints,
  shiftWeek,
  weekLabel,
  weekStartOf,
  type LeagueMember,
} from "./league";
import type { EngagementRecords } from "./engagement";

// A week that starts on Monday 26 October 2026, in whatever zone the tests run in.
const MON = new Date(2026, 9, 26);
const at = (dayOffset: number, hour = 12, minute = 0) => new Date(2026, 9, 26 + dayOffset, hour, minute).toISOString();
const none = (): EngagementRecords => ({ quizzes: [], games: [], submissions: [], assessments: [], diagnostics: [] });
const quiz = (iso: string) => ({ id: iso, moduleId: 1, userId: "u", score: 5, total: 10, answers: [], takenAt: iso });
const game = (iso: string, gameType = "memory") => ({ id: iso + gameType, moduleId: 1, userId: "u", gameType: gameType as never, score: 50, completedAt: iso });
const work = (iso: string) => ({ id: iso, moduleId: 1, userId: "u", type: "text" as const, content: "x", submittedAt: iso, status: "pending" as const });
const assess = (iso: string) => ({ id: iso, userId: "u", moduleId: 1, scores: [], averageLevel: 3, percent: 60, assessedAt: iso, assessorType: "self" as const });
const diag = (iso: string) => ({ id: iso, userId: "u", phase: "pre" as const, score: 10, total: 20, answers: [], takenAt: iso });
const rec = (o: Partial<EngagementRecords>): EngagementRecords => ({ ...none(), ...o });

describe("the week", () => {
  it("starts on Monday at midnight, whichever day of it you ask on", () => {
    for (let d = 0; d < 7; d++) {
      const w = weekStartOf(new Date(2026, 9, 26 + d, 15, 30));
      expect([w.getFullYear(), w.getMonth(), w.getDate(), w.getHours(), w.getDay()]).toEqual([2026, 9, 26, 0, 1]);
    }
  });

  it("a Sunday belongs to the week that is ending, not the one starting", () => {
    expect(weekStartOf(new Date(2026, 10, 1, 9)).getDate()).toBe(26); // Sun 1 Nov 2026
    expect(weekStartOf(new Date(2026, 10, 2, 0, 0, 1)).getDate()).toBe(2); // Mon 2 Nov
  });

  it("moves by calendar weeks across a month end and the clocks changing", () => {
    expect(shiftWeek(MON, 1)).toEqual(new Date(2026, 10, 2));
    expect(shiftWeek(MON, -1)).toEqual(new Date(2026, 9, 19));
    expect(shiftWeek(new Date(2026, 2, 23), 1).getHours()).toBe(0); // across EU DST, still midnight
  });

  it("is named in Kazakh from Monday to Sunday", () => {
    expect(weekLabel(MON)).toBe("26 қазан – 1 қараша");
    expect(weekLabel(new Date(2026, 11, 28))).toBe("28 желтоқсан – 3 қаңтар");
  });
});

describe("participation points", () => {
  it("are fixed per kind of record, whatever the score on it", () => {
    expect(LEAGUE_POINTS).toEqual({ quiz: 10, game: 5, daily: 10, submission: 15, assessment: 5, diagnostic: 10 });
    const p = (r: Partial<EngagementRecords>) => participationPoints(rec(r), MON).points;
    expect(p({ quizzes: [quiz(at(0))] })).toBe(10);
    expect(p({ games: [game(at(0))] })).toBe(5);
    expect(p({ games: [game(at(0), "daily")] })).toBe(10);
    expect(p({ submissions: [work(at(0))] })).toBe(15);
    expect(p({ assessments: [assess(at(0))] })).toBe(5);
    expect(p({ diagnostics: [diag(at(0))] })).toBe(10);
  });

  it("add up across days, and count the days", () => {
    const r = rec({ quizzes: [quiz(at(0)), quiz(at(2))], games: [game(at(2)), game(at(6))] });
    expect(participationPoints(r, MON)).toEqual({ points: 10 + (10 + 5) + 5, activeDays: 3 });
  });

  it("stop at the daily cap: one big evening is worth 40, not 100", () => {
    expect(DAY_CAP).toBe(40);
    const lots = rec({ quizzes: Array.from({ length: 10 }, (_, i) => quiz(at(1, 10, i))) }); // 100 raw
    expect(participationPoints(lots, MON)).toEqual({ points: 40, activeDays: 1 });
    // …but the cap is per day: the same effort over three days is worth more
    const spread = rec({ quizzes: [0, 1, 2].flatMap((d) => Array.from({ length: 4 }, (_, i) => quiz(at(d, 10, i)))) });
    expect(participationPoints(spread, MON)).toEqual({ points: 120, activeDays: 3 });
  });

  it("ignore anything outside the week: the minute before, and the minute after", () => {
    const before = new Date(MON.getTime() - 60_000).toISOString();
    const after = new Date(MON.getTime() + 7 * 86_400_000).toISOString();
    expect(participationPoints(rec({ quizzes: [quiz(before), quiz(after)] }), MON).points).toBe(0);
    // the very first instant and the last minute are in
    const first = MON.toISOString();
    const last = new Date(MON.getTime() + 7 * 86_400_000 - 60_000).toISOString();
    expect(participationPoints(rec({ quizzes: [quiz(first), quiz(last)] }), MON)).toEqual({ points: 20, activeDays: 2 });
  });

  it("skip an unreadable timestamp rather than fail", () => {
    expect(participationPoints(rec({ quizzes: [quiz("sometime")] }), MON).points).toBe(0);
  });
});

const member = (userId: string, group: string | null, points: number, activeDays = points > 0 ? 1 : 0, isMe = false): LeagueMember =>
  ({ userId, fullName: userId, group, isMe, points, activeDays });

describe("group standings", () => {
  it("rank groups on the mean, so a small group is not beaten for being small", () => {
    const m = [
      member("a1", "МТ-21", 50), member("a2", "МТ-21", 30), // mean 40
      ...Array.from({ length: 10 }, (_, i) => member(`b${i}`, "МТ-22", 20)), // total 200, mean 20
    ];
    const g = groupStandings(m);
    expect(g.map((x) => [x.name, x.rank, x.mean, x.total])).toEqual([["МТ-21", 1, 40, 80], ["МТ-22", 2, 20, 200]]);
  });

  it("count the quiet ones: leaving a member at zero lowers the mean", () => {
    const g = groupStandings([member("a", "G", 60), member("b", "G", 0), member("c", "H", 30), member("d", "H", 30)]);
    expect(g.find((x) => x.name === "G")).toMatchObject({ mean: 30, active: 1, members: 2 });
    // equal means: the group with more members taking part ranks first
    expect(g.map((x) => [x.name, x.rank])).toEqual([["H", 1], ["G", 2]]);
  });

  it("share a place on a perfect tie, and skip the next", () => {
    const g = groupStandings([
      member("a", "A", 20), member("b", "A", 20), member("c", "B", 20), member("d", "B", 20),
      member("e", "C", 5), member("f", "C", 5),
    ]);
    expect(g.map((x) => [x.name, x.rank])).toEqual([["A", 1], ["B", 1], ["C", 3]]);
    expect(champions(g).map((x) => x.name)).toEqual(["A", "B"]);
  });

  it("do not rank a group of one: a single star cannot stand for a group", () => {
    expect(MIN_GROUP_SIZE).toBe(2);
    const g = groupStandings([member("solo", "S", 200), member("a", "A", 10), member("b", "A", 10)]);
    expect(g.map((x) => [x.name, x.rank])).toEqual([["A", 1], ["S", null]]);
    expect(champions(g).map((x) => x.name)).toEqual(["A"]);
  });

  it("crown nobody in a week when nobody studied", () => {
    const g = groupStandings([member("a", "A", 0), member("b", "A", 0)]);
    expect(g[0].rank).toBe(1);
    expect(champions(g)).toEqual([]);
    expect(g[0].top).toBeNull();
  });

  it("treat «МТ-21», « мт-21 » and «Мт-21» as one group", () => {
    expect(groupKey(" мт-21 ")).toBe(groupKey("МТ-21"));
    expect(groupKey("МТ  21")).toBe(groupKey("мт 21"));
    const g = groupStandings([member("a", "МТ-21", 10), member("b", " мт-21 ", 20), member("c", "Мт-21", 30)]);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ members: 3, total: 60, mean: 20, name: "МТ-21" });
  });

  it("leave students without a group out of the group table (they stay in the personal one)", () => {
    const m = [member("a", null, 50), member("b", "  ", 50), member("c", "A", 1), member("d", "A", 1)];
    expect(groupStandings(m).map((x) => x.name)).toEqual(["A"]);
    expect(individualStandings(m)).toHaveLength(4);
  });

  it("name each group's top contributor, and mark the group I am in", () => {
    const g = groupStandings([member("a", "A", 10), member("b", "A", 40, 3, true), member("c", "B", 5), member("d", "B", 6)]);
    const a = g.find((x) => x.name === "A")!;
    expect(a.top?.userId).toBe("b");
    expect(a.hasMe).toBe(true);
    expect(g.find((x) => x.name === "B")!.hasMe).toBe(false);
  });
});

describe("personal standings and my share", () => {
  it("order by points, then by days taking part, then by name — with shared places", () => {
    const r = individualStandings([
      member("Dana", "A", 20, 2), member("Asel", "A", 20, 3), member("Bek", "A", 20, 3), member("Cem", "A", 50, 1),
    ]);
    expect(r.map((x) => [x.fullName, x.rank])).toEqual([["Cem", 1], ["Asel", 2], ["Bek", 2], ["Dana", 4]]);
  });

  it("my share of my group's week", () => {
    const m = [member("a", "A", 30, 1, true), member("b", "a", 90), member("c", "B", 500)];
    expect(myShare(m)).toBeCloseTo(0.25, 12);
    expect(myShare([member("a", "A", 0, 0, true), member("b", "A", 0)])).toBe(0);
    expect(myShare([member("a", null, 10, 1, true)])).toBe(0);
    expect(myShare([member("b", "A", 10)])).toBe(0);
  });
});

describe("the same rule as the database", () => {
  // supabase/tests/0012_league.sql builds this exact week for the same four people
  // and expects these exact figures from league_week().
  const records = {
    aigerim: rec({
      quizzes: [quiz(at(0, 9)), quiz(at(0, 10)), quiz(at(0, 11)), quiz(at(0, 12)), quiz(at(0, 13)), quiz(at(3, 9))], // Mon 5x10 -> cap 40; Thu 10
      games: [game(at(3, 10)), game(at(3, 11), "daily"), game(at(6, 22))], // Thu 5+10; Sun 5
      submissions: [work(at(5, 8))], // Sat 15
    }),
    bauyrzhan: rec({ games: [game(at(1, 23, 59))] }), // Tue 5
    dana: rec({ assessments: [assess(at(2, 12))], diagnostics: [diag(at(2, 13))], quizzes: [quiz(MON.toISOString())] }), // Wed: 5+10+10
    ernar: rec({ quizzes: [quiz(new Date(MON.getTime() - 3_600_000).toISOString()), quiz(new Date(MON.getTime() + 7 * 86_400_000).toISOString())] }), // both outside
  };
  it("Aigerim 40+10+5+10+5+15 = 85 over 4 days; Bauyrzhan 5 over 1; Dana 25 over 2; Ernar 0", () => {
    expect(participationPoints(records.aigerim, MON)).toEqual({ points: 40 + 25 + 15 + 5, activeDays: 4 });
    expect(participationPoints(records.bauyrzhan, MON)).toEqual({ points: 5, activeDays: 1 });
    expect(participationPoints(records.dana, MON)).toEqual({ points: 25, activeDays: 2 });
    expect(participationPoints(records.ernar, MON)).toEqual({ points: 0, activeDays: 0 });
  });
});
