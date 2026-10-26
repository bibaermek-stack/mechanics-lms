// The arena claims to be a faithful little mechanics lab: collisions conserve
// momentum, restitution decides how much kinetic energy survives, a kick obeys
// the third law, friction decays speed exponentially. These tests check each
// claim against the textbook formula, with the expected numbers worked out
// independently of the engine.

import { beforeEach, describe, expect, it } from "vitest";
import { createMatch, extrapolated, FIXED_H, isOver, readings, step } from "./physics";
import {
  BODY,
  DRIVE_FORCE,
  KICK_COOLDOWN,
  KICK_IMPULSE,
  KICK_REACH,
  PITCH,
  SPRINT_FACTOR,
  makeBall,
  makePlayer,
} from "./pitch";
import type { Disc, Input, MatchConfig, MatchState } from "./types";
import { NO_INPUT } from "./types";

const CONFIG: MatchConfig = { perSide: 1, duration: 180, goalLimit: 0 };
const H = FIXED_H;
const none = new Map<string, Input>();

/** A frictionless disc, so a single step changes velocity only through contact. */
function disc(id: string, x: number, y: number, vx: number, vy: number, m: number, r: number, e: number): Disc {
  return { id, x, y, vx, vy, m, r, restitution: e, damping: 0, kind: "player", team: 0 };
}

function run(state: MatchState, seconds: number, inputs: Map<string, Input> = none) {
  const n = Math.round(seconds / H);
  for (let i = 0; i < n; i++) step(state, H, inputs, CONFIG);
}

const momentum = (state: MatchState) => ({
  x: state.discs.reduce((a, d) => a + d.m * d.vx, 0),
  y: state.discs.reduce((a, d) => a + d.m * d.vy, 0),
});
const energy = (state: MatchState) => state.discs.reduce((a, d) => a + 0.5 * d.m * (d.vx ** 2 + d.vy ** 2), 0);

/** Deterministic pseudo-random numbers, so a failure can be reproduced. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

beforeEach(() => {
  // createMatch clears the module-level kick cooldowns.
  createMatch([], CONFIG);
});

describe("head-on collision between two discs", () => {
  // Masses 2 and 3 kg, speeds +5 and −3 m/s: p = 2·5 − 3·3 = 1 kg·m/s.
  const setup = (e: number) => {
    const a = disc("a", -0.1, 0, 5, 0, 2, 0.5, e);
    const b = disc("b", 0.1, 0, -3, 0, 3, 0.5, e);
    const state = createMatch([a, b], CONFIG);
    step(state, H, none, CONFIG);
    return { a, b, state };
  };

  it("elastic (e = 1): velocities follow the textbook formulas and kinetic energy is unchanged", () => {
    const { a, b, state } = setup(1);
    // v1' = ((m1 − m2)u1 + 2 m2 u2)/(m1 + m2) = (−5 − 18)/5 = −4.6
    // v2' = ((m2 − m1)u2 + 2 m1 u1)/(m1 + m2) = (−3 + 20)/5 =  3.4
    expect(a.vx).toBeCloseTo(-4.6, 9);
    expect(b.vx).toBeCloseTo(3.4, 9);
    expect(a.vy).toBe(0);
    const r = state.lastCollision!;
    expect(r.ekAfter).toBeCloseTo(r.ekBefore, 9);
    expect(r.ekBefore).toBeCloseTo(0.5 * 2 * 25 + 0.5 * 3 * 9, 9); // 38.5 J
  });

  it("perfectly inelastic (e = 0): they leave together, losing exactly ½μ·Δv² of energy", () => {
    const { a, b, state } = setup(0);
    // common velocity = p/(m1 + m2) = 1/5 = 0.2 m/s
    expect(a.vx).toBeCloseTo(0.2, 9);
    expect(b.vx).toBeCloseTo(0.2, 9);
    const mu = (2 * 3) / (2 + 3);
    const lost = state.lastCollision!.ekBefore - state.lastCollision!.ekAfter;
    expect(lost).toBeCloseTo(0.5 * mu * 8 ** 2, 9); // 38.4 J
  });

  it("partly elastic (e = 0.5): matches v1' = (m1u1 + m2u2 − m2·e·(u1−u2))/(m1+m2)", () => {
    const { a, b } = setup(0.5);
    expect(a.vx).toBeCloseTo((1 - 3 * 0.5 * 8) / 5, 9); // −2.2
    expect(b.vx).toBeCloseTo((1 + 2 * 0.5 * 8) / 5, 9); // 1.8
    // And the speed of separation is e times the speed of approach.
    expect(b.vx - a.vx).toBeCloseTo(0.5 * 8, 9);
  });

  it("conserves momentum for every restitution, to rounding", () => {
    for (const e of [0, 0.2, 0.35, 0.85, 1]) {
      const { state, a, b } = setup(e);
      expect(a.m * a.vx + b.m * b.vx).toBeCloseTo(1, 12);
      expect(state.lastCollision!.pAfter).toBeCloseTo(state.lastCollision!.pBefore, 12);
    }
  });

  it("equal masses, e = 1: the bodies swap velocities", () => {
    const a = disc("a", -0.1, 0, 4, 0, 1, 0.5, 1);
    const b = disc("b", 0.1, 0, -1, 0, 1, 0.5, 1);
    step(createMatch([a, b], CONFIG), H, none, CONFIG);
    expect(a.vx).toBeCloseTo(-1, 12);
    expect(b.vx).toBeCloseTo(4, 12);
  });

  it("bodies that are already separating are not given an impulse", () => {
    const a = disc("a", -0.1, 0, -2, 0, 2, 0.5, 1);
    const b = disc("b", 0.1, 0, 2, 0, 3, 0.5, 1);
    const state = createMatch([a, b], CONFIG);
    step(state, H, none, CONFIG);
    expect(a.vx).toBe(-2);
    expect(b.vx).toBe(2);
    expect(state.lastCollision).toBeNull();
  });

  it("the overlap is resolved, and the lighter body is the one that moves", () => {
    const heavy = disc("h", -0.1, 0, 0, 0, 1000, 0.5, 0.5);
    const light = disc("l", 0.1, 0, 0, 0, 1, 0.5, 0.5);
    step(createMatch([heavy, light], CONFIG), H, none, CONFIG);
    expect(Math.hypot(light.x - heavy.x, light.y - heavy.y)).toBeGreaterThanOrEqual(1 - 1e-9);
    expect(Math.abs(heavy.x + 0.1)).toBeLessThan(0.001);
    expect(light.x).toBeGreaterThan(0.5);
  });
});

describe("a collision off the line of centres", () => {
  it("only the normal component changes; the tangential component is untouched", () => {
    const a = disc("a", 0, 0, 4, 0, 2, 0.5, 1);
    const b = disc("b", Math.cos(Math.PI / 6) * 0.9, Math.sin(Math.PI / 6) * 0.9, 0, 0, 2, 0.5, 1);
    const state = createMatch([a, b], CONFIG);
    const p0 = momentum(state);

    // The step moves A on by 4·h *before* resolving the contact, so the line of
    // centres the impulse acts along is the one at that moment, not the starting 30°.
    const dx = b.x - (a.x + 4 * H);
    const dy = b.y - a.y;
    const n = { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
    const t = { x: -n.y, y: n.x };

    step(state, H, none, CONFIG);

    // Equal masses, e = 1, B at rest: B takes the normal part of A's velocity,
    // A keeps the tangential part.
    const un = 4 * n.x;
    const ut = 4 * t.x;
    expect(b.vx).toBeCloseTo(un * n.x, 9);
    expect(b.vy).toBeCloseTo(un * n.y, 9);
    expect(a.vx).toBeCloseTo(ut * t.x, 9);
    expect(a.vy).toBeCloseTo(ut * t.y, 9);
    const p1 = momentum(state);
    expect(p1.x).toBeCloseTo(p0.x, 9);
    expect(p1.y).toBeCloseTo(p0.y, 9);
  });
});

describe("collisions in general (randomised, reproducible)", () => {
  it("never change the system's total momentum vector or add kinetic energy, 500 random pile-ups", () => {
    const r = rng(20240807);
    for (let trial = 0; trial < 500; trial++) {
      const count = 2 + Math.floor(r() * 3);
      const discs = Array.from({ length: count }, (_, i) =>
        // Away from the boards, no friction, no kicks: only contacts act.
        disc(`d${i}`, (r() - 0.5) * 1.5, (r() - 0.5) * 1.5, (r() - 0.5) * 20, (r() - 0.5) * 20, 0.3 + r() * 80, 0.2 + r() * 0.4, r())
      );
      const state = createMatch(discs, CONFIG);
      const p0 = momentum(state);
      const e0 = energy(state);
      step(state, H, none, CONFIG);
      const p1 = momentum(state);
      const scale = Math.max(1, Math.hypot(p0.x, p0.y));
      expect(Math.abs(p1.x - p0.x) / scale).toBeLessThan(1e-9);
      expect(Math.abs(p1.y - p0.y) / scale).toBeLessThan(1e-9);
      // Restitution can only remove energy. (A few joules of slack: a pile-up
      // resolves its pairs one after another, which can hand energy between them.)
      expect(energy(state)).toBeLessThanOrEqual(e0 * 1.0000001 + 1e-9);
    }
  });
});

describe("player against ball", () => {
  it("a player barging a still ball sends it away fast and barely slows down", () => {
    const player = makePlayer("p", 0, 0, 1, "P");
    const ball = makeBall();
    player.x = -0.5; player.y = 0; player.vx = 5; player.damping = 0;
    ball.x = 0; ball.y = 0; ball.damping = 0;
    const state = createMatch([player, ball], CONFIG);
    step(state, H, none, CONFIG);

    const e = Math.min(BODY.player.restitution, BODY.ball.restitution); // the lower of the two
    const mp = BODY.player.m;
    const mb = BODY.ball.m;
    // Ball: (1 + e)·m_p/(m_p + m_b)·u.  Player: u − (1 + e)·m_b/(m_p + m_b)·u.
    expect(ball.vx).toBeCloseTo(((1 + e) * mp * 5) / (mp + mb), 9);
    expect(player.vx).toBeCloseTo(5 - ((1 + e) * mb * 5) / (mp + mb), 9);
    expect(player.vx).toBeGreaterThan(5 * 0.98); // the player lost under 2 % of its speed
    expect(ball.vx).toBeGreaterThan(5); // while the ball left faster than the player was going
    expect(state.lastCollision!.what).toBe("player-ball");
  });
});

describe("a kick (Newton's third law)", () => {
  const kickSetup = (gap: number) => {
    const player = makePlayer("p", 0, 0, 1, "P");
    const ball = makeBall();
    player.x = -3; player.y = 0;
    ball.x = player.x + player.r + ball.r + gap; ball.y = 0;
    const state = createMatch([player, ball], CONFIG);
    return { player, ball, state };
  };
  const kick = new Map<string, Input>([["p", { ...NO_INPUT, kick: true }]]);

  it("gives the ball J/m and the player −J/m, so total momentum does not change", () => {
    const { player, ball, state } = kickSetup(0.1);
    step(state, H, kick, CONFIG);
    const report = state.lastCollision!;
    expect(report.what).toBe("kick");
    expect(report.pBefore).toBeCloseTo(0, 12);
    expect(report.pAfter).toBeCloseTo(0, 9);

    // After the step's damping: v = (J/m)·exp(−k·h).
    const ballV = (KICK_IMPULSE / BODY.ball.m) * Math.exp(-BODY.ball.damping * H);
    const playerV = (-KICK_IMPULSE / BODY.player.m) * Math.exp(-BODY.player.damping * H);
    expect(ball.vx).toBeCloseTo(ballV, 9);
    expect(player.vx).toBeCloseTo(playerV, 9);
    expect(ball.vx).toBeGreaterThan(9); // "sends a still ball away at about 9 m/s"
    // The impulses themselves are equal and opposite. (The bodies' momenta no
    // longer cancel by the end of the step, but only because the ground then
    // damps the player ten times harder than the ball — an outside force.)
    expect(ball.m * ball.vx / Math.exp(-BODY.ball.damping * H)).toBeCloseTo(KICK_IMPULSE, 9);
    expect(player.m * player.vx / Math.exp(-BODY.player.damping * H)).toBeCloseTo(-KICK_IMPULSE, 9);
  });

  it("does not reach a ball that is too far away", () => {
    const { ball, state } = kickSetup(KICK_REACH + 0.05);
    step(state, H, kick, CONFIG);
    expect(ball.vx).toBe(0);
    expect(state.lastCollision).toBeNull();
  });

  it("holds the cooldown, then kicks again", () => {
    const { ball, state } = kickSetup(0.1);
    step(state, H, kick, CONFIG);
    const first = ball.vx;
    // Pull the ball back beside the player and try during the cooldown.
    ball.x = -3 + BODY.player.r + BODY.ball.r + 0.1; ball.vx = 0;
    run(state, KICK_COOLDOWN / 2, kick);
    expect(ball.vx).toBe(0);
    // After the cooldown the kick fires again, with the same impulse.
    ball.x = -3 + BODY.player.r + BODY.ball.r + 0.1; ball.vx = 0;
    run(state, KICK_COOLDOWN, kick);
    expect(ball.vx).toBeGreaterThan(first * 0.9);
  });
});

describe("friction and drive", () => {
  it("a free ball slows as v₀·e^(−k·t), and travels v₀/k·(1 − e^(−k·t))", () => {
    const ball = makeBall();
    ball.x = -6; ball.vx = 9;
    const state = createMatch([ball], CONFIG);
    run(state, 1);
    const k = BODY.ball.damping;
    expect(ball.vx).toBeCloseTo(9 * Math.exp(-k), 3);
    const expectedX = -6 + (9 / k) * (1 - Math.exp(-k));
    // One explicit step per 1/120 s: the position sum runs about k·h/2 = 0.2 % short of the integral.
    expect(Math.abs(ball.x - expectedX) / (expectedX + 6)).toBeLessThan(0.005);
  });

  it("a player from rest accelerates at F/m, then settles at F/(m·b)", () => {
    const player = makePlayer("p", 0, 0, 1, "P");
    player.x = 0; player.y = 0;
    const state = createMatch([player], CONFIG);
    const go = new Map<string, Input>([["p", { ...NO_INPUT, dx: 1 }]]);

    step(state, H, go, CONFIG);
    const a0 = DRIVE_FORCE / BODY.player.m;
    expect(player.drive).toBe(DRIVE_FORCE);
    expect(player.vx).toBeCloseTo(a0 * H * Math.exp(-BODY.player.damping * H), 9);

    // Left running, the speed approaches the balance point of drive and damping.
    // (Long enough to settle, short enough not to reach the boards.)
    player.x = -PITCH.hx + 1;
    for (let i = 0; i < 240; i++) {
      step(state, H, go, CONFIG);
      if (player.x > PITCH.hx - 1) player.x = -PITCH.hx + 1; // keep it on the pitch
    }
    const terminal = DRIVE_FORCE / (BODY.player.m * BODY.player.damping);
    expect(terminal).toBeCloseTo(2.579, 3);
    expect(player.vx).toBeCloseTo(terminal, 1);
    expect(player.vx).toBeLessThan(terminal + 1e-6); // never overshoots
  });

  it("sprinting multiplies the force, not the speed — the terminal speed rises by the same factor", () => {
    const player = makePlayer("p", 0, 0, 1, "P");
    const state = createMatch([player], CONFIG);
    const sprint = new Map<string, Input>([["p", { ...NO_INPUT, dx: 1, sprint: true }]]);
    step(state, H, sprint, CONFIG);
    expect(player.drive).toBeCloseTo(DRIVE_FORCE * SPRINT_FACTOR, 9);
    expect((DRIVE_FORCE * SPRINT_FACTOR) / (BODY.player.m * BODY.player.damping)).toBeCloseTo(4.9, 1);
  });

  it("diagonals are no faster than the axes", () => {
    const axis = makePlayer("a", 0, 0, 1, "A");
    const diag = makePlayer("d", 0, 0, 1, "D");
    axis.x = 0; axis.y = 0; diag.x = 0; diag.y = 0;
    const state = createMatch([axis, diag], CONFIG);
    // Far apart so they do not touch.
    diag.y = 5;
    run(state, 0.5, new Map<string, Input>([
      ["a", { ...NO_INPUT, dx: 1 }],
      ["d", { ...NO_INPUT, dx: 1, dy: 1 }],
    ]));
    expect(Math.hypot(diag.vx, diag.vy)).toBeCloseTo(Math.hypot(axis.vx, axis.vy), 9);
  });

  it("sprint stamina drains while sprinting and recovers at rest, within 0…1", () => {
    const player = makePlayer("p", 0, 0, 1, "P");
    const state = createMatch([player], CONFIG);
    const sprint = new Map<string, Input>([["p", { ...NO_INPUT, dx: 1, sprint: true }]]);
    player.x = -PITCH.hx + 1;
    for (let i = 0; i < 120; i++) { step(state, H, sprint, CONFIG); if (player.x > 2) player.x = -PITCH.hx + 1; }
    expect(player.stamina).toBeCloseTo(1 - 1 / 2.6, 2);
    run(state, 20);
    expect(player.stamina).toBe(1);
    // Holding sprint without moving costs nothing.
    const still = new Map<string, Input>([["p", { ...NO_INPUT, sprint: true }]]);
    run(state, 2, still);
    expect(player.stamina).toBe(1);
  });
});

describe("the boards", () => {
  it("a bounce off a wall loses speed by the restitution once — not once per contact pass", () => {
    const ball = makeBall();
    ball.damping = 0;
    ball.x = PITCH.hx - ball.r - 0.01; ball.y = 4; ball.vx = 10; // y = 4 is outside the goal mouth
    const state = createMatch([ball], CONFIG);
    step(state, H, none, CONFIG);
    expect(ball.vx).toBeCloseTo(-10 * BODY.ball.restitution, 9);
    expect(ball.x).toBeLessThanOrEqual(PITCH.hx - ball.r + 1e-12);
  });

  it("a ball never leaves the pitch at any speed, even a hundred times the normal one", () => {
    const ball = makeBall();
    ball.vx = 900; ball.vy = -700; ball.y = 3;
    const state = createMatch([ball], CONFIG);
    for (let i = 0; i < 600; i++) {
      step(state, H, none, CONFIG);
      expect(Number.isFinite(ball.x) && Number.isFinite(ball.y)).toBe(true);
      expect(Math.abs(ball.y)).toBeLessThanOrEqual(PITCH.hy - ball.r + 1e-9);
    }
  });

  it("the ball can enter the net through the goal mouth, a player cannot", () => {
    const ball = makeBall();
    const player = makePlayer("p", 0, 0, 1, "P");
    ball.x = PITCH.hx + 0.5; ball.y = 0;
    player.x = PITCH.hx + 0.5; player.y = 0;
    const state = createMatch([ball, player], { ...CONFIG });
    // Far apart in y so they do not collide: put the player outside the mouth line.
    player.y = 3;
    step(state, H, none, CONFIG);
    expect(ball.x).toBeGreaterThan(PITCH.hx);
    expect(player.x).toBeLessThanOrEqual(PITCH.hx - player.r + 1e-9);
  });

  it("a ball pinned in a corner by a player is not pushed into the boards or through the player", () => {
    const ball = makeBall();
    const player = makePlayer("p", 0, 0, 1, "P");
    ball.x = PITCH.hx - ball.r; ball.y = PITCH.hy - ball.r;
    player.x = ball.x - 0.9; player.y = ball.y - 0.9;
    const state = createMatch([ball, player], CONFIG);
    const push = new Map<string, Input>([["p", { ...NO_INPUT, dx: 1, dy: 1, sprint: true }]]);
    let deepest = 0;
    for (let i = 0; i < 480; i++) {
      step(state, H, push, CONFIG);
      expect(ball.x).toBeLessThanOrEqual(PITCH.hx - ball.r + 1e-9);
      expect(ball.y).toBeLessThanOrEqual(PITCH.hy - ball.r + 1e-9);
      deepest = Math.max(deepest, player.r + ball.r - Math.hypot(ball.x - player.x, ball.y - player.y));
    }
    // It used to sit a fifth of a metre inside the player for the rest of the match.
    expect(deepest).toBeLessThan(0.05);
  });
});

describe("goals, the clock and a whole match", () => {
  it("a ball wholly over the line in the mouth scores for the right team and stops play", () => {
    const ball = makeBall();
    ball.x = PITCH.hx + ball.r + 0.05; ball.y = 0;
    const state = createMatch([ball], CONFIG);
    step(state, H, none, CONFIG);
    expect(state.score).toEqual([1, 0]);
    expect(state.lastScorer).toBe(0);
    expect(state.celebrating).toBeGreaterThan(2);
  });

  it("the left goal scores for the other side", () => {
    const ball = makeBall();
    ball.x = -PITCH.hx - ball.r - 0.05; ball.y = 0.5;
    const state = createMatch([ball], CONFIG);
    step(state, H, none, CONFIG);
    expect(state.score).toEqual([0, 1]);
  });

  it("a ball touching the line is not yet a goal", () => {
    const ball = makeBall();
    ball.x = PITCH.hx; ball.y = 0;
    const state = createMatch([ball], CONFIG);
    step(state, H, none, CONFIG);
    expect(state.score).toEqual([0, 0]);
  });

  it("after the celebration everybody is back on their marks, stationary", () => {
    const ball = makeBall();
    const player = makePlayer("p", 0, 0, 1, "P");
    ball.x = PITCH.hx + ball.r + 0.05; ball.vx = 3;
    const state = createMatch([ball, player], CONFIG);
    run(state, 2.5);
    expect(ball.x).toBe(0);
    expect(ball.vx).toBe(0);
    expect(player.vx).toBe(0);
    expect(state.score).toEqual([1, 0]); // one goal, counted once
  });

  it("isOver: the clock, or the goal limit when there is one", () => {
    const s = createMatch([makeBall()], CONFIG);
    expect(isOver(s, CONFIG)).toBe(false);
    s.clock = 0;
    expect(isOver(s, CONFIG)).toBe(true);
    const limited = createMatch([makeBall()], { ...CONFIG, goalLimit: 3 });
    limited.score = [2, 3];
    expect(isOver(limited, { ...CONFIG, goalLimit: 3 })).toBe(true);
    limited.score = [2, 2];
    expect(isOver(limited, { ...CONFIG, goalLimit: 3 })).toBe(false);
  });

  it("the clock runs down by exactly the simulated time", () => {
    const s = createMatch([makeBall()], CONFIG);
    run(s, 10);
    expect(s.clock).toBeCloseTo(170, 6);
    expect(s.t).toBeCloseTo(10, 6);
  });

  it("a full 3-a-side match with random play stays finite, on the pitch and not absurdly fast", () => {
    const r = rng(42);
    const discs: Disc[] = [makeBall()];
    for (let team = 0; team < 2; team++) for (let i = 0; i < 3; i++) discs.push(makePlayer(`p${team}${i}`, team as 0 | 1, i, 3, `P${team}${i}`));
    const cfg: MatchConfig = { perSide: 3, duration: 60, goalLimit: 0 };
    const state = createMatch(discs, cfg);
    const inputs = new Map<string, Input>();
    for (let i = 0; i < 120 * 60; i++) {
      if (i % 30 === 0) {
        for (const d of discs) if (d.kind === "player") inputs.set(d.id, { dx: r() * 2 - 1, dy: r() * 2 - 1, kick: r() < 0.3, sprint: r() < 0.3 });
      }
      step(state, H, inputs, cfg);
      for (const d of discs) {
        if (!(Number.isFinite(d.x) && Number.isFinite(d.y) && Number.isFinite(d.vx) && Number.isFinite(d.vy))) throw new Error(`${d.id} went non-finite at step ${i}`);
        if (Math.abs(d.y) > PITCH.hy + 1e-6 || Math.abs(d.x) > PITCH.hx + PITCH.netDepth + 1e-6) throw new Error(`${d.id} left the pitch at step ${i}: ${d.x}, ${d.y}`);
        if (Math.hypot(d.vx, d.vy) > 60) throw new Error(`${d.id} reached ${Math.hypot(d.vx, d.vy)} m/s at step ${i}`);
      }
    }
    expect(state.t).toBeCloseTo(60, 6);
  });
});

describe("readouts", () => {
  it("readings() reports the speeds, momentum and energy of the bodies as they are", () => {
    const ball = makeBall();
    ball.vx = 3; ball.vy = 4;
    const player = makePlayer("p", 0, 0, 1, "P", true);
    player.vx = 0; player.vy = 2;
    player.drive = 390;
    const state = createMatch([ball, player], CONFIG);
    const r = readings(state);
    expect(r.ballSpeed).toBe(5);
    expect(r.ballMomentum).toBeCloseTo(0.44 * 5, 12);
    expect(r.totalMomentum).toBeCloseTo(Math.hypot(0.44 * 3, 0.44 * 4 + 72 * 2), 12);
    expect(r.totalEnergy).toBeCloseTo(0.5 * 0.44 * 25 + 0.5 * 72 * 4, 12);
    expect(r.myAccel).toBeCloseTo(390 / 72, 12);
  });

  it("extrapolated() moves a copy on by v·dt and leaves the original alone", () => {
    const ball = makeBall();
    ball.x = 1; ball.vx = 10;
    const state = createMatch([ball], CONFIG);
    const ahead = extrapolated(state, 0.05);
    expect(ahead.discs[0].x).toBeCloseTo(1.5, 12);
    expect(ball.x).toBe(1);
    expect(extrapolated(state, 0)).toBe(state);
  });
});
