// Projectile motion for the "Снаряд атысы" game — and the physics it teaches.
//
// A body leaves the origin with speed v at angle θ above the horizontal and
// moves under gravity g alone (no air). With the launch point `h0` above the
// ground:
//
//   x(t) = v·cosθ·t                    y(t) = h0 + v·sinθ·t − g·t²/2
//
// From h0 = 0 the textbook results follow, and the tests check each of them:
//
//   time of flight   T = 2·v·sinθ / g
//   range            R = v²·sin2θ / g           (largest at 45°; θ and 90°−θ give the same R)
//   greatest height  H = v²·sin²θ / (2g)
//
// Everything here is pure, in SI units, with angles in degrees at the interface
// (that is what the sliders say) and radians inside.

export interface Planet {
  id: "earth" | "moon" | "mars" | "jupiter";
  name: string;
  /** Surface gravity, m/s². */
  g: number;
}

export const PLANETS: Record<Planet["id"], Planet> = {
  earth: { id: "earth", name: "Жер", g: 9.81 },
  moon: { id: "moon", name: "Ай", g: 1.62 },
  mars: { id: "mars", name: "Марс", g: 3.71 },
  jupiter: { id: "jupiter", name: "Юпитер", g: 24.79 },
};

export const V_MIN = 5;
export const V_MAX = 40;
export const ANGLE_MIN = 5;
export const ANGLE_MAX = 85;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Seconds until the body is back at height 0 (the positive root of y(t) = 0). */
export function flightTime(v: number, angleDeg: number, g: number, h0 = 0): number {
  const vy = v * Math.sin(rad(angleDeg));
  return (vy + Math.sqrt(vy * vy + 2 * g * h0)) / g;
}

/** Horizontal distance at which it comes down. */
export function rangeOf(v: number, angleDeg: number, g: number, h0 = 0): number {
  return v * Math.cos(rad(angleDeg)) * flightTime(v, angleDeg, g, h0);
}

/** Greatest height above the ground. */
export function maxHeight(v: number, angleDeg: number, g: number, h0 = 0): number {
  const vy = v * Math.sin(rad(angleDeg));
  return h0 + (vy * vy) / (2 * g);
}

export function positionAt(v: number, angleDeg: number, g: number, t: number, h0 = 0): { x: number; y: number } {
  const a = rad(angleDeg);
  return { x: v * Math.cos(a) * t, y: h0 + v * Math.sin(a) * t - (g * t * t) / 2 };
}

/** Height of the path above the ground at horizontal distance `x` (negative once it is underground). */
export function heightAtX(v: number, angleDeg: number, g: number, x: number, h0 = 0): number {
  const a = rad(angleDeg);
  const c = Math.cos(a);
  return h0 + x * Math.tan(a) - (g * x * x) / (2 * v * v * c * c);
}

/** The path as points, from launch to landing. `steps` segments. */
export function trajectory(v: number, angleDeg: number, g: number, steps = 80, h0 = 0): { x: number; y: number }[] {
  const T = flightTime(v, angleDeg, g, h0);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const p = positionAt(v, angleDeg, g, (T * i) / steps, h0);
    // Rounding can leave the last point a hair under the ground.
    return { x: p.x, y: i === steps ? 0 : p.y };
  });
}

// ---------------------------------------------------------------------------
// The game
// ---------------------------------------------------------------------------

export interface Wall {
  /** Distance from the gun, m. */
  x: number;
  /** Height, m. */
  h: number;
}

export interface ProjectileRound {
  planet: Planet;
  /** Distance to the target's centre, m. */
  target: number;
  /** A shot landing within this of the centre is a hit, m. */
  radius: number;
  wall: Wall | null;
}

export interface ProjectileBoard {
  rounds: ProjectileRound[];
}

/** Lessons where it is on offer: kinematics (motion under g) and dynamics (why g is the same for all). */
export const PROJECTILE_LESSONS = [2, 3];

export const PROJECTILE_ROUNDS = 5;
export const MAX_SHOTS = 4;
/** Points for a hit on the 1st, 2nd, 3rd, 4th shot. */
export const SHOT_POINTS = [100, 70, 45, 25] as const;
/** What turning the prediction on costs: the round is worth this share of its points. */
export const HINT_FACTOR = 0.7;

export type ShotOutcome =
  | { kind: "hit"; range: number; error: number }
  | { kind: "short"; range: number; error: number }
  | { kind: "long"; range: number; error: number }
  | { kind: "wall"; range: number; error: number; heightAtWall: number };

/**
 * What a shot does in a round. The wall is checked first: a shell that would have
 * cleared the target but not the wall never gets there.
 */
export function judgeShot(round: ProjectileRound, v: number, angleDeg: number): ShotOutcome {
  const g = round.planet.g;
  const range = rangeOf(v, angleDeg, g);
  const error = range - round.target;
  if (round.wall && range > round.wall.x) {
    const y = heightAtX(v, angleDeg, g, round.wall.x);
    if (y <= round.wall.h) return { kind: "wall", range, error, heightAtWall: y };
  }
  if (Math.abs(error) <= round.radius) return { kind: "hit", range, error };
  return { kind: error < 0 ? "short" : "long", range, error };
}

/**
 * What the shell actually flies: the whole parabola, or only as far as the wall
 * when it hits one. `steps` segments, so the last point is the end of the
 * flight — the landing spot, or the face of the wall.
 */
export function shotPath(
  round: ProjectileRound,
  v: number,
  angleDeg: number,
  steps = 70
): { x: number; y: number }[] {
  const g = round.planet.g;
  const outcome = judgeShot(round, v, angleDeg);
  if (outcome.kind !== "wall" || !round.wall) return trajectory(v, angleDeg, g, steps);
  const tWall = round.wall.x / (v * Math.cos(rad(angleDeg)));
  return Array.from({ length: steps + 1 }, (_, i) => positionAt(v, angleDeg, g, (tWall * i) / steps));
}

/**
 * Points for a round: the shot it was won on, times the hint penalty. A round
 * never won is worth nothing.
 */
export function roundPoints(hitOnShot: number | null, usedHint: boolean): number {
  if (hitOnShot === null || hitOnShot < 1 || hitOnShot > MAX_SHOTS) return 0;
  return Math.round(SHOT_POINTS[hitOnShot - 1] * (usedHint ? HINT_FACTOR : 1));
}

/** The game's score out of 100: the mean of the rounds. */
export function gameScore(points: number[]): number {
  if (points.length === 0) return 0;
  return Math.round(points.reduce((a, b) => a + b, 0) / points.length);
}

/**
 * The five rounds of a game. Two on Earth to learn the controls, then the Moon,
 * Mars and Jupiter in an order that depends on the seed — the same shot lands at
 * very different distances under each, which is the point. From round three a
 * wall stands between gun and target and a flat shot cannot get over it.
 *
 * Every round can be won with the controls as they are: the target is never
 * further than what 70 % of the top speed reaches on that planet, and a wall is
 * low enough for a 45° shot to clear with room to spare.
 */
export function buildProjectile(seed: number): ProjectileBoard {
  // A tiny generator of its own, so this file does not depend on the rest of the app.
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const others: Planet["id"][] = ["moon", "mars", "jupiter"];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const order: Planet["id"][] = ["earth", "earth", ...others];

  const rounds = order.map((id, i): ProjectileRound => {
    const planet = PLANETS[id];
    const reach = (0.7 * V_MAX * V_MAX) / planet.g; // the furthest a target may be
    const hi = Math.min(reach, 120);
    const target = Math.round(18 + rnd() * (hi - 18));
    const radius = Math.max(2, Math.round(target * 0.06 * 2) / 2);
    const wall =
      i >= 2
        ? {
            x: Math.round(target / 2),
            // Low enough that 45° clears it: at x = D/2 that shot is D/4 high.
            h: Math.round(target * (0.06 + rnd() * 0.06) * 2) / 2,
          }
        : null;
    return { planet, target, radius, wall };
  });
  return { rounds };
}
