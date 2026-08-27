// Shared shapes for the arena — the two-dimensional physics football.
//
// Everything is in SI units: metres, seconds, kilograms. That is not decoration.
// The whole reason this game sits in a mechanics course is that its readouts can
// be compared with the lessons: a player carries a few hundred kg·m/s of
// momentum, a struck ball a handful, and the collision between them conserves
// their sum exactly. Working in pixels would have made every number meaningless.

export type Team = 0 | 1;

export interface Disc {
  id: string;
  /** Position of the centre, metres, origin at the centre spot. */
  x: number;
  y: number;
  /** Velocity, m/s. */
  vx: number;
  vy: number;
  /** Radius, m. */
  r: number;
  /** Mass, kg. */
  m: number;
  /** Coefficient of restitution used when this disc is in a collision. */
  restitution: number;
  /**
   * Velocity decay, s⁻¹. Stands in for rolling resistance and drag together:
   * v(t) = v₀·e^(−damping·t), which is what a ball rolling on grass does to a
   * good approximation.
   */
  damping: number;
  kind: "player" | "ball";
  team?: Team;
  /** Display name, for players. */
  name?: string;
  /** True for the disc this browser is driving. */
  local?: boolean;
  /** Set while the kick animation plays out. */
  kickFlash?: number;
}

/** One player's controls for a single step. */
export interface Input {
  /** Drive direction, each component in [−1, 1]. */
  dx: number;
  dy: number;
  /** Kick held down. */
  kick: boolean;
}

export const NO_INPUT: Input = { dx: 0, dy: 0, kick: false };

/**
 * What the last disc-to-disc collision did, latched at the moment it happened.
 *
 * Read live, the totals would be meaningless: the walls and friction are outside
 * forces, so the system's momentum changes all the time. Latching the pair at
 * the instant they touch is the only way the conservation law is visible — the
 * same reason the momentum simulation latches its before and after.
 */
export interface CollisionReport {
  /** Simulated time of the collision, s. */
  t: number;
  what: "player-ball" | "player-player" | "kick";
  /** Total momentum of the two bodies, kg·m/s. */
  pBefore: number;
  pAfter: number;
  /** Total kinetic energy of the two bodies, J. */
  ekBefore: number;
  ekAfter: number;
}

export interface MatchState {
  /** Simulated time since kick-off, s. */
  t: number;
  discs: Disc[];
  score: [number, number];
  /** Seconds left in the half. */
  clock: number;
  /** Set while a goal is being celebrated and play is stopped. */
  celebrating: number;
  /** Which team just scored, for the banner. */
  lastScorer: Team | null;
  lastCollision: CollisionReport | null;
}

/** Everything about a match that both ends have to agree on. */
export interface MatchConfig {
  /** Players per side, including the human. */
  perSide: number;
  /** Length of a half, seconds. */
  duration: number;
  /** Goals needed to end it early (0 = play the clock out). */
  goalLimit: number;
}

export const DEFAULT_CONFIG: MatchConfig = {
  perSide: 3,
  duration: 180,
  goalLimit: 5,
};
