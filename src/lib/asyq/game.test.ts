import { describe, expect, it } from "vitest";
import { seededRandom } from "../rng";
import { AsyqGame, PACE } from "./game";
import { getMode } from "./modes";
import { PHASES, type Phase } from "./machine";
import { FACE_INFO } from "./faces";
import { tossForOrder, tossOne } from "./toss";
import { loadPhysics } from "./physics";
import type { RuleConfig } from "./rules";
import { NO_THROW, type ThrowParams } from "./throw";

const mode = getMode("asyq-atu");
const cfg = (over: Partial<RuleConfig> = {}): RuleConfig => mode.normalize({ ...mode.defaults(), ...over }).config;

async function headless(over: Partial<RuleConfig> = {}) {
  const g = await AsyqGame.create(cfg(over), false);
  expect(g.start()).toBe(true);
  return g;
}

const AT_ROW: ThrowParams = { yaw: 0, power: 0.6, spin: 0, roll: 0 };

describe("a game played without waiting", () => {
  it("starts on the first player, aiming, with every asyq on the field", async () => {
    const g = await headless();
    expect(g.state.phase).toBe("aiming");
    expect(g.state.current).toBe(0);
    expect(g.state.field).toHaveLength(5);
    expect(g.state.history).toHaveLength(0);
  });

  it("plays a throw through every phase and lands back at aiming, with the throw written down", async () => {
    const g = await headless();
    const rec = g.playThrow(AT_ROW)!;
    expect(rec).not.toBeNull();
    expect(rec.no).toBe(1);
    expect(rec.playerName).toBe("1-ойыншы");
    expect(rec.params).toEqual(AT_ROW);
    expect(rec.simulation.clean).toBe(true);
    expect(rec.simulation.settled).toBe(true);
    expect(rec.contacts.some(([a, b]) => a === "s" || b === "s")).toBe(true);
    expect(rec.touched.length).toBeGreaterThan(0);
    expect(g.state.history).toEqual([rec]);
    // whoever is next, the game is waiting for them to aim
    expect(g.state.phase).toBe("aiming");
    expect(g.refusals).toEqual([]);
  });

  it("keeps count: every asyq is either still on the field or in a player's winnings, none twice, none lost", async () => {
    const g = await headless({ targetCount: 6, end: { kind: "throws", perPlayer: 6 } });
    const rnd = seededRandom(3);
    for (let i = 0; i < 6 && g.state.phase === "aiming"; i++) {
      g.playThrow({ yaw: (rnd() - 0.5) * 0.4, power: 0.5 + rnd() * 0.4, spin: 0, roll: 0 });
      const won = g.state.players.flatMap((p) => p.won);
      const field = g.state.field.map((b) => b.id);
      expect(new Set([...won, ...field]).size, `throw ${i + 1}`).toBe(won.length + field.length);
      if (g.state.nextId === 7) expect(won.length + field.length).toBe(6); // before any refill
    }
  });

  it("points add up: each player's total is the sum of their throws, and the records agree with the winnings", async () => {
    const g = await headless({ targetCount: 6, pointsPerAsyq: 2 });
    const rnd = seededRandom(11);
    while (g.state.phase === "aiming" && g.state.history.length < 14) g.playThrow({ yaw: (rnd() - 0.5) * 0.3, power: 0.55 + rnd() * 0.4, spin: 0, roll: 0 });
    for (let i = 0; i < g.state.players.length; i++) {
      const mine = g.state.history.filter((h) => h.playerIndex === i);
      expect(g.state.players[i].points).toBe(mine.reduce((a, h) => a + h.points, 0));
      expect(g.state.players[i].throws).toBe(mine.length);
      expect(g.state.players[i].won).toEqual(mine.flatMap((h) => h.scored.map((s) => s.id)));
      expect(g.state.players[i].points).toBe(g.state.players[i].won.length * 2);
    }
    expect(g.state.history.map((h) => h.no)).toEqual(g.state.history.map((_, i) => i + 1));
  });

  it("a throw wide of the row wins nothing and the turn passes", async () => {
    const g = await headless();
    const rec = g.playThrow({ yaw: (45 * Math.PI) / 180, power: 0.5, spin: 0, roll: 0 })!;
    expect(rec.points).toBe(0);
    expect(rec.scored).toEqual([]);
    expect(rec.touched).toEqual([]);
    expect(g.state.current).toBe(1);
    expect(g.state.field).toHaveLength(5);
  });

  it("the asyqs left on the field stay where the throw left them, and the next throw starts from there", async () => {
    const g = await headless({ targetCount: 6, end: { kind: "throws", perPlayer: 9 } });
    g.playThrow({ yaw: 0, power: 0.45, spin: 0, roll: 0 });
    const after = g.state.field.map((b) => ({ id: b.id, p: [...b.position] }));
    // the sakha is thrown wide so nothing else moves: the field must be exactly as the first throw left it
    const rec = g.playThrow({ yaw: (45 * Math.PI) / 180, power: 0.5, spin: 0, roll: 0 })!;
    expect(rec.touched).toEqual([]);
    for (const a of after) {
      const b = g.state.field.find((x) => x.id === a.id)!;
      expect(Math.hypot(b.position[0] - a.p[0], b.position[2] - a.p[2]), a.id).toBeLessThan(0.001);
    }
  });

  it("is repeatable: the same rules and the same throws give the same game, to the last number", async () => {
    const play = async () => {
      const g = await headless({ targetCount: 6, end: { kind: "throws", perPlayer: 3 } });
      const rnd = seededRandom(5);
      while (g.state.phase === "aiming") g.playThrow({ yaw: (rnd() - 0.5) * 0.3, power: 0.5 + rnd() * 0.4, spin: rnd() - 0.5, roll: 0 });
      return g;
    };
    const a = await play(), b = await play();
    expect(a.state.phase).toBe("finished");
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  }, 120_000);

  it("different throws, different games: the aim, the strength and the spin each change the outcome", async () => {
    const key = async (p: ThrowParams) => {
      const g = await headless();
      return JSON.stringify(g.playThrow(p)!.faces) + JSON.stringify(g.state.field.map((b) => b.position.map((x) => +x.toFixed(4))));
    };
    const base = await key(AT_ROW);
    expect(await key({ ...AT_ROW, power: 0.9 })).not.toBe(base);
    expect(await key({ ...AT_ROW, yaw: 0.12 })).not.toBe(base);
    expect(await key({ ...AT_ROW, spin: 0.8 })).not.toBe(base);
  });

  it("plays whole games to the end, every throw clean, with a winner who really has the most", async () => {
    for (const seed of [1, 2, 3]) {
      const g = await headless({ targetCount: 5, end: { kind: "points", target: 4 }, seed });
      const rnd = seededRandom(seed * 17);
      let n = 0;
      // a steady player: aims at the asyq nearest the middle of the ring, a little off, and throws hard enough to clear it
      while (g.state.phase === "aiming" && n++ < 80) {
        const R = g.state.config.ringRadius;
        const target = [...g.state.field].sort((a, b) => Math.hypot(a.position[0], a.position[2]) - Math.hypot(b.position[0], b.position[2]))[0];
        const yaw = Math.atan2(target.position[2], target.position[0] + R) + (rnd() - 0.5) * 0.06;
        g.playThrow({ yaw, power: 0.65 + rnd() * 0.3, spin: 0, roll: 0 });
      }
      const s = g.state;
      expect(s.phase, `seed ${seed}`).toBe("finished");
      expect(s.history.every((h) => h.simulation.clean && h.simulation.settled)).toBe(true);
      const top = Math.max(...s.players.map((p) => p.points));
      expect(top).toBeGreaterThanOrEqual(4);
      expect(s.winners!.every((i) => s.players[i].points === top)).toBe(true);
      expect(s.players.filter((p) => p.points === top).length).toBe(s.winners!.length);
      expect(g.refusals).toEqual([]);
    }
  }, 300_000);

  it("refuses a throw once the game is over, and a second start", async () => {
    const g = await headless({ players: [{ name: "Жалғыз", sakha: "auyr" }], targetCount: 1, end: { kind: "throws", perPlayer: 1 } });
    g.playThrow(AT_ROW);
    expect(g.state.phase).toBe("finished");
    expect(g.throwSakha(AT_ROW)).toBe(false);
    expect(g.start()).toBe(false);
    expect(g.refusals.length).toBe(2);
    expect(g.state.history).toHaveLength(1);
  });

  it("a throw with nonsense numbers is refused and nothing changes", async () => {
    const g = await headless();
    expect(g.throwSakha({ ...NO_THROW, power: NaN })).toBe(false);
    expect(g.state.phase).toBe("aiming");
    expect(g.state.history).toHaveLength(0);
  });
});

describe("a game played with a person watching", () => {
  it("goes through the phases in order, each lingering for its pause, and waits for the player at aiming", async () => {
    const g = await AsyqGame.create(cfg({ end: { kind: "throws", perPlayer: 2 } }), true);
    const seen: Phase[] = [g.state.phase];
    const note = () => {
      if (seen[seen.length - 1] !== g.state.phase) seen.push(g.state.phase);
    };
    const entered: Partial<Record<Phase, number>> = {};
    let t = 0;
    const tick = (dt: number) => {
      g.tick(dt);
      t += dt;
      if (seen[seen.length - 1] !== g.state.phase) entered[g.state.phase] = t;
      note();
    };
    g.start();
    note();
    expect(g.state.phase).toBe("choosePlayer");
    while (g.state.phase === "choosePlayer") tick(1 / 60);
    expect(g.state.phase).toBe("aiming");
    // nothing happens by itself while the player aims
    for (let i = 0; i < 300; i++) tick(1 / 60);
    expect(g.state.phase).toBe("aiming");
    expect(g.throwSakha(AT_ROW)).toBe(true);
    expect(g.state.phase).toBe("throwing");
    expect(g.throwSakha(AT_ROW), "no second throw while the first is on its way").toBe(false);
    let guard = 0;
    while (g.state.phase !== "aiming" && guard++ < 60 * 30) tick(1 / 60);
    expect(g.state.phase).toBe("aiming");
    expect(seen).toEqual(["setup", "choosePlayer", "aiming", "throwing", "colliding", "judging", "scoring", "nextTurn", "choosePlayer", "aiming"]);
    // each pause was honoured
    expect(entered.scoring! - entered.judging!).toBeGreaterThanOrEqual(PACE.judging! - 0.05);
    expect(entered.nextTurn! - entered.scoring!).toBeGreaterThanOrEqual(PACE.scoring! - 0.05);
    for (const p of seen) expect(PHASES).toContain(p);
  }, 60_000);

  it("a throw that touches nothing skips the collision phase", async () => {
    const g = await AsyqGame.create(cfg(), true);
    g.start();
    while (g.state.phase === "choosePlayer") g.tick(0.1);
    g.throwSakha({ yaw: (45 * Math.PI) / 180, power: 0.4, spin: 0, roll: 0 });
    const seen = new Set<Phase>();
    let guard = 0;
    while (g.state.phase !== "aiming" && guard++ < 3000) {
      g.tick(1 / 60);
      seen.add(g.state.phase);
    }
    expect(seen.has("colliding")).toBe(false);
    expect(seen.has("judging")).toBe(true);
  }, 60_000);

  it("shows the sakha flying while it flies, and the result still while it is judged", async () => {
    const g = await AsyqGame.create(cfg(), true);
    g.start();
    while (g.state.phase === "choosePlayer") g.tick(0.1);
    expect(g.poses().map((p) => p.id)).toEqual(["a1", "a2", "a3", "a4", "a5"]);
    g.throwSakha(AT_ROW);
    const s0 = g.poses().find((p) => p.id === "s")!;
    g.tick(0.1);
    const s1 = g.poses().find((p) => p.id === "s")!;
    expect(s1.position[0]).toBeGreaterThan(s0.position[0] + 0.1);
    let guard = 0;
    while (g.state.phase !== "judging" && guard++ < 3000) g.tick(1 / 60);
    const judged = g.poses();
    expect(judged.find((p) => p.id === "s")).toBeDefined();
    expect(judged.every((p) => p.face !== undefined)).toBe(true);
    while (g.state.phase !== "aiming" && guard++ < 6000) g.tick(1 / 60);
    expect(g.poses().find((p) => p.id === "s")).toBeUndefined();
  }, 60_000);

  it("plays back at the same speed whatever the frame rate, and reaches the same result", async () => {
    const result = async (dt: number) => {
      const g = await AsyqGame.create(cfg(), true);
      g.start();
      while (g.state.phase === "choosePlayer") g.tick(dt);
      g.throwSakha({ ...AT_ROW, spin: 0.3 });
      let guard = 0;
      while (g.state.phase !== "aiming" && guard++ < 200_000) g.tick(dt);
      return JSON.stringify(g.state.history[0]) + JSON.stringify(g.state.field);
    };
    expect(await result(1 / 30)).toBe(await result(1 / 144));
  }, 60_000);
});

describe("who throws first", () => {
  const four = (over: Partial<RuleConfig> = {}) =>
    cfg({ players: ["A", "B", "C", "D"].map((name) => ({ name, sakha: "ortasha" })), turnOrder: "toss", ...over });

  it("when told to toss, orders everyone by the side their sakha lands on, best first, the same way every time", async () => {
    await loadPhysics();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const c = four({ seed });
      const a = tossForOrder(c), b = tossForOrder(c);
      expect(a).toEqual(b);
      expect([...a.order].sort()).toEqual([0, 1, 2, 3]);
      // in the first round, a better side never comes after a worse one
      const first = a.rounds[0];
      const ranks = a.order.map((p) => first.find((r) => r.player === p)!.rank);
      expect([...ranks]).toEqual([...ranks].sort((x, y) => x - y));
      for (const r of first) expect(r.rank).toBe(r.face ? FACE_INFO[r.face].rank : 5);
    }
  });

  it("tosses again among players who landed on the same side", async () => {
    await loadPhysics();
    let sawTie = false;
    for (let seed = 1; seed <= 30 && !sawTie; seed++) {
      const t = tossForOrder(four({ seed }));
      if (t.rounds.length > 1) {
        sawTie = true;
        const first = t.rounds[0];
        const second = t.rounds[1];
        const tied = new Set(second.map((r) => r.player));
        // everyone who tossed again shared a rank in the round before
        for (const p of tied) expect(first.filter((r) => r.rank === first.find((x) => x.player === p)!.rank).length).toBeGreaterThan(1);
      }
    }
    expect(sawTie).toBe(true);
  });

  it("different seeds give different orders", async () => {
    await loadPhysics();
    const orders = new Set(Array.from({ length: 12 }, (_, i) => tossForOrder(four({ seed: i + 1 })).order.join()));
    expect(orders.size).toBeGreaterThan(2);
  });

  it("one sakha tossed lands on a named side, and the broad sides are the common ones", async () => {
    await loadPhysics();
    const faces = Array.from({ length: 40 }, (_, i) => tossOne(four(), 0, 1000 + i).face);
    expect(faces.filter((f) => f === "buk" || f === "shik").length).toBeGreaterThan(faces.filter((f) => f === "alshy" || f === "tayke").length);
  });

  it("is used by the game: with toss on, the first to throw is the one the toss put first", async () => {
    const g = await AsyqGame.create(four({ seed: 4 }), false);
    g.start();
    expect(g.toss).not.toBeNull();
    expect(g.state.order).toEqual(g.toss!.order);
    expect(g.state.current).toBe(g.toss!.order[0]);
  });

  it("with seat order, nobody tosses", async () => {
    const g = await AsyqGame.create(four({ turnOrder: "sequence" }), false);
    g.start();
    expect(g.toss).toBeNull();
    expect(g.state.order).toEqual([0, 1, 2, 3]);
  });
});
