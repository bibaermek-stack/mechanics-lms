// What a game of asyq is made of, as data.
//
// Traditional asyq games differ by region and by variant, so nothing about scoring, which asyqs
// are won, or when the game ends is built into the engine. A game is a RuleConfig; a mode
// (modes/*.ts) is the code that reads one. "Асық ату" is the first mode; Ханталапай and Бес табан
// have a place in the registry already, and each mode keeps its own rules in its own file.

import type { BodyInit } from "./physics";
import type { SurfaceId } from "./physics";
import type { FaceId } from "./faces";
import type { Vec3 } from "./math";
import { ASYQ_LENGTH } from "./physics";

export type ModeId = "asyq-atu" | "hantalapai" | "bes-taban";
export type LayoutKind = "line" | "ring";
export type TurnRule = "continue" | "pass";
export type TurnOrder = "sequence" | "toss";
export type LeaveRule = "centre" | "whole";

export type EndCondition =
  /** The game ends when no asyq is left on the field. */
  | { kind: "cleared" }
  /** The first player to reach the target ends it (the field is refilled if it empties first). */
  | { kind: "points"; target: number }
  /** Every player throws this many times. */
  | { kind: "throws"; perPlayer: number };

export interface SakhaSpec {
  id: string;
  name: string;
  /** Kilograms. */
  mass: number;
  /** Long axis, metres. */
  length: number;
}

export const SAKHAS: readonly SakhaSpec[] = [
  { id: "jengil", name: "Жеңіл сақа", mass: 0.06, length: ASYQ_LENGTH * 1.4 },
  { id: "ortasha", name: "Орташа сақа", mass: 0.09, length: ASYQ_LENGTH * 1.5 },
  { id: "auyr", name: "Ауыр сақа", mass: 0.14, length: ASYQ_LENGTH * 1.6 },
];

export const sakhaById = (id: string): SakhaSpec => SAKHAS.find((s) => s.id === id) ?? SAKHAS[1];

export interface PlayerConfig {
  name: string;
  sakha: string;
}

export interface RuleConfig {
  mode: ModeId;
  players: PlayerConfig[];
  /** Asyqs set up on the field. */
  targetCount: number;
  layout: LayoutKind;
  /** Radius of the ring the asyqs must be knocked out of, metres. The thrower stands on its edge. */
  ringRadius: number;
  /** The side the asyqs are stood up on. */
  setupFace: FaceId;
  surface: SurfaceId;
  /** An asyq is won when it leaves the ring: by its centre, or only when all of it is out. */
  leaveRule: LeaveRule;
  pointsPerAsyq: number;
  /** Extra points for each won asyq, by the side it lies on. */
  faceBonus: Record<FaceId, number>;
  /** After a throw that won something: the thrower goes again, or the turn passes. */
  turnRule: TurnRule;
  /** Most throws in a row for one player, when turns continue. */
  maxStreak: number;
  end: EndCondition;
  /** Put a fresh set of asyqs down when the field empties and the game goes on. */
  refillWhenCleared: boolean;
  /** Who throws first: seat order, or by tossing the sakhas (the side each lies on ranks them). */
  turnOrder: TurnOrder;
  /** Offer spin when throwing. */
  allowSpin: boolean;
  /** Seeds the toss. */
  seed: number;
}

export const MAX_PLAYERS = 4;
export const MIN_TARGETS = 1;
export const RING = { min: 0.4, max: 1.6 } as const;
export const MAX_TARGETS = 12;
export const SPACING = ASYQ_LENGTH * 1.35;
/** Hard stop on a game's length, so no combination of rules can run for ever. */
export const MAX_THROWS_IN_GAME = 120;

export const FACE_ZERO: Record<FaceId, number> = { alshy: 0, tayke: 0, buk: 0, shik: 0 };

/** How many asyqs fit in a line across a ring of this radius with room to spare. */
export const maxTargets = (radius: number, layout: LayoutKind): number =>
  Math.min(
    MAX_TARGETS,
    layout === "line" ? Math.max(1, Math.floor((1.6 * radius) / SPACING) + 1) : Math.max(1, Math.floor((2 * Math.PI * radius * 0.5) / SPACING))
  );

export interface Zone {
  /** Centre of the ring on the floor (x, z). */
  centre: [number, number];
  radius: number;
}

/** A bone on the field. */
export interface FieldBody {
  id: string;
  position: Vec3;
  rotation: [number, number, number, number];
}

/** What a mode tells the game about a field it has laid out. */
export interface FieldLayout {
  zone: Zone;
  bodies: BodyInit[];
  /** Where the thrower stands (the sakha is released a hand's height above this). */
  origin: Vec3;
}

export interface ScoredAsyq {
  id: string;
  /** The side it lies on once stopped (null: on an edge or an end). */
  face: FaceId | null;
  base: number;
  bonus: number;
  points: number;
}

export interface Judgement {
  scored: ScoredAsyq[];
  /** Total for the throw. */
  points: number;
  /** Asyqs the sakha or another asyq touched. */
  touched: string[];
  /** Asyqs that ended farther than a centimetre from where they began. */
  moved: string[];
  sakhaFace: FaceId | null;
  sakhaInZone: boolean;
  /** Side each remaining asyq lies on after the throw. */
  faces: Record<string, FaceId | null>;
}

export interface FinalBody {
  id: string;
  kind: "asyq" | "sakha";
  position: Vec3;
  rotation: [number, number, number, number];
  face: FaceId | null;
}

export interface JudgeInput {
  config: RuleConfig;
  zone: Zone;
  /** Where each asyq on the field stood before the throw. */
  before: FieldBody[];
  /** Where everything ended. */
  after: FinalBody[];
  /** Pairs that touched during the throw (ids), in order. */
  contacts: [string, string][];
}

export interface NextInput {
  config: RuleConfig;
  /** Players' running state after this throw's points were added. */
  players: { points: number; throws: number }[];
  /** Player indices in turn order, and whose turn it was (a position in `order`). */
  order: number[];
  turnPos: number;
  /** Throws the current player has made in a row this turn, this one included. */
  streak: number;
  /** Throws made in the game, this one included. */
  throwNo: number;
  /** Asyqs this throw won. */
  scored: number;
  /** Asyqs left on the field. */
  fieldLeft: number;
}

export interface NextDecision {
  /** Position in `order` of whoever throws next (the same when the turn goes on). */
  turnPos: number;
  over: boolean;
  /** Put a fresh set on the field before the next throw. */
  refill: boolean;
  reason: string;
}

export interface ModeDefinition {
  id: ModeId;
  name: string;
  summary: string;
  /** False for modes that have a place in the registry but no rules yet. */
  available: boolean;
  defaults(): RuleConfig;
  /** Clamps a config to what this mode can play, and says what it changed. */
  normalize(config: RuleConfig): { config: RuleConfig; notes: string[] };
  layout(config: RuleConfig, firstId: number): FieldLayout;
  judge(input: JudgeInput): Judgement;
  next(input: NextInput): NextDecision;
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
