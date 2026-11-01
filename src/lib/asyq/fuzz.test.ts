// Games played with rules and throws nobody chose by hand, checked against what must always be true of a
// game of asyq whatever its rules: nothing scored twice, nothing lost, every throw honest, the end where
// the rules put it. Seeded, so a failure names the game that broke it and replays exactly.

import { beforeAll, describe, expect, it } from "vitest";
import { AsyqGame } from "./game";
import { getMode } from "./modes";
import { loadPhysics, SURFACES, type SurfaceId } from "./physics";
import { MAX_PLAYERS, MAX_THROWS_IN_GAME, SAKHAS, type EndCondition, type LayoutKind, type RuleConfig } from "./rules";
import { OVERLAP_LIMIT } from "./simulate";
import { FACE_IDS } from "./faces";
import type { ThrowParams } from "./throw";

beforeAll(async () => {
  await loadPhysics();
});

/** Small, fast, good enough: the same numbers for the same seed on every machine. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mode = getMode("asyq-atu");
const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

function randomConfig(seed: number): RuleConfig {
  const r = rng(seed);
  const d = mode.defaults();
  const players = 1 + Math.floor(r() * MAX_PLAYERS);
  const endKinds: EndCondition[] = [
    { kind: "cleared" },
    { kind: "points", target: 1 + Math.floor(r() * 8) },
    { kind: "throws", perPlayer: 1 + Math.floor(r() * 4) },
  ];
  const raw: RuleConfig = {
    ...d,
    players: Array.from({ length: players }, (_, i) => ({ name: `Ойыншы ${i + 1}`, sakha: pick(r, SAKHAS).id })),
    targetCount: 1 + Math.floor(r() * 8),
    layout: pick<LayoutKind>(r, ["line", "ring"]),
    ringRadius: 0.4 + r() * 1.2,
    setupFace: pick(r, FACE_IDS),
    surface: pick(r, Object.keys(SURFACES) as SurfaceId[]),
    leaveRule: pick(r, ["centre", "whole"] as const),
    pointsPerAsyq: Math.floor(r() * 4),
    faceBonus: { alshy: Math.floor(r() * 5) - 2, tayke: Math.floor(r() * 5) - 2, buk: Math.floor(r() * 5) - 2, shik: Math.floor(r() * 5) - 2 },
    turnRule: pick(r, ["continue", "pass"] as const),
    maxStreak: 1 + Math.floor(r() * 4),
    end: pick(r, endKinds),
    refillWhenCleared: r() < 0.6,
    turnOrder: pick(r, ["sequence", "toss"] as const),
    allowSpin: r() < 0.7,
    seed: Math.floor(r() * 1e6),
  };
  return mode.normalize(raw).config;
}

function randomThrow(r: () => number): ThrowParams {
  // mostly sensible throws, sometimes the extremes and the nonsense the game must also survive
  const wild = r() < 0.2;
  return {
    yaw: wild ? (r() < 0.5 ? -1 : 1) * r() * 3 : (r() - 0.5) * 0.5,
    power: wild ? (r() < 0.5 ? 0 : 1) : r(),
    spin: wild ? (r() - 0.5) * 4 : (r() - 0.5) * 1.2,
    roll: wild ? (r() - 0.5) * 4 : (r() - 0.5) * 1.2,
  };
}

// FUZZ_SEEDS=100-140 plays that many more games, for a long run; the default few keep the suite quick
const range = (process.env.FUZZ_SEEDS ?? "").match(/^(\d+)-(\d+)$/);
const GAMES = range ? Array.from({ length: +range[2] - +range[1] + 1 }, (_, i) => +range[1] + i) : [3, 8, 14, 21, 27, 33];

describe("whole games on random rules", () => {
  for (const seed of GAMES) {
    it(`game ${seed}: every rule that must hold, holds, throw by throw`, async () => {
      const config = randomConfig(seed);
      const label = `game ${seed} (${config.players.length} players, ${config.targetCount} asyqs, ${config.layout}, R=${config.ringRadius.toFixed(2)}, ${config.surface}, ${config.leaveRule}, end ${JSON.stringify(config.end)}, ${config.turnRule}, bonus ${JSON.stringify(config.faceBonus)})`;
      const g = await AsyqGame.create(config, false);
      const r = rng(seed * 7919);
      expect(g.start()).toBe(true);

      let created = config.targetCount; // asyqs ever put on the field
      let prevNextId = g.state.nextId;
      let guard = 0;
      while (g.state.phase !== "finished") {
        expect(++guard, `${label}: ran away`).toBeLessThanOrEqual(MAX_THROWS_IN_GAME + 1);
        expect(g.state.phase, label).toBe("aiming");
        const before = g.state;
        const rec = g.playThrow(randomThrow(r));
        expect(rec, `${label}: throw ${guard} was not played (${g.refusals.at(-1)})`).not.toBeNull();
        const s = g.state;

        // the throw was honest
        expect(rec!.simulation.settled, `${label}: throw ${rec!.no} did not settle`).toBe(true);
        expect(rec!.simulation.clean, `${label}: throw ${rec!.no} overlapped ${(rec!.simulation.maxOverlap * 1000).toFixed(2)} mm`).toBe(true);
        expect(rec!.simulation.maxOverlap).toBeLessThanOrEqual(OVERLAP_LIMIT);

        // the right player threw, and the history grew by one
        expect(s.history).toHaveLength(before.history.length + 1);
        expect(rec!.no).toBe(before.history.length + 1);
        expect(rec!.playerIndex).toBe(before.order[before.turnPos]);
        expect(s.players[rec!.playerIndex].throws).toBe(before.players[rec!.playerIndex].throws + 1);

        // a throw scores at most once per asyq, only asyqs that were on the field, and the points add up
        const ids = rec!.scored.map((x) => x.id);
        expect(new Set(ids).size, `${label}: an asyq scored twice in one throw`).toBe(ids.length);
        for (const id of ids) expect(before.field.some((f) => f.id === id), `${label}: ${id} was not on the field`).toBe(true);
        expect(rec!.points).toBe(rec!.scored.reduce((a, x) => a + x.points, 0));
        expect(s.players[rec!.playerIndex].points).toBe(before.players[rec!.playerIndex].points + rec!.points);
        for (const [i, p] of s.players.entries()) if (i !== rec!.playerIndex) expect(p.points, `${label}: the wrong player was paid`).toBe(before.players[i].points);

        // nothing lost, nothing won twice: every asyq ever made is on the field or in exactly one player's pile
        const won = s.players.flatMap((p) => p.won);
        expect(new Set(won).size, `${label}: an asyq was won twice`).toBe(won.length);
        for (const f of s.field) expect(won.includes(f.id), `${label}: ${f.id} is won and still on the field`).toBe(false);
        if (s.nextId > prevNextId) created += s.nextId - prevNextId;
        prevNextId = s.nextId;
        expect(s.field.length + won.length, `${label}: an asyq vanished`).toBe(created);
        for (const f of s.field) expect(f.position.every(Number.isFinite) && f.rotation.every(Number.isFinite), `${label}: ${f.id} is not a number`).toBe(true);

        // player points are the sum of their throws
        for (const [i, p] of s.players.entries()) {
          expect(p.points).toBe(s.history.filter((h) => h.playerIndex === i).reduce((a, h) => a + h.points, 0));
          expect(p.throws).toBe(s.history.filter((h) => h.playerIndex === i).length);
        }
      }

      const s = g.state;
      expect(s.history.length).toBeLessThanOrEqual(MAX_THROWS_IN_GAME);
      expect(s.endReason, label).toBeTruthy();
      // the end is where the rules put it (or at the hard stop)
      if (s.history.length < MAX_THROWS_IN_GAME) {
        const e = config.end;
        if (e.kind === "points") expect(s.players.some((p) => p.points >= e.target) || (s.field.length === 0 && !config.refillWhenCleared), label).toBe(true);
        if (e.kind === "throws") expect(s.players.every((p) => p.throws >= e.perPlayer) || (s.field.length === 0 && !config.refillWhenCleared), label).toBe(true);
        if (e.kind === "cleared") expect(s.field.length, label).toBe(0);
      }
      // the winners have the most points; nobody wins a game in which nothing was scored
      const top = Math.max(...s.players.map((p) => p.points));
      for (const w of s.winners!) expect(s.players[w].points, label).toBe(top);
      if (s.history.some((h) => h.points !== 0)) expect(s.winners!.length, `${label}: nobody won`).toBeGreaterThan(0);
      for (const [i, p] of s.players.entries()) if (p.points === top && s.history.some((h) => h.points !== 0)) expect(s.winners, `${label}: ${p.name} tied for the most and did not win`).toContain(i);
    }, 600_000);
  }
});

describe("rules that come from outside", () => {
  // a rule set saved by another version of the game, or damaged in storage, or typed into a box
  const garbage: [string, unknown][] = [
    ["nothing at all", null],
    ["a string", "text"],
    ["a number", 42],
    ["an empty list", []],
    ["numbers that are not numbers", { ringRadius: "big", targetCount: "5", pointsPerAsyq: NaN, maxStreak: Infinity, seed: -Infinity }],
    ["numbers out of any range", { ringRadius: 1e9, targetCount: -50, pointsPerAsyq: 1e9, maxStreak: -4, seed: 1e30 }],
    ["words that are not rules", { surface: "lava", setupFace: "x", layout: 1, leaveRule: {}, turnRule: null, turnOrder: [] }],
    ["another mode's name", { mode: "hantalapai" }],
    ["players that are not a list", { players: "x" }],
    ["no players", { players: [] }],
    ["players that are not players", { players: [{ name: "a".repeat(100), sakha: "giant" }, null, 5, { name: 7 }] }],
    ["a name of three hundred letters", { players: [{ name: "ә".repeat(300), sakha: "ortasha" }] }],
    ["a name of emoji, which are two units each", { players: [{ name: "🪨".repeat(40), sakha: "ortasha" }] }],
    ["too many players", { players: Array.from({ length: 9 }, (_, i) => ({ name: `P${i}`, sakha: "auyr" })) }],
    ["an end that is no end", { end: { kind: "zzz" } }],
    ["a target that is no number", { end: { kind: "points", target: "x" } }],
    ["a target too big", { end: { kind: "points", target: 1e9 } }],
    ["negative throws each", { end: { kind: "throws", perPlayer: -3 } }],
    ["bonuses that are not numbers", { faceBonus: { alshy: "x", tayke: 1e9, buk: null } }],
    ["bonuses that are not an object", { faceBonus: 7 }],
    ["flags that are not flags", { allowSpin: "yes", refillWhenCleared: 1 }],
  ];
  const names = new Set(["alshy", "tayke", "buk", "shik"]);

  for (const [what, input] of garbage) {
    it(`${what}: comes out as rules the game can play`, async () => {
      const { config: c, notes } = mode.normalize(input as RuleConfig);
      expect(c.mode).toBe("asyq-atu");
      expect(c.players.length).toBeGreaterThanOrEqual(1);
      expect(c.players.length).toBeLessThanOrEqual(MAX_PLAYERS);
      for (const p of c.players) {
        expect(p.name.length).toBeGreaterThan(0);
        expect([...p.name].length).toBeLessThanOrEqual(24);
        expect(SAKHAS.some((s) => s.id === p.sakha)).toBe(true);
      }
      for (const x of [c.targetCount, c.ringRadius, c.pointsPerAsyq, c.maxStreak, c.seed, ...Object.values(c.faceBonus)]) expect(Number.isFinite(x)).toBe(true);
      expect(c.ringRadius).toBeGreaterThanOrEqual(0.4);
      expect(c.ringRadius).toBeLessThanOrEqual(1.6);
      expect(Number.isInteger(c.targetCount) && c.targetCount >= 1).toBe(true);
      expect(Object.keys(SURFACES)).toContain(c.surface);
      expect(names.has(c.setupFace)).toBe(true);
      expect(["line", "ring"]).toContain(c.layout);
      expect(["cleared", "points", "throws"]).toContain(c.end.kind);
      if (c.end.kind === "points") expect(c.end.target >= 1 && c.end.target <= 500 && Number.isInteger(c.end.target)).toBe(true);
      if (c.end.kind === "throws") expect(c.end.perPlayer >= 1 && c.end.perPlayer <= 30 && Number.isInteger(c.end.perPlayer)).toBe(true);
      expect(typeof c.allowSpin).toBe("boolean");
      expect(typeof c.refillWhenCleared).toBe("boolean");
      if (input !== null && typeof input === "object" && Object.keys(input as object).length > 0) expect(notes.length, "said nothing about what it changed").toBeGreaterThan(0);

      // normalising twice changes nothing more
      const again = mode.normalize(c);
      expect(again.config).toEqual(c);
      expect(again.notes).toEqual([]);

      // and a game can be played on it, the very first throw included
      const g = await AsyqGame.create(c, false);
      expect(g.start()).toBe(true);
      const rec = g.playThrow({ yaw: 0, power: 0.7, spin: 0, roll: 0 });
      expect(rec).not.toBeNull();
      expect(rec!.simulation.clean).toBe(true);
    }, 60_000);
  }
});

describe("rules that are changed say so", () => {
  const says = (input: object, ...parts: string[]) => {
    const { notes } = mode.normalize(input as RuleConfig);
    for (const part of parts) expect(notes.some((n) => n.includes(part)), `no note with "${part}" in ${JSON.stringify(notes)}`).toBe(true);
  };
  it("a bonus out of range", () => says({ faceBonus: { tayke: 99 } }, "tayke", "99 → 20"));
  it("a run of throws that is too long", () => says({ maxStreak: 99 }, "99 → 10"));
  it("a target nobody could reach", () => says({ end: { kind: "points", target: 9999 } }, "9999 → 500"));
  it("too many throws each", () => says({ end: { kind: "throws", perPlayer: 99 } }, "99 → 30"));
  it("a seed below zero", () => says({ seed: -5 }, "-5 → 4294967291"));
  it("another mode's name", () => says({ mode: "bes-taban" }, "түзетілді"));
  it("and a valid set is changed in silence", () => {
    const d = mode.defaults();
    expect(mode.normalize(d).notes).toEqual([]);
    expect(mode.normalize({ ...d, players: [{ name: "Ә".repeat(24), sakha: "auyr" }] }).notes).toEqual([]);
  });
  it("a name is cut to 24 letters, whole ones (an emoji is not split in two)", () => {
    const c = mode.normalize({ ...mode.defaults(), players: [{ name: "🪨".repeat(40), sakha: "ortasha" }] }).config;
    expect([...c.players[0].name]).toHaveLength(24);
    expect(c.players[0].name).toBe("🪨".repeat(24));
  });
});
