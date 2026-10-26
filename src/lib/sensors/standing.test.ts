import { describe, expect, it } from "vitest";
import { bestByUser, binOf, classFromRows, histogram, sameJumpOn, standingAmong } from "./standing";

describe("standing among the class", () => {
  it("counts those below, equal and above, and gives the percentile with ties as half", () => {
    const s = standingAmong(0.4, [0.2, 0.3, 0.4, 0.4, 0.5, 0.6]);
    expect(s).toEqual({ n: 6, below: 2, equal: 2, above: 2, percentile: ((2 + 1) / 6) * 100 });
  });

  it("is the top of the class at 100 minus half a place, and the bottom at half a place", () => {
    expect(standingAmong(1, [0.1, 0.2, 0.3, 0.4]).percentile).toBe(100);
    expect(standingAmong(0, [0.1, 0.2, 0.3, 0.4]).percentile).toBe(0);
    expect(standingAmong(0.5, [0.5]).percentile).toBe(50);
  });

  it("says nothing without a class", () => {
    expect(standingAmong(0.3, [])).toEqual({ n: 0, below: 0, equal: 0, above: 0, percentile: null });
  });
});

describe("histogram", () => {
  it("bins by width from the lowest multiple, including the top value, and loses nobody", () => {
    const v = [0.12, 0.18, 0.22, 0.31, 0.39, 0.4, 0.55];
    const h = histogram(v, 0.1);
    expect(h.map((b) => [b.from, b.count])).toEqual([[0.1, 2], [0.2, 1], [0.3, 2], [0.4, 1], [0.5, 1]]);
    expect(h.reduce((a, b) => a + b.count, 0)).toBe(v.length);
    expect(h[0].to).toBe(0.2);
  });

  it("puts a value on a bin edge into the bin that starts there (0,3 is in 0,3–0,4 though 0,3/0,1 is 2,999…)", () => {
    const h = histogram([0.3], 0.1);
    expect(h.find((b) => b.count === 1)!.from).toBe(0.3);
  });

  it("finds the same bin for a value as counted it, including on an edge", () => {
    const v = [0.12, 0.3, 0.3, 0.45, 0.2, 0.15, 0.6];
    const bins = histogram(v, 0.05);
    for (const x of v) expect(bins[binOf(bins, x)].from).toBeLessThanOrEqual(x + 1e-9);
    // marking each value's bin and counting the marks gives back the counts
    const marked = bins.map(() => 0);
    for (const x of v) marked[binOf(bins, x)]++;
    expect(marked).toEqual(bins.map((b) => b.count));
    expect(bins[binOf(bins, 0.3)].from).toBeCloseTo(0.3, 9);
    expect(binOf([], 1)).toBe(-1);
  });

  it("handles one value, no values and a nonsense width", () => {
    expect(histogram([0.25], 0.1).reduce((a, b) => a + b.count, 0)).toBe(1);
    expect(histogram([], 0.1)).toEqual([]);
    expect(histogram([1, 2], 0)).toEqual([]);
  });
});

describe("bestByUser", () => {
  const r = (userId: string, kind: string, value: number) => ({ userId, kind, value });
  it("keeps each user's highest value of the asked kind only", () => {
    const m = bestByUser([r("a", "jump", 0.3), r("a", "jump", 0.5), r("a", "jump", 0.4), r("b", "jump", 0.2), r("a", "rest-g", 9.8), r("c", "pendulum", 2)], "jump");
    expect([...m.entries()].sort()).toEqual([["a", 0.5], ["b", 0.2]]);
  });
  it("skips values that are not numbers and gives an empty map for a kind nobody did", () => {
    expect(bestByUser([r("a", "jump", NaN)], "jump").size).toBe(0);
    expect(bestByUser([r("a", "jump", 0.3)], "elevator").size).toBe(0);
  });
});

describe("classFromRows", () => {
  it("separates the caller from the class, reading numbers the database sends as text", () => {
    expect(classFromRows([{ best: "0.31", is_me: false }, { best: 0.45, is_me: true }, { best: "0.52", is_me: false }])).toEqual({ others: [0.31, 0.52], mine: 0.45 });
  });
  it("has no 'mine' when the caller has not jumped, and ignores unreadable rows", () => {
    expect(classFromRows([{ best: 0.3, is_me: false }, { best: "x", is_me: false }])).toEqual({ others: [0.3], mine: null });
    expect(classFromRows([])).toEqual({ others: [], mine: null });
  });
});

describe("sameJumpOn", () => {
  it("scales a jump by the ratio of the gravities: 40 cm on Earth is about 2,4 m on the Moon", () => {
    expect(sameJumpOn(0.4, 9.80665, 1.62)).toBeCloseTo(2.4214, 3);
    expect(sameJumpOn(0.4, 9.80665, 9.80665)).toBeCloseTo(0.4, 12);
    // and it goes down where gravity is stronger
    expect(sameJumpOn(0.4, 9.80665, 24.79)).toBeLessThan(0.4);
  });
});
