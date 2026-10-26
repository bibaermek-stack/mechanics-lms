import { describe, expect, it } from "vitest";
import { decimate, magnitudeSeries } from "./plot";
import { synthesizeJump } from "./analysis";

const line = (n: number) => Array.from({ length: n }, (_, i) => ({ t: i / 50, v: 9.8 }));

describe("decimate", () => {
  it("leaves a short signal alone", () => {
    const p = line(100);
    expect(decimate(p, 600)).toEqual(p);
  });

  it("thins a long one to no more than the limit, in time order", () => {
    const out = decimate(line(10_000), 600);
    expect(out.length).toBeLessThanOrEqual(600);
    for (let i = 1; i < out.length; i++) expect(out[i].t).toBeGreaterThanOrEqual(out[i - 1].t);
  });

  it("keeps each bucket's low and high in time order when the signal slopes, falls or wobbles", () => {
    const shapes = {
      rising: (i: number) => i * 0.01,
      falling: (i: number) => 100 - i * 0.01,
      wobble: (i: number) => 9.8 + 3 * Math.sin(i / 7),
    };
    for (const [name, f] of Object.entries(shapes)) {
      const p = Array.from({ length: 5000 }, (_, i) => ({ t: i / 50, v: f(i) }));
      const out = decimate(p, 150);
      for (let i = 1; i < out.length; i++) expect(out[i].t, name).toBeGreaterThan(out[i - 1].t);
    }
  });

  it("keeps a single spike and a single dip, however thin the thinning", () => {
    const p = line(10_000);
    p[4321] = { t: p[4321].t, v: 40 };
    p[7777] = { t: p[7777].t, v: 0 };
    const out = decimate(p, 200);
    expect(Math.max(...out.map((x) => x.v))).toBe(40);
    expect(Math.min(...out.map((x) => x.v))).toBe(0);
  });

  it("ignores a limit too small to mean anything", () => {
    expect(decimate(line(50), 2)).toHaveLength(50);
  });
});

describe("magnitudeSeries", () => {
  it("draws the landing spike of a jump at its true height", () => {
    const { samples } = synthesizeJump(0.4, { noise: 0 });
    const true_max = Math.max(...samples.map((s) => Math.hypot(s.x, s.y, s.z)));
    const series = magnitudeSeries(samples, 80);
    expect(series.length).toBeLessThanOrEqual(80);
    expect(Math.max(...series.map((p) => p.v))).toBeCloseTo(true_max, 9);
  });
});
