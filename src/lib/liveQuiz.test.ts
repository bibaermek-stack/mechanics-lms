import { describe, expect, it } from "vitest";
import {
  GRACE_MS,
  MAX_PLAYERS,
  NAME_MAX,
  aliasOf,
  cleanName,
  createRoom,
  isRoomCode,
  leaderboard,
  newRoomCode,
  pointsFor,
  publicState,
  reduce,
  type HostState,
  type LiveEvent,
  type LiveQuestion,
} from "./liveQuiz";

const CODE = "123456";
const LIMIT = 20_000;
const T0 = 1_000_000;
const Q: LiveQuestion[] = [
  { id: "q1", text: "Бірінші?", options: ["а", "ә", "б", "в"], correct: 1 },
  { id: "q2", text: "Екінші?", options: ["а", "ә", "б", "в"], correct: 0 },
  { id: "q3", text: "Үшінші?", options: ["а", "ә", "б", "в"], correct: 2 },
];

const run = (s: HostState, ...steps: [LiveEvent, number?][]) => steps.reduce((st, [e, t]) => reduce(st, e, t ?? T0), s);
const join = (id: string, name = id): [LiveEvent, number] => [{ type: "join", playerId: id, name }, T0];
const lobby = (...ids: string[]) => run(createRoom(CODE, Q, LIMIT), ...ids.map((id) => join(id)));
const started = (...ids: string[]) => run(lobby(...ids), [{ type: "start" }, T0]);
const answer = (id: string, choice: number, at: number): [LiveEvent, number] => [{ type: "answer", playerId: id, choice }, at];

describe("points", () => {
  it("run from 1000 for an instant answer to 500 on the buzzer, in proportion", () => {
    expect(pointsFor(0, LIMIT)).toBe(1000);
    expect(pointsFor(LIMIT, LIMIT)).toBe(500);
    expect(pointsFor(10_000, LIMIT)).toBe(750);
    expect(pointsFor(5_000, LIMIT)).toBe(875);
    expect(pointsFor(15_000, LIMIT)).toBe(625);
    expect(pointsFor(3_000, LIMIT)).toBe(925);
    expect(pointsFor(12_000, LIMIT)).toBe(700);
  });
  it("round to the nearest point and never leave the 500–1000 range", () => {
    expect(pointsFor(20, LIMIT)).toBe(1000); // 999,5
    expect(pointsFor(21, LIMIT)).toBe(999); // 999,475
    expect(pointsFor(-5000, LIMIT)).toBe(1000);
    expect(pointsFor(LIMIT * 3, LIMIT)).toBe(500);
  });
  it("scale with the question's own time limit", () => {
    expect(pointsFor(15_000, 30_000)).toBe(750);
    expect(pointsFor(5_000, 10_000)).toBe(750);
  });
});

describe("names", () => {
  it("are tidied: spaces collapsed, controls dropped, 20 letters at most (counting letters, not bytes)", () => {
    expect(cleanName("  Айгерім   Болат  ")).toBe("Айгерім Болат");
    expect(cleanName("A\u0000B\u0007C\nD")).toBe("A B C D");
    expect(cleanName("а".repeat(25))).toBe("а".repeat(NAME_MAX));
    expect([...cleanName("😀".repeat(25))]).toHaveLength(NAME_MAX);
    expect(cleanName("   ")).toBe("");
    expect(cleanName("")).toBe("");
  });
});

describe("the lobby", () => {
  it("lets players in with their names, and tells them apart when the names clash (without regard to case)", () => {
    const s = lobby("a", "b", "c");
    expect(Object.values(s.players).map((p) => p.name)).toEqual(["a", "b", "c"]);
    const dup = run(createRoom(CODE, Q, LIMIT), join("1", "Али"), join("2", "али"), join("3", "АЛИ"));
    expect(Object.values(dup.players).map((p) => p.name)).toEqual(["Али", "али 2", "АЛИ 3"]);
    const long = run(createRoom(CODE, Q, LIMIT), join("1", "а".repeat(20)), join("2", "а".repeat(20)));
    const names = Object.values(long.players).map((p) => p.name);
    expect(names[1]).toBe("а".repeat(18) + " 2");
    expect([...names[1]]).toHaveLength(20);
  });

  it("turns away an empty name, a sixth-hundred player, and a second try of the same phone", () => {
    const s = createRoom(CODE, Q, LIMIT);
    expect(reduce(s, { type: "join", playerId: "a", name: "   " }, T0)).toBe(s);
    const one = lobby("a");
    expect(reduce(one, { type: "join", playerId: "a", name: "Other" }, T0)).toBe(one); // a refreshed phone is still itself
    expect(one.players.a.name).toBe("a");
    let full = createRoom(CODE, Q, LIMIT);
    for (let i = 0; i < MAX_PLAYERS; i++) full = reduce(full, { type: "join", playerId: `p${i}`, name: `n${i}` }, T0);
    expect(Object.keys(full.players)).toHaveLength(MAX_PLAYERS);
    expect(reduce(full, { type: "join", playerId: "extra", name: "extra" }, T0)).toBe(full);
  });

  it("refuses a token whose alias is already taken (a one-in-billions clash, found here by a birthday search)", () => {
    const seen = new Map<string, string>();
    let pair: [string, string] | null = null;
    for (let i = 0; i < 2_000_000 && !pair; i++) {
      const token = `t${i}`;
      const alias = aliasOf(CODE, token);
      const other = seen.get(alias);
      if (other) pair = [other, token];
      else seen.set(alias, token);
    }
    expect(pair, "no colliding pair in two million tokens").not.toBeNull();
    const [first, second] = pair!;
    const s = lobby(first);
    expect(aliasOf(CODE, first)).toBe(aliasOf(CODE, second));
    expect(reduce(s, { type: "join", playerId: second, name: "twin" }, T0)).toBe(s);
    // and a token with a free alias is let in as usual
    expect(Object.keys(reduce(s, { type: "join", playerId: "other-token", name: "ok" }, T0).players)).toHaveLength(2);
  });

  it("lets a player leave, but only before the quiz starts", () => {
    const s = lobby("a", "b");
    expect(Object.keys(reduce(s, { type: "leave", playerId: "a" }, T0).players)).toEqual(["b"]);
    expect(reduce(s, { type: "leave", playerId: "zzz" }, T0)).toBe(s);
    const go = run(s, [{ type: "start" }, T0]);
    expect(reduce(go, { type: "leave", playerId: "a" }, T0)).toBe(go);
  });

  it("closes at the start: nobody joins a quiz in progress", () => {
    const s = started("a");
    expect(reduce(s, { type: "join", playerId: "late", name: "late" }, T0 + 1)).toBe(s);
  });

  it("starts only with a question and a player", () => {
    const empty = createRoom(CODE, Q, LIMIT);
    expect(reduce(empty, { type: "start" }, T0)).toBe(empty);
    const noQuestions = run(createRoom(CODE, [], LIMIT), join("a"));
    expect(reduce(noQuestions, { type: "start" }, T0)).toBe(noQuestions);
    const s = started("a");
    expect(s).toMatchObject({ phase: "question", index: 0, startedAt: T0 });
    expect(reduce(s, { type: "start" }, T0 + 5)).toBe(s);
  });
});

describe("answering", () => {
  it("is measured by the host's clock, not the player's", () => {
    const s = run(started("a", "b"), answer("a", 1, T0 + 3_000));
    expect(s.answers.a).toEqual({ choice: 1, elapsedMs: 3_000 });
    expect(s.phase).toBe("question"); // b has not answered yet
  });

  it("takes only the first answer of each player", () => {
    const s = run(started("a", "b"), answer("a", 1, T0 + 1_000));
    expect(reduce(s, { type: "answer", playerId: "a", choice: 0 }, T0 + 2_000)).toBe(s);
    expect(s.answers.a.choice).toBe(1);
  });

  it("ignores a stranger, a choice outside the options, and a non-whole choice", () => {
    const s = started("a", "b");
    for (const choice of [-1, 4, 1.5, NaN, Infinity]) expect(reduce(s, { type: "answer", playerId: "a", choice }, T0 + 100), String(choice)).toBe(s);
    expect(reduce(s, { type: "answer", playerId: "nobody", choice: 1 }, T0 + 100)).toBe(s);
    expect(reduce(s, { type: "answer", playerId: "a", choice: 3 }, T0 + 100).answers.a.choice).toBe(3); // the last option is allowed
    expect(reduce(s, { type: "answer", playerId: "a", choice: 0 }, T0 + 100).answers.a.choice).toBe(0); // and the first
  });

  it("is accepted up to the limit plus the grace, and is worth the least after the limit", () => {
    const s = started("a", "b");
    expect(reduce(s, { type: "answer", playerId: "a", choice: 1 }, T0 + LIMIT + GRACE_MS).answers.a).toEqual({ choice: 1, elapsedMs: LIMIT });
    expect(reduce(s, { type: "answer", playerId: "a", choice: 1 }, T0 + LIMIT + GRACE_MS + 1)).toBe(s);
    expect(reduce(s, { type: "answer", playerId: "a", choice: 1 }, T0 - 50).answers.a.elapsedMs).toBe(0); // a clock that stepped back is not a negative time
  });

  it("is refused outside a question: in the lobby, once revealed, once finished", () => {
    const l = lobby("a");
    expect(reduce(l, { type: "answer", playerId: "a", choice: 1 }, T0)).toBe(l);
    const r = run(started("a", "b"), [{ type: "reveal" }, T0 + 1]);
    expect(reduce(r, { type: "answer", playerId: "a", choice: 1 }, T0 + 2)).toBe(r);
  });

  it("reveals at once when everybody has answered", () => {
    const s = run(started("a", "b"), answer("a", 1, T0 + 1_000), answer("b", 0, T0 + 2_000));
    expect(s.phase).toBe("reveal");
  });
});

describe("revealing", () => {
  it("scores right answers by speed, wrong and missing ones nothing, and adds up", () => {
    // question 1: correct is option 1
    let s = run(started("a", "b", "c"), answer("a", 1, T0 + 3_000), answer("b", 0, T0 + 5_000), [{ type: "reveal" }, T0 + 6_000]);
    expect(s.phase).toBe("reveal");
    expect(s.players.a).toMatchObject({ score: 925, lastGain: 925, lastCorrect: true });
    expect(s.players.b).toMatchObject({ score: 0, lastGain: 0, lastCorrect: false });
    expect(s.players.c).toMatchObject({ score: 0, lastGain: 0, lastCorrect: false }); // never answered
    // question 2: correct is option 0
    s = run(s, [{ type: "next" }, T0 + 10_000], answer("a", 0, T0 + 10_000 + 10_000), answer("b", 0, T0 + 10_000 + 1_000), [{ type: "reveal" }, T0 + 25_000]);
    expect(s.players.a.score).toBe(925 + 750);
    expect(s.players.b.score).toBe(975);
    expect(s.players.c.score).toBe(0);
  });

  it("happens only during a question", () => {
    const l = lobby("a");
    expect(reduce(l, { type: "reveal" }, T0)).toBe(l);
    const r = run(started("a", "b"), [{ type: "reveal" }, T0]);
    expect(reduce(r, { type: "reveal" }, T0)).toBe(r);
  });

  it("is triggered by the clock: not a moment before limit + grace, and from then on", () => {
    const s = started("a");
    expect(reduce(s, { type: "tick" }, T0 + LIMIT + GRACE_MS - 1)).toBe(s);
    expect(reduce(s, { type: "tick" }, T0 + LIMIT + GRACE_MS).phase).toBe("reveal");
    expect(reduce(lobby("a"), { type: "tick" }, T0 + 1e9).phase).toBe("lobby");
  });

  it("a late answer that was already on the wire still counts before the clock closes the question", () => {
    const s = started("a", "b");
    const withLate = reduce(s, { type: "answer", playerId: "a", choice: 1 }, T0 + LIMIT + 300);
    expect(withLate.answers.a.elapsedMs).toBe(LIMIT);
    expect(reduce(withLate, { type: "tick" }, T0 + LIMIT + GRACE_MS).players.a.lastGain).toBe(500);
  });
});

describe("moving on", () => {
  it("goes question by question, resets the answers, restarts the clock, and ends with a finished room", () => {
    let s = run(started("a"), answer("a", 1, T0 + 1_000));
    expect(s.phase).toBe("reveal");
    s = reduce(s, { type: "next" }, T0 + 9_000);
    expect(s).toMatchObject({ phase: "question", index: 1, startedAt: T0 + 9_000, answers: {} });
    s = run(s, answer("a", 0, T0 + 9_500), [{ type: "next" }, T0 + 10_000], answer("a", 2, T0 + 10_200));
    expect(s).toMatchObject({ phase: "reveal", index: 2 });
    s = reduce(s, { type: "next" }, T0 + 11_000);
    expect(s.phase).toBe("finished");
    expect(reduce(s, { type: "next" }, T0 + 12_000)).toBe(s);
  });

  it("does not move on from a question that is still open", () => {
    const s = started("a", "b");
    expect(reduce(s, { type: "next" }, T0 + 1)).toBe(s);
  });

  it("can be ended by the teacher from anywhere, without scoring the question in progress", () => {
    const q = run(started("a", "b"), answer("a", 1, T0 + 100));
    const e = reduce(q, { type: "end" }, T0 + 200);
    expect(e.phase).toBe("finished");
    expect(e.players.a.score).toBe(0);
    expect(reduce(e, { type: "end" }, T0 + 300)).toBe(e);
    expect(reduce(lobby("a"), { type: "end" }, T0).phase).toBe("finished");
  });

  it("counts every change in seq, and no no-op", () => {
    const a = createRoom(CODE, Q, LIMIT);
    const b = reduce(a, { type: "join", playerId: "a", name: "a" }, T0);
    const c = reduce(b, { type: "start" }, T0);
    expect([a.seq, b.seq, c.seq]).toEqual([0, 1, 2]);
    expect(reduce(c, { type: "tick" }, T0 + 1).seq).toBe(2);
  });

  it("never changes the state it was given", () => {
    const s = started("a", "b");
    const frozen = JSON.stringify(s);
    reduce(s, { type: "answer", playerId: "a", choice: 1 }, T0 + 10);
    reduce(s, { type: "reveal" }, T0 + 20);
    reduce(s, { type: "end" }, T0 + 30);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe("the leaderboard", () => {
  it("ranks by score, ties share a rank and the next is skipped, equal scores keep the order they joined", () => {
    let s = createRoom(CODE, Q, LIMIT);
    s = run(s, join("a", "A"), join("b", "B"), join("c", "C"), join("d", "D"));
    s = { ...s, players: { a: { ...s.players.a, score: 800, joinedAt: 4 }, b: { ...s.players.b, score: 1000, joinedAt: 3 }, c: { ...s.players.c, score: 800, joinedAt: 2 }, d: { ...s.players.d, score: 500, joinedAt: 1 } } };
    const rows = leaderboard(s);
    expect(rows.map((r) => [r.name, r.score, r.rank])).toEqual([["B", 1000, 1], ["C", 800, 2], ["A", 800, 2], ["D", 500, 4]]);
  });
  it("names rows by alias, never by token", () => {
    const rows = leaderboard(run(createRoom(CODE, Q, LIMIT), join("secret-token-1", "Аружан"), join("secret-token-2", "Бота")));
    expect(rows.map((r) => r.id).sort()).toEqual([aliasOf(CODE, "secret-token-1"), aliasOf(CODE, "secret-token-2")].sort());
    expect(JSON.stringify(rows)).not.toContain("secret-token");
  });
});

describe("what the players are told", () => {
  const tok = ["tok-a-123", "tok-b-456"];
  // the display names are not the tokens: a token must never turn up on the wire
  const named = () => run(createRoom(CODE, Q, LIMIT), join(tok[0], "Аружан"), join(tok[1], "Бота"));
  const q = () => run(named(), [{ type: "start" }, T0]);

  it("hides the right answer while the question is open, and shows only the text and options", () => {
    const p = publicState(q(), T0 + 5_000);
    expect(p.phase).toBe("question");
    expect(p.correct).toBeNull();
    expect(p.distribution).toBeNull();
    expect(p.board).toBeNull();
    expect(Object.keys(p.question!).sort()).toEqual(["options", "text"]);
    expect(p.remainingMs).toBe(LIMIT - 5_000);
    expect(JSON.stringify(p)).not.toMatch(/"correct":\d/);
  });

  it("reveals the answer, how the class chose, and the board — together, after the question", () => {
    const s = run(q(), answer(tok[0], 1, T0 + 2_000), answer(tok[1], 3, T0 + 4_000));
    const p = publicState(s, T0 + 5_000);
    expect(p.phase).toBe("reveal");
    expect(p.correct).toBe(1);
    expect(p.distribution).toEqual([0, 1, 0, 1]);
    expect(p.remainingMs).toBeNull();
    expect(p.board!.map((r) => [r.rank, r.gain, r.correct])).toEqual([[1, 950, true], [2, 0, false]]);
  });

  it("never carries a player's token: only aliases, in the player list, the answered list and the board", () => {
    const s = run(q(), answer(tok[0], 1, T0 + 2_000), [{ type: "reveal" }, T0 + 3_000]);
    const wire = JSON.stringify(publicState(s, T0 + 4_000));
    for (const t of tok) expect(wire).not.toContain(t);
    expect(publicState(s, T0).players.map((x) => x.id)).toEqual(tok.map((t) => aliasOf(CODE, t)));
    expect(publicState(s, T0).answered).toEqual([aliasOf(CODE, tok[0])]);
  });

  it("says who has answered, in the lobby shows no question, and when finished only the board", () => {
    expect(publicState(named(), T0).question).toBeNull();
    expect(publicState(named(), T0).board).toBeNull();
    const s = run(q(), answer(tok[0], 1, T0 + 1_000));
    expect(publicState(s, T0 + 1_500).answered).toEqual([aliasOf(CODE, tok[0])]);
    const fin = run(q(), [{ type: "end" }, T0 + 2_000]);
    const p = publicState(fin, T0 + 3_000);
    expect(p).toMatchObject({ phase: "finished", question: null, correct: null, remainingMs: null });
    expect(p.board).toHaveLength(2);
  });

  it("counts the time down and never below zero", () => {
    expect(publicState(q(), T0 + LIMIT + 5_000).remainingMs).toBe(0);
    expect(publicState(q(), T0).remainingMs).toBe(LIMIT);
  });
});

describe("room codes", () => {
  it("are six digits and range over all of them", () => {
    expect(isRoomCode(newRoomCode(() => 0))).toBe(true);
    expect(newRoomCode(() => 0)).toBe("100000");
    expect(newRoomCode(() => 0.999999999)).toBe("999999");
    for (let i = 0; i < 50; i++) expect(isRoomCode(newRoomCode())).toBe(true);
    for (const bad of ["12345", "1234567", "12a456", "", " 123456", "٠١٢٣٤٥"]) expect(isRoomCode(bad), bad).toBe(false);
  });
});
