// The physics of the roller-coaster builder (lesson 5, work and energy).
//
// The track is a curve y(x): a smooth line through control points the student can
// move. A cart runs on it like a bead on a wire — it cannot leave the track, but
// the track says how hard it presses on it, and that is the "G-force" a rider feels.
//
// With s the distance along the track, u = ds/dt the cart's speed along it, θ the
// slope (tanθ = y′) and κ = y″/(1+y′²)^{3/2} the curvature (positive in a valley):
//
//   tangential    du/dt = −g·sinθ − μ·|N/m|·sgn(u)         (gravity, then friction)
//   normal        N/m   = g·cosθ + κ·u²                    (a valley presses harder; a crest, less)
//   position      dx/dt = u·cosθ
//
// Friction is μ|N| — Coulomb friction on the contact force — so a sharp valley
// costs more energy than a gentle one. Per kilogram, E = ½u² + g·y + Q is conserved
// to the integrator's accuracy, where Q = ∫ μ|N/m| ds is the heat; with μ = 0 the
// cart can never rise above its starting height. Both are tested.
//
// Everything is pure and in SI units. Energies are scaled by the cart's mass.

export const G = 9.81;

export interface Pt {
  x: number;
  y: number;
}

/** A smooth height profile and its first two derivatives. */
export interface Profile {
  x0: number;
  x1: number;
  y(x: number): number;
  dy(x: number): number;
  d2y(x: number): number;
}

const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);

/** Fritsch–Carlson's end-point slope (as in the usual PCHIP): a one-sided three-point estimate, kept from overshooting. */
function endSlope(h0: number, h1: number, d0: number, d1: number): number {
  let d = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
  if (sgn(d) !== sgn(d0)) d = 0;
  else if (sgn(d0) !== sgn(d1) && Math.abs(d) > 3 * Math.abs(d0)) d = 3 * d0;
  return d;
}

/**
 * A piecewise cubic through the points that never overshoots them (monotone
 * "PCHIP" interpolation): a hill's crest is at its control point and a valley's
 * bottom likewise, so what the student drags is what the cart meets. Continuous in
 * height and slope; the curvature steps at the control points.
 */
export function pchip(points: readonly Pt[]): Profile {
  const n = points.length;
  if (n < 2) throw new Error("A track needs at least two points");
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  for (let i = 1; i < n; i++) if (!(xs[i] > xs[i - 1])) throw new Error("Control points must go left to right");
  const h = xs.slice(1).map((x, i) => x - xs[i]);
  const delta = ys.slice(1).map((y, i) => (y - ys[i]) / h[i]);
  const d = new Array<number>(n);
  if (n === 2) {
    d[0] = d[1] = delta[0];
  } else {
    for (let k = 1; k < n - 1; k++) {
      if (delta[k - 1] * delta[k] <= 0) d[k] = 0;
      else {
        const w1 = 2 * h[k] + h[k - 1], w2 = h[k] + 2 * h[k - 1];
        d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
      }
    }
    d[0] = endSlope(h[0], h[1], delta[0], delta[1]);
    d[n - 1] = endSlope(h[n - 2], h[n - 3], delta[n - 2], delta[n - 3]);
  }

  const locate = (x: number) => {
    let lo = 0, hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (xs[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const at = (x: number) => {
    const k = locate(Math.min(xs[n - 1], Math.max(xs[0], x)));
    return { k, t: (Math.min(xs[n - 1], Math.max(xs[0], x)) - xs[k]) / h[k], hk: h[k] };
  };

  return {
    x0: xs[0],
    x1: xs[n - 1],
    y(x) {
      const { k, t, hk } = at(x);
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * hk * d[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * hk * d[k + 1];
    },
    dy(x) {
      const { k, t, hk } = at(x);
      const t2 = t * t;
      return ((6 * t2 - 6 * t) * ys[k] + (3 * t2 - 4 * t + 1) * hk * d[k] + (-6 * t2 + 6 * t) * ys[k + 1] + (3 * t2 - 2 * t) * hk * d[k + 1]) / hk;
    },
    d2y(x) {
      const { k, t, hk } = at(x);
      return ((12 * t - 6) * ys[k] + (6 * t - 4) * hk * d[k] + (-12 * t + 6) * ys[k + 1] + (6 * t - 2) * hk * d[k + 1]) / (hk * hk);
    },
  };
}

/** What the track does to the cart at a place and a speed. */
export function contact(p: Profile, x: number, u: number, g = G) {
  const yp = p.dy(x), ypp = p.d2y(x);
  const s = Math.sqrt(1 + yp * yp); // ds/dx
  const sin = yp / s, cos = 1 / s;
  const kappa = ypp / (s * s * s);
  /** Normal force per unit mass: positive presses the cart onto the track. */
  const n = g * cos + kappa * u * u;
  return { s, sin, cos, kappa, n, gForce: n / g };
}

export interface SimOptions {
  /** Coefficient of friction. */
  mu?: number;
  /** Speed along the track at the start, m/s (the first control point, going right). */
  v0?: number;
  /** Cart mass, kg — energies scale with it. */
  mass?: number;
  g?: number;
  /** Give up after this long, s. */
  tMax?: number;
}

export interface Frame {
  t: number;
  x: number;
  y: number;
  /** Speed along the track, m/s (negative: rolling back). */
  u: number;
  /** J */
  ke: number;
  pe: number;
  heat: number;
  gForce: number;
  /** The track's slope angle, rad — for tilting the cart. */
  angle: number;
}

export type Status =
  | "finished" // reached the right end
  | "stopped" // came to rest on the track
  | "off-start" // rolled back off the left end
  | "running"; // still moving when time ran out (a swing that never settles)

export interface Run {
  /** About 60 per second, from the start to the end. */
  frames: Frame[];
  status: Status;
  /** Where it ended up, and how fast it was going. */
  endX: number;
  endSpeed: number;
  endTime: number;
  /** The furthest right the cart got — how far it came when it did not make it. */
  maxX: number;
  maxHeight: number;
  maxSpeed: number;
  maxG: number;
  minG: number;
  /** The first place the track would have to pull the cart down to keep it on, if any. */
  liftOffAt: number | null;
  heat: number;
  /** Largest departure of KE + PE + heat from its start value, relative to it. */
  energyError: number;
  startEnergy: number;
}

const DT = 1 / 1200;
const EVERY = 20; // a frame every 20 steps: 60 per second

/**
 * Releases the cart at the left end and rolls it until it leaves the track, stops or
 * time runs out. RK4 on (x, u, heat), 1200 steps a second. The one thing RK4 cannot do
 * is cross the kink of Coulomb friction at u = 0: if each stage re-reads the sign of u,
 * a cart creeping towards rest flips the force back and forth and never arrives. So the
 * direction friction acts in is read once, at the start of the step; a step that then
 * changes the sign of u is cut there — the cart is at rest for that instant, and stays
 * there if friction can hold it on that slope (|g·sinθ| ≤ μ·|N/m|), which is what
 * "stopped" means.
 */
export function simulate(p: Profile, opts: SimOptions = {}): Run {
  const mu = opts.mu ?? 0, m = opts.mass ?? 500, g = opts.g ?? G, tMax = opts.tMax ?? 60;
  let x = p.x0, u = Math.max(0, opts.v0 ?? 0), q = 0, t = 0;

  /** `dir`: which way the cart is sliding (+1 right, −1 left) for the whole step. */
  const f = (xx: number, uu: number, dir: number): [number, number, number] => {
    const c = contact(p, xx, uu, g);
    const fr = mu * Math.abs(c.n);
    return [uu / c.s, -g * c.sin - fr * dir, fr * Math.abs(uu)];
  };

  const frame = (): Frame => {
    const yy = p.y(x), c = contact(p, x, u, g);
    return { t, x, y: yy, u, ke: 0.5 * m * u * u, pe: m * g * yy, heat: m * q, gForce: c.gForce, angle: Math.atan(p.dy(x)) };
  };

  const e0 = m * (0.5 * u * u + g * p.y(x));
  const frames: Frame[] = [frame()];
  let status: Status = "running";
  let maxX = x, maxHeight = p.y(x), maxSpeed = Math.abs(u), maxG = frames[0].gForce, minG = maxG;
  let liftOffAt: number | null = frames[0].gForce < 0 ? x : null;
  let energyError = 0;

  const isStuck = () => {
    const c = contact(p, x, 0, g);
    return Math.abs(g * c.sin) <= mu * Math.abs(c.n) + 1e-12;
  };

  // Released from rest on a slope that friction can hold: it never moves.
  if (u === 0 && isStuck()) status = "stopped";

  const steps = Math.round(tMax / DT);
  for (let i = 1; i <= steps && status === "running"; i++) {
    // at rest, friction opposes the way gravity would start it moving
    const dir = u !== 0 ? sgn(u) : -sgn(contact(p, x, 0, g).sin);
    const [k1x, k1u, k1q] = f(x, u, dir);
    const [k2x, k2u, k2q] = f(x + 0.5 * DT * k1x, u + 0.5 * DT * k1u, dir);
    const [k3x, k3u, k3q] = f(x + 0.5 * DT * k2x, u + 0.5 * DT * k2u, dir);
    const [k4x, k4u, k4q] = f(x + DT * k3x, u + DT * k3u, dir);
    const nx = x + (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    let nu = u + (DT / 6) * (k1u + 2 * k2u + 2 * k3u + k4u);
    const nq = q + (DT / 6) * (k1q + 2 * k2q + 2 * k3q + k4q);
    t = i * DT;

    // the cart reversed or halted during this step: stop it there
    let reversed = false;
    if (u !== 0 && nu * u <= 0) {
      nu = 0;
      reversed = true;
    }
    x = nx;
    u = nu;
    q = nq;

    if (x >= p.x1) {
      x = p.x1;
      status = "finished";
    } else if (x <= p.x0) {
      x = p.x0;
      status = "off-start";
    } else if (reversed && isStuck()) {
      status = "stopped";
    }

    const yy = p.y(x), c = contact(p, x, u, g);
    maxX = Math.max(maxX, x);
    maxHeight = Math.max(maxHeight, yy);
    maxSpeed = Math.max(maxSpeed, Math.abs(u));
    maxG = Math.max(maxG, c.gForce);
    minG = Math.min(minG, c.gForce);
    if (liftOffAt === null && c.gForce < 0) liftOffAt = x;
    energyError = Math.max(energyError, Math.abs(m * (0.5 * u * u + g * yy + q) - e0) / e0);

    if (i % EVERY === 0 || status !== "running") frames.push(frame());
  }

  const last = frames[frames.length - 1];
  return {
    frames,
    status,
    endX: last.x,
    endSpeed: Math.abs(last.u),
    endTime: last.t,
    maxX,
    maxHeight,
    maxSpeed,
    maxG,
    minG,
    liftOffAt,
    heat: last.heat,
    energyError,
    startEnergy: e0,
  };
}

/** The frame at time t (linear in between), clamped to the run. */
export function frameAt(run: Run, t: number): Frame {
  const fr = run.frames;
  if (t <= fr[0].t) return fr[0];
  const last = fr[fr.length - 1];
  if (t >= last.t) return last;
  let lo = 0, hi = fr.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fr[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = fr[lo], b = fr[hi], w = (t - a.t) / (b.t - a.t);
  const mix = (p: number, r: number) => p + w * (r - p);
  return {
    t,
    x: mix(a.x, b.x),
    y: mix(a.y, b.y),
    u: mix(a.u, b.u),
    ke: mix(a.ke, b.ke),
    pe: mix(a.pe, b.pe),
    heat: mix(a.heat, b.heat),
    gForce: mix(a.gForce, b.gForce),
    angle: mix(a.angle, b.angle),
  };
}
