import { describe, expect, it } from "vitest";
import { ALLOWED, PHASES, PHASE_LABEL, createGame, reduce, type GameEvent, type GameState, type Phase } from "./machine";
import { MODES, getMode, playableModes } from "./modes";
import { FACE_ZERO, MAX_PLAYERS, RING, SPACING, maxTargets, type FinalBody, type RuleConfig } from "./rules";
import { AIM_LIMIT } from "./throw";
import { orientationOnFace } from "./placement";
import type { FaceId } from "./faces";

const asyqAtu = getMode("asyq-atu");
const config = (over: Partial<RuleConfig> = {}): RuleConfig => asyqAtu.normalize({ ...asyqAtu.defaults(), ...over }).config;

const FINAL_SIM = { hz: 480, maxOverlap: 0.0003, clean: true, settled: true, duration: 2, attempts: 1 };

/** Applies events in order, failing the test on a refusal unless told otherwise. */
function run(state: GameState, ...events: GameEvent[]): GameState {
  for (const e of events) {
    const r = reduce(state, e);
    expect(r.error, `${e.type} in ${state.phase}`).toBeUndefined();
    state = r.state;
  }
  return state;
}

/** Final poses for a throw: where each asyq on the field ended (default: unmoved), and the sakha. */
function finals(state: GameState, where: Record<string, [number, number]> = {}, faces: Record<string, FaceId | null> = {}): FinalBody[] {
  const out: FinalBody[] = state.field.map((b) => {
    const at = where[b.id];
    return { id: b.id, kind: "asyq" as const, position: at ? [at[0], b.position[1], at[1]] : b.position, rotation: b.rotation, face: b.id in faces ? faces[b.id] : "alshy" };
  });
  out.push({ id: "s", kind: "sakha", position: [0, 0.02, 0.1], rotation: orientationOnFace("buk", 0), face: "buk" });
  return out;
}

const PARAMS = { yaw: 0, power: 0.6, spin: 0, roll: 0 };
const toAiming = (c = config()) => run(createGame(c), { type: "START", order: c.players.map((_, i) => i) }, { type: "CHOOSE" });

/** Plays one throw through to nextTurn with the given outcome. */
function play(state: GameState, where: Record<string, [number, number]> = {}, faces: Record<string, FaceId | null> = {}, contact = true): GameState {
  const events: GameEvent[] = [{ type: "THROW", params: PARAMS, speed: 4 }];
  if (contact) events.push({ type: "CONTACT", contacts: [["s", "a1"]] });
  events.push({ type: "SETTLED", final: finals(state, where, faces), contacts: contact ? [["s", "a1"]] : [], sim: FINAL_SIM }, { type: "JUDGE" }, { type: "SCORE" });
  return run(state, ...events);
}

describe("the order of a game", () => {
  it("visits the nine phases in the order the rules give, and no other", () => {
    const trail: Phase[] = [];
    let s = createGame(config());
    trail.push(s.phase);
    const step = (e: GameEvent) => {
      s = run(s, e);
      trail.push(s.phase);
    };
    step({ type: "START", order: [0, 1] });
    step({ type: "CHOOSE" });
    step({ type: "THROW", params: PARAMS, speed: 4 });
    step({ type: "CONTACT", contacts: [["s", "a1"]] });
    step({ type: "SETTLED", final: finals(s), contacts: [["s", "a1"]], sim: FINAL_SIM });
    step({ type: "JUDGE" });
    step({ type: "SCORE" });
    step({ type: "NEXT" });
    expect(trail).toEqual(["setup", "choosePlayer", "aiming", "throwing", "colliding", "judging", "scoring", "nextTurn", "choosePlayer"]);
    expect(PHASES).toEqual(["setup", "choosePlayer", "aiming", "throwing", "colliding", "judging", "scoring", "nextTurn", "finished"]);
    for (const p of PHASES) expect(PHASE_LABEL[p].length).toBeGreaterThan(3);
  });

  it("a throw that touches nothing goes straight from throwing to judging", () => {
    let s = toAiming();
    s = run(s, { type: "THROW", params: PARAMS, speed: 4 });
    expect(s.phase).toBe("throwing");
    s = run(s, { type: "SETTLED", final: finals(s), contacts: [], sim: FINAL_SIM });
    expect(s.phase).toBe("judging");
  });

  it("refuses every event that does not belong to the phase, and leaves the state exactly as it was", () => {
    const all: GameEvent[] = [
      { type: "START", order: [0, 1] },
      { type: "CHOOSE" },
      { type: "THROW", params: PARAMS, speed: 4 },
      { type: "CONTACT", contacts: [] },
      { type: "SETTLED", final: [], contacts: [], sim: FINAL_SIM },
      { type: "JUDGE" },
      { type: "SCORE" },
      { type: "NEXT" },
      { type: "RESET" },
    ];
    // one state in each phase
    const at: Record<Phase, GameState> = {} as Record<Phase, GameState>;
    at.setup = createGame(config());
    at.choosePlayer = run(at.setup, { type: "START", order: [0, 1] });
    at.aiming = run(at.choosePlayer, { type: "CHOOSE" });
    at.throwing = run(at.aiming, { type: "THROW", params: PARAMS, speed: 4 });
    at.colliding = run(at.throwing, { type: "CONTACT", contacts: [["s", "a1"]] });
    at.judging = run(at.colliding, { type: "SETTLED", final: finals(at.colliding), contacts: [["s", "a1"]], sim: FINAL_SIM });
    at.scoring = run(at.judging, { type: "JUDGE" });
    at.nextTurn = run(at.scoring, { type: "SCORE" });
    at.finished = run(createGame(config({ end: { kind: "throws", perPlayer: 1 } })), { type: "START", order: [0, 1] }, { type: "CHOOSE" });
    let g = at.finished;
    for (let i = 0; i < 2; i++) {
      g = run(g, { type: "THROW", params: PARAMS, speed: 4 }, { type: "SETTLED", final: finals(g), contacts: [], sim: FINAL_SIM }, { type: "JUDGE" }, { type: "SCORE" }, { type: "NEXT" });
      if (g.phase === "choosePlayer") g = run(g, { type: "CHOOSE" });
    }
    at.finished = g;
    for (const phase of PHASES) {
      expect(at[phase].phase, phase).toBe(phase);
      for (const e of all) {
        const r = reduce(at[phase], e);
        if (ALLOWED[phase].includes(e.type)) continue;
        expect(r.error, `${e.type} in ${phase}`).toMatch(PHASE_LABEL[phase]);
        expect(r.state, `${e.type} in ${phase} must not change anything`).toBe(at[phase]);
      }
    }
  });

  it("lets each phase be left by exactly the events the rules give it, written out here independently of the table", () => {
    expect(ALLOWED).toEqual({
      setup: ["START"],
      choosePlayer: ["CHOOSE"],
      aiming: ["THROW"],
      throwing: ["CONTACT", "SETTLED"],
      colliding: ["SETTLED"],
      judging: ["JUDGE"],
      scoring: ["SCORE"],
      nextTurn: ["NEXT"],
      finished: ["RESET"],
    });
  });

  it("cannot throw twice: a second throw while the first is in flight is refused", () => {
    let s = toAiming();
    s = run(s, { type: "THROW", params: PARAMS, speed: 4 });
    const again = reduce(s, { type: "THROW", params: PARAMS, speed: 4 });
    expect(again.error).toBeDefined();
    expect(again.state).toBe(s);
  });

  it("insists the turn order names every player once", () => {
    const s = createGame(config());
    for (const bad of [[0], [0, 0], [0, 2], [1, 0, 1]]) expect(reduce(s, { type: "START", order: bad }).error, JSON.stringify(bad)).toBeDefined();
    expect(reduce(s, { type: "START", order: [1, 0] }).state.order).toEqual([1, 0]);
  });

  it("resets to a fresh game with the same rules", () => {
    let s = play(toAiming(), { a1: [3, 0] });
    s = run(s, { type: "NEXT" });
    const done = run(createGame(config({ end: { kind: "cleared" }, targetCount: 1 })));
    expect(done.history).toHaveLength(0);
    expect(s.history.length).toBeGreaterThan(0);
  });
});

describe("the throw as the machine accepts it", () => {
  it("clamps the aim and the strength to what the game allows", () => {
    const s = run(toAiming(), { type: "THROW", params: { yaw: 3, power: 7, spin: 5, roll: -5 }, speed: 4 });
    expect(s.pending!.params).toEqual({ yaw: AIM_LIMIT, power: 1, spin: 1, roll: -1 });
  });

  it("takes the spin out when the rules offer none", () => {
    const s = run(toAiming(config({ allowSpin: false })), { type: "THROW", params: { yaw: 0.2, power: 0.5, spin: 1, roll: 1 }, speed: 4 });
    expect(s.pending!.params.spin).toBe(0);
    expect(s.pending!.params.roll).toBe(0);
  });

  it("refuses a throw whose numbers are not numbers", () => {
    const s = toAiming();
    for (const bad of [{ yaw: NaN, power: 0.5, spin: 0, roll: 0 }, { yaw: 0, power: Infinity, spin: 0, roll: 0 }, { yaw: 0, power: 0.5, spin: NaN, roll: 0 }]) {
      const r = reduce(s, { type: "THROW", params: bad, speed: 4 });
      expect(r.error).toBeDefined();
      expect(r.state).toBe(s);
    }
  });
});

describe("what a throw wins", () => {
  const R = asyqAtu.defaults().ringRadius;

  it("an asyq that leaves the ring is won, one that stays is not", () => {
    let s = toAiming(config({ targetCount: 3 }));
    s = play(s, { a1: [R + 0.2, 0], a2: [0.3, 0.1] });
    const rec = s.history[0];
    expect(rec.scored.map((x) => x.id)).toEqual(["a1"]);
    expect(rec.points).toBe(1);
    expect(s.players[0].points).toBe(1);
    expect(s.players[0].won).toEqual(["a1"]);
    // the others lie where they stopped; the won one is off the field
    expect(s.field.map((b) => b.id).sort()).toEqual(["a2", "a3"]);
    expect(s.field.find((b) => b.id === "a2")!.position[0]).toBeCloseTo(0.3, 9);
  });

  it("exactly on the line is still in: out means farther than the radius", () => {
    const s = play(toAiming(config({ targetCount: 2 })), { a1: [R, 0], a2: [R + 0.001, 0] });
    expect(s.history[0].scored.map((x) => x.id)).toEqual(["a2"]);
  });

  it("'the whole of it' is stricter than 'its centre': a half length more is needed", () => {
    const centre = play(toAiming(config({ targetCount: 2, leaveRule: "centre" })), { a1: [R + 0.01, 0] });
    const whole = play(toAiming(config({ targetCount: 2, leaveRule: "whole" })), { a1: [R + 0.01, 0] });
    expect(centre.history[0].scored).toHaveLength(1);
    expect(whole.history[0].scored).toHaveLength(0);
    const wholeFar = play(toAiming(config({ targetCount: 2, leaveRule: "whole" })), { a1: [R + 0.03, 0] });
    expect(wholeFar.history[0].scored).toHaveLength(1);
  });

  it("points per asyq and the bonus for the side it lies on are the rules' to set", () => {
    const c = config({ targetCount: 4, pointsPerAsyq: 2, faceBonus: { ...FACE_ZERO, alshy: 3, shik: -1 } });
    const s = play(toAiming(c), { a1: [2, 0], a2: [0, 2], a3: [-2, 0] }, { a1: "alshy", a2: "shik", a3: "buk" });
    const byId = Object.fromEntries(s.history[0].scored.map((x) => [x.id, x]));
    expect(byId.a1).toMatchObject({ face: "alshy", base: 2, bonus: 3, points: 5 });
    expect(byId.a2).toMatchObject({ face: "shik", bonus: -1, points: 1 });
    expect(byId.a3).toMatchObject({ face: "buk", bonus: 0, points: 2 });
    expect(s.history[0].points).toBe(8);
    expect(s.players[0].points).toBe(8);
  });

  it("an asyq on an edge or an end earns no side bonus", () => {
    const c = config({ targetCount: 2, faceBonus: { alshy: 5, tayke: 5, buk: 5, shik: 5 } });
    const s = play(toAiming(c), { a1: [2, 0] }, { a1: null });
    expect(s.history[0].scored[0]).toMatchObject({ face: null, bonus: 0, points: 1 });
  });

  it("an asyq is never paid for twice in one throw, even if it is listed twice", () => {
    let s = toAiming(config({ targetCount: 2 }));
    s = run(s, { type: "THROW", params: PARAMS, speed: 4 });
    const f = finals(s, { a1: [2, 0] });
    s = run(s, { type: "SETTLED", final: [...f, ...f.filter((b) => b.id === "a1")], contacts: [], sim: FINAL_SIM }, { type: "JUDGE" }, { type: "SCORE" });
    expect(s.history[0].scored).toHaveLength(1);
    expect(s.players[0].points).toBe(1);
  });

  it("an asyq won in one throw cannot be won again in the next: it is no longer on the field", () => {
    let s = play(toAiming(config({ targetCount: 3, turnRule: "continue" })), { a1: [2, 0] });
    s = run(s, { type: "NEXT" }, { type: "CHOOSE" });
    expect(s.field.map((b) => b.id)).not.toContain("a1");
    s = play(s, { a2: [2, 0] });
    expect(s.history[1].scored.map((x) => x.id)).toEqual(["a2"]);
    expect(s.players[0].won).toEqual(["a1", "a2"]);
  });

  it("records the sides every asyq ended on, which asyqs were touched and which moved", () => {
    let s = toAiming(config({ targetCount: 3 }));
    s = run(s, { type: "THROW", params: PARAMS, speed: 4 }, { type: "CONTACT", contacts: [["s", "a1"]] });
    s = run(s, { type: "SETTLED", final: finals(s, { a1: [0.5, 0.2], a2: [0, 0.2] }, { a1: "buk", a2: "tayke" }), contacts: [["s", "a1"], ["a1", "a2"]], sim: FINAL_SIM }, { type: "JUDGE" }, { type: "SCORE" });
    const r = s.history[0];
    expect(r.touched).toEqual(["a1", "a2"]);
    expect(r.moved).toContain("a1");
    expect(r.faces).toMatchObject({ a1: "buk", a2: "tayke", a3: "alshy" });
    expect(r.simulation).toEqual(FINAL_SIM);
    expect(r.playerName).toBe("1-ойыншы");
    expect(r.no).toBe(1);
  });
});

describe("whose turn it is", () => {
  const win = (s: GameState) => play(s, { [s.field[0].id]: [2, 0] });
  const lose = (s: GameState) => play(s, {});

  it("passes the turn after a throw that wins nothing", () => {
    let s = toAiming();
    s = lose(s);
    expect(s.decision).toMatchObject({ turnPos: 1, over: false });
    s = run(s, { type: "NEXT" }, { type: "CHOOSE" });
    expect(s.current).toBe(1);
  });

  it("lets a winner go again when the rules say so, up to the longest streak", () => {
    let s = toAiming(config({ targetCount: 8, turnRule: "continue", maxStreak: 2 }));
    s = win(s);
    expect(s.decision!.turnPos).toBe(0);
    s = run(s, { type: "NEXT" }, { type: "CHOOSE" });
    expect(s.current).toBe(0);
    expect(s.streak).toBe(1);
    s = win(s);
    expect(s.decision!.turnPos, "second win reaches the streak limit").toBe(1);
    s = run(s, { type: "NEXT" }, { type: "CHOOSE" });
    expect(s.current).toBe(1);
    expect(s.streak).toBe(0);
  });

  it("passes the turn after a win when the rules say the turn always passes", () => {
    let s = toAiming(config({ targetCount: 8, turnRule: "pass" }));
    s = win(s);
    expect(s.decision!.turnPos).toBe(1);
  });

  it("goes round in the order it was given", () => {
    let s = run(createGame(config({ players: [{ name: "A", sakha: "auyr" }, { name: "B", sakha: "auyr" }, { name: "C", sakha: "auyr" }] })), { type: "START", order: [2, 0, 1] }, { type: "CHOOSE" });
    const seen: number[] = [s.current];
    for (let i = 0; i < 4; i++) {
      s = lose(s);
      s = run(s, { type: "NEXT" }, { type: "CHOOSE" });
      seen.push(s.current);
    }
    expect(seen).toEqual([2, 0, 1, 2, 0]);
  });

  it("a single player simply throws again", () => {
    let s = toAiming(config({ players: [{ name: "Жалғыз", sakha: "ortasha" }], end: { kind: "throws", perPlayer: 3 } }));
    s = lose(s);
    expect(s.decision).toMatchObject({ turnPos: 0, over: false });
  });
});

describe("when it ends", () => {
  const winAll = (s: GameState) => {
    const where: Record<string, [number, number]> = {};
    s.field.forEach((b, i) => (where[b.id] = [2 + i * 0.1, 0]));
    return play(s, where);
  };

  it("when the field is empty, if that is the rule; and the one with most points wins", () => {
    let s = toAiming(config({ targetCount: 2, end: { kind: "cleared" } }));
    s = winAll(s);
    expect(s.decision).toMatchObject({ over: true });
    s = run(s, { type: "NEXT" });
    expect(s.phase).toBe("finished");
    expect(s.winners).toEqual([0]);
    expect(s.endReason).toMatch(/таусылды/);
  });

  it("when someone reaches the target, and the field is refilled if it empties first", () => {
    let s = toAiming(config({ targetCount: 2, end: { kind: "points", target: 3 }, refillWhenCleared: true, turnRule: "continue", maxStreak: 9 }));
    s = winAll(s);
    expect(s.decision).toMatchObject({ over: false, refill: true });
    s = run(s, { type: "NEXT" });
    expect(s.field).toHaveLength(2);
    expect(s.field.map((b) => b.id)).toEqual(["a3", "a4"]); // fresh asyqs, fresh numbers
    s = run(s, { type: "CHOOSE" });
    s = play(s, { a3: [2, 0] });
    expect(s.players[0].points).toBe(3);
    expect(s.decision!.over).toBe(true);
    s = run(s, { type: "NEXT" });
    expect(s.winners).toEqual([0]);
  });

  it("a 'first to N' game with no refill ends when the field runs dry", () => {
    const s = winAll(toAiming(config({ targetCount: 2, end: { kind: "points", target: 50 }, refillWhenCleared: false })));
    expect(s.decision!.over).toBe(true);
  });

  it("when everyone has thrown their share", () => {
    let s = toAiming(config({ targetCount: 8, end: { kind: "throws", perPlayer: 2 }, turnRule: "pass" }));
    const turns: number[] = [];
    while (s.phase !== "finished") {
      turns.push(s.current);
      s = play(s, {});
      s = run(s, { type: "NEXT" });
      if (s.phase === "choosePlayer") s = run(s, { type: "CHOOSE" });
    }
    expect(turns).toEqual([0, 1, 0, 1]);
    expect(s.players.map((p) => p.throws)).toEqual([2, 2]);
    expect(s.winners).toEqual([]); // nobody scored: no winner, not an arbitrary one
  });

  it("a winner who goes on is stopped at their share in a 'throws each' game", () => {
    let s = toAiming(config({ targetCount: 8, end: { kind: "throws", perPlayer: 2 }, turnRule: "continue", maxStreak: 9 }));
    s = play(s, { a1: [2, 0] });
    s = run(s, { type: "NEXT" }, { type: "CHOOSE" });
    expect(s.current).toBe(0);
    s = play(s, { a2: [2, 0] });
    // player 0 has used both throws: the turn passes even though the throw won
    expect(s.decision!.turnPos).toBe(1);
  });

  it("tied players share the win", () => {
    let s = toAiming(config({ targetCount: 4, end: { kind: "throws", perPlayer: 1 }, turnRule: "pass" }));
    s = play(s, { a1: [2, 0] });
    s = run(s, { type: "NEXT" }, { type: "CHOOSE" });
    s = play(s, { a2: [2, 0] });
    s = run(s, { type: "NEXT" });
    expect(s.phase).toBe("finished");
    expect(s.winners).toEqual([0, 1]);
  });

  it("never runs on for ever: a game stops after 120 throws whatever the rules", () => {
    let s = toAiming(config({ targetCount: 12, end: { kind: "points", target: 500 }, refillWhenCleared: true, pointsPerAsyq: 0, turnRule: "pass" }));
    // with 0 points a "points" game normalises to "cleared"; force the long game by hand
    s = { ...s, config: { ...s.config, end: { kind: "points", target: 500 } } };
    let n = 0;
    while (s.phase !== "finished" && n < 200) {
      s = play(s, {});
      s = run(s, { type: "NEXT" });
      if (s.phase === "choosePlayer") s = run(s, { type: "CHOOSE" });
      n++;
    }
    expect(s.phase).toBe("finished");
    expect(n).toBe(120);
    expect(s.endReason).toMatch(/120/);
  });
});

describe("the rules a game is set up with", () => {
  it("keeps what is playable and says what it changed", () => {
    const { config: c, notes } = asyqAtu.normalize({
      ...asyqAtu.defaults(),
      players: Array.from({ length: 9 }, (_, i) => ({ name: i === 3 ? "   " : `P${i}`, sakha: "auyr" })),
      ringRadius: 9,
      targetCount: 99,
      pointsPerAsyq: 1e6,
      maxStreak: 0,
    });
    expect(c.players).toHaveLength(MAX_PLAYERS);
    expect(c.players[3].name).toBe("4-ойыншы");
    expect(c.ringRadius).toBe(RING.max);
    expect(c.targetCount).toBe(maxTargets(RING.max, "line"));
    expect(c.targetCount).toBe(12);
    expect(c.pointsPerAsyq).toBe(20);
    expect(c.maxStreak).toBe(1);
    expect(notes.length).toBeGreaterThan(2);
    // and it never changes a config that is already fine
    const ok = asyqAtu.defaults();
    expect(asyqAtu.normalize(ok).notes).toEqual([]);
    expect(asyqAtu.normalize(ok).config).toEqual(ok);
  });

  it("the asyqs fit the ring: no layout can ask for more than its room", () => {
    for (const layout of ["line", "ring"] as const) {
      for (let r = RING.min; r <= RING.max + 1e-9; r += 0.1) {
        const n = maxTargets(r, layout);
        expect(n).toBeGreaterThanOrEqual(1);
        const f = asyqAtu.layout({ ...asyqAtu.defaults(), layout, ringRadius: r, targetCount: n }, 1);
        expect(f.bodies).toHaveLength(n);
        for (const b of f.bodies) expect(Math.hypot(b.position[0], b.position[2]), `${layout} r=${r}`).toBeLessThan(r);
        // and none stands on another
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          expect(Math.hypot(f.bodies[i].position[0] - f.bodies[j].position[0], f.bodies[i].position[2] - f.bodies[j].position[2]), `${layout} r=${r} ${i}/${j}`).toBeGreaterThan(SPACING * 0.9);
        }
      }
    }
  });

  it("a game that ends on points cannot be left unwinnable: with no points to earn it ends when the field is empty", () => {
    const { config: c, notes } = asyqAtu.normalize({ ...asyqAtu.defaults(), pointsPerAsyq: 0, end: { kind: "points", target: 5 } });
    expect(c.end.kind).toBe("cleared");
    expect(notes.join(" ")).toMatch(/ұпай/);
  });

  it("stands the asyqs in a row for the line and round a circle for the ring, all on the chosen side", () => {
    const line = asyqAtu.layout({ ...asyqAtu.defaults(), targetCount: 5 }, 1);
    expect(line.bodies.map((b) => b.id)).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    expect(line.bodies.every((b) => Math.abs(b.position[0]) < 1e-9)).toBe(true);
    expect(line.bodies[0].position[2]).toBeCloseTo(-2 * SPACING, 9);
    expect(line.zone).toEqual({ centre: [0, 0], radius: 0.6 });
    expect(line.origin).toEqual([-0.6, 0, 0]);
    const ring = asyqAtu.layout({ ...asyqAtu.defaults(), layout: "ring", targetCount: 6 }, 10);
    expect(ring.bodies.map((b) => b.id)).toEqual(["a10", "a11", "a12", "a13", "a14", "a15"]);
    const radii = ring.bodies.map((b) => Math.hypot(b.position[0], b.position[2]));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 9);
  });
});

describe("modes", () => {
  it("Асық ату is playable; Ханталапай and Бес табан are in the registry, switched off, with their own ids", () => {
    expect(playableModes().map((m) => m.id)).toEqual(["asyq-atu"]);
    expect(MODES.map((m) => m.id)).toEqual(["asyq-atu", "hantalapai", "bes-taban"]);
    for (const m of MODES.filter((x) => !x.available)) {
      expect(m.summary).toMatch(/кейін қосылады/);
      expect(m.defaults().mode).toBe(m.id);
    }
    expect(() => getMode("nope" as never)).toThrow();
  });
});
