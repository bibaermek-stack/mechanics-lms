import { describe, expect, it } from "vitest";
import { calibration, firstAttempts, itemStats, misconceptionStats, predictionRows, studentPredictions } from "./misconceptions";
import { PREDICT_ITEMS } from "@/data/predictions";
import type { Confidence, PredictionAttempt } from "./types";

let n = 0;
const a = (userId: string, itemId: string, optionId: string, confidence: Confidence, at: string): PredictionAttempt => {
  const item = PREDICT_ITEMS.find((i) => i.id === itemId)!;
  const opt = item.options.find((o) => o.id === optionId)!;
  return { id: `p${++n}`, userId, itemId, optionId, correct: optionId === item.correct, misconception: opt.misconception ?? null, confidence, createdAt: at };
};
const T = (d: number, h = 10) => new Date(2026, 9, d, h).toISOString();

describe("first attempts", () => {
  it("keep the earliest per student and item, whatever order they arrive in", () => {
    const rows = [
      a("u1", "heavy-light", "same", 3, T(2)),    // the retry, which now knows the answer
      a("u1", "heavy-light", "heavy", 3, T(1)),   // the first: wrong
      a("u2", "heavy-light", "same", 2, T(1)),
      a("u1", "drop-vs-shot", "same", 1, T(1)),
    ];
    const f = firstAttempts(rows);
    expect(f).toHaveLength(3);
    expect(f.find((r) => r.userId === "u1" && r.itemId === "heavy-light")!.optionId).toBe("heavy");
    expect(firstAttempts([...rows].reverse())).toHaveLength(3);
  });

  it("break an exact tie by id, so the result never depends on the input order", () => {
    const x = { ...a("u1", "heavy-light", "heavy", 1, T(1)), id: "a" };
    const y = { ...a("u1", "heavy-light", "same", 1, T(1)), id: "b" };
    expect(firstAttempts([x, y])[0].id).toBe("a");
    expect(firstAttempts([y, x])[0].id).toBe("a");
  });

  it("do not mutate what they are given", () => {
    const rows = Object.freeze([a("u1", "heavy-light", "same", 1, T(1)), a("u1", "heavy-light", "heavy", 1, T(2))]) as PredictionAttempt[];
    expect(() => firstAttempts(rows)).not.toThrow();
  });
});

describe("item statistics", () => {
  // 10 students on "heavy-light": 6 right, 3 say heavy (2 of them certain), 1 says light
  const rows = [
    ...[1, 2, 3, 4, 5, 6].map((i) => a(`s${i}`, "heavy-light", "same", 2, T(1))),
    a("s7", "heavy-light", "heavy", 3, T(1)), a("s8", "heavy-light", "heavy", 3, T(1)), a("s9", "heavy-light", "heavy", 1, T(1)),
    a("s10", "heavy-light", "light", 2, T(1)),
    // retries do not count
    a("s7", "heavy-light", "same", 3, T(3)), a("s8", "heavy-light", "same", 3, T(3)),
  ];
  const stat = itemStats(rows, PREDICT_ITEMS).find((s) => s.itemId === "heavy-light")!;

  it("counts students, right answers and the share right", () => {
    expect([stat.n, stat.correct]).toEqual([10, 6]);
    expect(stat.correctShare).toBeCloseTo(0.6, 12);
  });

  it("splits the options and finds the commonest wrong one", () => {
    const by = Object.fromEntries(stat.options.map((o) => [o.optionId, o]));
    expect([by.same.count, by.heavy.count, by.light.count]).toEqual([6, 3, 1]);
    expect(by.heavy.share).toBeCloseTo(0.3, 12);
    expect(by.heavy.misconception).toBe("heavy-falls-faster");
    expect(by.same.misconception).toBeNull();
    expect(stat.topWrong?.optionId).toBe("heavy");
  });

  it("counts the wrong answers that were given with certainty", () => {
    expect(stat.confidentWrong).toBe(2);
  });

  it("reports an item nobody has tried as no data, not as zero percent", () => {
    const empty = itemStats(rows, PREDICT_ITEMS).find((s) => s.itemId === "lever-balance")!;
    expect(empty.n).toBe(0);
    expect(empty.correctShare).toBeNull();
    expect(empty.topWrong).toBeNull();
    expect(empty.options.every((o) => o.count === 0 && o.share === 0)).toBe(true);
  });

  it("lists every item, tried or not, in the order given", () => {
    expect(itemStats([], PREDICT_ITEMS).map((s) => s.itemId)).toEqual(PREDICT_ITEMS.map((i) => i.id));
  });
});

describe("misconceptions across the class", () => {
  const rows = [
    a("s1", "heavy-light", "heavy", 3, T(1)),         // heavy-falls-faster, certain
    a("s2", "heavy-light", "heavy", 1, T(1)),         // heavy-falls-faster
    a("s3", "heavy-light", "same", 3, T(1)),          // right
    a("s1", "truck-car", "truck", 3, T(1)),           // bigger-exerts-bigger-force, certain
    a("s4", "truck-car", "car", 2, T(1)),             // damage-means-force
    a("s2", "heavy-light", "heavy", 3, T(5)),         // a retry: ignored
  ];

  it("counts different students, not repeats, and ranks the widest first", () => {
    const m = misconceptionStats(rows);
    expect(m.map((x) => [x.id, x.students, x.occurrences, x.confident])).toEqual([
      ["heavy-falls-faster", 2, 2, 1],
      ["bigger-exerts-bigger-force", 1, 1, 1],
      ["damage-means-force", 1, 1, 0],
    ]);
    expect(m[0].items).toEqual(["heavy-light"]);
  });

  it("is empty when everyone was right", () => {
    expect(misconceptionStats([a("s1", "heavy-light", "same", 3, T(1))])).toEqual([]);
  });

  it("counts a student once however many items show the same misconception, and the occurrences separately", () => {
    // two different items that happen to share one misconception (rows are free to name any item)
    const row = (user: string, item: string, at: string): PredictionAttempt => ({
      id: `${user}${item}`, userId: user, itemId: item, optionId: "x", correct: false, misconception: "heavy-falls-faster", confidence: 3, createdAt: at,
    });
    const m = misconceptionStats([row("u1", "item-a", T(1)), row("u1", "item-b", T(1)), row("u2", "item-a", T(1))]);
    expect(m).toHaveLength(1);
    expect([m[0].students, m[0].occurrences, m[0].confident]).toEqual([2, 3, 3]);
    expect(m[0].items).toEqual(["item-a", "item-b"]);
  });

  it("gives one student's three different misconceptions one student each", () => {
    const m = misconceptionStats([a("s1", "heavy-light", "heavy", 2, T(1)), a("s1", "braking-distance", "x2", 2, T(1)), a("s1", "drop-vs-shot", "a", 2, T(1))]);
    expect(m.length).toBe(3); // three different misconceptions, one student each
    expect(m.every((x) => x.students === 1)).toBe(true);
  });
});

describe("one student", () => {
  const rows = [
    a("u", "heavy-light", "same", 3, T(1)),
    a("u", "truck-car", "truck", 3, T(1)),
    a("u", "egg-drop", "pillow", 1, T(1)),
    a("u", "truck-car", "equal", 3, T(2)), // retry
    a("v", "heavy-light", "heavy", 3, T(1)),
  ];
  it("attempted, right and share, from first attempts only", () => {
    expect(studentPredictions(rows, "u")).toEqual({ attempted: 3, correct: 1, accuracy: 1 / 3, confidentWrong: 1 });
  });
  it("is null accuracy before the first attempt", () => {
    expect(studentPredictions(rows, "nobody")).toEqual({ attempted: 0, correct: 0, accuracy: null, confidentWrong: 0 });
  });
});

describe("calibration", () => {
  it("shows whether being certain goes with being right", () => {
    const rows = [
      a("s1", "heavy-light", "same", 3, T(1)), a("s2", "heavy-light", "same", 3, T(1)), a("s3", "heavy-light", "heavy", 3, T(1)),
      a("s4", "heavy-light", "same", 1, T(1)), a("s5", "heavy-light", "heavy", 1, T(1)),
    ];
    const c = calibration(rows);
    expect(c.n).toEqual({ 1: 2, 2: 0, 3: 3 });
    expect(c.accuracy[3]).toBeCloseTo(2 / 3, 12);
    expect(c.accuracy[1]).toBe(0.5);
    expect(c.accuracy[2]).toBeNull();
  });
});

describe("the spreadsheet", () => {
  it("lists first attempts only, oldest first, with names where known", () => {
    const rows = [a("u2", "heavy-light", "same", 2, T(3)), a("u1", "heavy-light", "heavy", 3, T(1)), a("u1", "heavy-light", "same", 3, T(2))];
    const t = predictionRows(rows, { u1: "Айгерім" });
    expect(t[0]).toEqual(["student", "item", "option", "correct", "misconception", "confidence", "at"]);
    expect(t).toHaveLength(3);
    expect(t[1].slice(0, 6)).toEqual(["Айгерім", "heavy-light", "heavy", 0, "heavy-falls-faster", 3]);
    expect(t[2].slice(0, 6)).toEqual(["u2", "heavy-light", "same", 1, "", 2]);
  });
});
