// The arena's physics: Newton's laws, impulse-based collisions, friction.
//
// Every collision is resolved by applying equal and opposite impulses to the two
// bodies, which is Newton's third law written as one line of code — and it is
// what makes momentum conserved exactly rather than approximately. The engine
// latches each collision's before and after totals so the game can show that.
//
// Walls are the exception, and deliberately so: a wall is a body of infinite
// mass bolted to the ground, so a bounce off one changes the system's momentum.
// The readout says as much rather than pretending otherwise.

import {
  DRIVE_FORCE,
  KICK_COOLDOWN,
  KICK_IMPULSE,
  KICK_REACH,
  PITCH,
  SPRINT_FACTOR,
  SPRINT_RECOVERY,
  SPRINT_SECONDS,
  resetPositions,
} from "./pitch";
import type { CollisionReport, Disc, Input, MatchConfig, MatchState, Team } from "./types";
import { NO_INPUT } from "./types";

/** Physics step. Small enough that a 9 m/s ball moves 7,5 cm between steps. */
export const FIXED_H = 1 / 120;

/**
 * Position passes per step.
 *
 * One pass separates a pair. It takes more than one to settle a pile-up,
 * because pushing A off B can push A into C — and a corner, where two players
 * and the ball meet the boards at once, is exactly that case.
 */
const CONTACT_PASSES = 4;

/** Kick cooldowns, kept outside the state so snapshots stay small. */
const cooldowns = new Map<string, number>();

function kinetic(d: Disc) {
  return 0.5 * d.m * (d.vx * d.vx + d.vy * d.vy);
}

/** Magnitude of the summed momentum vector of two bodies, kg·m/s. */
function pairMomentum(a: Disc, b: Disc) {
  const px = a.m * a.vx + b.m * b.vx;
  const py = a.m * a.vy + b.m * b.vy;
  return Math.hypot(px, py);
}

/**
 * Resolves one circle-on-circle collision.
 *
 * The impulse that separates them is j = −(1+e)·v_rel·n / (1/m₁ + 1/m₂); each
 * body gets j/m of velocity change along the normal, in opposite directions.
 * Because the two impulses are equal and opposite, Σp comes out unchanged no
 * matter what e is — only the kinetic energy falls, by the amount e takes out.
 */
function collide(a: Disc, b: Disc, t: number, impulse: boolean): CollisionReport | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const overlap = a.r + b.r - dist;
  if (overlap <= 0 || dist < 1e-9) return null;

  const nx = dx / dist;
  const ny = dy / dist;

  // Push them apart first, in inverse proportion to their masses, so the heavy
  // body barely moves. Without this they sink into each other and stick.
  const invA = 1 / a.m;
  const invB = 1 / b.m;
  const totalInv = invA + invB;
  const shareA = overlap * (invA / totalInv);
  const shareB = overlap * (invB / totalInv);
  // Whatever the boards refuse to let one body take, the other one takes
  // instead — see `shove`. Without the hand-back the mass split alone would
  // push a ball trapped against a board straight through it.
  const stuckA = shove(a, -nx * shareA, -ny * shareA);
  const stuckB = shove(b, nx * shareB, ny * shareB);
  shove(b, -stuckA.dx, -stuckA.dy);
  shove(a, -stuckB.dx, -stuckB.dy);

  if (!impulse) return null;

  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn > 0) return null; // already separating

  const pBefore = pairMomentum(a, b);
  const ekBefore = kinetic(a) + kinetic(b);

  const e = Math.min(a.restitution, b.restitution);
  const j = (-(1 + e) * vn) / totalInv;
  a.vx -= (j * nx) / a.m;
  a.vy -= (j * ny) / a.m;
  b.vx += (j * nx) / b.m;
  b.vy += (j * ny) / b.m;

  return {
    t,
    what: a.kind === "player" && b.kind === "player" ? "player-player" : "player-ball",
    pBefore,
    pAfter: pairMomentum(a, b),
    ekBefore,
    ekAfter: kinetic(a) + kinetic(b),
  };
}

/** How far the centre of a disc may travel, m. Only a ball may enter a net. */
function bounds(d: Disc) {
  const inGoalMouth = Math.abs(d.y) < PITCH.goalHalf;
  const limitX = inGoalMouth && d.kind === "ball" ? PITCH.hx + PITCH.netDepth : PITCH.hx;
  return {
    minX: -limitX + d.r,
    maxX: limitX - d.r,
    minY: -PITCH.hy + d.r,
    maxY: PITCH.hy - d.r,
  };
}

/**
 * Moves `d` as far as the boards allow, and reports the part it could not take.
 *
 * A body pressed against a board cannot give way: the board is holding it there.
 * So the displacement it cannot accept has to go somewhere, and the only place
 * left is the body pushing it — which is the board's reaction force arriving by
 * a different route. Dropping it instead is what let a ball pinned in a corner
 * be shoved into the wall on every step, clamped back out, and left sitting a
 * fifth of a metre inside the player leaning on it for the rest of the match.
 */
function shove(d: Disc, dx: number, dy: number): { dx: number; dy: number } {
  const b = bounds(d);
  const wantX = d.x + dx;
  const wantY = d.y + dy;
  const gotX = Math.min(Math.max(wantX, b.minX), b.maxX);
  const gotY = Math.min(Math.max(wantY, b.minY), b.maxY);
  d.x = gotX;
  d.y = gotY;
  return { dx: wantX - gotX, dy: wantY - gotY };
}

/** Puts a disc back inside the boards without touching its velocity. */
function clampToPitch(d: Disc) {
  shove(d, 0, 0);
}

/**
 * Bounces a disc off the boards, and off the posts and back of the net.
 *
 * Runs once per step, straight after the integration, so the reflection belongs
 * to the motion that actually reached the board. The contact passes that follow
 * only clamp, or a body held against a board would have its velocity flipped
 * four times over and lose e⁴ of it instead of e.
 */
function wallBounce(d: Disc) {
  const b = bounds(d);
  if (d.x < b.minX) {
    d.x = b.minX;
    d.vx = Math.abs(d.vx) * d.restitution;
  } else if (d.x > b.maxX) {
    d.x = b.maxX;
    d.vx = -Math.abs(d.vx) * d.restitution;
  }
  if (d.y < b.minY) {
    d.y = b.minY;
    d.vy = Math.abs(d.vy) * d.restitution;
  } else if (d.y > b.maxY) {
    d.y = b.maxY;
    d.vy = -Math.abs(d.vy) * d.restitution;
  }
}

/** True once the ball is wholly over the line inside the mouth. */
function goalScored(ball: Disc): Team | null {
  if (Math.abs(ball.y) >= PITCH.goalHalf) return null;
  if (ball.x - ball.r > PITCH.hx) return 0;
  if (ball.x + ball.r < -PITCH.hx) return 1;
  return null;
}

/**
 * A kick is an impulse, not a teleport: the ball gains J/m_ball and the player
 * loses J/m_player in the opposite direction. The recoil is tiny — the player
 * outweighs the ball a hundred and sixty times over — but it is there, and it
 * is the third law the lesson asks about.
 */
function tryKick(player: Disc, ball: Disc, t: number): CollisionReport | null {
  const until = cooldowns.get(player.id) ?? 0;
  if (t < until) return null;

  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist > player.r + ball.r + KICK_REACH || dist < 1e-6) return null;

  const pBefore = pairMomentum(player, ball);
  const ekBefore = kinetic(player) + kinetic(ball);

  const nx = dx / dist;
  const ny = dy / dist;
  ball.vx += (KICK_IMPULSE * nx) / ball.m;
  ball.vy += (KICK_IMPULSE * ny) / ball.m;
  player.vx -= (KICK_IMPULSE * nx) / player.m;
  player.vy -= (KICK_IMPULSE * ny) / player.m;

  cooldowns.set(player.id, t + KICK_COOLDOWN);
  player.kickFlash = 0.18;

  return {
    t,
    what: "kick",
    pBefore,
    pAfter: pairMomentum(player, ball),
    ekBefore,
    ekAfter: kinetic(player) + kinetic(ball),
  };
}

export function createMatch(discs: Disc[], config: MatchConfig): MatchState {
  cooldowns.clear();
  return {
    t: 0,
    discs,
    score: [0, 0],
    clock: config.duration,
    celebrating: 0,
    lastScorer: null,
    lastCollision: null,
  };
}

/**
 * Advances the match by exactly `h` seconds.
 *
 * `inputs` is keyed by disc id; anything without an entry simply coasts, which
 * is what lets the same function drive a local match, a bot-filled one and the
 * host's copy of an online one without knowing the difference.
 */
export function step(state: MatchState, h: number, inputs: Map<string, Input>, config: MatchConfig) {
  state.t += h;

  if (state.celebrating > 0) {
    state.celebrating = Math.max(0, state.celebrating - h);
    if (state.celebrating === 0) resetPositions(state.discs, config.perSide);
    return;
  }

  if (state.clock > 0) state.clock = Math.max(0, state.clock - h);

  const ball = state.discs.find((d) => d.kind === "ball");

  for (const d of state.discs) {
    if (d.kickFlash) d.kickFlash = Math.max(0, d.kickFlash - h);

    if (d.kind === "player") {
      const input = inputs.get(d.id) ?? NO_INPUT;
      // Normalise the drive so diagonals are not faster than the axes.
      const mag = Math.hypot(input.dx, input.dy);
      const reserve = d.stamina ?? 1;
      // Sprinting only costs, and only pays, while the player is actually
      // driving: holding the key still on the spot would otherwise burn the
      // reserve for nothing.
      const sprinting = Boolean(input.sprint) && mag > 1e-6 && reserve > 0;
      const force = DRIVE_FORCE * (sprinting ? SPRINT_FACTOR : 1);
      // What is actually applied, not what a fully deflected stick would apply:
      // an analogue stick at 45 % asks for 45 % of the force, and a readout that
      // said 780 N while the body felt 351 N would be teaching the wrong number.
      d.drive = force * Math.min(mag, 1);
      d.stamina = Math.min(
        1,
        Math.max(0, reserve + (sprinting ? -h / SPRINT_SECONDS : h / SPRINT_RECOVERY))
      );

      if (mag > 1e-6) {
        const ux = input.dx / Math.max(mag, 1);
        const uy = input.dy / Math.max(mag, 1);
        d.vx += ((force * ux) / d.m) * h;
        d.vy += ((force * uy) / d.m) * h;
      }
      if (input.kick && ball) {
        const report = tryKick(d, ball, state.t);
        if (report) state.lastCollision = report;
      }
    }

    // Friction and drag together, as an exponential decay of speed.
    const decay = Math.exp(-d.damping * h);
    d.vx *= decay;
    d.vy *= decay;

    d.x += d.vx * h;
    d.y += d.vy * h;
  }

  // The boards act on the motion that has just happened, once. Everything after
  // this only moves bodies apart, and treats the boards as a hard limit.
  for (const d of state.discs) wallBounce(d);

  for (let pass = 0; pass < CONTACT_PASSES; pass++) {
    for (let i = 0; i < state.discs.length; i++) {
      for (let k = i + 1; k < state.discs.length; k++) {
        const report = collide(state.discs[i], state.discs[k], state.t, pass === 0);
        if (report) state.lastCollision = report;
      }
    }
    for (const d of state.discs) clampToPitch(d);
  }

  if (ball) {
    const scorer = goalScored(ball);
    if (scorer !== null) {
      state.score[scorer] += 1;
      state.lastScorer = scorer;
      state.celebrating = 2.2;
    }
  }
}

/** True once the clock has run out or one side has reached the goal limit. */
export function isOver(state: MatchState, config: MatchConfig): boolean {
  if (state.clock <= 0) return true;
  if (config.goalLimit > 0) {
    return state.score[0] >= config.goalLimit || state.score[1] >= config.goalLimit;
  }
  return false;
}

/**
 * A snapshot moved forward by `dt`, for drawing only.
 *
 * The server publishes twenty times a second and the screen draws sixty, so
 * three frames in four would otherwise repeat the last one and the ball would
 * visibly stutter. Carrying each body on at its own velocity for the age of the
 * snapshot costs one array and hides the gap; it is never fed back into the
 * simulation, so it cannot drift into it.
 */
export function extrapolated(state: MatchState, dt: number): MatchState {
  if (dt <= 0) return state;
  return {
    ...state,
    discs: state.discs.map((d) => ({ ...d, x: d.x + d.vx * dt, y: d.y + d.vy * dt })),
  };
}

/** Live numbers for the physics panel. */
export function readings(state: MatchState) {
  const ball = state.discs.find((d) => d.kind === "ball");
  let ek = 0;
  let px = 0;
  let py = 0;
  for (const d of state.discs) {
    ek += kinetic(d);
    px += d.m * d.vx;
    py += d.m * d.vy;
  }
  // The disc this browser drives, so the panel can show the second law on the
  // one body the player is actually pushing: F is what the keys ask for and
  // a = F/m is what the body does about it.
  const mine = state.discs.find((d) => d.local);
  return {
    ballSpeed: ball ? Math.hypot(ball.vx, ball.vy) : 0,
    ballMomentum: ball ? ball.m * Math.hypot(ball.vx, ball.vy) : 0,
    totalMomentum: Math.hypot(px, py),
    totalEnergy: ek,
    mySpeed: mine ? Math.hypot(mine.vx, mine.vy) : 0,
    myDrive: mine?.drive ?? 0,
    myAccel: mine ? (mine.drive ?? 0) / mine.m : 0,
    myStamina: mine?.stamina ?? 0,
  };
}
