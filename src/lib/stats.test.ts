import { describe, expect, it } from "vitest";
import {
  effectLabel,
  formatP,
  hakeBand,
  hakeGain,
  incompleteBeta,
  mean,
  pairedT,
  sd,
  tTwoTailedP,
  welchT,
} from "./stats";

describe("descriptive statistics", () => {
  it("mean and sample SD", () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    // Textbook: sample SD of this set is sqrt(32/7).
    expect(sd([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });

  it("SD of fewer than two values is 0, not NaN", () => {
    expect(sd([])).toBe(0);
    expect(sd([5])).toBe(0);
  });
});

describe("Hake's normalised gain", () => {
  it("is the share of the available improvement achieved", () => {
    expect(hakeGain(40, 70)).toBeCloseTo(0.5, 12);
    expect(hakeGain(0, 100)).toBe(1);
    expect(hakeGain(50, 50)).toBe(0);
  });

  it("does not punish a group that started high", () => {
    // Same 10-point raw gain, but 90 → 100 closed the whole remaining gap.
    expect(hakeGain(90, 100)).toBe(1);
    expect(hakeGain(40, 50)).toBeCloseTo(1 / 6, 12);
  });

  it("is undefined when there was no room to improve", () => {
    expect(hakeGain(100, 100)).toBeNull();
  });

  it("uses Hake's own bands", () => {
    expect(hakeBand(0.29)).toBe("low");
    expect(hakeBand(0.3)).toBe("medium");
    expect(hakeBand(0.69)).toBe("medium");
    expect(hakeBand(0.7)).toBe("high");
  });
});

describe("Student t distribution", () => {
  // The Cauchy case df = 1 has the closed form p = 1 − (2/π)·atan|t|.
  it("matches the closed form at df = 1", () => {
    for (const t of [0.5, 1, 2, 5, 12.7062047]) {
      expect(tTwoTailedP(t, 1)).toBeCloseTo(1 - (2 / Math.PI) * Math.atan(t), 9);
    }
  });

  it("matches published critical values (two-tailed α = 0.05)", () => {
    expect(tTwoTailedP(2.2281389, 10)).toBeCloseTo(0.05, 6);
    expect(tTwoTailedP(2.0859634, 20)).toBeCloseTo(0.05, 6);
    expect(tTwoTailedP(2.0452296, 29)).toBeCloseTo(0.05, 6);
  });

  it("matches published critical values (two-tailed α = 0.01)", () => {
    expect(tTwoTailedP(3.1692727, 10)).toBeCloseTo(0.01, 6);
    expect(tTwoTailedP(2.8453397, 20)).toBeCloseTo(0.01, 6);
  });

  it("is symmetric and 1 at t = 0", () => {
    expect(tTwoTailedP(0, 7)).toBeCloseTo(1, 12);
    expect(tTwoTailedP(-1.7, 12)).toBeCloseTo(tTwoTailedP(1.7, 12), 12);
  });

  it("tends to the normal distribution for large df", () => {
    // z = 1.96 → p = 0.05.
    expect(tTwoTailedP(1.96, 100000)).toBeCloseTo(0.05, 3);
  });

  it("incompleteBeta honours its definition at the ends and the middle", () => {
    expect(incompleteBeta(0, 2, 3)).toBe(0);
    expect(incompleteBeta(1, 2, 3)).toBe(1);
    // I_x(a, a) at x = 1/2 is 1/2 by symmetry.
    expect(incompleteBeta(0.5, 4, 4)).toBeCloseTo(0.5, 12);
  });
});

describe("paired t-test", () => {
  // Differences 2, 4, 3, 5, 1 → mean 3, SD sqrt(2.5), n = 5.
  const pre = [10, 20, 30, 40, 50];
  const post = [12, 24, 33, 45, 51];

  it("computes the textbook statistic", () => {
    const r = pairedT(pre, post)!;
    expect(r.n).toBe(5);
    expect(r.df).toBe(4);
    expect(r.meanDiff).toBe(3);
    expect(r.sdDiff).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(r.t).toBeCloseTo(3 / (Math.sqrt(2.5) / Math.sqrt(5)), 12);
    expect(r.t).toBeCloseTo(4.2426, 4);
    expect(r.p).toBeCloseTo(0.01324, 4);
    expect(r.dz).toBeCloseTo(3 / Math.sqrt(2.5), 12);
  });

  it("needs at least two pairs", () => {
    expect(pairedT([50], [60])).toBeNull();
  });

  it("rejects arrays that are not aligned", () => {
    expect(() => pairedT([1, 2, 3], [1, 2])).toThrow();
  });

  it("does not report a finite t when nobody varied", () => {
    expect(pairedT([1, 2, 3], [1, 2, 3])).toMatchObject({ t: 0, p: 1, dz: null });
    expect(pairedT([1, 2, 3], [6, 7, 8])).toMatchObject({ t: Infinity, p: 0, dz: null });
  });
});

describe("Welch's t-test", () => {
  const a = [27.5, 21, 19, 23.6, 17, 17.9, 16.9, 20.1, 21.9, 22.6, 23.1, 19.6, 19, 21.7, 21.4];
  const b = [27.1, 22, 20.8, 23.4, 23.4, 23.5, 25.8, 22, 24.8, 20.2, 21.9, 22.1, 22.9, 20.5, 24.4];

  it("reproduces the reference result for this data set", () => {
    // Reference values were computed independently of this module: the
    // statistic and Welch–Satterthwaite df from Python's `statistics`, and the
    // p-value by numerically integrating the t density (Simpson's rule).
    const r = welchT(a, b)!;
    expect(r.t).toBeCloseTo(-2.45536, 4);
    expect(r.df).toBeCloseTo(24.98853, 4);
    expect(r.p).toBeCloseTo(0.021378, 5);
    expect(r.d).toBeCloseTo(-0.89657, 4);
    expect(r.diff).toBeLessThan(0);
  });

  it("Cohen's d uses the pooled SD and carries the sign of the difference", () => {
    const r = welchT(a, b)!;
    const pooled = Math.sqrt(((a.length - 1) * sd(a) ** 2 + (b.length - 1) * sd(b) ** 2) / (a.length + b.length - 2));
    expect(r.d).toBeCloseTo((mean(a) - mean(b)) / pooled, 12);
    expect(r.d!).toBeLessThan(0);
  });

  it("swapping the groups flips the sign but not the p-value", () => {
    const ab = welchT(a, b)!;
    const ba = welchT(b, a)!;
    expect(ba.t).toBeCloseTo(-ab.t, 12);
    expect(ba.p).toBeCloseTo(ab.p, 12);
  });

  it("needs two values per group", () => {
    expect(welchT([1], [1, 2, 3])).toBeNull();
  });
});

describe("labels", () => {
  it("effect size wording follows Cohen's thresholds", () => {
    expect(effectLabel(0.1)).toBe("шамалы");
    expect(effectLabel(-0.3)).toBe("әлсіз");
    expect(effectLabel(0.5)).toBe("орташа");
    expect(effectLabel(1.2)).toBe("күшті");
    expect(effectLabel(null)).toBe("—");
  });

  it("p-values print the way a thesis table does", () => {
    expect(formatP(0.0004)).toBe("< 0.001");
    expect(formatP(0.02263)).toBe("0.023");
    expect(formatP(NaN)).toBe("—");
  });
});
