import type { Sample } from "./analysis";
import { magnitude } from "./analysis";

export interface Point {
  t: number;
  v: number;
}

/**
 * Thins a long signal for drawing without losing its peaks: the signal is cut into
 * buckets and each keeps its lowest and highest point, in time order. Picking every
 * n-th point instead would drop the very spike a landing makes.
 */
export function decimate(points: readonly Point[], maxPoints: number): Point[] {
  if (points.length <= maxPoints || maxPoints < 4) return points.slice();
  const buckets = Math.floor(maxPoints / 2);
  const size = points.length / buckets;
  const out: Point[] = [];
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * size), to = Math.min(points.length, Math.floor((b + 1) * size));
    let lo = points[from], hi = points[from];
    for (let i = from; i < to; i++) {
      if (points[i].v < lo.v) lo = points[i];
      if (points[i].v > hi.v) hi = points[i];
    }
    if (lo === hi) out.push(lo);
    else if (lo.t < hi.t) out.push(lo, hi);
    else out.push(hi, lo);
  }
  return out;
}

/** |a| against time, ready to draw. */
export function magnitudeSeries(samples: Sample[], maxPoints = 600): Point[] {
  return decimate(samples.map((s) => ({ t: s.t, v: magnitude(s) })), maxPoints);
}
