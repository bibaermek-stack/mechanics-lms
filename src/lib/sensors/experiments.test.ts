import { describe, expect, it } from "vitest";
import { G, synthesizeJump, synthesizeLift, synthesizePendulum, synthesizeRest } from "./analysis";
import { EXPERIMENTS, PENDULUM_LENGTH, analyseRun, experimentFor, num } from "./experiments";
import { SENSOR_KINDS } from "./meta";

const ok = (r: ReturnType<typeof analyseRun>) => {
  if (!r.ok) throw new Error(r.reason);
  return r.analysis;
};

describe("num", () => {
  it("writes a decimal comma and a true minus", () => {
    expect(num(9.8066)).toBe("9,81");
    expect(num(-0.5, 1)).toBe("−0,5");
    expect(num(3, 0)).toBe("3");
    expect(num(0.4)).toBe("0,40");
  });
});

describe("the experiment list", () => {
  it("has one experiment for each kind the database knows, in a usable order", () => {
    expect(EXPERIMENTS.map((e) => e.kind)).toEqual(["rest-g", "jump", "pendulum", "elevator"]);
    expect(new Set(EXPERIMENTS.map((e) => e.kind))).toEqual(new Set(SENSOR_KINDS));
  });

  it("gives every recording long enough for its own analysis", () => {
    expect(experimentFor("rest-g").seconds).toBeGreaterThanOrEqual(3); // 0,5 s dropped + 2 s still
    expect(experimentFor("pendulum").seconds).toBeGreaterThanOrEqual(6); // analysePendulum refuses less
    expect(experimentFor("elevator").seconds).toBeGreaterThanOrEqual(20);
    for (const e of EXPERIMENTS) {
      expect(e.steps.length).toBeGreaterThan(1);
      expect(e.countdown).toBeGreaterThanOrEqual(3);
    }
  });

  it("asks for a length only where it matters", () => {
    expect(EXPERIMENTS.filter((e) => e.needsLength).map((e) => e.kind)).toEqual(["pendulum"]);
  });
});

describe("rest: g", () => {
  it("reports the measured g, its distance from theory and a clean result needs no warning", () => {
    const a = ok(analyseRun("rest-g", synthesizeRest(6, 9.79, { seed: 3 })));
    expect(a.value).toBeCloseTo(9.79, 1);
    expect(a.headline).toBe(`g = ${num(a.value)} м/с²`);
    expect(a.saveable).toBe(true);
    expect(a.warnings).toEqual([]);
    expect(a.details.deviationPercent).toBeCloseTo(((a.value - G) / G) * 100, 9);
  });

  it("warns when the sensor is more than 3 % off, and still lets it be read", () => {
    const a = ok(analyseRun("rest-g", synthesizeRest(6, 10.3, { seed: 4 })));
    expect(a.warnings).toHaveLength(1);
    expect(a.value).toBeCloseTo(10.3, 1);
  });

  it("says whether the phone lay flat, and that tilt does not change the total", () => {
    const tilted = (deg: number) =>
      synthesizeRest(6, G, { seed: 13 }).map((s) => ({ ...s, x: G * Math.sin((deg * Math.PI) / 180), y: 0, z: G * Math.cos((deg * Math.PI) / 180) }));
    const flat = ok(analyseRun("rest-g", tilted(2)));
    expect(flat.lines.join(" ")).toContain("жазық жатты");
    const lean = ok(analyseRun("rest-g", tilted(35)));
    expect(lean.lines.join(" ")).toContain("35° көлбеу");
    expect(lean.value).toBeCloseTo(G, 1);
    expect(lean.details.tilt as number).toBeCloseTo(35, 0);
  });

  it("refuses a restless phone with the reason", () => {
    const r = analyseRun("rest-g", synthesizeJump(0.3).samples);
    expect(r.ok).toBe(false);
  });
});

describe("jump", () => {
  it("measures the height and says how sure it is, and what it would be on the Moon", () => {
    const a = ok(analyseRun("jump", synthesizeJump(0.4, { seed: 5, ramp: 0.03 }).samples));
    expect(a.value).toBeGreaterThan(0.34);
    expect(a.value).toBeLessThan(0.46);
    expect(a.saveable).toBe(true);
    expect(a.lines.join(" ")).toContain("Айда");
    // 0,4 m on Earth is 0,4 · 9,80665 / 1,62 m on the Moon
    const moon = (a.value * G) / 1.62;
    expect(a.lines.join(" ")).toContain(`${moon.toFixed(1).replace(".", ",")} м`);
    expect(a.highlights).toHaveLength(1);
    expect(a.highlights[0].to).toBeGreaterThan(a.highlights[0].from);
  });

  it("doubts a jump over a metre but keeps it, and cannot store one over 1,2 m", () => {
    const high = ok(analyseRun("jump", synthesizeJump(1.1, { seed: 14 }).samples));
    expect(high.warnings).toHaveLength(1);
    expect(high.saveable).toBe(true);
    const absurd = ok(analyseRun("jump", synthesizeJump(1.3, { seed: 15 }).samples));
    expect(absurd.saveable).toBe(false);
    expect(ok(analyseRun("jump", synthesizeJump(0.9, { seed: 16 }).samples)).warnings).toEqual([]);
  });

  it("marks the best of several jumps differently from the others", () => {
    const one = synthesizeJump(0.5, { seed: 6 }).samples;
    const two = synthesizeJump(0.25, { seed: 7 }).samples;
    const joined = [...one, ...two.map((s) => ({ ...s, t: s.t + one[one.length - 1].t + 0.02 }))];
    const a = ok(analyseRun("jump", joined));
    expect(a.highlights).toHaveLength(2);
    expect(a.highlights.filter((h) => h.tone === "good")).toHaveLength(1);
    expect(a.details.jumps).toBe(2);
  });

  it("carries the reason when there is no jump", () => {
    const r = analyseRun("jump", synthesizeRest(8));
    expect(r).toMatchObject({ ok: false });
  });
});

describe("pendulum", () => {
  it("needs a sensible length and says so", () => {
    const { samples } = synthesizePendulum(1);
    for (const bad of [undefined, NaN, 0, -1, PENDULUM_LENGTH.min - 0.01, PENDULUM_LENGTH.max + 0.01]) {
      const r = analyseRun("pendulum", samples, { length: bad });
      expect(r.ok, String(bad)).toBe(false);
      expect((r as { reason: string }).reason).toMatch(/ұзындығ/);
    }
  });

  it("compares the measured period with 2π√(L/g) and derives g from it", () => {
    const { samples, period } = synthesizePendulum(0.8, { seed: 8, seconds: 20 });
    const a = ok(analyseRun("pendulum", samples, { length: 0.8 }));
    expect(a.value).toBeCloseTo(period, 1);
    expect(a.details.theory).toBeCloseTo(period, 9);
    expect(Math.abs(a.details.deviationPercent as number)).toBeLessThan(1.5);
    expect(a.details.gEstimate as number).toBeGreaterThan(9.5);
    expect(a.details.gEstimate as number).toBeLessThan(10.1);
    expect(a.warnings).toEqual([]);
  });

  it("warns when the entered length does not match the swing", () => {
    // a 1,0 m pendulum, but 0,6 m typed in: theory is 1,55 s, the swing is 2,0 s
    const { samples } = synthesizePendulum(1, { seed: 9, seconds: 20 });
    const a = ok(analyseRun("pendulum", samples, { length: 0.6 }));
    expect(a.warnings).toHaveLength(1);
    expect(Math.abs(a.details.deviationPercent as number)).toBeGreaterThan(20);
    // relative to the theory, not to the measurement
    const theory = a.details.theory as number;
    expect(a.details.deviationPercent as number).toBeCloseTo(((a.value - theory) / theory) * 100, 9);
    expect(a.lines[0]).toContain(`${num(Math.abs(a.details.deviationPercent as number), 1)} %`);
  });
});

describe("lift", () => {
  it("says which way the lift went and by how much the weight changed", () => {
    for (const dir of ["up", "down"] as const) {
      const a = ok(analyseRun("elevator", synthesizeLift(dir, 1.1, { seed: 10 })));
      expect(a.details.direction).toBe(dir);
      expect(a.value).toBeGreaterThan(0.9);
      expect(a.value).toBeLessThan(1.3);
      expect(a.headline).toContain(dir === "up" ? "жоғары" : "төмен");
      expect(a.highlights).toHaveLength(2);
      expect(a.saveable).toBe(true);
    }
  });

  it("describes going up as heavier first, lighter second", () => {
    const up = ok(analyseRun("elevator", synthesizeLift("up", 1.1, { seed: 11 })));
    expect(up.highlights.map((h) => h.label)).toEqual(["ауырлады", "жеңілдеді"]);
    const down = ok(analyseRun("elevator", synthesizeLift("down", 1.1, { seed: 12 })));
    expect(down.highlights.map((h) => h.label)).toEqual(["жеңілдеді", "ауырлады"]);
  });
});

describe("every analysis", () => {
  it("records the sample rate and count, and is not saveable outside the database's range", () => {
    const a = ok(analyseRun("rest-g", synthesizeRest(6, 9.8, { hz: 60 })));
    expect(a.details.rateHz).toBe(60);
    expect(a.details.samples).toBe(361);
    // a reading of 12 m/s² cannot be stored: the database would refuse it
    const wild = ok(analyseRun("rest-g", synthesizeRest(6, 12.5)));
    expect(wild.saveable).toBe(false);
  });
});
