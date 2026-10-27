import { describe, expect, it } from "vitest";
import { ALL_MODULES } from "./modules";
import { FORMULAS } from "./formulas";
import { LESSON_SCRIPTS } from "./lessonVideos";
import { availableDerivedGames } from "./gameContent";
import {
  BLITZ_ROUNDS,
  ORDER_STEPS,
  TRUEFALSE_CARDS,
  buildBlitz,
  buildOrder,
  buildTrueFalse,
  exactDecimals,
} from "./moreGames";

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);
const lesson = (id: number) => ALL_MODULES.find((m) => m.id === id)!;

describe("true or false", () => {
  it("deals twelve distinct cards, exactly half of them true", () => {
    for (const m of ALL_MODULES) {
      for (const seed of SEEDS) {
        const b = buildTrueFalse(m, seed)!;
        expect(b.cards).toHaveLength(TRUEFALSE_CARDS);
        expect(new Set(b.cards.map((c) => c.id)).size).toBe(TRUEFALSE_CARDS);
        expect(b.cards.filter((c) => c.isTrue)).toHaveLength(TRUEFALSE_CARDS / 2);
      }
    }
  });

  it("a true card carries the lesson's right answer, a false one carries a wrong answer", () => {
    for (const m of ALL_MODULES) {
      for (const seed of SEEDS.slice(0, 10)) {
        for (const c of buildTrueFalse(m, seed)!.cards) {
          const q = m.quiz.find((x) => x.id === c.id)!;
          const right = q.options[q.correctIndex];
          if (c.isTrue) expect(c.claim, c.id).toBe(right);
          else {
            expect(c.claim, c.id).not.toBe(right);
            expect(q.options, c.id).toContain(c.claim);
            expect(c.explanation, c.id).toContain(right);
          }
          expect(c.prompt).toBe(q.question);
        }
      }
    }
  });

  it("is the same board for the same seed (a duel) and a different one for another", () => {
    const m = lesson(5);
    expect(buildTrueFalse(m, 99)).toEqual(buildTrueFalse(m, 99));
    const decks = new Set(SEEDS.map((s) => buildTrueFalse(m, s)!.cards.map((c) => c.id + c.isTrue).join()));
    expect(decks.size).toBeGreaterThan(30);
  });

  it("is not offered for a lesson with too few questions", () => {
    expect(buildTrueFalse({ ...lesson(3), quiz: lesson(3).quiz.slice(0, 5) }, 1)).toBeNull();
  });
});

describe("put in order", () => {
  it("lays six chapters out of order and knows the order", () => {
    for (const m of ALL_MODULES) {
      for (const seed of SEEDS) {
        const b = buildOrder(m, seed)!;
        expect(b.items).toHaveLength(ORDER_STEPS);
        expect(b.answer).toHaveLength(ORDER_STEPS);
        expect(new Set(b.items.map((i) => i.id)).size).toBe(ORDER_STEPS);
        expect([...b.items.map((i) => i.id)].sort()).toEqual([...b.answer].sort());
        // never handed over already solved
        expect(b.items.map((i) => i.id)).not.toEqual(b.answer);
      }
    }
  });

  it("the answer is the order the film tells the chapters in", () => {
    for (const m of ALL_MODULES) {
      const chapters = LESSON_SCRIPTS[m.id].chapters;
      for (const seed of SEEDS.slice(0, 10)) {
        const b = buildOrder(m, seed)!;
        const positions = b.answer.map((id) => chapters.findIndex((c) => c.id === id));
        expect(positions.every((p) => p >= 0)).toBe(true);
        expect([...positions].sort((a, b2) => a - b2)).toEqual(positions);
        for (const it of b.items) expect(it.text).toBe(chapters.find((c) => c.id === it.id)!.caption);
      }
    }
  });

  it("is reproducible from the seed", () => {
    expect(buildOrder(lesson(2), 5)).toEqual(buildOrder(lesson(2), 5));
  });
});

describe("problem blitz", () => {
  it("has no blitz for the introduction, which has no formulas", () => {
    expect(buildBlitz(lesson(1), 1)).toBeNull();
  });

  it("gives eight problems for every lesson that has formulas", () => {
    for (const m of ALL_MODULES.filter((x) => x.id > 1)) {
      for (const seed of SEEDS) {
        const b = buildBlitz(m, seed);
        expect(b, `lesson ${m.id} seed ${seed}`).not.toBeNull();
        expect(b!.problems).toHaveLength(BLITZ_ROUNDS);
      }
    }
  });

  it("every correct option is recomputed, from the numbers shown, by the verified formula bank", () => {
    let checked = 0;
    for (const m of ALL_MODULES.filter((x) => x.id > 1)) {
      for (const seed of SEEDS) {
        for (const p of buildBlitz(m, seed)!.problems) {
          const f = FORMULAS.find((x) => x.id === p.formulaId)!;
          expect(f.moduleIds, p.formulaId).toContain(m.id);
          const given = Object.fromEntries(p.given.map((g) => [g.sym, g.value]));
          // exactly the other variables of the formula are given
          expect(Object.keys(given).sort(), p.formulaId).toEqual(f.vars.map((v) => v.sym).filter((s) => s !== p.unknown.sym).sort());
          const exact = f.solve[p.unknown.sym](given);
          expect(p.options[p.correctIndex], `${p.formulaId} ${p.unknown.sym}`).toBe(Number(exact.toFixed(p.decimals)));
          // and when the answer is not flagged as rounded, rounding it lost nothing
          if (!p.approx) expect(Math.abs(exact - p.options[p.correctIndex])).toBeLessThan(1e-9 * Math.max(1, exact));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it("offers four distinct, positive options of which exactly one is right", () => {
    for (const m of ALL_MODULES.filter((x) => x.id > 1)) {
      for (const seed of SEEDS) {
        for (const p of buildBlitz(m, seed)!.problems) {
          expect(p.options).toHaveLength(4);
          expect(new Set(p.options).size, `${p.formulaId}`).toBe(4);
          for (const o of p.options) expect(o).toBeGreaterThan(0);
          expect(p.options.filter((o) => o === Number(p.answer.toFixed(p.decimals)))).toHaveLength(1);
        }
      }
    }
  });

  it("only gives values from the realistic pools, and a sensible answer", () => {
    for (const m of ALL_MODULES.filter((x) => x.id > 1)) {
      for (const seed of SEEDS.slice(0, 15)) {
        for (const p of buildBlitz(m, seed)!.problems) {
          expect(p.answer).toBeGreaterThan(0);
          expect(p.answer).toBeLessThan(5e6);
          for (const g of p.given) expect(Number.isFinite(g.value)).toBe(true);
          if (p.unknown.unit === "%") expect(p.answer).toBeLessThanOrEqual(100);
          for (const g of p.given) if (g.sym === "g") expect(g.value).toBe(10);
        }
      }
    }
  });

  it("rounds only a few answers (π, roots) and says so", () => {
    for (const m of ALL_MODULES.filter((x) => x.id > 1)) {
      for (const seed of SEEDS) {
        const b = buildBlitz(m, seed)!;
        const approx = b.problems.filter((p) => p.approx);
        expect(approx.length).toBeLessThanOrEqual(3);
        for (const p of approx) expect(["pendulum", "spring-pendulum", "angular-velocity"]).toContain(p.formulaId);
      }
    }
  });

  it("asks eight different questions, and different games for different seeds", () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const b = buildBlitz(lesson(5), seed)!;
      const keys = b.problems.map((p) => `${p.formulaId}|${p.unknown.sym}|${p.given.map((g) => g.value).join()}`);
      expect(new Set(keys).size).toBe(BLITZ_ROUNDS);
    }
    const games = new Set(SEEDS.map((s) => JSON.stringify(buildBlitz(lesson(5), s))));
    expect(games.size).toBeGreaterThan(30);
  });

  it("is reproducible from the seed (a duel)", () => {
    expect(buildBlitz(lesson(6), 12345)).toEqual(buildBlitz(lesson(6), 12345));
  });

  it("never asks for the angle, and leaves out the trig-heavy and the unwieldy formulas", () => {
    for (const m of ALL_MODULES) {
      for (const seed of SEEDS.slice(0, 15)) {
        for (const p of buildBlitz(m, seed)?.problems ?? []) {
          expect(p.unknown.sym).not.toBe("alpha");
          expect(["incline", "young"]).not.toContain(p.formulaId);
        }
      }
    }
  });
});

describe("exactDecimals", () => {
  it("finds the shortest exact writing, or admits there is none", () => {
    expect(exactDecimals(5)).toBe(0);
    expect(exactDecimals(2.5)).toBe(1);
    expect(exactDecimals(0.002)).toBe(3);
    expect(exactDecimals(160.00000000000003)).toBe(0);
    expect(exactDecimals(Math.PI)).toBeNull();
    expect(exactDecimals(1 / 3)).toBeNull();
  });
});

describe("registration with the derived games", () => {
  it("is offered for every lesson that can build it", () => {
    for (const m of ALL_MODULES) {
      const games = availableDerivedGames(m, m.id * 7919);
      expect(games).toContain("truefalse");
      expect(games).toContain("order");
      expect(games.includes("blitz")).toBe(m.id > 1);
    }
  });
});
