import { describe, expect, it } from "vitest";
import { G } from "./coaster";
import {
  CART_MASS,
  LEVELS,
  POINTS,
  TRACK_X,
  Y_MAX,
  Y_MIN,
  Y_STEP,
  evaluate,
  levelById,
  normalise,
  pointsFor,
  scoreOf,
} from "./coasterLevels";

const L = (id: string) => levelById(id)!;
const stars = (id: string, ys: number[]) => evaluate(L(id), ys).stars;

describe("the levels as data", () => {
  it("have unique ids, seven starting heights and locked heights that agree with them", () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const l of LEVELS) {
      expect(l.initial, l.id).toHaveLength(POINTS);
      for (const [i, y] of Object.entries(l.locked)) {
        expect(Number(i)).toBeGreaterThanOrEqual(0);
        expect(Number(i)).toBeLessThan(POINTS);
        expect(l.initial[Number(i)], `${l.id} point ${i}`).toBe(y);
      }
      for (const y of l.initial) {
        expect(y).toBeGreaterThanOrEqual(Y_MIN);
        expect(y).toBeLessThanOrEqual(Y_MAX);
      }
      expect(l.task.length).toBeGreaterThan(20);
      expect(l.hint.length).toBeGreaterThan(10);
      // the finish point is always fixed, so "reaching it" means the same for everyone
      expect(l.locked[POINTS - 1] ?? l.locked[POINTS - 2], l.id).toBeDefined();
    }
  });

  it("start every level unsolved: the starting track earns no stars", () => {
    for (const l of LEVELS) expect(evaluate(l, l.initial).stars, l.id).toBe(0);
  });

  it("make a track of seven points four metres apart", () => {
    expect(TRACK_X).toEqual([0, 4, 8, 12, 16, 20, 24]);
    expect(pointsFor([1, 2, 3, 4, 5, 6, 7]).map((p) => p.x)).toEqual([...TRACK_X]);
  });
});

describe("normalise", () => {
  const lv = L("hill"); // points 3 and 6 are locked at 5 and 1
  it("forces locked heights back, whatever was asked", () => {
    const n = normalise(lv, [8, 3, 2, 99, 2, 1.5, -4]);
    expect(n[3]).toBe(5);
    expect(n[6]).toBe(1);
  });
  it("holds every free height inside the range and on the grid", () => {
    const n = normalise(lv, [100, -3, 2.04, 5, 2.06, 1.53, 1]);
    expect(n[0]).toBe(Y_MAX);
    expect(n[1]).toBe(Y_MIN);
    expect(n[2]).toBe(2);
    expect(n[4]).toBe(2.1);
    expect(n[5]).toBe(1.5);
    for (const v of n) expect(Math.abs(v / Y_STEP - Math.round(v / Y_STEP))).toBeLessThan(1e-6);
  });
  it("turns nonsense into the lowest height, and is idempotent", () => {
    expect(normalise(lv, [NaN, Infinity, 2, 5, 2, 1.5, 1])[0]).toBe(Y_MIN);
    const once = normalise(lv, [7.77, 3.33, 2.22, 5, 2.11, 1.55, 1]);
    expect(normalise(lv, once)).toEqual(once);
  });
});

describe("level 1 — clearing a 5 m hill with no friction", () => {
  const base = (y0: number) => [y0, 1, 2, 5, 2, 1.5, 1];
  it("cannot be done from the hill's own height or lower, and can from a little above it", () => {
    expect(stars("hill", base(4.5))).toBe(0);
    expect(stars("hill", base(4.9))).toBe(0);
    expect(evaluate(L("hill"), base(5.2)).run.status).toBe("finished");
  });
  it("gives 3 stars up to 5,7 m, 2 up to 7 m, then 1", () => {
    expect(stars("hill", base(5.2))).toBe(3);
    expect(stars("hill", base(5.7))).toBe(3);
    expect(stars("hill", base(5.8))).toBe(2);
    expect(stars("hill", base(7))).toBe(2);
    expect(stars("hill", base(7.1))).toBe(1);
    expect(stars("hill", base(12))).toBe(1);
  });
  it("says how far it got when it does not make it", () => {
    const v = evaluate(L("hill"), base(4.5));
    expect(v.lines.join(" ")).toMatch(/кері қайтты/);
    expect(v.lines.join(" ")).toContain(v.run.maxX.toFixed(1).replace(".", ","));
  });
});

describe("level 2 — friction μ = 0,1, hills of 3 m and 4 m", () => {
  const fr = (y0: number) => [y0, 4.5, 3, 3.6, 4, 1.7, 1];
  it("needs a higher start than without friction: the 4 m hill alone would need only 4 m", () => {
    // frictionless, a start at 4,5 clears a 4 m hill (see level 1); with friction it does not
    expect(stars("friction", fr(4.5))).toBe(0);
    expect(stars("friction", fr(5))).toBe(0);
    expect(stars("friction", fr(5.6))).toBe(0);
  });
  it("is passed from 5,8 m, and each extra metre costs stars", () => {
    expect(stars("friction", fr(5.8))).toBe(3);
    expect(stars("friction", fr(6.2))).toBe(3);
    expect(stars("friction", fr(6.3))).toBe(2);
    expect(stars("friction", fr(7.5))).toBe(2);
    expect(stars("friction", fr(7.6))).toBe(1);
  });
  it("a start that friction can hold on does not move at all, and says it stopped", () => {
    const v = evaluate(L("friction"), fr(5));
    expect(v.run.status).toBe("stopped");
    expect(v.lines.join(" ")).toMatch(/тоқтап қалды/);
  });
  it("turns energy into heat: the heat at the finish is the energy that is missing", () => {
    const v = evaluate(L("friction"), fr(6.2));
    const r = v.run, m = CART_MASS;
    const missing = m * G * (6.2 - 1) - 0.5 * m * r.endSpeed ** 2;
    expect(Math.abs(r.heat - missing) / missing).toBeLessThan(0.01);
  });
});

describe("level 3 — the speed at the finish", () => {
  const sp = (y0: number) => [y0, 4.1, 1.8, 1.7, 1.5, 1.2, 1];
  // independent oracle: with no friction v = √(2g·Δh) however the track runs, so the stars follow from arithmetic
  const expected = (y0: number) => {
    const err = Math.abs(Math.sqrt(2 * G * (y0 - 1)) - 12);
    return err <= 0.3 ? 3 : err <= 0.8 ? 2 : err <= 2 ? 1 : 0;
  };
  it("gives the stars the arithmetic says, for every start height from 6 to 11 m", () => {
    for (let y0 = 6; y0 <= 11.001; y0 += 0.1) {
      const y = Math.round(y0 * 10) / 10;
      expect(stars("speed", sp(y)), `y0=${y}`).toBe(expected(y));
    }
  });
  it("is solved at about 8,3 m: 1 + 12²/2g", () => {
    expect(1 + 144 / (2 * G)).toBeCloseTo(8.339, 3);
    expect(stars("speed", sp(8.3))).toBe(3);
  });
  it("says whether it was too fast or too slow", () => {
    expect(evaluate(L("speed"), sp(6)).lines.join(" ")).toMatch(/Тым баяу/);
    expect(evaluate(L("speed"), sp(11)).lines.join(" ")).toMatch(/Тым жылдам/);
  });
});

describe("level 4 — stopping in the zone 18–22 m, μ = 0,15", () => {
  const st = (y0: number) => [y0, 1.6, 2.3, 0.5, 0.5, 0.5, 0.5];
  it("3 stars for stopping at the middle of the zone, fewer further off", () => {
    const v = evaluate(L("stop"), st(4.1));
    expect(v.run.status).toBe("stopped");
    expect(Math.abs(v.run.endX - 20)).toBeLessThan(0.4);
    expect(v.stars).toBe(3);
    const off = evaluate(L("stop"), st(4.4));
    expect(off.run.endX).toBeGreaterThan(21);
    expect(off.stars).toBe(1);
  });
  it("stops further along the more energy it starts with (above the first hill's height)", () => {
    let last = 0;
    for (const y0 of [4.1, 4.2, 4.3, 4.4, 4.5, 4.6]) {
      const x = evaluate(L("stop"), st(y0)).run.endX;
      expect(x, `y0=${y0}`).toBeGreaterThan(last);
      last = x;
    }
  });
  it("earns nothing for running through the finish or for stopping short", () => {
    const over = evaluate(L("stop"), st(8));
    expect(over.stars).toBe(0);
    expect(over.lines.join(" ")).toMatch(/мәреден өтіп кетті/);
    const short = evaluate(L("stop"), st(2));
    expect(short.stars).toBe(0);
    expect(short.run.endX).toBeLessThan(18);
  });
  it("matches the textbook estimate on a flat run-out: heat = μ·m·g·distance", () => {
    const r = evaluate(L("stop"), st(4.1)).run;
    // from the foot of the slopes (x = 12) the track is flat, so what is left after 12 m is spent over (endX − 12)
    const eAt12 = r.frames.reduce((p, q) => (Math.abs(q.x - 12) < Math.abs(p.x - 12) ? q : p));
    near(eAt12.ke, 0.15 * CART_MASS * G * (r.endX - 12), 0.03);
  });
});

describe("level 5 — a thrilling but safe ride", () => {
  it("the steep starting track is thrilling and deadly: over 7 g, no stars", () => {
    const v = evaluate(L("safe"), L("safe").initial);
    expect(v.run.maxSpeed).toBeGreaterThan(12);
    expect(v.run.maxG).toBeGreaterThan(7);
    expect(v.stars).toBe(0);
  });
  it("a gentle long descent gets 3 stars: over 12 m/s, under 3 g", () => {
    const v = evaluate(L("safe"), [8.5, 4.3, 2.1, 1.1, 0.8, 0.5, 1]);
    expect(v.run.maxSpeed).toBeGreaterThanOrEqual(12);
    expect(v.run.maxG).toBeLessThanOrEqual(3);
    expect(v.stars).toBe(3);
  });
  it("2 stars between 3 and 4,5 g, and a slow ride is no answer however gentle", () => {
    expect(stars("safe", [8.5, 5, 2.5, 1.2, 0.9, 0.6, 1])).toBe(2);
    expect(stars("safe", [9, 4, 1.5, 0.8, 0.6, 0.5, 1])).toBe(2);
    const slow = evaluate(L("safe"), [7, 4.3, 2.1, 1.1, 0.8, 0.5, 1]);
    expect(slow.run.maxG).toBeLessThan(3);
    expect(slow.stars).toBe(0);
    expect(slow.lines.join(" ")).toMatch(/Тым баяу/);
  });
});

describe("level 6 — weightlessness", () => {
  it("the starting track leaves the rails (G < 0): no stars, and the verdict says so", () => {
    const v = evaluate(L("airtime"), L("airtime").initial);
    expect(v.run.minG).toBeLessThan(-1);
    expect(v.stars).toBe(0);
    expect(v.lines.join(" ")).toMatch(/рельстен (ажырап|ұшып)/);
  });
  it("a flat-topped crest taken fast brings G to about 0 without leaving the rails: 3 stars", () => {
    const v = evaluate(L("airtime"), [9, 7.6, 8.9, 4.7, 2.5, 1.9, 1]);
    expect(v.run.minG).toBeGreaterThanOrEqual(-0.05);
    expect(v.run.minG).toBeLessThanOrEqual(0.1);
    expect(v.stars).toBe(3);
  });
  it("grades by how close G gets to 0: up to 0,1 is 3 stars, to 0,25 is 2, to 0,5 is 1", () => {
    const at = (ys: number[]) => evaluate(L("airtime"), ys);
    const a = at([9, 7.5, 8.9, 4.7, 2.6, 1.9, 1]); // minG 0,104
    const b = at([9, 7.5, 8.9, 4.7, 2.5, 1.8, 1]); // 0,209
    const c = at([9, 7.6, 8.9, 4.7, 2.7, 1.9, 1]); // 0,253
    const d = at([9, 7.6, 8.9, 4.7, 2.5, 1.5, 1]); // 0,368
    expect([a.run.minG, b.run.minG, c.run.minG, d.run.minG].map((v) => +v.toFixed(2))).toEqual([0.1, 0.21, 0.25, 0.37]);
    expect([a.stars, b.stars, c.stars, d.stars]).toEqual([2, 2, 1, 1]);
  });

  it("forgives G a hair below 0 (numerical noise, −0,05 g) but not a real lift-off", () => {
    const hair = evaluate(L("airtime"), [9, 7.2, 8.9, 4.7, 2.5, 1.9, 1]);
    expect(hair.run.minG).toBeLessThan(0);
    expect(hair.run.minG).toBeGreaterThan(-0.05);
    expect(hair.stars).toBe(3);
    const edge = evaluate(L("airtime"), [9, 7.6, 8.9, 4.7, 2.4, 1.9, 1]);
    expect(edge.run.minG).toBeLessThan(-0.04);
    expect(edge.stars).toBe(3);
    const real = evaluate(L("airtime"), [9, 7.5, 8.9, 4.7, 2.5, 2, 1]);
    expect(real.run.minG).toBeLessThan(-0.09);
    expect(real.run.minG).toBeGreaterThan(-0.2);
    expect(real.stars).toBe(0);
    expect(real.lines.join(" ")).toMatch(/рельстен (ажырап|ұшып)/);
  });

  it("a track that is merely quiet (G never below 0,5) earns nothing", () => {
    const v = evaluate(L("airtime"), [6, 5, 4, 3, 2, 1.5, 1]);
    expect(v.run.minG).toBeGreaterThan(0.5);
    expect(v.stars).toBe(0);
    expect(v.lines.join(" ")).toMatch(/салмағы бар/);
  });
});

describe("scoreOf", () => {
  it("is the share of all the stars there are", () => {
    expect(scoreOf({})).toEqual({ stars: 0, score: 0 });
    expect(scoreOf(Object.fromEntries(LEVELS.map((l) => [l.id, 3])))).toEqual({ stars: 18, score: 100 });
    expect(scoreOf({ hill: 3, friction: 3 })).toEqual({ stars: 6, score: 33 });
    expect(scoreOf({ hill: 1 })).toEqual({ stars: 1, score: 6 });
    expect(scoreOf({ unknown: 3 })).toEqual({ stars: 0, score: 0 });
  });
});

function near(a: number, b: number, rel: number) {
  expect(Math.abs(a - b) / Math.abs(b), `${a} vs ${b}`).toBeLessThan(rel);
}
