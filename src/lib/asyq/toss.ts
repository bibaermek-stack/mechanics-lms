// Who throws first. In several versions of the game every player tosses their sakha and the side
// it lands on ranks them: алшы first, then тәйке, бүк, шік (faces.ts). Players who land on the
// same side toss again among themselves. The tosses are real physics — the same engine, the same
// bones — and seeded, so a game with the same seed always starts with the same order.

import { AsyqWorld, MAX_THROW_TIME } from "./physics";
import { FACE_INFO, type FaceId } from "./faces";
import { qNormalize, type Quat } from "./math";
import { seededRandom } from "../rng";
import { sakhaById, type RuleConfig } from "./rules";

export interface TossResult {
  player: number;
  face: FaceId | null;
  /** 1 (best) … 4; an edge or an end ranks last. */
  rank: number;
}

export interface Toss {
  order: number[];
  /** Every round of tossing, in order; later rounds are the tie-breaks. */
  rounds: TossResult[][];
}

const EDGE_RANK = 5;
const MAX_ROUNDS = 6;

function randomQuat(rnd: () => number): Quat {
  const u1 = rnd(), u2 = rnd() * 2 * Math.PI, u3 = rnd() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  return qNormalize([a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)]);
}

/** One sakha dropped from hand height at a random angle; the side it ends on. Needs loadPhysics() done. */
export function tossOne(config: RuleConfig, player: number, seed: number): TossResult {
  const rnd = seededRandom(seed);
  const sakha = sakhaById(config.players[player].sakha);
  const w = AsyqWorld.createReady({ surface: config.surface, hz: 480 });
  w.addBody({ id: "s", kind: "sakha", length: sakha.length, mass: sakha.mass, position: [0, 0.1 + rnd() * 0.05, 0], rotation: randomQuat(rnd) });
  w.launch("s", [(rnd() - 0.5) * 1.2, 0, (rnd() - 0.5) * 1.2], [(rnd() - 0.5) * 20, (rnd() - 0.5) * 20, (rnd() - 0.5) * 20]);
  while (!w.allAtRest() && w.time < MAX_THROW_TIME) w.step();
  const face = w.pose("s").face ?? null;
  w.dispose();
  return { player, face, rank: face ? FACE_INFO[face].rank : EDGE_RANK };
}

export function tossForOrder(config: RuleConfig): Toss {
  const rounds: TossResult[][] = [];
  const order: number[] = [];
  const settle = (group: number[], depth: number) => {
    if (group.length <= 1 || depth >= MAX_ROUNDS) {
      order.push(...group); // a lone player, or players still level after MAX_ROUNDS: seat order
      return;
    }
    const results = group.map((p) => tossOne(config, p, (config.seed * 1_000_003 + rounds.length * 7919 + p * 104_729) >>> 0));
    rounds.push(results);
    const ranks = [...new Set(results.map((r) => r.rank))].sort((a, b) => a - b);
    for (const rank of ranks) settle(results.filter((r) => r.rank === rank).map((r) => r.player), depth + 1);
  };
  settle(config.players.map((_, i) => i), 0);
  return { order, rounds };
}
