import { describe, expect, it } from "vitest";
import {
  MISCONCEPTIONS,
  PREDICT_ITEMS,
  brakingDistance,
  fallTime,
  itemById,
  itemsForLesson,
  mval,
  pendulumPeriod,
  slideDown,
} from "./predictions";
import { G, G_MOON } from "./facts";

const near = (a: number, b: number, rel = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.abs(b) * rel + 1e-12);
const item = (id: string) => itemById(id)!;
const obs = (id: string) => item(id).observe();

describe("every item", () => {
  it("has a unique id, a lesson from 1 to 10, and a question that asks something", () => {
    expect(new Set(PREDICT_ITEMS.map((i) => i.id)).size).toBe(PREDICT_ITEMS.length);
    for (const i of PREDICT_ITEMS) {
      expect(i.lesson).toBeGreaterThanOrEqual(1);
      expect(i.lesson).toBeLessThanOrEqual(10);
      expect(i.question.endsWith("?")).toBe(true);
      expect(i.setup.length).toBeGreaterThan(30);
    }
  });

  it("has a short name of its own, so no two items are alike in a list", () => {
    expect(new Set(PREDICT_ITEMS.map((i) => i.title)).size).toBe(PREDICT_ITEMS.length);
    for (const i of PREDICT_ITEMS) {
      expect(i.title.length, i.id).toBeGreaterThan(5);
      expect(i.title.length, i.id).toBeLessThan(50);
      expect(i.title.endsWith("?"), i.id).toBe(false);
    }
  });

  it("covers every lesson, with at least 19 items in all", () => {
    for (let l = 1; l <= 10; l++) expect(itemsForLesson(l).length, `lesson ${l}`).toBeGreaterThanOrEqual(1);
    expect(PREDICT_ITEMS.length).toBeGreaterThanOrEqual(19);
  });

  it("offers three options, exactly one of them right, each wrong one naming a known misconception", () => {
    for (const i of PREDICT_ITEMS) {
      expect(i.options.length, i.id).toBe(3);
      expect(new Set(i.options.map((o) => o.id)).size, i.id).toBe(3);
      const right = i.options.filter((o) => !o.misconception);
      expect(right.map((o) => o.id), i.id).toEqual([i.correct]);
      for (const o of i.options.filter((o) => o.misconception)) {
        expect(MISCONCEPTIONS[o.misconception!], `${i.id}/${o.id}: ${o.misconception}`).toBeDefined();
      }
    }
  });

  it("uses every misconception it defines, and each has a title and a kind word on why it feels right", () => {
    const used = new Set(PREDICT_ITEMS.flatMap((i) => i.options.map((o) => o.misconception).filter(Boolean)));
    for (const id of Object.keys(MISCONCEPTIONS)) expect(used.has(id), `unused: ${id}`).toBe(true);
    expect(new Set(Object.values(MISCONCEPTIONS).map((m) => m.title)).size).toBe(Object.keys(MISCONCEPTIONS).length);
    for (const m of Object.values(MISCONCEPTIONS)) {
      expect(m.title.length).toBeGreaterThan(8);
      expect(m.why.length).toBeGreaterThan(30);
    }
  });

  it("is answered by its own measurement: the numbers support the option marked correct", () => {
    for (const i of PREDICT_ITEMS) expect(i.answerFrom(i.observe()), i.id).toBe(i.correct);
  });

  it("measures real, finite numbers with a unit, and explains them without raw floats or placeholders", () => {
    for (const i of PREDICT_ITEMS) {
      const o = i.observe();
      expect(o.measurements.length, i.id).toBeGreaterThanOrEqual(2);
      expect(new Set(o.measurements.map((m) => m.key)).size, i.id).toBe(o.measurements.length);
      for (const m of o.measurements) {
        expect(Number.isFinite(m.value), `${i.id}/${m.key}`).toBe(true);
        expect(m.unit.length).toBeGreaterThan(0);
        expect(m.label.length).toBeGreaterThan(5);
      }
      const text = i.explain(o);
      expect(text, i.id).not.toMatch(/undefined|NaN|\$\{|\[object|\d\.\d{3,}/);
      expect(text.length, i.id).toBeGreaterThan(80);
    }
  });

  it("cannot be answered by position: the correct option is not always first, nor always last", () => {
    const at = PREDICT_ITEMS.map((i) => i.options.findIndex((o) => o.id === i.correct));
    expect(new Set(at).size).toBe(3);
  });
});

describe("the experiments, against values worked out separately", () => {
  it("falling 1,5 m takes 0,5530 s whether or not it is also moving sideways, and 8 m/s sideways carries 4,42 m", () => {
    const o = obs("drop-vs-shot");
    near(mval(o, "t-a"), 0.553001263609331, 1e-4);
    near(mval(o, "t-b"), 0.553001263609331, 1e-4);
    near(mval(o, "range-b"), 4.424010108874648, 1e-4);
  });

  it("stepping Newton's law reproduces √(2h/g) for several heights", () => {
    for (const h of [0.5, 1.5, 20, 100]) near(fallTime(h), Math.sqrt((2 * h) / G), 2e-4);
  });

  it("20 m takes 2,019 s for 1 kg and 5 kg alike, landing at 19,8 m/s", () => {
    const o = obs("heavy-light");
    near(mval(o, "t-heavy"), 2.019275109384609, 1e-4);
    near(mval(o, "t-light"), 2.019275109384609, 1e-4);
    near(mval(o, "v-heavy"), 19.809088823063014, 1e-4);
  });

  it("at the top of a 10 m/s throw: v = 0, a = −9,81 m/s² (and the same on the way up and down), h = 5,10 m", () => {
    const o = obs("top-of-throw");
    expect(Math.abs(mval(o, "v-top"))).toBeLessThan(0.01);
    near(mval(o, "a-top"), -9.81, 1e-4);
    near(mval(o, "a-rise"), -9.81, 1e-4);
    near(mval(o, "a-fall"), -9.81, 1e-4);
    near(mval(o, "h-top"), 5.09683995922528, 1e-3);
  });

  it("friction on a 2 kg block at μ = 0,4 is 7,848 N on either face; the pressure differs 5×", () => {
    const o = obs("friction-area");
    near(mval(o, "f-wide"), 7.848);
    near(mval(o, "f-narrow"), 7.848);
    near(mval(o, "p-narrow") / mval(o, "p-wide"), 5, 1e-12);
  });

  it("a 60 kg person on a scale reads 588,6 N at rest, 678,6 N accelerating up and 498,6 N down at 1,5 m/s²", () => {
    const o = obs("elevator-scale");
    near(mval(o, "n-rest"), 588.6);
    near(mval(o, "n-up"), 678.6);
    near(mval(o, "n-down"), 498.6);
  });

  it("the puck keeps 2 m/s and covers 20 m on ice; on the rough floor it stops after 4,08 m", () => {
    const o = obs("frictionless-puck");
    near(mval(o, "v-ice"), 2, 1e-9);
    expect(mval(o, "v-rough")).toBe(0);
    near(mval(o, "x-ice"), 20, 1e-3);
    near(mval(o, "x-rough"), 4.077471967380224, 5e-3);
  });

  it("in the collision the truck and the car feel 177,8 kN each; accelerations 22,2 and 177,8 m/s²", () => {
    const o = obs("truck-car");
    near(mval(o, "f-truck"), 177.7778, 1e-5);
    near(mval(o, "f-car"), 177.7778, 1e-5);
    near(mval(o, "a-truck"), 22.2222, 1e-5);
    near(mval(o, "a-car"), 177.7778, 1e-5);
  });

  it("all three slopes end at √(2g·1 m) = 4,4294 m/s, but take 0,465 s, 0,738 s and 1,862 s", () => {
    const o = obs("three-hills");
    for (const k of ["v-steep", "v-gentle", "v-curve"]) near(mval(o, k), 4.429446918070021, 1e-9);
    near(mval(o, "t-steep"), 0.4654199160619092, 1e-9);
    near(mval(o, "t-curve"), 0.7384535830082575, 1e-6);
    near(mval(o, "t-gentle"), 1.8616796642476379, 1e-9);
  });

  it("a track is walked correctly: a vertical drop is free fall and a level one never gets going", () => {
    // 1 m straight down: the segment slope tends to vertical, so the time tends to √(2h/g)
    const drop = slideDown([1, 0], 1e-9);
    near(drop.time, Math.sqrt(2 / G), 1e-6);
    near(drop.speed, Math.sqrt(2 * G), 1e-6);
    // a level track has nothing to pull the ball along: it never gets going
    const flat = slideDown([0.5, 0.5, 0.5], 1);
    expect(flat.speed).toBe(0);
    expect(flat.time).toBe(Infinity);
  });

  it("stopping from 50 and 100 km/h at μ = 0,7 takes 14,05 m and 56,18 m: four times as far", () => {
    const o = obs("braking-distance");
    near(mval(o, "s-50"), 14.04552457899383, 1e-3);
    near(mval(o, "s-100"), 56.18209831597532, 1e-3);
    near(mval(o, "ratio"), 4, 1e-3);
    near(brakingDistance(10, 0.5), 100 / (2 * 0.5 * G), 1e-3);
  });

  it("the carts leave at 4,243 m/s and 1,414 m/s with equal momenta and the spring's 12 J all used", () => {
    const o = obs("spring-carts");
    near(mval(o, "v-light"), 4.242640687119286);
    near(mval(o, "v-heavy"), 1.4142135623730951);
    near(mval(o, "p-light"), mval(o, "p-heavy"), 1e-12);
    near(0.5 * 1 * mval(o, "v-light") ** 2 + 0.5 * 3 * mval(o, "v-heavy") ** 2, 12, 1e-12);
  });

  it("the egg's impulse is 0,2658 kg·m/s; 133 N on stone, 2,66 N on a pillow — fifty times apart", () => {
    const o = obs("egg-drop");
    near(mval(o, "p"), 0.2657668150842012);
    near(mval(o, "f-stone"), 132.8834075421006);
    near(mval(o, "f-pillow"), 2.657668150842012);
    near(mval(o, "f-stone") / mval(o, "f-pillow"), 50, 1e-12);
  });

  it("rolling down 2 m at 20°: the solid cylinder takes 1,337 s, the hollow one 1,544 s", () => {
    const o = obs("rolling-race");
    near(mval(o, "t-solid"), 1.3372582293503341);
    near(mval(o, "t-hollow"), 1.5441327973829155);
    near(mval(o, "a-solid"), 2.2368117373498735);
    near(mval(o, "a-hollow"), 1.6776088030124052);
  });

  it("the skater's L = 6 kg·m²/s gives ω from 2 to 6 rad/s", () => {
    const o = obs("skater-arms");
    near(mval(o, "L"), 6);
    near(mval(o, "w-after"), 6);
  });

  it("a pendulum's period is the same for 100 g and 500 g — 2,0089 s for a 0,15 rad swing, not 2,0061", () => {
    const o = obs("pendulum-mass");
    near(mval(o, "t-light"), 2.0088913538367072, 2e-5);
    near(mval(o, "t-heavy"), 2.0088913538367072, 2e-5);
    near(pendulumPeriod(0.1, 1, G), pendulumPeriod(7, 1, G), 1e-12); // the mass really does cancel in the integration
  });

  it("on the Moon the same pendulum takes 4,943 s: √(g_E/g_M) = 2,46 times as long", () => {
    const o = obs("pendulum-moon");
    near(mval(o, "t-moon"), 4.943487564438619, 2e-5);
    near(mval(o, "ratio"), Math.sqrt(G / G_MOON), 2e-3);
  });

  it("90 g of floating ice displaces 90 cm³ and melts into 90 cm³", () => {
    const o = obs("melting-ice");
    near(mval(o, "v-displaced"), 90, 1e-12);
    near(mval(o, "v-melted"), 90, 1e-12);
    expect(mval(o, "dv")).toBe(0);
  });

  it("the three vessels press on the bottom at 2 943 Pa while their water weighs 18,7, 29,4 and 56,2 N", () => {
    const o = obs("vessels");
    for (const k of ["p-wide", "p-cyl", "p-narrow"]) near(mval(o, k), 2943);
    near(mval(o, "w-narrow"), 18.682715956253805, 1e-9);
    near(mval(o, "w-cyl"), 29.43, 1e-9);
    near(mval(o, "w-wide"), 56.231418422250684, 1e-9);
  });

  it("both sides of the lever pull with 5,886 N·m", () => {
    const o = obs("lever-balance");
    near(mval(o, "m-left"), 5.886);
    near(mval(o, "m-right"), 5.886);
  });

  it("the dumbbell weighs 49,05 N at home and 8,1 N on the Moon, its mass staying 5 kg", () => {
    const o = obs("moon-dumbbell");
    near(mval(o, "w-earth"), 49.05);
    near(mval(o, "w-moon"), 8.1);
    expect(mval(o, "m-moon")).toBe(5);
  });
});

describe("the scenes", () => {
  it("falling bodies start in the picture and finish on the ground", () => {
    for (const id of ["drop-vs-shot", "heavy-light", "top-of-throw"]) {
      const o = obs(id);
      if (o.scene.kind !== "paths") throw new Error("expected paths");
      for (const b of o.scene.bodies) {
        const p0 = b.at(0), p1 = b.at(b.end);
        expect(p0.x).toBeGreaterThanOrEqual(0);
        expect(p0.x).toBeLessThanOrEqual(o.scene.world.w);
        expect(p0.y).toBeLessThanOrEqual(o.scene.world.h);
        expect(p1.y).toBeLessThanOrEqual(1e-4); // the stepped simulation lands within 0,1 mm of the ground
        expect(p1.x).toBeLessThanOrEqual(o.scene.world.w);
      }
    }
  });

  it("runners start at zero, never go backwards, and the finishers reach 1 exactly when they finish", () => {
    for (const id of ["frictionless-puck", "three-hills", "rolling-race"]) {
      const o = obs(id);
      if (o.scene.kind !== "race") throw new Error("expected race");
      for (const lane of o.scene.lanes) {
        expect(lane.at(0), `${id}/${lane.label}`).toBe(0);
        let prev = 0;
        for (let k = 0; k <= 200; k++) {
          const f = lane.at((o.scene.duration * k) / 200);
          expect(f).toBeGreaterThanOrEqual(prev - 1e-12);
          expect(f).toBeLessThanOrEqual(1 + 1e-12);
          prev = f;
        }
        if (lane.finish !== null) {
          near(lane.at(lane.finish), 1, 1e-6);
          expect(lane.at(lane.finish * 0.5)).toBeLessThan(1);
        }
      }
    }
  });

  it("in the race of the hills the order of finishing is steep, curve, gentle", () => {
    const o = obs("three-hills");
    if (o.scene.kind !== "race") throw new Error("expected race");
    const order = [...o.scene.lanes].sort((a, b) => a.finish! - b.finish!).map((l) => l.label);
    expect(order).toEqual(["Тік жол", "Иілген жол", "Жайпақ еңіс"]);
  });
});
