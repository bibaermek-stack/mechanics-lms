// "Асық ату": a row of asyqs stands in a ring, and each player in turn throws their sakha from the
// ring's edge to knock asyqs out of it. Every asyq that leaves the ring is won by the thrower.
//
// Nothing below is "the" rule of asyq: the ring's size, how many asyqs, what counts as out, the
// points, whether a lucky throw earns another, and when the game stops are all read from the
// RuleConfig, and a regional variant is a different config, not different code.

import { bodyOnFace } from "../placement";
import { ASYQ_LENGTH } from "../physics";
import { heading, type Vec3 } from "../math";
import {
  FACE_ZERO,
  MAX_PLAYERS,
  MAX_THROWS_IN_GAME,
  RING,
  SPACING,
  clamp,
  maxTargets,
  type FieldLayout,
  type Judgement,
  type JudgeInput,
  type ModeDefinition,
  type NextDecision,
  type NextInput,
  type RuleConfig,
  type ScoredAsyq,
} from "../rules";

const defaults = (): RuleConfig => ({
  mode: "asyq-atu",
  players: [
    { name: "1-ойыншы", sakha: "ortasha" },
    { name: "2-ойыншы", sakha: "ortasha" },
  ],
  targetCount: 5,
  layout: "line",
  ringRadius: 0.6,
  setupFace: "alshy",
  surface: "topyraq",
  leaveRule: "centre",
  pointsPerAsyq: 1,
  faceBonus: { ...FACE_ZERO },
  turnRule: "continue",
  maxStreak: 3,
  end: { kind: "cleared" },
  refillWhenCleared: true,
  turnOrder: "sequence",
  allowSpin: true,
  seed: 1,
});

function normalize(input: RuleConfig): { config: RuleConfig; notes: string[] } {
  const notes: string[] = [];
  const c: RuleConfig = { ...input, players: input.players.map((p) => ({ ...p })), faceBonus: { ...FACE_ZERO, ...input.faceBonus } };
  const note = (what: string, from: unknown, to: unknown) => {
    if (from !== to) notes.push(`${what}: ${String(from)} → ${String(to)}`);
  };

  const players = clamp(Math.round(c.players.length), 1, MAX_PLAYERS);
  if (players !== c.players.length) {
    note("ойыншылар саны", c.players.length, players);
    c.players = c.players.slice(0, players);
  }
  c.players = c.players.map((p, i) => ({ name: p.name.trim() || `${i + 1}-ойыншы`, sakha: p.sakha }));

  const r = clamp(c.ringRadius, RING.min, RING.max);
  note("шеңбер радиусы", c.ringRadius, r);
  c.ringRadius = r;

  const n = clamp(Math.round(c.targetCount), 1, maxTargets(c.ringRadius, c.layout));
  note("нысанадағы асық саны", c.targetCount, n);
  c.targetCount = n;

  const pts = clamp(Math.round(c.pointsPerAsyq), 0, 20);
  note("асық үшін ұпай", c.pointsPerAsyq, pts);
  c.pointsPerAsyq = pts;
  for (const k of Object.keys(c.faceBonus) as (keyof typeof c.faceBonus)[]) c.faceBonus[k] = clamp(Math.round(c.faceBonus[k]), -10, 20);

  c.maxStreak = clamp(Math.round(c.maxStreak), 1, 10);
  if (c.end.kind === "points") c.end = { kind: "points", target: clamp(Math.round(c.end.target), 1, 500) };
  if (c.end.kind === "throws") c.end = { kind: "throws", perPlayer: clamp(Math.round(c.end.perPlayer), 1, 30) };
  // a game that ends on points can never end if no throw can earn any
  if (c.end.kind === "points" && c.pointsPerAsyq + Math.max(0, ...Object.values(c.faceBonus)) <= 0) {
    c.end = { kind: "cleared" };
    notes.push("ұпай берілмесе, ойын «нысана бос болғанда» аяқталады");
  }
  c.seed = Math.round(c.seed) >>> 0;
  return { config: c, notes };
}

function layout(config: RuleConfig, firstId: number): FieldLayout {
  const R = config.ringRadius;
  const n = config.targetCount;
  const bodies = [];
  if (config.layout === "line") {
    // standing in a row across the ring, through its middle, long axes along the row
    for (let i = 0; i < n; i++) {
      bodies.push(bodyOnFace({ id: `a${firstId + i}`, kind: "asyq", length: ASYQ_LENGTH, face: config.setupFace, x: 0, z: (i - (n - 1) / 2) * SPACING, yaw: Math.PI / 2 }));
    }
  } else {
    // standing round a smaller circle inside the ring, each facing along it
    const r = Math.max(0.1, (n * SPACING) / (2 * Math.PI), Math.min(0.5 * R, 0.25));
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n;
      bodies.push(bodyOnFace({ id: `a${firstId + i}`, kind: "asyq", length: ASYQ_LENGTH, face: config.setupFace, x: r * Math.cos(a), z: r * Math.sin(a), yaw: a + Math.PI / 2 }));
    }
  }
  const origin: Vec3 = [-R, 0, 0];
  return { zone: { centre: [0, 0], radius: R }, bodies, origin };
}

const dist2d = (p: Vec3, c: [number, number]) => Math.hypot(p[0] - c[0], p[2] - c[1]);

function judge(input: JudgeInput): Judgement {
  const { config, zone, before, after, contacts } = input;
  const out = (p: Vec3) => dist2d(p, zone.centre) > zone.radius + (config.leaveRule === "whole" ? ASYQ_LENGTH / 2 : 0);
  const startOf = new Map(before.map((b) => [b.id, b.position]));
  const scored: ScoredAsyq[] = [];
  const faces: Record<string, ScoredAsyq["face"]> = {};
  const moved: string[] = [];
  for (const b of after) {
    if (b.kind !== "asyq") continue;
    faces[b.id] = b.face;
    const was = startOf.get(b.id);
    if (was && Math.hypot(b.position[0] - was[0], b.position[2] - was[2]) > 0.01) moved.push(b.id);
    // an asyq is won once, and only if it was on the field before this throw
    if (was && out(b.position) && !scored.some((s) => s.id === b.id)) {
      const bonus = b.face ? config.faceBonus[b.face] : 0;
      scored.push({ id: b.id, face: b.face, base: config.pointsPerAsyq, bonus, points: config.pointsPerAsyq + bonus });
    }
  }
  const sakha = after.find((b) => b.kind === "sakha");
  const touched = new Set<string>();
  for (const [a, b] of contacts) {
    for (const [x, y] of [[a, b], [b, a]]) if (y.startsWith("a") && (x === "s" || x.startsWith("a"))) touched.add(y);
  }
  return {
    scored,
    points: scored.reduce((a, s) => a + s.points, 0),
    touched: [...touched].sort(),
    moved: moved.sort(),
    sakhaFace: sakha ? sakha.face : null,
    sakhaInZone: sakha ? !out(sakha.position) : false,
    faces,
  };
}

function next(input: NextInput): NextDecision {
  const { config, players, order, turnPos, streak, throwNo, scored, fieldLeft } = input;
  const end = config.end;
  const current = order[turnPos];
  const over = (reason: string): NextDecision => ({ turnPos, over: true, refill: false, reason });

  if (throwNo >= MAX_THROWS_IN_GAME) return over(`ойын ${MAX_THROWS_IN_GAME} лақтырудан ұзаққа созылмайды`);
  if (end.kind === "points" && players.some((p) => p.points >= end.target)) return over(`${end.target} ұпайға жетті`);
  if (end.kind === "cleared" && fieldLeft === 0) return over("нысанадағы асықтар таусылды");
  if (end.kind === "throws" && players.every((p) => p.throws >= end.perPlayer)) return over(`әрқайсысы ${end.perPlayer} реттен лақтырды`);
  // nothing left to throw at, and no fresh set to put down
  if (fieldLeft === 0 && !config.refillWhenCleared) return over("нысанадағы асықтар таусылды");
  const refill = fieldLeft === 0;

  // a player with the throws of a "throws each" game used up is skipped
  const hasThrows = (i: number) => end.kind !== "throws" || players[i].throws < end.perPlayer;
  if (scored > 0 && config.turnRule === "continue" && streak < config.maxStreak && hasThrows(current)) {
    return { turnPos, over: false, refill, reason: "асық ұтты: тағы лақтырады" };
  }
  for (let k = 1; k <= order.length; k++) {
    const pos = (turnPos + k) % order.length;
    if (hasThrows(order[pos])) return { turnPos: pos, over: false, refill, reason: pos === turnPos ? "кезек өзінде" : "кезек келесі ойыншыға" };
  }
  return over("лақтырулар таусылды");
}

export const asyqAtu: ModeDefinition = {
  id: "asyq-atu",
  name: "Асық ату",
  summary: "Шеңбер ішіне қатарлап тігілген асықтарды сақамен ұрып, шеңберден шығарасың. Шыққан асық — лақтырушыға.",
  available: true,
  defaults,
  normalize,
  layout,
  judge,
  next,
};

/** Heading of a throw from the thrower's position, given the yaw the player chose. */
export const throwHeading = (yaw: number) => heading(yaw);
