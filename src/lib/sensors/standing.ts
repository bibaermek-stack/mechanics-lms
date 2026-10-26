// Where a measurement sits among the class — without a name in sight.

export interface Standing {
  n: number;
  below: number;
  equal: number;
  above: number;
  /** 0–100: the share of the class below this value, ties counted as half. null with no class. */
  percentile: number | null;
}

/** `others` are the classmates' bests (the caller's own may be among them or not). */
export function standingAmong(value: number, others: readonly number[]): Standing {
  const below = others.filter((v) => v < value).length;
  const equal = others.filter((v) => v === value).length;
  const n = others.length;
  return { n, below, equal, above: n - below - equal, percentile: n === 0 ? null : ((below + equal / 2) / n) * 100 };
}

export interface Bin {
  from: number;
  to: number;
  count: number;
}

/** Equal-width bins from the lowest value rounded down to a multiple of `width`, through the highest. */
const EPS = 1e-9;

/** Which bin a value falls in; the same rule the histogram counts by, so a marker lands on the bar that counted it. */
export function binOf(bins: readonly Bin[], value: number): number {
  if (bins.length === 0) return -1;
  const width = bins[0].to - bins[0].from;
  return Math.max(0, Math.min(bins.length - 1, Math.floor((value - bins[0].from) / width + EPS)));
}

export function histogram(values: readonly number[], width: number): Bin[] {
  if (values.length === 0 || !(width > 0)) return [];
  const lo = Math.floor(Math.min(...values) / width + EPS) * width;
  const hi = Math.max(...values);
  const bins: Bin[] = [];
  for (let from = lo; from <= hi + EPS; from += width) {
    const f = Math.round(from * 1e9) / 1e9;
    bins.push({ from: f, to: Math.round((f + width) * 1e9) / 1e9, count: 0 });
  }
  for (const v of values) bins[binOf(bins, v)].count++;
  return bins;
}

/** The best (highest) value of one kind for each user: a student's standing is their best, not their latest. */
export function bestByUser(results: readonly { userId: string; kind: string; value: number }[], kind: string): Map<string, number> {
  const best = new Map<string, number>();
  for (const r of results) {
    if (r.kind !== kind || !Number.isFinite(r.value)) continue;
    const had = best.get(r.userId);
    if (had === undefined || r.value > had) best.set(r.userId, r.value);
  }
  return best;
}

export interface ClassBests {
  /** Classmates' bests, nobody's name attached. */
  others: number[];
  /** The caller's own best, if they have one. */
  mine: number | null;
}

/** Splits the rows of `class_jump_bests()` (a number and a flag, never a name) into the class and the caller. */
export function classFromRows(rows: readonly { best: number | string; is_me: boolean }[]): ClassBests {
  const others: number[] = [];
  let mine: number | null = null;
  for (const r of rows) {
    const v = Number(r.best);
    if (!Number.isFinite(v)) continue;
    if (r.is_me) mine = v;
    else others.push(v);
  }
  return { others, mine };
}

/**
 * The same push-off gives a jump of height g_here/g_there times as high where gravity is
 * g_there: the take-off speed v = √(2·g·h) is what the legs provide, and h = v²/(2g).
 */
export function sameJumpOn(height: number, gHere: number, gThere: number): number {
  return (height * gHere) / gThere;
}
