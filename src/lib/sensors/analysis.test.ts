import { describe, expect, it } from "vitest";
import {
  G,
  analyzeJump,
  analyzeLift,
  analyzePendulum,
  analyzeRest,
  magnitude,
  noise,
  parseSensorCsv,
  pendulumLengthFor,
  pendulumPeriodFor,
  resample,
  sampleInterval,
  smooth,
  synthesizeJump,
  synthesizeLift,
  synthesizePendulum,
  synthesizeRest,
  type Sample,
} from "./analysis";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("small tools", () => {
  it("magnitude is the length of the vector", () => {
    expect(magnitude({ x: 3, y: 4, z: 12 })).toBe(13);
  });

  it("smoothing keeps the length, averages the neighbours, and shortens the window at the ends", () => {
    expect(smooth([0, 3, 0, 3, 0], 3)).toEqual([1.5, 1, 2, 1, 1.5]);
    expect(smooth([5], 3)).toEqual([5]);
  });

  it("the sample interval is the typical gap, not thrown by one dropped sample", () => {
    const s: Sample[] = [0, 0.02, 0.04, 0.06, 0.2, 0.22].map((t) => ({ t, x: 0, y: 0, z: G }));
    expect(sampleInterval(s)).toBeCloseTo(0.02, 12);
    expect(sampleInterval([{ t: 0, x: 0, y: 0, z: 0 }])).toBeNaN();
  });

  it("resampling lands on an even grid and follows a straight line exactly", () => {
    const irregular: Sample[] = [0, 0.013, 0.05, 0.081, 0.1].map((t) => ({ t, x: 2 * t, y: -t, z: 5 }));
    const even = resample(irregular, 100);
    expect(even.length).toBe(11);
    even.forEach((s, i) => {
      expect(s.t).toBeCloseTo(i / 100, 9);
      expect(s.x).toBeCloseTo(2 * s.t, 9);
      expect(s.z).toBeCloseTo(5, 9);
    });
  });

  it("the noise source is repeatable and standard-normal", () => {
    const a = noise(7), b = noise(7);
    const xs = Array.from({ length: 20000 }, () => a());
    expect(xs.slice(0, 5)).toEqual(Array.from({ length: 5 }, () => b()));
    const m = xs.reduce((p, q) => p + q, 0) / xs.length;
    const v = xs.reduce((p, q) => p + (q - m) ** 2, 0) / xs.length;
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(Math.abs(v - 1)).toBeLessThan(0.04);
  });

  it("the pendulum formula and its inverse agree, and 1 m gives 2,006 s", () => {
    expect(pendulumPeriodFor(1)).toBeCloseTo(2.0060666807, 3);
    for (const L of [0.2, 0.7, 1, 2.5]) expect(pendulumLengthFor(pendulumPeriodFor(L))).toBeCloseTo(L, 12);
  });
});

describe("g at rest", () => {
  it("reads the phone's own g to a hundredth, with the hand's let-go at the start ignored", () => {
    for (const g of [9.7, 9.81, 9.95]) {
      for (let seed = 1; seed <= 4; seed++) {
        const r = analyzeRest(synthesizeRest(6, g, { seed }));
        if (!r.ok) throw new Error(r.reason);
        expect(Math.abs(r.g - g)).toBeLessThan(0.03);
        expect(r.sd).toBeLessThan(0.3);
      }
    }
  });

  it("measures the tilt from flat", () => {
    const tilted = (deg: number): Sample[] =>
      synthesizeRest(5, G, { noise: 0.02 }).map((s) => ({ ...s, x: G * Math.sin((deg * Math.PI) / 180), y: 0, z: G * Math.cos((deg * Math.PI) / 180) }));
    for (const deg of [0, 15, 30, 60]) {
      const r = analyzeRest(tilted(deg));
      if (!r.ok) throw new Error(r.reason);
      expect(r.tilt).toBeCloseTo(deg, 0);
      expect(r.g).toBeCloseTo(G, 1);
    }
  });

  it("refuses a phone that is being moved, and one recorded for too short a time", () => {
    const shaking = synthesizeRest(6, G, { noise: 1.5 });
    expect(analyzeRest(shaking).ok).toBe(false);
    expect(analyzeRest(synthesizeRest(1.5, G)).ok).toBe(false);
    expect(analyzeRest([]).ok).toBe(false);
  });
});

describe("a jump", () => {
  it("is recovered from flight time within 5 % (50 and 100 Hz) and 8 % (25 Hz), across heights and noise", () => {
    for (const [hz, tol] of [[25, 0.08], [50, 0.05], [100, 0.05]] as const) {
      for (const h of [0.1, 0.2, 0.3, 0.45, 0.6]) {
        for (const sigma of [0.05, 0.15, 0.3]) {
          for (const seed of [1, 2, 3]) {
            const { samples } = synthesizeJump(h, { hz, noise: sigma, seed });
            const r = analyzeJump(samples);
            if (!r.ok) throw new Error(`${hz} Hz, ${h} m, σ ${sigma}: ${r.reason}`);
            expect(rel(r.best.height, h), `${hz} Hz, h=${h}, σ=${sigma}, seed ${seed}`).toBeLessThan(tol);
          }
        }
      }
    }
  });

  it("copes with the soft edges of a real phone: the reading takes 30 ms to fall into free fall and 30 ms to climb out", () => {
    // A ramp makes the reading lag each edge; the measured flight comes out a little short
    // (about 0,6 of the ramp — up to 11 % in height for a small jump). That is a limit of timing a
    // flight from the reading, stated on the page; it is tested here so it cannot grow unnoticed.
    for (const hz of [50, 100]) {
      for (const h of [0.15, 0.3, 0.5]) {
        for (const seed of [1, 2, 3]) {
          const { samples } = synthesizeJump(h, { hz, ramp: 0.03, noise: 0.15, seed });
          const r = analyzeJump(samples);
          if (!r.ok) throw new Error(`${hz} Hz ${h} m: ${r.reason}`);
          expect(rel(r.best.height, h), `${hz} Hz, h=${h}`).toBeLessThan(0.12);
          expect(r.best.height, `${hz} Hz, h=${h}: soft edges make it read low, not high`).toBeLessThan(h * 1.03);
        }
      }
    }
  });

  it("does not take a deep squat for a jump: the reading dips to 0,55 g, which is not free fall", () => {
    // a bounce, then a fast squat (reading 0,55 g for 0,25 s) and a braking spike, as in a real squat-and-stand
    const squat: Sample[] = Array.from({ length: 500 }, (_, i) => {
      const t = i / 100;
      let a = G;
      if (t >= 1.0 && t < 1.15) a = G * (1 + 0.4 * Math.sin((Math.PI * (t - 1.0)) / 0.15)); // a bounce
      else if (t >= 1.6 && t < 1.85) a = G * 0.55;
      else if (t >= 1.85 && t < 2.0) a = G * (1 + 0.8 * Math.sin((Math.PI * (t - 1.85)) / 0.15)); // braking
      return { t, x: 0.1, y: 0.1, z: a };
    });
    expect(analyzeJump(squat).ok).toBe(false);
  });

  it("does not count weightlessness that ends with no landing: a push-off, a fall, and a quiet return to g", () => {
    // a phone thrown up and caught in a cushion: nothing like the spike of feet hitting the floor
    const soft: Sample[] = Array.from({ length: 500 }, (_, i) => {
      const t = i / 100;
      const a = t < 1.5 ? G : t < 1.7 ? G * (1 + 1.2 * Math.sin((Math.PI * (t - 1.5)) / 0.2)) : t < 2.2 ? 0.15 : G * 1.2;
      return { t, x: 0.1, y: 0.1, z: a };
    });
    expect(analyzeJump(soft).ok).toBe(false);
  });

  it("finds the flight time to within a sample, and says how far off it might be", () => {
    for (const hz of [25, 50, 100]) {
      const { samples, flightTime } = synthesizeJump(0.35, { hz, noise: 0.1, seed: 4 });
      const r = analyzeJump(samples);
      if (!r.ok) throw new Error(r.reason);
      const dt = 1 / hz;
      expect(Math.abs(r.best.flightTime - flightTime)).toBeLessThanOrEqual(1.2 * dt);
      // the stated ± is the sample-interval allowance; the true height lies within it, give or take a half
      expect(Math.abs(r.best.height - 0.35)).toBeLessThanOrEqual(1.5 * r.best.uncertainty);
      expect(r.best.uncertainty).toBeCloseTo((G * r.best.flightTime * dt) / 4, 9);
    }
  });

  it("uses h = g t² / 8: a 0,5 s flight is 0,307 m, and doubling the flight quadruples the height", () => {
    const { samples } = synthesizeJump(0.3, { hz: 100, noise: 0.05, seed: 2 });
    const r = analyzeJump(samples);
    if (!r.ok) throw new Error(r.reason);
    expect(r.best.height).toBeCloseTo((G * r.best.flightTime ** 2) / 8, 12);
    expect((G * 0.5 ** 2) / 8).toBeCloseTo(0.3066, 3);
    expect((G * 1.0 ** 2) / 8 / ((G * 0.5 ** 2) / 8)).toBe(4);
  });

  it("finds two jumps in one recording and reports the higher as the best", () => {
    const a = synthesizeJump(0.2, { hz: 100, noise: 0.1, seed: 5 }).samples;
    const b = synthesizeJump(0.45, { hz: 100, noise: 0.1, seed: 6 }).samples;
    const end = a[a.length - 1].t + 0.01;
    const both = [...a, ...b.map((s) => ({ ...s, t: s.t + end }))];
    const r = analyzeJump(both);
    if (!r.ok) throw new Error(r.reason);
    expect(r.jumps).toHaveLength(2);
    expect(rel(r.best.height, 0.45)).toBeLessThan(0.05);
    expect(r.best.start).toBeGreaterThan(end);
  });

  it("is not fooled by a phone lying still, or by one that is simply dropped (no push-off)", () => {
    expect(analyzeJump(synthesizeRest(8, G)).ok).toBe(false);
    // a drop: still, then 0,4 s of free fall, then an impact
    const drop: Sample[] = Array.from({ length: 400 }, (_, i) => {
      const t = i / 100;
      const a = t < 1.5 ? G : t < 1.9 ? 0.15 : t < 1.95 ? 4 * G : G;
      return { t, x: 0.1, y: 0.1, z: a };
    });
    const r = analyzeJump(drop);
    expect(r.ok).toBe(false);
  });

  it("ignores a short bump, a flight with no landing, and a sensor that reports too seldom", () => {
    const bump = synthesizeJump(0.012, { hz: 100, noise: 0.05 }).samples; // ~0,098 s of flight: not a jump
    expect(analyzeJump(bump).ok).toBe(false);
    const full = synthesizeJump(0.3, { hz: 100, noise: 0.05 }).samples;
    const cut = full.filter((s) => s.t < 2.3); // recording stops mid-air
    expect(analyzeJump(cut).ok).toBe(false);
    const slow = synthesizeJump(0.3, { hz: 10, noise: 0.05 }).samples;
    expect(analyzeJump(slow).ok).toBe(false);
    expect(analyzeJump([]).ok).toBe(false);
  });

  it("is not thrown by an uneven sensor clock", () => {
    const { samples } = synthesizeJump(0.3, { hz: 100, noise: 0.1, seed: 9 });
    const jitter = noise(3);
    const uneven = samples.map((s, i) => ({ ...s, t: i === 0 ? 0 : s.t + 0.002 * jitter() }));
    const r = analyzeJump(uneven);
    if (!r.ok) throw new Error(r.reason);
    expect(rel(r.best.height, 0.3)).toBeLessThan(0.08);
  });
});

describe("a pendulum", () => {
  it("finds the period to 1 % for lengths from 0,3 m to 2 m, at three sample rates", () => {
    for (const hz of [25, 50, 100]) {
      for (const L of [0.3, 0.5, 1, 1.5, 2]) {
        for (const seed of [1, 2]) {
          const { samples, period } = synthesizePendulum(L, { hz, noise: 0.15, seed });
          const r = analyzePendulum(samples);
          if (!r.ok) throw new Error(`${hz} Hz, L=${L}: ${r.reason}`);
          expect(rel(r.period, period), `${hz} Hz L=${L}`).toBeLessThan(0.01);
          expect(r.frequency).toBeCloseTo(1 / r.period, 12);
        }
      }
    }
  });

  it("is exact to within a quarter of a percent on a clean, undamped swing: the peak is read between samples", () => {
    for (const L of [0.6, 1, 1.7]) {
      const { samples, period } = synthesizePendulum(L, { hz: 50, noise: 0.02, damping: 0, seconds: 16, seed: 4 });
      const r = analyzePendulum(samples);
      if (!r.ok) throw new Error(r.reason);
      expect(rel(r.period, period), `L=${L}`).toBeLessThan(0.0025);
    }
  });

  it("works on the swing axis whichever way the phone is held", () => {
    const { samples, period } = synthesizePendulum(1, { noise: 0.1, seed: 3 });
    // turn the phone: swap x and z
    const turned = samples.map((s) => ({ ...s, x: s.z, z: s.x }));
    const r = analyzePendulum(turned);
    if (!r.ok) throw new Error(r.reason);
    expect(rel(r.period, period)).toBeLessThan(0.01);
    expect(r.axis).toBe("z");
  });

  it("recovers the length of the string from the period: l = g (T/2π)²", () => {
    const { samples } = synthesizePendulum(0.8, { noise: 0.1, seed: 7 });
    const r = analyzePendulum(samples);
    if (!r.ok) throw new Error(r.reason);
    expect(rel(pendulumLengthFor(r.period), 0.8)).toBeLessThan(0.02);
  });

  it("counts the swings it saw", () => {
    const { samples } = synthesizePendulum(1, { seconds: 12, noise: 0.1 });
    const r = analyzePendulum(samples);
    if (!r.ok) throw new Error(r.reason);
    expect(r.cycles).toBe(6); // 12 s / 2,006 s = 5,98
    expect(r.quality).toBeGreaterThan(0.5);
  });

  it("is not thrown by an uneven sensor clock", () => {
    const { samples, period } = synthesizePendulum(1, { hz: 60, noise: 0.1, seed: 2 });
    const j = noise(11);
    const uneven = samples.map((s, i) => ({ ...s, t: i === 0 ? 0 : s.t + 0.004 * j() }));
    const r = analyzePendulum(uneven);
    if (!r.ok) throw new Error(r.reason);
    expect(rel(r.period, period)).toBeLessThan(0.015);
  });

  it("refuses a phone that is not swinging, a recording that is too short, and plain noise", () => {
    expect(analyzePendulum(synthesizeRest(10, G, { noise: 0.05 })).ok).toBe(false);
    expect(analyzePendulum(synthesizePendulum(1, { seconds: 4 }).samples).ok).toBe(false);
    const n = noise(5);
    const hiss: Sample[] = Array.from({ length: 600 }, (_, i) => ({ t: i / 50, x: n(), y: n(), z: G + n() }));
    expect(analyzePendulum(hiss).ok).toBe(false);
    expect(analyzePendulum([]).ok).toBe(false);
  });
});

describe("a lift", () => {
  it("tells up from down by the order of the two departures, every time", () => {
    for (const dir of ["up", "down"] as const) {
      for (const a of [0.6, 1.0, 1.5]) {
        for (let seed = 1; seed <= 4; seed++) {
          const r = analyzeLift(synthesizeLift(dir, a, { seed, noise: 0.12 }));
          if (!r.ok) throw new Error(`${dir} ${a}: ${r.reason}`);
          expect(r.direction, `${dir} ${a} seed ${seed}`).toBe(dir);
        }
      }
    }
  });

  it("reads the acceleration to within 16 % (noise included), and the change of apparent weight with it", () => {
    for (const dir of ["up", "down"] as const) {
      for (const a of [0.6, 1.0, 1.5]) {
        for (let seed = 1; seed <= 6; seed++) {
          const r = analyzeLift(synthesizeLift(dir, a, { seed, noise: 0.12 }));
          if (!r.ok) throw new Error(r.reason);
          expect(rel(r.maxAcceleration, a), `${dir} ${a} seed ${seed}`).toBeLessThan(0.16);
          expect(r.weightChangePercent).toBeCloseTo((r.maxAcceleration / r.rest) * 100, 9);
          expect(Math.abs(r.rest - G)).toBeLessThan(0.05);
        }
      }
    }
  });

  it("refuses two bumps the same way: a ride has a start and a stop, which feel opposite", () => {
    const bumps: Sample[] = Array.from({ length: 500 }, (_, i) => {
      const t = i / 50;
      const lift = (c: number) => Math.exp(-(((t - c) / 0.5) ** 2));
      return { t, x: 0.1, y: 0.1, z: G + 1.2 * lift(3) + 1.2 * lift(6.5) };
    });
    expect(analyzeLift(bumps).ok).toBe(false);
  });

  it("goes up as: first heavier, then lighter; down as the reverse", () => {
    const up = analyzeLift(synthesizeLift("up", 1, { seed: 1 }));
    const down = analyzeLift(synthesizeLift("down", 1, { seed: 1 }));
    if (!up.ok || !down.ok) throw new Error("lift not found");
    expect(up.phases.map((p) => p.feel)).toEqual(["heavier", "lighter"]);
    expect(down.phases.map((p) => p.feel)).toEqual(["lighter", "heavier"]);
    expect(up.phases[0].end).toBeLessThan(up.phases[1].start);
  });

  it("refuses a recording with no ride in it, one that starts while moving, and one with only half a ride", () => {
    expect(analyzeLift(synthesizeRest(10, G, { noise: 0.1 })).ok).toBe(false);
    const jostled = synthesizeLift("up", 1, { seed: 2 }).map((s, i) => (i < 80 ? { ...s, z: s.z + 1.2 * Math.sin(i / 4) } : s)); // a slow wobble of the hand
    expect(analyzeLift(jostled).ok).toBe(false);
    const half = synthesizeLift("up", 1, { seed: 2 }).filter((s) => s.t < 4.5); // cut before it slows
    expect(analyzeLift(half).ok).toBe(false);
    expect(analyzeLift([]).ok).toBe(false);
  });
});

describe("a CSV from another app", () => {
  const csv = (rows: Sample[], head: string, sep = ",", dec = ".") =>
    [head, ...rows.map((s) => [s.t, s.x, s.y, s.z].map((v) => String(v.toFixed(6)).replace(".", dec)).join(sep))].join("\n");
  const rest = synthesizeRest(6, 9.81, { seed: 2 });

  it("reads the Phyphox layout: time in seconds, acceleration with g in m/s²", () => {
    const r = parseSensorCsv(csv(rest, '"Time (s)","Acceleration x (m/s^2)","Acceleration y (m/s^2)","Acceleration z (m/s^2)"'));
    if (!r.ok) throw new Error(r.reason);
    expect(r.unit).toBe("m/s²");
    expect(r.samples).toHaveLength(rest.length);
    expect(r.samples[0].t).toBe(0);
    expect(r.samples[10].z).toBeCloseTo(rest[10].z, 5);
    const g = analyzeRest(r.samples);
    if (!g.ok) throw new Error(g.reason);
    expect(g.g).toBeCloseTo(9.81, 1);
  });

  it("reads semicolons with decimal commas, tabs, a byte-order mark, and a recording that does not start at 0", () => {
    const shifted = rest.map((s) => ({ ...s, t: s.t + 1234.5 }));
    for (const [sep, dec] of [[";", ","], ["\t", "."]] as const) {
      const r = parseSensorCsv("﻿" + csv(shifted, ["Time (s)", "Acceleration x", "Acceleration y", "Acceleration z"].join(sep), sep, dec));
      if (!r.ok) throw new Error(r.reason);
      expect(r.samples[0].t).toBe(0);
      expect(r.samples[r.samples.length - 1].t).toBeCloseTo(6, 3);
    }
  });

  it("converts readings given in g, whether the header says so or only the numbers do", () => {
    const inG = rest.map((s) => ({ ...s, x: s.x / G, y: s.y / G, z: s.z / G }));
    const named = parseSensorCsv(csv(inG, "time (s),acc x (g),acc y (g),acc z (g)"));
    if (!named.ok) throw new Error(named.reason);
    expect(named.unit).toBe("g");
    expect(magnitude(named.samples[100])).toBeCloseTo(G, 1);
    const silent = parseSensorCsv(csv(inG, "time,acc x,acc y,acc z"));
    if (!silent.ok) throw new Error(silent.reason);
    expect(silent.unit).toBe("g");
    expect(magnitude(silent.samples[100])).toBeCloseTo(G, 1);
  });

  it("reads timestamps given in milliseconds", () => {
    const ms = rest.map((s) => ({ ...s, t: s.t * 1000 }));
    const r = parseSensorCsv(csv(ms, "time,acc x,acc y,acc z"));
    if (!r.ok) throw new Error(r.reason);
    expect(r.samples[r.samples.length - 1].t).toBeCloseTo(6, 3);
  });

  it("reads a file with no header at all, taking time, x, y, z in that order", () => {
    const r = parseSensorCsv(rest.map((s) => `${s.t},${s.x},${s.y},${s.z}`).join("\n"));
    if (!r.ok) throw new Error(r.reason);
    expect(r.samples).toHaveLength(rest.length);
  });

  it("refuses acceleration WITHOUT gravity, which cannot show a rest, a jump or a lift", () => {
    const r = parseSensorCsv(csv(rest, "Time (s),Linear Acceleration x (m/s^2),Linear Acceleration y (m/s^2),Linear Acceleration z (m/s^2)"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/g-мен|гравитация/);
  });

  it("refuses a file that is too short or has no acceleration columns", () => {
    expect(parseSensorCsv("a,b\n1,2").ok).toBe(false);
    expect(parseSensorCsv(csv(rest, "Time (s),Pressure,Humidity,Light")).ok).toBe(false);
  });

  it("skips rows that are not numbers instead of failing the file", () => {
    const lines = csv(rest, "time,acc x,acc y,acc z").split("\n");
    lines.splice(30, 0, "nan;;;");
    const r = parseSensorCsv(lines.join("\n"));
    if (!r.ok) throw new Error(r.reason);
    expect(r.samples).toHaveLength(rest.length);
  });

  it("round-trips a whole jump: through CSV and back, the height is the same", () => {
    const { samples } = synthesizeJump(0.33, { hz: 100, noise: 0.1, seed: 5 });
    const direct = analyzeJump(samples);
    const parsed = parseSensorCsv(csv(samples, "Time (s),Acceleration x (m/s^2),Acceleration y (m/s^2),Acceleration z (m/s^2)"));
    if (!direct.ok || !parsed.ok) throw new Error("failed");
    const again = analyzeJump(parsed.samples);
    if (!again.ok) throw new Error(again.reason);
    expect(again.best.height).toBeCloseTo(direct.best.height, 4);
  });
});
