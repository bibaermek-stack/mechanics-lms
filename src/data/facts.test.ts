import { describe, expect, it } from "vitest";
import {
  FACTS,
  MYTHS,
  MYTH_CARDS,
  buildMythBoard,
  dayNumber,
  factOfTheDay,
  type Fact,
} from "./facts";
import { shiftDay } from "@/lib/engagement";

// Reference figures worked out separately (Python, not this code):
//   v₁ = √(gR) = 7 905,66 m/s · T = 2π√(R/g) = 84,391 min · v₂ = √(2gR) = 11 180,3 m/s
//   g, R = 9,81 m/s², 6 371 km; equatorial R = 6 378,137 km; ω = 2π / 86 164,0905 s

const myth = (id: string) => MYTHS.find((m) => m.id === id)!;
const fact = (id: string) => FACTS.find((f) => f.id === id)!;
const near = (a: number, b: number, rel = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.abs(b) * rel + 1e-12);

describe("the myths: the numbers behind the explanations", () => {
  it("a bullet fired level and one dropped from 1,5 m land after t = √(2h/g) = 0,553 s", () => {
    near(myth("horizontal-bullet").calc().t, 0.553001263609331);
    expect(myth("horizontal-bullet").why(myth("horizontal-bullet").calc())).toContain("0,55 с");
  });

  it("a coin from 300 m would reach 76,7 m/s without air", () => {
    near(myth("coin-skyscraper").calc().v, 76.72027111526653);
    expect(myth("coin-skyscraper").why(myth("coin-skyscraper").calc())).toContain("77 м/с");
  });

  it("a 70 kg passenger at 50 km/h: p = 972 kg·m/s, 19,4 kN in 0,05 s but 6,5 kN in 0,15 s", () => {
    const c = myth("seatbelt").calc();
    near(c.p, 972.2222222222223);
    near(c.f1, 19.444444444444443);
    near(c.f2, 6.481481481481482);
    near(c.f1 / c.f2, 3, 1e-12); // three times the time, a third of the force
    const t = myth("seatbelt").why(c);
    expect(t).toContain("972 кг·м/с");
    expect(t).toContain("19,4 кН");
    expect(t).toContain("6,5 кН");
  });

  it("stopping a 1 200 kg car at 10 m/s in 0,2 s takes 60 kN ≈ 6 tonnes-force", () => {
    const c = myth("stop-car-by-hand").calc();
    expect(c.p).toBe(12000);
    expect(c.f).toBeCloseTo(60, 9);
    near(c.tonnes, 6.116207951070336);
    const t = myth("stop-car-by-hand").why(c);
    expect(t).toContain("12\u00a0000");
    expect(t).toContain("60 кН");
    expect(t).toContain("6 тонна");
  });

  it("a 4 kg rifle fires a 10 g bullet at 800 m/s and recoils at 2 m/s", () => {
    expect(myth("recoil").calc().v).toBe(2);
    expect(myth("recoil").why(myth("recoil").calc())).toContain("2 м/с");
  });

  it("the first orbital speed is 7,9 km/s and the period 84,4 min", () => {
    const c = myth("baikonur").calc();
    near(c.v, 7.90566316003913);
    near(c.T, 84.39134660324302);
    const t = myth("baikonur").why(c);
    expect(t).toContain("7,9 км/с");
    expect(t).toContain("84 минут");
    expect(t).toContain("12 сәуірде");
  });

  it("at the space station's 400 km, gravity is still 88,5 % of the surface value, 8,69 m/s²", () => {
    const c = myth("iss-no-gravity").calc();
    near(c.pct, 88.53389732040488);
    near(c.g, 8.685175327131718);
    expect(myth("iss-no-gravity").why(c)).toMatch(/≈ 89 %.*8,7 м\/с²/);
  });

  it("stopping distances at μ = 0,7: 14,0 m from 50 km/h and 56,2 m from 100 km/h — exactly four times", () => {
    const c = myth("stopping-distance").calc();
    near(c.s1, 14.04552457899383);
    near(c.s2, 56.18209831597532);
    near(c.s2 / c.s1, 4, 1e-12);
    const t = myth("stopping-distance").why(c);
    expect(t).toContain("≈ 14 м");
    expect(t).toContain("≈ 56 м");
  });

  it("steel is 7,8 times as dense as water", () => {
    expect(myth("steel-ship").calc().ratio).toBe(7.8);
    expect(myth("steel-ship").why(myth("steel-ship").calc())).toContain("7,8 есе");
  });

  it("a skater pulling in the arms from I = 3,0 to 1,0 kg·m² spins three times as fast", () => {
    expect(myth("skater").calc().k).toBe(3);
  });

  it("at the equator, ω²R = 0,0339 m/s², 0,346 % of g", () => {
    const c = myth("equator-weight").calc();
    near(c.a, 0.03391571395733061, 1e-6);
    near(c.pct, 0.3457259322867544, 1e-6);
    expect(myth("equator-weight").why(c)).toContain("0,034 м/с²");
  });

  it("a 1 m pendulum swings in 2,006 s", () => {
    near(myth("pendulum").calc().T, 2.0060666807106475);
    expect(myth("pendulum").why(myth("pendulum").calc())).toContain("2,01 с");
  });
});

describe("the myths: the bank itself", () => {
  it("has unique ids and claims, lessons 1–10, and a source for each", () => {
    expect(new Set(MYTHS.map((m) => m.id)).size).toBe(MYTHS.length);
    expect(new Set(MYTHS.map((m) => m.claim)).size).toBe(MYTHS.length);
    for (const m of MYTHS) {
      expect(m.lesson).toBeGreaterThanOrEqual(1);
      expect(m.lesson).toBeLessThanOrEqual(10);
      expect(m.source.length).toBeGreaterThan(3);
      expect(m.claim.length).toBeGreaterThan(20);
      expect(m.why(m.calc()).length).toBeGreaterThan(60);
    }
  });

  it("has enough of each kind for a deck of four true and four false", () => {
    expect(MYTHS.filter((m) => m.isTrue).length).toBeGreaterThanOrEqual(MYTH_CARDS / 2);
    expect(MYTHS.filter((m) => !m.isTrue).length).toBeGreaterThanOrEqual(MYTH_CARDS / 2);
  });

  it("never prints a raw JavaScript number or a placeholder", () => {
    for (const m of MYTHS) {
      const t = m.why(m.calc());
      expect(t, m.id).not.toMatch(/undefined|NaN|\$\{|\[object|\d\.\d{3,}/);
    }
    for (const f of FACTS) {
      const t = f.answer(f.calc());
      expect(t, f.id).not.toMatch(/undefined|NaN|\$\{|\[object|\d\.\d{3,}/);
    }
  });

  it("covers a good spread of the course, not one lesson", () => {
    const lessons = new Set(MYTHS.map((m) => m.lesson));
    expect(lessons.size).toBeGreaterThanOrEqual(6);
  });
});

describe("a myth deck", () => {
  it("is eight cards, exactly four of them true", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const b = buildMythBoard(seed);
      expect(b.cards).toHaveLength(MYTH_CARDS);
      expect(b.cards.filter((c) => c.isTrue)).toHaveLength(MYTH_CARDS / 2);
      expect(new Set(b.cards.map((c) => c.id)).size).toBe(MYTH_CARDS);
    }
  });

  it("is the same deck for the same seed, and varies between seeds", () => {
    expect(buildMythBoard(7)).toEqual(buildMythBoard(7));
    const decks = new Set(Array.from({ length: 80 }, (_, i) => buildMythBoard(i).cards.map((c) => c.id).join()));
    expect(decks.size).toBeGreaterThan(60);
  });

  it("carries the true/false value and explanation of the myth it was built from", () => {
    for (const c of buildMythBoard(3).cards) {
      const m = myth(c.id);
      expect(c.isTrue).toBe(m.isTrue);
      expect(c.claim).toBe(m.claim);
      expect(c.explanation).toBe(m.why(m.calc()));
    }
  });

  it("does not always put the true ones first, nor last", () => {
    const firstTrue = Array.from({ length: 200 }, (_, i) => buildMythBoard(i).cards[0].isTrue).filter(Boolean).length;
    expect(firstTrue).toBeGreaterThan(70);
    expect(firstTrue).toBeLessThan(130);
  });
});

describe("the facts: the numbers behind the answers", () => {
  it("orbit 7,9 km/s; escape 11,2 km/s", () => {
    near(fact("orbit").calc().v, 7.90566316003913);
    near(fact("escape").calc().v, 11.180296060480689);
    expect(fact("orbit").answer(fact("orbit").calc())).toContain("7,9 км/с");
    expect(fact("escape").answer(fact("escape").calc())).toContain("11,2 км/с");
  });

  it("the same jump is 6,06 times as high on the Moon: 0,5 m becomes 3,03 m", () => {
    const c = fact("moon-jump").calc();
    near(c.h, 3.0277777777777777);
    near(c.k, 6.055555555555555);
    expect(fact("moon-jump").answer(c)).toMatch(/6,1 есе.*≈ 3 м/);
  });

  it("60 kg weighs 589 N on Earth and 1 487 N on Jupiter, 2,53 times as much", () => {
    const c = fact("jupiter-weight").calc();
    near(c.earth, 588.6);
    near(c.jupiter, 1487.4);
    near(c.k, 2.527013251783894);
    const t = fact("jupiter-weight").answer(c);
    expect(t).toContain("589 Н");
    expect(t).toContain("1487 Н");
    expect(t).toContain("2,5 есе");
  });

  it("a fighter at 250 m/s on a 1,5 km turn: 41,7 m/s² = 4,25 g", () => {
    const c = fact("pilot-g").calc();
    near(c.a, 41.666666666666664);
    near(c.g, 4.247366632687733);
    expect(fact("pilot-g").answer(c)).toMatch(/≈ 42 м\/с².*≈ 4,2g/);
  });

  it("a 120 N·m nut needs 480 N on a 0,25 m key and 200 N on a 0,6 m key", () => {
    const c = fact("wrench").calc();
    expect([c.f1, c.f2]).toEqual([480, 200]);
  });

  it("climbing 3 m in 5 s at 70 kg takes 412 W", () => {
    near(fact("stairs-power").calc().p, 412.02);
    expect(fact("stairs-power").answer(fact("stairs-power").calc())).toContain("412 Вт");
  });

  it("10 m of water adds 98,1 kPa", () => {
    near(fact("water-pressure").calc().p, 98.1);
    expect(fact("water-pressure").answer(fact("water-pressure").calc())).toContain("98 кПа");
  });

  it("a 0,25 kg mass on a 100 N/m spring has T = π/10 = 0,314 s", () => {
    near(fact("spring-period").calc().T, 0.3141592653589793);
    expect(fact("spring-period").answer(fact("spring-period").calc())).toContain("0,31 с");
  });

  it("the ground moves east at 465 m/s at the equator, 324 m/s at Baikonur, 292 m/s at Astana", () => {
    const c = fact("earth-speed").calc();
    near(c.eq, 465.10113961660727, 1e-6);
    near(c.baikonur, 323.5532265835588, 1e-6);
    near(c.astana, 291.87677098032606, 1e-6);
    expect(fact("earth-speed").answer(c)).toMatch(/465 м\/с.*324 м\/с.*292 м\/с/);
  });

  it("100 km/h: 43,7 m with static friction (μ 0,9), 56,2 m skidding (μ 0,7)", () => {
    const c = fact("abs").calc();
    near(c.rolling, 43.69718757909191);
    near(c.skidding, 56.18209831597532);
    expect(fact("abs").answer(c)).toMatch(/≈ 44 м.*≈ 56 м/);
  });

  it("a raindrop with no air from 1,5 km would hit 172 m/s", () => {
    near(fact("raindrop").calc().v, 171.55174146594956);
    expect(fact("raindrop").answer(fact("raindrop").calc())).toContain("172 м/с");
  });

  it("a 60 kg person leaving a 120 kg boat at 3 m/s sends it back at 1,5 m/s", () => {
    expect(fact("recoil-fact").calc().v).toBe(1.5);
  });
});

describe("the day's fact", () => {
  const DAYS = Array.from({ length: 3000 }, (_, i) => shiftDay("2026-01-01", i));
  const idOf = (d: string, facts?: readonly Fact[]) => factOfTheDay(d, facts).id;

  it("counts days from the calendar alone", () => {
    expect(dayNumber("1970-01-01")).toBe(0);
    expect(dayNumber("1969-12-31")).toBe(-1);
    expect(dayNumber("2026-10-26")).toBe(20752);
    expect(dayNumber("2026-10-27") - dayNumber("2026-10-26")).toBe(1);
    expect(dayNumber("2028-03-01") - dayNumber("2028-02-28")).toBe(2); // 2028 is a leap year
    expect(dayNumber("2026-03-30") - dayNumber("2026-03-29")).toBe(1); // clocks change; the count does not care
  });

  it("is the same fact for the same day, whoever asks", () => {
    for (const d of DAYS.slice(0, 50)) expect(idOf(d)).toBe(idOf(d));
  });

  it("is never the same fact two days running — including across the seam between rounds", () => {
    for (let i = 1; i < DAYS.length; i++) expect(idOf(DAYS[i]), DAYS[i]).not.toBe(idOf(DAYS[i - 1]));
  });

  it("shows every fact exactly once in each run of as many days as there are facts", () => {
    const n = FACTS.length;
    const start = DAYS.findIndex((d) => dayNumber(d) % n === 0); // the first day a run begins
    for (let run = 0; run < 12; run++) {
      const ids = DAYS.slice(start + run * n, start + (run + 1) * n).map((d) => idOf(d));
      expect(new Set(ids).size, `run ${run}`).toBe(n);
    }
  });

  it("changes the order from one run to the next", () => {
    const n = FACTS.length;
    const start = DAYS.findIndex((d) => dayNumber(d) % n === 0);
    const runs = Array.from({ length: 12 }, (_, r) => DAYS.slice(start + r * n, start + (r + 1) * n).map((d) => idOf(d)).join());
    expect(new Set(runs).size).toBeGreaterThan(10);
  });

  it("works for a tiny bank and refuses to repeat even then", () => {
    const three = FACTS.slice(0, 3);
    for (let i = 1; i < 300; i++) expect(idOf(DAYS[i], three)).not.toBe(idOf(DAYS[i - 1], three));
  });

  it("has unique ids, real lessons and a question mark in every question", () => {
    expect(new Set(FACTS.map((f) => f.id)).size).toBe(FACTS.length);
    for (const f of FACTS) {
      expect(f.lesson).toBeGreaterThanOrEqual(1);
      expect(f.lesson).toBeLessThanOrEqual(10);
      expect(f.question.endsWith("?")).toBe(true);
    }
    expect(FACTS.length).toBeGreaterThanOrEqual(14);
  });
});

