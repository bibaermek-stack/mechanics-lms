// "Асық ату": a row of asyqs stands in a ring, and each player in turn throws their sakha from the
// ring's edge to knock asyqs out of it. Every asyq that leaves the ring is won by the thrower.
//
// Nothing below is "the" rule of asyq: the ring's size, how many asyqs, what counts as out, the
// points, whether a lucky throw earns another, and when the game stops are all read from the
// RuleConfig, and a regional variant is a different config, not different code.

import { bodyOnFace } from "../placement";
import { ASYQ_LENGTH, SURFACES, type SurfaceId } from "../physics";
import { FACE_IDS } from "../faces";
import { heading, type Vec3 } from "../math";
import {
  FACE_ZERO,
  MAX_PLAYERS,
  MAX_THROWS_IN_GAME,
  RING,
  SAKHAS,
  SPACING,
  clamp,
  maxTargets,
  type EndCondition,
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

/** The longest name a player can have (the setup form stops typing here too). */
export const MAX_NAME = 24;

/**
 * Takes whatever was stored or typed and gives back a config of the right shape: a number where a number
 * belongs, one of the known words where a word is expected. A rule set saved by another version of the
 * game, or damaged in storage, would otherwise pass through as NaN or an unknown surface and only fail
 * when a throw was made. Returns how many values had to be replaced by the defaults.
 */
function sanitize(input: unknown): { config: RuleConfig; replaced: number } {
  const d = defaults();
  const raw = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  let replaced = 0;
  const num = (x: unknown, fallback: number) => {
    if (typeof x === "number" && Number.isFinite(x)) return x;
    if (x !== undefined) replaced++;
    return fallback;
  };
  const word = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T => {
    if ((allowed as readonly unknown[]).includes(x)) return x as T;
    if (x !== undefined) replaced++;
    return fallback;
  };
  const flag = (x: unknown, fallback: boolean) => {
    if (typeof x === "boolean") return x;
    if (x !== undefined) replaced++;
    return fallback;
  };

  let listed = Array.isArray(raw.players) ? raw.players : [];
  if (listed.length === 0) {
    if (raw.players !== undefined) replaced++;
    listed = d.players;
  }
  const players = listed.slice(0, 100).map((p, i) => {
    const r = (typeof p === "object" && p !== null ? p : {}) as Record<string, unknown>;
    const letters = [...(typeof r.name === "string" ? r.name : "").trim()];
    if (typeof r.name !== "string" || letters.length > MAX_NAME) replaced++;
    return {
      name: letters.slice(0, MAX_NAME).join("").trim() || `${i + 1}-ойыншы`,
      sakha: word(r.sakha, SAKHAS.map((s) => s.id), "ortasha"),
    };
  });

  const isObject = (x: unknown) => typeof x === "object" && x !== null;
  if (raw.end !== undefined && !isObject(raw.end)) replaced++;
  if (raw.faceBonus !== undefined && !isObject(raw.faceBonus)) replaced++;
  const e = (isObject(raw.end) ? raw.end : {}) as Record<string, unknown>;
  const kind = word(e.kind, ["cleared", "points", "throws"] as const, d.end.kind);
  const end: EndCondition = kind === "points" ? { kind, target: num(e.target, 10) } : kind === "throws" ? { kind, perPlayer: num(e.perPlayer, 3) } : { kind };

  const fb = (isObject(raw.faceBonus) ? raw.faceBonus : {}) as Record<string, unknown>;
  const faceBonus = { ...FACE_ZERO };
  for (const f of FACE_IDS) faceBonus[f] = num(fb[f], 0);

  if (raw.mode !== undefined && raw.mode !== "asyq-atu") replaced++;
  const config: RuleConfig = {
    mode: "asyq-atu",
    players,
    targetCount: num(raw.targetCount, d.targetCount),
    layout: word(raw.layout, ["line", "ring"] as const, d.layout),
    ringRadius: num(raw.ringRadius, d.ringRadius),
    setupFace: word(raw.setupFace, FACE_IDS, d.setupFace),
    surface: word(raw.surface, Object.keys(SURFACES) as SurfaceId[], d.surface),
    leaveRule: word(raw.leaveRule, ["centre", "whole"] as const, d.leaveRule),
    pointsPerAsyq: num(raw.pointsPerAsyq, d.pointsPerAsyq),
    faceBonus,
    turnRule: word(raw.turnRule, ["continue", "pass"] as const, d.turnRule),
    maxStreak: num(raw.maxStreak, d.maxStreak),
    end,
    refillWhenCleared: flag(raw.refillWhenCleared, d.refillWhenCleared),
    turnOrder: word(raw.turnOrder, ["sequence", "toss"] as const, d.turnOrder),
    allowSpin: flag(raw.allowSpin, d.allowSpin),
    seed: num(raw.seed, d.seed),
  };
  return { config, replaced };
}

function normalize(input: RuleConfig): { config: RuleConfig; notes: string[] } {
  const notes: string[] = [];
  const { config: c, replaced } = sanitize(input);
  if (replaced > 0) notes.push(`жарамсыз немесе тым ұзын мәндер түзетілді (${replaced})`);
  const note = (what: string, from: unknown, to: unknown) => {
    if (from !== to) notes.push(`${what}: ${String(from)} → ${String(to)}`);
  };

  const players = clamp(c.players.length, 1, MAX_PLAYERS);
  if (players !== c.players.length) {
    note("ойыншылар саны", c.players.length, players);
    c.players = c.players.slice(0, players);
  }

  const r = clamp(c.ringRadius, RING.min, RING.max);
  note("шеңбер радиусы", c.ringRadius, r);
  c.ringRadius = r;

  const n = clamp(Math.round(c.targetCount), 1, maxTargets(c.ringRadius, c.layout));
  note("нысанадағы асық саны", c.targetCount, n);
  c.targetCount = n;

  const pts = clamp(Math.round(c.pointsPerAsyq), 0, 20);
  note("асық үшін ұпай", c.pointsPerAsyq, pts);
  c.pointsPerAsyq = pts;
  for (const k of Object.keys(c.faceBonus) as (keyof typeof c.faceBonus)[]) {
    const bonus = clamp(Math.round(c.faceBonus[k]), -10, 20);
    note(`қырға қосымша ұпай (${k})`, c.faceBonus[k], bonus);
    c.faceBonus[k] = bonus;
  }

  const streak = clamp(Math.round(c.maxStreak), 1, 10);
  note("қатар лақтыру саны", c.maxStreak, streak);
  c.maxStreak = streak;
  if (c.end.kind === "points") {
    const target = clamp(Math.round(c.end.target), 1, 500);
    note("мақсатты ұпай", c.end.target, target);
    c.end = { kind: "points", target };
  }
  if (c.end.kind === "throws") {
    const perPlayer = clamp(Math.round(c.end.perPlayer), 1, 30);
    note("әр ойыншының лақтыруы", c.end.perPlayer, perPlayer);
    c.end = { kind: "throws", perPlayer };
  }
  // a game that ends on points can never end if no throw can earn any
  if (c.end.kind === "points" && c.pointsPerAsyq + Math.max(0, ...Object.values(c.faceBonus)) <= 0) {
    c.end = { kind: "cleared" };
    notes.push("ұпай берілмесе, ойын «нысана бос болғанда» аяқталады");
  }
  const seed = Math.round(c.seed) >>> 0;
  note("кездейсоқтық саны", c.seed, seed);
  c.seed = seed;
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
