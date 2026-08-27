// Bot players.
//
// Deliberately simple and deliberately beatable: one chaser per side and the
// rest holding a shape. The bots reason in the same units as everything else,
// so "get behind the ball" is a real position on the pitch rather than a rule
// tuned against pixels.

import { PITCH, formationSpot } from "./pitch";
import type { Disc, Input, Team } from "./types";

/** Where a team is attacking: +1 shoots at the right-hand goal. */
function attackSign(team: Team) {
  return team === 0 ? 1 : -1;
}

function steer(from: Disc, tx: number, ty: number): { dx: number; dy: number } {
  const dx = tx - from.x;
  const dy = ty - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.05) return { dx: 0, dy: 0 };
  return { dx: dx / d, dy: dy / d };
}

/**
 * One bot's input for this step.
 *
 * `rank` is how close this bot is to the ball among its own side — rank 0
 * chases, everyone else holds a shape that slides toward the ball's side of the
 * pitch, which is enough to make them look like a team rather than a swarm.
 */
export function botInput(
  bot: Disc,
  ball: Disc,
  rank: number,
  index: number,
  perSide: number,
  difficulty = 1
): Input {
  const team = bot.team ?? 0;
  const sign = attackSign(team);

  if (rank === 0) {
    // Aim for the spot just behind the ball on the line to the opponent's goal,
    // so that arriving at it means arriving facing the right way.
    const goalX = PITCH.hx * sign;
    const toGoal = Math.hypot(goalX - ball.x, 0 - ball.y);
    const bx = ball.x - ((goalX - ball.x) / Math.max(toGoal, 0.001)) * (bot.r + ball.r);
    const by = ball.y - ((0 - ball.y) / Math.max(toGoal, 0.001)) * (bot.r + ball.r);
    const dir = steer(bot, bx, by);

    const dist = Math.hypot(ball.x - bot.x, ball.y - bot.y);
    // Kick when close and the ball is on the goal side, so the bot does not
    // hammer it back toward its own net.
    const facing = (ball.x - bot.x) * sign > -0.1;
    return { ...dir, kick: dist < bot.r + ball.r + 0.24 && facing, sprint: false };
  }

  // Holding players keep their formation depth but track the ball across.
  const spot = formationSpot(team, index, perSide);
  const targetY = spot.y * 0.5 + ball.y * 0.45;
  const targetX = spot.x + (ball.x - spot.x) * 0.25 * difficulty;
  const dir = steer(bot, targetX, Math.max(-PITCH.hy + 1, Math.min(PITCH.hy - 1, targetY)));
  // Bots never sprint: the reserve is the human's edge, and a chasing bot that
  // could always run them down would make the game unwinnable rather than hard.
  return { ...dir, kick: false, sprint: false };
}

/** Inputs for every bot on the pitch, keyed by disc id. */
export function botInputs(
  discs: Disc[],
  perSide: number,
  isBot: (d: Disc) => boolean,
  difficulty = 1
): Map<string, Input> {
  const out = new Map<string, Input>();
  const ball = discs.find((d) => d.kind === "ball");
  if (!ball) return out;

  for (const team of [0, 1] as Team[]) {
    const side = discs.filter((d) => d.kind === "player" && d.team === team);
    // Rank by distance to the ball; only the nearest chases.
    const ranked = [...side].sort(
      (a, b) =>
        Math.hypot(ball.x - a.x, ball.y - a.y) - Math.hypot(ball.x - b.x, ball.y - b.y)
    );
    ranked.forEach((d, rank) => {
      if (!isBot(d)) return;
      out.set(d.id, botInput(d, ball, rank, side.indexOf(d), perSide, difficulty));
    });
  }
  return out;
}
