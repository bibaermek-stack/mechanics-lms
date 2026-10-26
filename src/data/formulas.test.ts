// The problems page tells students that every formula and its inverse is
// "checked by an automatic test, so the number is right". This is that test.
//
// Two independent checks:
//
//  1. A worked example per formula. The numbers were written out by hand from the
//     equation as printed on the board (`expr`), not generated from the code, so a
//     solver that disagrees with its own formula — or a formula mistyped in the
//     table — fails here. Every solvable unknown is recovered from the others.
//
//  2. A round trip on random inputs: whichever unknown one solver isolates, every
//     other solver must hand back the original inputs. This catches an inverse
//     that is right for the numbers in (1) by luck.

import { describe, expect, it } from "vitest";
import { FORMULAS, formulasForModule, modulesWithFormulas, type Formula } from "./formulas";

/** One consistent set of values per formula: every variable satisfies the equation. */
const sin30 = 0.5;
const cos30 = Math.cos(Math.PI / 6);
const CASES: Record<string, Record<string, number>> = {
  // Кинематика
  "avg-speed": { v: 5, s: 100, t: 20 }, // 100 m in 20 s
  "velocity-accel": { v: 14, v0: 2, a: 3, t: 4 }, // 2 + 3·4
  "path-accel": { s: 32, v0: 2, a: 3, t: 4 }, // 2·4 + 3·16/2
  torricelli: { v: 5, v0: 3, a: 2, s: 4 }, // 25 = 9 + 2·2·4
  "free-fall-height": { h: 20, g: 10, t: 2 }, // 10·4/2
  "free-fall-speed": { v: 30, g: 10, t: 3 },
  // Динамика, Ньютон заңдары
  "newton-second": { F: 20, m: 5, a: 4 },
  weight: { F: 50, m: 5, g: 10 },
  friction: { Ff: 10, mu: 0.25, N: 40 },
  incline: { a: 10 * (sin30 - 0.2 * cos30), g: 10, alpha: 30, mu: 0.2 }, // 30° slope, μ = 0.2
  // Жұмыс және энергия
  work: { A: 50, F: 20, s: 5, alpha: 60 }, // 20·5·cos 60°
  kinetic: { Ek: 18, m: 4, v: 3 },
  potential: { Ep: 100, m: 2, g: 10, h: 5 },
  power: { N: 20, A: 600, t: 30 },
  efficiency: { eta: 75, Au: 60, At: 80 },
  // Импульс
  momentum: { p: 12, m: 3, v: 4 },
  impulse: { F: 10, dt: 0.5, dp: 5 },
  // Айналмалы қозғалыс
  "angular-velocity": { omega: Math.PI, T: 2 }, // ω = 2π/T
  "linear-angular": { v: 2, omega: 4, R: 0.5 },
  torque: { M: 20, F: 50, d: 0.4 },
  "rot-newton": { M: 6, I: 2, eps: 3 },
  "rot-kinetic": { Ek: 9, I: 2, omega: 3 },
  // Тербелістер
  pendulum: { T: 2 * Math.PI, l: 9.81, g: 9.81 }, // l = g → T = 2π s
  "spring-pendulum": { T: 2 * Math.PI, m: 2, k: 2 }, // m = k → T = 2π s
  hooke: { F: 10, k: 200, x: 0.05 },
  // Сұйықтар
  density: { rho: 2700, m: 540, V: 0.2 },
  hydrostatic: { p: 20000, rho: 1000, g: 10, h: 2 }, // 1000·10·2 Pa
  archimedes: { Fa: 30, rho: 1000, g: 10, V: 0.003 },
  continuity: { S1: 0.02, v1: 3, S2: 0.01, v2: 6 }, // 0.06 = 0.06
  // Инженерлік механика
  stress: { sigma: 2_000_000, F: 1000, S: 0.0005 },
  strain: { eps: 0.001, dl: 0.002, l: 2 },
  young: { sigma: 2e8, E: 200e9, eps: 0.001 }, // steel
};

const close = (got: number, want: number, rel = 1e-9) =>
  Math.abs(got - want) <= rel * Math.max(1, Math.abs(want));

describe("the formula bank is well formed", () => {
  it("has a worked example for every formula, and none for a formula that does not exist", () => {
    expect(Object.keys(CASES).sort()).toEqual(FORMULAS.map((f) => f.id).sort());
  });

  it("has unique ids and, within a formula, unique symbols", () => {
    expect(new Set(FORMULAS.map((f) => f.id)).size).toBe(FORMULAS.length);
    for (const f of FORMULAS) expect(new Set(f.vars.map((v) => v.sym)).size, f.id).toBe(f.vars.length);
  });

  it("only solves for variables it declares, and the example covers exactly its variables", () => {
    for (const f of FORMULAS) {
      const syms = f.vars.map((v) => v.sym);
      for (const k of Object.keys(f.solve)) expect(syms, `${f.id}: solves for ${k}`).toContain(k);
      expect(Object.keys(CASES[f.id]).sort(), f.id).toEqual([...syms].sort());
    }
  });

  it("assigns each formula to real lessons (1–10) and has something to say about it", () => {
    for (const f of FORMULAS) {
      expect(f.moduleIds.length, f.id).toBeGreaterThan(0);
      for (const m of f.moduleIds) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(10);
      }
      expect(f.title.length).toBeGreaterThan(2);
      expect(f.expr.length).toBeGreaterThan(2);
      expect(f.note.length).toBeGreaterThan(10);
    }
  });

  it("looks formulas up by lesson", () => {
    for (const m of modulesWithFormulas()) {
      const list = formulasForModule(m);
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((f) => f.moduleIds.includes(m))).toBe(true);
    }
    // F = m·a is filed under both lessons, as its comment says.
    expect(formulasForModule(3).map((f) => f.id)).toContain("newton-second");
    expect(formulasForModule(4).map((f) => f.id)).toContain("newton-second");
  });
});

describe("every solver reproduces the worked example", () => {
  for (const f of FORMULAS) {
    it(`${f.id}: ${f.expr}`, () => {
      const given = CASES[f.id];
      for (const [unknown, solve] of Object.entries(f.solve)) {
        const others = Object.fromEntries(Object.entries(given).filter(([k]) => k !== unknown));
        const got = solve(others);
        expect(close(got, given[unknown]), `${f.id}: ${unknown} = ${got}, expected ${given[unknown]}`).toBe(true);
      }
    });
  }
});

describe("round trip on random inputs", () => {
  // Angles live in (10°, 70°) so acos and tan are defined; everything else is positive.
  const ANGLES = new Set(["alpha"]);
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }

  function consistentSet(f: Formula, r: () => number): Record<string, number> {
    const x: Record<string, number> = {};
    for (const v of f.vars) x[v.sym] = ANGLES.has(v.sym) ? 10 + r() * 60 : 0.5 + r() * 20;
    // Make the set satisfy the equation by deriving one variable from the rest.
    const base = Object.keys(f.solve)[0];
    x[base] = f.solve[base](Object.fromEntries(Object.entries(x).filter(([k]) => k !== base)));
    return x;
  }

  for (const f of FORMULAS) {
    it(`${f.id}: all inverses agree with each other`, () => {
      const r = rng(f.id.length * 7919 + 13);
      for (let trial = 0; trial < 200; trial++) {
        const x = consistentSet(f, r);
        for (const [unknown, solve] of Object.entries(f.solve)) {
          const others = Object.fromEntries(Object.entries(x).filter(([k]) => k !== unknown));
          const got = solve(others);
          if (!close(got, x[unknown], 1e-7)) {
            throw new Error(`${f.id}: solving for ${unknown} from ${JSON.stringify(others)} gave ${got}, the set had ${x[unknown]}`);
          }
        }
      }
    });
  }
});
