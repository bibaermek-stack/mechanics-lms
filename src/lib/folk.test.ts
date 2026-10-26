import { describe, expect, it } from "vitest";
import {
  FOLK_LESSONS,
  FOLK_ROUNDS,
  G,
  arrowSpeed,
  buildFolk,
  controlGrid,
  defaultValues,
  judge,
  maxPull,
  propellantFor,
  singleStageLimit,
  slideDistance,
  solutionFor,
  stageDeltaV,
  type FolkKind,
  type FolkRound,
} from "./folk";

const KINDS: FolkKind[] = ["bow", "asyq", "tug", "rocket"];
const near = (a: number, b: number, rel: number, what = "") => expect(Math.abs(a - b) / Math.abs(b), `${what}: ${a} vs ${b}`).toBeLessThan(rel);

// Reference values: a separate Python calculation of each formula (math module only).
describe("the physics", () => {
  it("bow: a 40 cm draw of a 280 N/m bow stores 22,4 J and sends 25 g away at 35,4 m/s", () => {
    expect(0.5 * 280 * 0.4 ** 2).toBeCloseTo(22.4, 12);
    expect(arrowSpeed(280, 0.4, 0.025, 0.7)).toBeCloseTo(35.41750979, 7);
    // the arrow's kinetic energy is η of the stored energy
    expect(0.5 * 0.025 * arrowSpeed(280, 0.4, 0.025, 0.7) ** 2).toBeCloseTo(0.7 * 22.4, 10);
  });

  it("asyq: d = v²/(2μg)", () => {
    expect(slideDistance(6, 0.4)).toBeCloseTo(4.587155963, 8);
    expect(slideDistance(3.13, 0.05)).toBeCloseTo(9.986646279, 8);
    expect(slideDistance(9.7, 0.6)).toBeCloseTo(7.992694529, 8);
    // twice as fast, four times as far
    expect(slideDistance(12, 0.4) / slideDistance(6, 0.4)).toBeCloseTo(4, 12);
  });

  it("tug: the most a team can pull is μMg", () => {
    expect(maxPull(0.5, 480)).toBeCloseTo(2354.4, 9);
    expect(maxPull(0.25, 600)).toBeCloseTo(1471.5, 9);
    // doubling the mass or the grip doubles it
    expect(maxPull(0.5, 960)).toBeCloseTo(2 * maxPull(0.5, 480), 9);
  });

  it("rocket: Tsiolkovsky for a stage and for two", () => {
    expect(stageDeltaV(3000, 2, 20, 0.1)).toBeCloseTo(5375.278407685, 6);
    expect(stageDeltaV(4000, 2, 18.1, 0.1)).toBeCloseTo(6997.255857875, 6);
    expect(stageDeltaV(3000, 2, 0, 0.1)).toBe(0);
    expect(stageDeltaV(3000, 2, -5, 0.1)).toBe(0); // no negative fuel
    expect(singleStageLimit(3000, 0.1)).toBeCloseTo(7193.685818395, 6);
    // however much fuel, one stage stays under its limit and creeps towards it
    expect(stageDeltaV(3000, 2, 1e6, 0.1)).toBeLessThan(7193.69);
    expect(stageDeltaV(3000, 2, 1e6, 0.1)).toBeGreaterThan(7193.6);
    // two stages: 40 t then 5 t, 1 t payload
    const d2 = stageDeltaV(3000, 1, 5, 0.1);
    const d1 = stageDeltaV(3000, 1 + 1.1 * 5, 40, 0.1);
    expect(d2).toBeCloseTo(4399.011206381, 6);
    expect(d1).toBeCloseTo(4711.794237354, 6);
  });

  it("rocket: the propellant a stage needs inverts the equation, and says when no amount will do", () => {
    const mp = propellantFor(3000, 1, 3900, 0.1);
    expect(mp).toBeCloseTo(3.641255889, 8);
    expect(stageDeltaV(3000, 1, mp, 0.1)).toBeCloseTo(3900, 8);
    expect(propellantFor(3000, 2, 7300, 0.1)).toBe(Infinity); // past the single-stage limit
    expect(propellantFor(3000, 2, 7193, 0.1)).toBeGreaterThan(1000);
  });
});

describe("judging a bow shot", () => {
  const round = (): FolkRound => ({
    kind: "bow", title: "", story: "", facts: [], controls: [],
    params: { k: 280, m: 0.025, eta: 0.7, h0: 1.5, target: 113, radius: 3 },
  });
  it("lands at the range of the arrow's speed: 40 cm at 30° from 1,5 m goes 113,28 m", () => {
    const j = judge(round(), { draw: 40, angle: 30 });
    expect(j.values.v).toBeCloseTo(35.41750979, 6);
    expect(j.values.range).toBeCloseTo(113.2780778, 4);
    expect(j.values.energy).toBeCloseTo(22.4, 10);
    expect(j.hit).toBe(true);
    expect(j.verdict).toBe("hit");
  });
  it("is a miss either side of the radius, and says which side", () => {
    const r = round(); // target 113, radius 3
    const long = judge(r, { draw: 42, angle: 30 });
    const short = judge(r, { draw: 38, angle: 30 });
    expect(long.verdict).toBe("high");
    expect(long.error).toBeGreaterThan(3);
    expect(short.verdict).toBe("low");
    expect(short.error).toBeLessThan(-3);
    expect(long.headline).toMatch(/асып/);
    expect(short.headline).toMatch(/жетпей/);
  });
  it("accepts a different draw and angle that reach the same place (55 cm at 12° goes 104,94 m)", () => {
    const r = round();
    r.params.target = 105;
    const j = judge(r, { draw: 55, angle: 12 });
    expect(j.values.range).toBeCloseTo(104.9422257, 4);
    expect(j.hit).toBe(true);
  });
  it("has the radius itself inside the hit", () => {
    const r = round();
    const range = judge(r, { draw: 40, angle: 30 }).values.range;
    r.params.target = range + 3;
    expect(judge(r, { draw: 40, angle: 30 }).hit).toBe(true);
    r.params.target = range + 3.01;
    expect(judge(r, { draw: 40, angle: 30 }).hit).toBe(false);
  });
});

describe("judging a throw of the sakha", () => {
  const round = (mu: number, target: number, radius: number): FolkRound => ({ kind: "asyq", title: "", story: "", facts: [], controls: [], params: { mu, target, radius } });
  it("hits when it stops within the radius of the row", () => {
    const j = judge(round(0.4, 4.6, 0.5), { speed: 6 });
    expect(j.values.d).toBeCloseTo(4.587155963, 8);
    expect(j.hit).toBe(true);
  });
  it("falls short on a rougher surface than it was thrown for, and long on a smoother one", () => {
    expect(judge(round(0.4, 8, 0.5), { speed: 6 }).verdict).toBe("low");
    expect(judge(round(0.05, 4, 0.5), { speed: 6 }).verdict).toBe("high");
  });
  it("needs v = √(2μgd): 6,86 m/s for 8 m on a 0,3 floor", () => {
    const need = Math.sqrt(2 * 0.3 * G * 8);
    expect(need).toBeCloseTo(6.862069658, 8);
    expect(judge(round(0.3, 8, 0.5), { speed: Math.round(need * 10) / 10 }).hit).toBe(true);
  });
});

describe("judging a rope pull", () => {
  const round = (mu: number, muOpp: number, massOpp: number): FolkRound => ({ kind: "tug", title: "", story: "", facts: [], controls: [], params: { mu, muOpp, massOpp } });
  it("is balanced when μM matches: 0,5 against 0,25 · 600 kg needs 300 kg", () => {
    expect(judge(round(0.5, 0.25, 600), { mass: 300 }).hit).toBe(true);
    expect(judge(round(0.5, 0.25, 600), { mass: 300 }).verdict).toBe("hit");
  });
  it("is a loss when lighter and a win when heavier, 3 % being the margin", () => {
    const r = round(0.5, 0.25, 600);
    expect(judge(r, { mass: 250 }).verdict).toBe("low");
    expect(judge(r, { mass: 350 }).verdict).toBe("high");
    expect(judge(r, { mass: 308 }).hit).toBe(true); // +2,7 %
    expect(judge(r, { mass: 310 }).hit).toBe(false); // +3,3 %
    expect(judge(r, { mass: 292 }).hit).toBe(true);
    expect(judge(r, { mass: 290 }).hit).toBe(false);
  });
  it("says the better grip beats the bigger arms: the same team on ice pulls far less", () => {
    const grass = judge(round(0.5, 0.5, 400), { mass: 400 }).values.mine;
    const ice = judge(round(0.05, 0.5, 400), { mass: 400 }).values.mine;
    expect(ice / grass).toBeCloseTo(0.1, 12);
  });
});

describe("judging a launch", () => {
  const single = (): FolkRound => ({ kind: "rocket", title: "", story: "", facts: [], controls: [], params: { ve: 3000, payload: 2, stages: 1, eps: 0.1, target: 5400 } });
  const double = (): FolkRound => ({ kind: "rocket", title: "", story: "", facts: [], controls: [], params: { ve: 3000, payload: 1, stages: 2, eps: 0.1, target: 9100 } });
  it("single stage: 20 t of fuel gives 5375 m/s", () => {
    const j = judge(single(), { fuel1: 20 });
    expect(j.values.total).toBeCloseTo(5375.278407685, 6);
    expect(j.values.dv2).toBe(0);
    expect(j.hit).toBe(true); // 5400 ± 162
  });
  it("two stages: 40 t then 5 t gives 9110,8 m/s, the sum of the two", () => {
    const j = judge(double(), { fuel1: 40, fuel2: 5 });
    expect(j.values.dv1).toBeCloseTo(4711.794237354, 6);
    expect(j.values.dv2).toBeCloseTo(4399.011206381, 6);
    expect(j.values.total).toBeCloseTo(9110.805443734, 6);
    expect(j.hit).toBe(true);
  });
  it("ignores the second tank in a one-stage round, whatever the value says", () => {
    expect(judge(single(), { fuel1: 20, fuel2: 50 }).values.total).toBeCloseTo(5375.278407685, 6);
  });
  it("explains a miss in m/s and mentions the limit when the target is near it", () => {
    const low = judge(single(), { fuel1: 10 });
    expect(low.verdict).toBe("low");
    expect(low.headline).toMatch(/жетпейді/);
    const r = single();
    r.params.target = 7000;
    expect(judge(r, { fuel1: 60 }).lines.join(" ")).toMatch(/шегі 7194/);
    expect(judge(single(), { fuel1: 20 }).lines.join(" ")).not.toMatch(/шегі/);
  });
});

describe("the boards", () => {
  it("have five rounds each, the same for the same seed, different for another", () => {
    for (const kind of KINDS) {
      const a = buildFolk(kind, 7), b = buildFolk(kind, 7), c = buildFolk(kind, 8);
      expect(a.rounds).toHaveLength(FOLK_ROUNDS);
      expect(a).toEqual(b);
      expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
    }
  });

  it("belong to the lessons that teach their physics", () => {
    expect(FOLK_LESSONS).toEqual({ bow: [5], asyq: [3], tug: [4], rocket: [6] });
  });

  it("every round, on every seed, can be won with the sliders as they are (some pair of settings hits)", () => {
    for (const kind of KINDS) {
      for (let seed = 1; seed <= 25; seed++) {
        for (const [i, round] of buildFolk(kind, seed).rounds.entries()) {
          const grid = controlGrid(round);
          const hits = grid.filter((v) => judge(round, v).hit).length;
          expect(hits, `${kind} seed ${seed} round ${i + 1}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("and the starting positions of the sliders do not already win", () => {
    for (const kind of KINDS) {
      for (let seed = 1; seed <= 25; seed++) {
        for (const [i, round] of buildFolk(kind, seed).rounds.entries()) {
          expect(judge(round, defaultValues(round)).hit, `${kind} seed ${seed} round ${i + 1}`).toBe(false);
        }
      }
    }
  });

  it("the hint is a real solution: it is on the sliders' grid and it hits", () => {
    for (const kind of KINDS) {
      for (let seed = 1; seed <= 25; seed++) {
        for (const [i, round] of buildFolk(kind, seed).rounds.entries()) {
          const sol = solutionFor(round);
          for (const c of round.controls) {
            expect(sol[c.id], `${kind} ${seed}/${i + 1} ${c.id}`).toBeGreaterThanOrEqual(c.min);
            expect(sol[c.id]).toBeLessThanOrEqual(c.max);
            const steps = (sol[c.id] - c.min) / c.step;
            expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
          }
          expect(judge(round, sol).hit, `${kind} seed ${seed} round ${i + 1} ${JSON.stringify(sol)}`).toBe(true);
        }
      }
    }
  });

  it("have controls whose start lies inside their range", () => {
    for (const kind of KINDS) {
      for (const round of buildFolk(kind, 3).rounds) {
        for (const c of round.controls) {
          expect(c.initial).toBeGreaterThanOrEqual(c.min);
          expect(c.initial).toBeLessThanOrEqual(c.max);
          expect(c.step).toBeGreaterThan(0);
        }
        expect(round.facts.length).toBeGreaterThan(1);
      }
    }
  });

  it("the rocket rounds get harder: the last two need a second stage, the single-stage targets are under the limit", () => {
    const rounds = buildFolk("rocket", 4).rounds;
    expect(rounds.map((r) => r.params.stages)).toEqual([1, 1, 1, 2, 2]);
    for (const r of rounds.filter((x) => x.params.stages === 1)) expect(r.params.target).toBeLessThan(singleStageLimit(r.params.ve, r.params.eps));
    // and one stage cannot make the two-stage targets, whatever the fuel
    for (const r of rounds.filter((x) => x.params.stages === 2)) expect(r.params.target).toBeGreaterThan(singleStageLimit(r.params.ve, r.params.eps));
  });

  it("the tug rounds differ and the answer is not the opponent's own mass", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const rounds = buildFolk("tug", seed).rounds;
      for (const r of rounds.slice(1)) expect(r.params.mu).not.toBe(r.params.muOpp);
      expect(new Set(rounds.map((r) => `${r.params.mu}/${r.params.muOpp}/${r.params.massOpp}`)).size).toBeGreaterThan(3);
    }
  });

  it("the asyq rounds use five different surfaces, in an order that changes with the seed", () => {
    for (let seed = 1; seed <= 10; seed++) expect(new Set(buildFolk("asyq", seed).rounds.map((r) => r.params.mu)).size).toBe(5);
    const orders = new Set(Array.from({ length: 12 }, (_, i) => buildFolk("asyq", i + 1).rounds.map((r) => r.params.mu).join()));
    expect(orders.size).toBeGreaterThan(5);
  });
});
