// Descriptive and inferential statistics for the pre/post analysis.
//
// Everything here is a pure function of arrays of numbers, on purpose: the
// teacher analytics page reports p-values and effect sizes that end up in a
// thesis, so the arithmetic has to be checkable on its own (see
// src/lib/stats.test.ts) rather than buried inside a component.
//
// No dependency: the only non-trivial piece is the Student t distribution,
// which comes from the regularised incomplete beta function (Numerical Recipes
// 6.4, continued fraction). It is accurate to ~1e-10, far past what a class of
// thirty students can justify.

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Sample standard deviation (n − 1). 0 for fewer than two values. */
export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

/**
 * Hake's normalised gain: the share of the *available* improvement that was
 * achieved, (post − pre) / (100 − pre). It is the usual measure in physics
 * education research because, unlike a raw difference, it does not punish a
 * group that started high. `null` when the group already scored 100.
 */
export function hakeGain(pre: number, post: number): number | null {
  if (!Number.isFinite(pre) || !Number.isFinite(post) || pre >= 100) return null;
  return (post - pre) / (100 - pre);
}

/** Hake's own bands: low < 0.3 ≤ medium < 0.7 ≤ high. */
export function hakeBand(g: number): "low" | "medium" | "high" {
  if (g < 0.3) return "low";
  if (g < 0.7) return "medium";
  return "high";
}

// ---------------------------------------------------------------------------
// Student t distribution
// ---------------------------------------------------------------------------

/** ln Γ(x), Lanczos approximation (g = 7, n = 9). */
function lnGamma(x: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Continued fraction for the incomplete beta function (modified Lentz). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  // The fraction converges quickly only on one side of (a + 1) / (a + b + 2).
  return x < (a + 1) / (a + b + 2)
    ? (front * betaContinuedFraction(a, b, x)) / a
    : 1 - (front * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** Two-tailed p-value of a t statistic with `df` degrees of freedom. */
export function tTwoTailedP(t: number, df: number): number {
  if (!Number.isFinite(t)) return t === Infinity || t === -Infinity ? 0 : NaN;
  if (!(df > 0)) return NaN;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export interface PairedResult {
  n: number;
  meanDiff: number;
  sdDiff: number;
  t: number;
  df: number;
  p: number;
  /** Cohen's d_z: mean difference over the SD of the differences. */
  dz: number | null;
}

/**
 * Paired (dependent-samples) t-test of `post` against `pre`. The arrays must be
 * the same length and index-aligned — one entry per student.
 */
export function pairedT(pre: number[], post: number[]): PairedResult | null {
  if (pre.length !== post.length) throw new Error("pairedT: arrays must be the same length");
  const n = pre.length;
  if (n < 2) return null;
  const diffs = post.map((v, i) => v - pre[i]);
  const meanDiff = mean(diffs);
  const sdDiff = sd(diffs);
  const df = n - 1;
  if (sdDiff === 0) {
    // Every student moved by the same amount: the t statistic is infinite (or
    // 0/0 when nobody moved at all), and reporting it as a number would lie.
    return {
      n,
      meanDiff,
      sdDiff,
      t: meanDiff === 0 ? 0 : meanDiff > 0 ? Infinity : -Infinity,
      df,
      p: meanDiff === 0 ? 1 : 0,
      dz: null,
    };
  }
  const t = meanDiff / (sdDiff / Math.sqrt(n));
  return { n, meanDiff, sdDiff, t, df, p: tTwoTailedP(t, df), dz: meanDiff / sdDiff };
}

export interface WelchResult {
  n1: number;
  n2: number;
  mean1: number;
  mean2: number;
  /** mean1 − mean2 */
  diff: number;
  t: number;
  df: number;
  p: number;
  /** Cohen's d with the pooled SD. */
  d: number | null;
}

/**
 * Welch's unequal-variance t-test of group 1 against group 2. Used rather than
 * Student's pooled test because two study groups are rarely the same size, and
 * Welch is no worse when they happen to be.
 */
export function welchT(a: number[], b: number[]): WelchResult | null {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = mean(a);
  const m2 = mean(b);
  const v1 = sd(a) ** 2;
  const v2 = sd(b) ** 2;
  const se2 = v1 / n1 + v2 / n2;
  const diff = m1 - m2;
  const pooled = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const d = pooled === 0 ? null : diff / pooled;
  if (se2 === 0) {
    return { n1, n2, mean1: m1, mean2: m2, diff, t: diff === 0 ? 0 : diff > 0 ? Infinity : -Infinity, df: n1 + n2 - 2, p: diff === 0 ? 1 : 0, d };
  }
  const t = diff / Math.sqrt(se2);
  const df = se2 ** 2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  return { n1, n2, mean1: m1, mean2: m2, diff, t, df, p: tTwoTailedP(t, df), d };
}

/** Cohen's conventional wording for an effect size. */
export function effectLabel(d: number | null): string {
  if (d === null || !Number.isFinite(d)) return "—";
  const a = Math.abs(d);
  if (a < 0.2) return "шамалы";
  if (a < 0.5) return "әлсіз";
  if (a < 0.8) return "орташа";
  return "күшті";
}

/** "p < 0.001" rather than "p = 0.0000", which is what a thesis table wants. */
export function formatP(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "< 0.001";
  return p.toFixed(3);
}
