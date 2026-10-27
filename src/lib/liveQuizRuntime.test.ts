import { describe, expect, it } from "vitest";
import { GRACE_MS, aliasOf, createRoom, publicState, type HostState, type LiveQuestion, type Msg, type PublicState } from "./liveQuiz";
import { HostController, MemoryHub, PlayerClient } from "./liveQuizRuntime";

const CODE = "246810";
const LIMIT = 20_000;
const Q: LiveQuestion[] = [
  { id: "q1", text: "Бірінші?", options: ["а", "ә", "б", "в"], correct: 1 },
  { id: "q2", text: "Екінші?", options: ["а", "ә", "б", "в"], correct: 0 },
];

/** A classroom: one host, any number of phones, one fake clock. */
function classroom(names: string[] = ["Аружан", "Бота", "Ержан"]) {
  let t = 5_000_000;
  const now = () => t;
  const hub = new MemoryHub();
  const changes: HostState[] = [];
  const host = new HostController(hub.connect(), createRoom(CODE, Q, LIMIT), now, (s) => changes.push(s));
  const phones = names.map((n, i) => new PlayerClient(hub.connect(), CODE, `secret-${i}-${n}`, n, now));
  return { host, phones, hub, changes, advance: (ms: number) => (t += ms), now, tokenOf: (i: number) => `secret-${i}-${names[i]}` };
}

describe("a whole class playing", () => {
  it("joins, plays two questions with speed-based scores, and ends with the right podium", () => {
    const c = classroom();
    // everyone is in the host's room and told so
    expect(Object.values(c.host.state.players).map((p) => p.name)).toEqual(["Аружан", "Бота", "Ержан"]);
    for (const p of c.phones) expect(p.view).toMatchObject({ joined: true });
    expect(c.phones[0].view.state!.phase).toBe("lobby");
    expect(c.phones[0].view.state!.players.map((x) => x.name)).toEqual(["Аружан", "Бота", "Ержан"]);

    c.host.command({ type: "start" });
    for (const p of c.phones) {
      expect(p.view.state!.phase).toBe("question");
      expect(p.view.state!.question!.options).toEqual(["а", "ә", "б", "в"]);
    }

    // question 1: right answer is option 1
    c.advance(3_000);
    expect(c.phones[0].answer(1)).toBe(true); // 3 s → 925
    c.advance(2_000);
    expect(c.phones[1].answer(0)).toBe(true); // wrong
    expect(c.host.state.phase).toBe("question");
    c.advance(7_000);
    expect(c.phones[2].answer(1)).toBe(true); // 12 s → 700; everybody in: revealed at once
    expect(c.host.state.phase).toBe("reveal");
    for (const p of c.phones) expect(p.view.state!.phase).toBe("reveal");
    const board = c.phones[1].view.state!.board!;
    expect(board.map((r) => [r.name, r.score, r.rank])).toEqual([["Аружан", 925, 1], ["Ержан", 700, 2], ["Бота", 0, 3]]);
    expect(c.phones[1].view.state!.correct).toBe(1);
    expect(c.phones[1].view.state!.distribution).toEqual([1, 2, 0, 0]);

    // question 2: right is option 0; nobody answers: the clock closes it
    c.host.command({ type: "next" });
    expect(c.phones[0].view.state!.index).toBe(1);
    expect(c.phones[0].view.myChoice).toBeNull(); // a new question, a fresh choice
    c.advance(LIMIT + GRACE_MS - 1);
    c.host.tick();
    expect(c.host.state.phase).toBe("question");
    c.advance(1);
    c.host.tick();
    expect(c.host.state.phase).toBe("reveal");
    expect(c.phones[0].view.state!.board!.every((r) => r.gain === 0 && r.correct === false)).toBe(true);

    c.host.command({ type: "next" });
    expect(c.host.state.phase).toBe("finished");
    const final = c.phones[2].view.state!;
    expect(final.phase).toBe("finished");
    expect(final.board!.map((r) => r.name)).toEqual(["Аружан", "Ержан", "Бота"]);
    // each phone can find its own row by alias
    const mine = final.board!.find((r) => r.id === c.phones[2].alias)!;
    expect(mine).toMatchObject({ name: "Ержан", rank: 2, score: 700 });
  });

  it("the host's clock decides how fast an answer was, whenever the phone's message happens to arrive", () => {
    const c = classroom(["Аружан"]);
    c.host.command({ type: "start" });
    c.advance(4_000);
    c.phones[0].answer(1);
    expect(c.host.state.answers[c.tokenOf(0)].elapsedMs).toBe(4_000);
  });

  it("a phone that was told the question 6 s ago has 14 s left, by its own clock", () => {
    const c = classroom(["Аружан"]);
    c.host.command({ type: "start" });
    expect(c.phones[0].remainingMs()).toBe(LIMIT);
    c.advance(6_000);
    expect(c.phones[0].remainingMs()).toBe(14_000);
    c.advance(30_000);
    expect(c.phones[0].remainingMs()).toBe(0);
    expect(classroom().phones[0].remainingMs()).toBeNull(); // the lobby has no clock
  });

  it("a player may answer once from the phone, and the buttons stop after", () => {
    const c = classroom(["Аружан", "Бота"]);
    c.host.command({ type: "start" });
    expect(c.phones[0].answer(2)).toBe(true);
    expect(c.phones[0].answer(1)).toBe(false);
    expect(c.phones[0].view.myChoice).toBe(2);
    expect(c.host.state.answers[c.tokenOf(0)].choice).toBe(2);
    // not before the question, nor in the reveal
    const lobby = classroom(["Аружан"]);
    expect(lobby.phones[0].answer(0)).toBe(false);
  });

  it("a refreshed phone comes back as the same player, in the middle of the game", () => {
    const c = classroom(["Аружан", "Бота"]);
    c.host.command({ type: "start" });
    c.advance(2_000);
    c.phones[0].answer(1);
    // the page reloads: a new client with the same token
    const again = new PlayerClient(c.hub.connect(), CODE, c.tokenOf(0), "Аружан", c.now);
    expect(again.view.joined).toBe(true);
    expect(again.view.state!.phase).toBe("question");
    expect(again.view.state!.answered).toContain(again.alias);
    expect(again.answer(0)).toBe(false); // it already answered: the host would refuse and so does the phone
    expect(Object.keys(c.host.state.players)).toHaveLength(2);
  });

  it("nobody joins after the start", () => {
    const c = classroom(["Аружан"]);
    c.host.command({ type: "start" });
    const late = new PlayerClient(c.hub.connect(), CODE, "late-token", "Кеш", c.now);
    expect(late.view.joined).toBe(false);
    expect(Object.keys(c.host.state.players)).toEqual([c.tokenOf(0)]);
    expect(late.answer(1)).toBe(false);
  });
});

describe("what goes over the wire", () => {
  it("never shows the right answer while a question is open, to anyone, in any message", () => {
    const c = classroom();
    c.host.command({ type: "start" });
    c.advance(5_000);
    c.host.broadcast();
    const during = c.hub.sent.filter((m): m is Extract<Msg, { t: "state" }> => m.t === "state" && m.state.phase === "question");
    expect(during.length).toBeGreaterThan(0);
    for (const m of during) {
      expect(m.state.correct).toBeNull();
      expect(m.state.distribution).toBeNull();
      expect(m.state.board).toBeNull();
      expect(JSON.stringify(m)).not.toMatch(/"correct":\d/);
    }
  });

  it("never carries a player's secret token", () => {
    const c = classroom();
    c.host.command({ type: "start" });
    c.phones[0].answer(1);
    c.phones[1].answer(1);
    c.phones[2].answer(1);
    c.host.command({ type: "next" });
    c.host.command({ type: "end" });
    for (const m of c.hub.sent.filter((x) => x.t === "state")) {
      for (let i = 0; i < 3; i++) expect(JSON.stringify(m)).not.toContain(c.tokenOf(i));
    }
  });

  it("tells everyone only when something changed, and on every join", () => {
    const c = classroom(["Аружан"]);
    const states = () => c.hub.sent.filter((m) => m.t === "state").length;
    const before = states();
    c.host.tick(); // nothing to do in the lobby
    expect(states()).toBe(before);
    c.host.command({ type: "start" });
    expect(states()).toBe(before + 1);
    new PlayerClient(c.hub.connect(), CODE, "x", "x", c.now); // a late join is refused, but the newcomer is told where things stand
    expect(states()).toBeGreaterThan(before + 1);
  });
});

describe("the host's own bookkeeping", () => {
  it("stays quiet about an answer it refuses (a duplicate) and says nothing for a no-op", () => {
    const c = classroom(["Аружан", "Бота"]);
    c.host.command({ type: "start" });
    c.phones[0].answer(1);
    const states = () => c.hub.sent.filter((m) => m.t === "state").length;
    const before = states();
    c.hub.connect().send({ t: "answer", code: CODE, playerId: c.tokenOf(0), choice: 2 });
    expect(states()).toBe(before);
  });

  it("reports each real change to the teacher's screen, and nothing else", () => {
    const c = classroom(["Аружан"]);
    const afterJoin = c.changes.length;
    expect(afterJoin).toBe(1);
    c.host.tick(); // a no-op in the lobby
    expect(c.changes).toHaveLength(afterJoin);
    c.host.command({ type: "start" });
    expect(c.changes).toHaveLength(afterJoin + 1);
    expect(c.changes[c.changes.length - 1]).toBe(c.host.state);
  });

  it("answers a bare join message with the state, even when the join is refused", () => {
    const c = classroom(["Аружан"]);
    c.host.command({ type: "start" });
    const raw = c.hub.connect();
    const before = c.hub.sent.length;
    raw.send({ t: "join", code: CODE, playerId: "late", name: "late" });
    const reply = c.hub.sent.slice(before).filter((m) => m.t === "state");
    expect(reply).toHaveLength(1);
    expect(Object.keys(c.host.state.players)).toEqual([c.tokenOf(0)]);
  });

  it("refuses a join whose name is absurdly long rather than guessing", () => {
    const c = classroom([]);
    const raw = c.hub.connect();
    raw.send({ t: "join", code: CODE, playerId: "p", name: "z".repeat(500) });
    expect(Object.keys(c.host.state.players)).toEqual([]);
    raw.send({ t: "join", code: CODE, playerId: "p", name: "z".repeat(200) });
    expect(Object.values(c.host.state.players).map((p) => p.name)).toEqual(["z".repeat(20)]);
  });
});

describe("a slow or stalled phone", () => {
  it("cannot answer twice by tapping again before the host has confirmed the first tap", () => {
    let t = 1_000;
    const hub = new MemoryHub(true);
    const host = new HostController(hub.connect(), createRoom(CODE, Q, LIMIT), () => t);
    const phone = new PlayerClient(hub.connect(), CODE, "tok", "Аружан", () => t);
    hub.flush();
    host.command({ type: "start" });
    hub.flush();
    expect(phone.view.state!.phase).toBe("question");
    expect(phone.answer(1)).toBe(true);
    expect(phone.answer(2)).toBe(false); // the host's confirmation is still on its way
    hub.flush();
    expect(host.state.answers.tok.choice).toBe(1);
    expect(hub.sent.filter((m) => m.t === "answer")).toHaveLength(1);
  });

  it("catches up with the host's clock at the next snapshot, even though nothing in the room changed", () => {
    let hostT = 1_000;
    let phoneT = 1_000;
    const hub = new MemoryHub();
    const host = new HostController(hub.connect(), createRoom(CODE, Q, LIMIT), () => hostT);
    const phone = new PlayerClient(hub.connect(), CODE, "tok", "Аружан", () => phoneT);
    host.command({ type: "start" });
    // the phone's page was in the background: its timers (and so its clock reading) stood still while 8 s passed
    hostT += 8_000;
    expect(phone.remainingMs()).toBe(LIMIT);
    host.broadcast(); // the host's heartbeat: same seq as before
    expect(phone.remainingMs()).toBe(LIMIT - 8_000);
  });
});

describe("hostile and broken messages", () => {
  const spoofer = (c: ReturnType<typeof classroom>) => c.hub.connect();

  it("the host takes nothing but join, answer and hello from the network: a forged state from a player changes nothing", () => {
    const c = classroom(["Аружан", "Бота"]);
    const evil = spoofer(c);
    const fake: PublicState = { ...publicState(c.host.state, c.now()), phase: "finished", seq: 9999 };
    evil.send({ t: "state", state: fake });
    expect(c.host.state.phase).toBe("lobby");
    expect(c.host.state.seq).toBeLessThan(100);
  });

  it("ignores messages for another room, malformed messages and unknown types", () => {
    const c = classroom(["Аружан", "Бота"]);
    c.host.command({ type: "start" });
    const evil = spoofer(c);
    const seqBefore = c.host.state.seq;
    const junk: unknown[] = [
      { t: "answer", code: "000000", playerId: c.tokenOf(0), choice: 1 }, // wrong room
      { t: "answer", code: CODE, playerId: c.tokenOf(0), choice: "1" }, // a string
      { t: "answer", code: CODE, playerId: c.tokenOf(0) }, // no choice
      { t: "answer", code: CODE, choice: 1 }, // no player
      { t: "answer", code: CODE, playerId: 5, choice: 1 }, // not a string
      { t: "answer", code: CODE, playerId: "x".repeat(65), choice: 1 },
      { t: "join", code: CODE, playerId: "y", name: 5 },
      { t: "join", code: CODE, playerId: "y", name: "z".repeat(500) },
      { t: "reveal" },
      { t: "next", code: CODE },
      { type: "answer" },
      null,
      "hello",
      42,
      [],
    ];
    for (const m of junk) evil.send(m as Msg);
    expect(c.host.state.seq).toBe(seqBefore);
    expect(c.host.state.answers).toEqual({});
  });

  it("an answer in someone else's name fails without their secret token — the alias on the wire is no use", () => {
    const c = classroom(["Аружан", "Бота"]);
    c.host.command({ type: "start" });
    const evil = spoofer(c);
    const victimAlias = c.phones[0].alias;
    expect(c.phones[1].view.state!.players.map((p) => p.id)).toContain(victimAlias); // the alias is public…
    evil.send({ t: "answer", code: CODE, playerId: victimAlias, choice: 3 }); // …but is not the key
    expect(Object.keys(c.host.state.answers)).toEqual([]);
  });

  it("a second answer sent by hand, straight at the host, still counts only once", () => {
    const c = classroom(["Аружан", "Бота"]);
    c.host.command({ type: "start" });
    const own = c.hub.connect();
    c.advance(1_000);
    own.send({ t: "answer", code: CODE, playerId: c.tokenOf(0), choice: 1 });
    own.send({ t: "answer", code: CODE, playerId: c.tokenOf(0), choice: 2 });
    expect(c.host.state.answers[c.tokenOf(0)].choice).toBe(1);
  });

  it("a player ignores a snapshot from another room, a malformed one, and an older one that arrives late", () => {
    const c = classroom(["Аружан"]);
    const p = c.phones[0];
    const evil = spoofer(c);
    const cur = p.view.state!;
    evil.send({ t: "state", state: { ...cur, code: "999999", phase: "finished", seq: 99999 } });
    evil.send({ t: "state" } as unknown as Msg);
    evil.send({ t: "state", state: null } as unknown as Msg);
    expect(p.view.state).toEqual(cur);
    c.host.command({ type: "start" });
    const now = p.view.state!;
    evil.send({ t: "state", state: { ...cur } }); // the old lobby snapshot, late
    expect(p.view.state).toBe(now);
    expect(p.view.state!.phase).toBe("question");
  });

  it("closing a host or a phone stops it listening", () => {
    const c = classroom(["Аружан"]);
    c.phones[0].close();
    const seen: number[] = [];
    c.phones[0].subscribe((v) => seen.push(v.state?.seq ?? -1));
    c.host.command({ type: "start" });
    expect(seen).toEqual([]);
    c.host.close();
    const evil = c.hub.connect();
    evil.send({ t: "join", code: CODE, playerId: "after", name: "after" });
    expect(Object.keys(c.host.state.players)).toEqual([c.tokenOf(0)]);
  });
});
