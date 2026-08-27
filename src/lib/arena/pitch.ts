// The pitch, and the bodies that start on it.
//
// Sized like a futsal court rather than a full football pitch: at 24 × 14 m a
// pass crosses it in about two seconds, which is the pace this plays at.

import type { Disc, Team } from "./types";

export const PITCH = {
  /** Half-length and half-width of the playing surface, m. */
  hx: 12,
  hy: 7,
  /** Half-height of the goal mouth, m. */
  goalHalf: 1.8,
  /** How far behind the goal line the net reaches, m. */
  netDepth: 1.2,
} as const;

/** Ball and player sizes, masses and surface properties. */
export const BODY = {
  ball: {
    r: 0.22,
    /** A size-4 futsal ball. */
    m: 0.44,
    restitution: 0.85,
    /** Rolls a long way, but not for ever. */
    damping: 0.42,
  },
  player: {
    r: 0.42,
    /** A player, near enough. Two orders of magnitude above the ball, which is
     *  exactly why a shoulder barge sends the ball away and barely slows the
     *  player — the asymmetry the momentum lesson is about. */
    m: 72,
    restitution: 0.35,
    /** Boots on a court: stops quickly once you stop pushing. */
    damping: 4.2,
  },
} as const;

/** Drive force a player can apply, N. Gives a ≈ 11 m/s² and a top speed ≈ 6 m/s. */
export const DRIVE_FORCE = 780;
/** Impulse delivered by a kick, N·s. Sends a still ball away at about 9 m/s. */
export const KICK_IMPULSE = 4.0;
/** How far past the two radii a player can reach to kick, m. */
export const KICK_REACH = 0.28;
/** Seconds between kicks. */
export const KICK_COOLDOWN = 0.35;

/**
 * What sprinting multiplies the drive force by.
 *
 * It is a force, not a speed: a = F/m rises with it and so does the top speed
 * F/(m·b), but the player still takes time to get there. That is the second law
 * doing the work, and it is why a sprint is worth starting early.
 */
export const SPRINT_FACTOR = 1.9;
/** A full reserve is this many seconds of sprint. */
export const SPRINT_SECONDS = 2.6;
/** And this many seconds at rest to fill it again. */
export const SPRINT_RECOVERY = 5.5;

export const TEAM_NAMES: Record<Team, string> = { 0: "Қызыл", 1: "Көк" };
export const TEAM_COLORS: Record<Team, string> = { 0: "#ef4444", 1: "#3366ff" };

/** Where each player of a side lines up at kick-off, as a fraction of the half. */
const FORMATION: [number, number][][] = [
  [[-0.35, 0]],
  [[-0.62, 0], [-0.25, 0]],
  [[-0.72, 0], [-0.3, -0.45], [-0.3, 0.45]],
  [[-0.78, 0], [-0.42, -0.5], [-0.42, 0.5], [-0.16, 0]],
];

/** Kick-off position for one player, mirrored for the away side. */
export function formationSpot(team: Team, index: number, perSide: number): { x: number; y: number } {
  const rows = FORMATION[Math.min(perSide, FORMATION.length) - 1];
  const [fx, fy] = rows[Math.min(index, rows.length - 1)];
  const sign = team === 0 ? 1 : -1;
  return { x: fx * PITCH.hx * sign, y: fy * PITCH.hy };
}

export function makeBall(): Disc {
  return {
    id: "ball",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ...BODY.ball,
    kind: "ball",
  };
}

export function makePlayer(
  id: string,
  team: Team,
  index: number,
  perSide: number,
  name: string,
  local = false
): Disc {
  const spot = formationSpot(team, index, perSide);
  return {
    id,
    x: spot.x,
    y: spot.y,
    vx: 0,
    vy: 0,
    ...BODY.player,
    kind: "player",
    team,
    name,
    local,
    stamina: 1,
    drive: 0,
  };
}

/** Puts every body back on its kick-off mark and stops it dead. */
export function resetPositions(discs: Disc[], perSide: number) {
  const counts: Record<number, number> = { 0: 0, 1: 0 };
  for (const d of discs) {
    if (d.kind === "ball") {
      d.x = 0;
      d.y = 0;
    } else {
      const team = d.team ?? 0;
      const spot = formationSpot(team, counts[team]++, perSide);
      d.x = spot.x;
      d.y = spot.y;
    }
    d.vx = 0;
    d.vy = 0;
    // A restart gives everyone their legs back; otherwise the side that had
    // just been chasing would kick off a goal down on stamina as well.
    if (d.kind === "player") {
      d.stamina = 1;
      d.drive = 0;
    }
  }
}
