// A live class quiz in the style of Kahoot: the teacher shows a question, everyone answers
// on their own phone, faster correct answers score more, and a leaderboard follows each
// question.
//
// The teacher's browser is the server. It owns the room's state and is the only one that
// ever applies an event, using its OWN clock for how long an answer took — so a player's
// phone cannot make itself faster, and the right answer is never sent to a player until the
// question is revealed. Everything below is pure (state, event, time in → state out), which
// is what makes it testable with a fake clock; liveQuizRuntime.ts wires it to a transport.
//
// A player's id is a SECRET token only their phone knows: whoever holds it can answer for
// them. Everything broadcast to the room names players by an alias derived from the token
// (aliasOf) — a phone works out its own alias to find itself, nobody can work backwards.

import { hashSeed } from "./rng";

export const MAX_PLAYERS = 100;
export const NAME_MAX = 20;
/** How long after the deadline an answer that was already on its way is still accepted. */
export const GRACE_MS = 800;
export const MIN_POINTS = 500;
export const MAX_POINTS = 1000;

export interface LiveQuestion {
  id: string;
  text: string;
  options: string[];
  /** Index into options. */
  correct: number;
}

export type Phase = "lobby" | "question" | "reveal" | "finished";

export interface Player {
  name: string;
  joinedAt: number;
  score: number;
  /** Points won by the last revealed question, and whether the answer was right. */
  lastGain: number;
  lastCorrect: boolean | null;
}

export interface Answer {
  choice: number;
  /** Host-measured, 0…timeLimit. */
  elapsedMs: number;
}

export interface HostState {
  code: string;
  /** Rises with every change; players ignore a snapshot older than the one they have. */
  seq: number;
  phase: Phase;
  questions: LiveQuestion[];
  timeLimitMs: number;
  /** −1 in the lobby. */
  index: number;
  /** Host clock, ms, when the current question opened. */
  startedAt: number | null;
  players: Record<string, Player>;
  /** For the current question only. */
  answers: Record<string, Answer>;
}

export type LiveEvent =
  | { type: "join"; playerId: string; name: string }
  | { type: "leave"; playerId: string }
  | { type: "start" }
  | { type: "answer"; playerId: string; choice: number }
  | { type: "reveal" }
  | { type: "next" }
  | { type: "tick" }
  | { type: "end" };

export function createRoom(code: string, questions: LiveQuestion[], timeLimitMs: number): HostState {
  return { code, seq: 0, phase: "lobby", questions, timeLimitMs, index: -1, startedAt: null, players: {}, answers: {} };
}

/** What the room is told in place of a player's token. One-way: the alias cannot be turned back into the token. */
export const aliasOf = (code: string, token: string) => hashSeed(`${code}:${token}`).toString(36);

/** 500 for an answer on the buzzer, 1000 for an instant one, in proportion between. */
export function pointsFor(elapsedMs: number, timeLimitMs: number): number {
  const f = Math.min(1, Math.max(0, elapsedMs / timeLimitMs));
  return Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * (1 - f));
}

/** A name as it will be shown: no control characters, spaces collapsed, at most NAME_MAX letters. */
export function cleanName(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return [...s].slice(0, NAME_MAX).join("").trim();
}

function uniqueName(base: string, taken: Iterable<string>): string {
  const used = new Set([...taken].map((n) => n.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let k = 2; ; k++) {
    const suffix = ` ${k}`;
    const name = [...base].slice(0, NAME_MAX - suffix.length).join("").trimEnd() + suffix;
    if (!used.has(name.toLowerCase())) return name;
  }
}

const bump = (s: HostState, patch: Partial<HostState>): HostState => ({ ...s, ...patch, seq: s.seq + 1 });

function reveal(s: HostState): HostState {
  const q = s.questions[s.index];
  const players: Record<string, Player> = {};
  for (const [id, p] of Object.entries(s.players)) {
    const a = s.answers[id];
    const right = a !== undefined && a.choice === q.correct;
    const gain = right ? pointsFor(a.elapsedMs, s.timeLimitMs) : 0;
    players[id] = { ...p, score: p.score + gain, lastGain: gain, lastCorrect: right };
  }
  return bump(s, { phase: "reveal", players });
}

/**
 * The only way the room changes. Returns the very same object when the event does nothing
 * (an answer after the deadline, a join after the start…), so a caller can tell by `===`
 * whether anything needs broadcasting.
 */
export function reduce(s: HostState, e: LiveEvent, now: number): HostState {
  switch (e.type) {
    case "join": {
      if (s.phase !== "lobby") return s;
      if (Object.keys(s.players).length >= MAX_PLAYERS) return s;
      const alias = aliasOf(s.code, e.playerId);
      // the same phone again (a refresh) is itself, not a second player; a different token with the same alias is a one-in-billions clash
      if (Object.keys(s.players).some((t) => aliasOf(s.code, t) === alias)) return s;
      const base = cleanName(e.name);
      if (!base) return s;
      const name = uniqueName(base, Object.values(s.players).map((p) => p.name));
      return bump(s, { players: { ...s.players, [e.playerId]: { name, joinedAt: now, score: 0, lastGain: 0, lastCorrect: null } } });
    }
    case "leave": {
      if (s.phase !== "lobby" || !s.players[e.playerId]) return s;
      const { [e.playerId]: _gone, ...rest } = s.players;
      return bump(s, { players: rest });
    }
    case "start": {
      if (s.phase !== "lobby" || s.questions.length === 0 || Object.keys(s.players).length === 0) return s;
      return bump(s, { phase: "question", index: 0, startedAt: now, answers: {} });
    }
    case "answer": {
      if (s.phase !== "question" || s.startedAt === null) return s;
      if (!s.players[e.playerId] || s.answers[e.playerId]) return s;
      const q = s.questions[s.index];
      if (!Number.isInteger(e.choice) || e.choice < 0 || e.choice >= q.options.length) return s;
      const took = now - s.startedAt;
      if (took > s.timeLimitMs + GRACE_MS) return s;
      const answers = { ...s.answers, [e.playerId]: { choice: e.choice, elapsedMs: Math.min(s.timeLimitMs, Math.max(0, took)) } };
      const next = bump(s, { answers });
      // everyone is in: no reason to wait out the clock
      return Object.keys(next.players).every((id) => answers[id]) ? reveal(next) : next;
    }
    case "reveal":
      return s.phase === "question" ? reveal(s) : s;
    case "next": {
      if (s.phase !== "reveal") return s;
      if (s.index + 1 < s.questions.length) return bump(s, { phase: "question", index: s.index + 1, startedAt: now, answers: {} });
      return bump(s, { phase: "finished" });
    }
    case "tick":
      return s.phase === "question" && s.startedAt !== null && now - s.startedAt >= s.timeLimitMs + GRACE_MS ? reveal(s) : s;
    case "end":
      return s.phase === "finished" ? s : bump(s, { phase: "finished" });
  }
}

// ---------------------------------------------------------------------------
// The leaderboard
// ---------------------------------------------------------------------------

export interface BoardRow {
  id: string;
  name: string;
  score: number;
  /** 1-based; equal scores share a rank and the next rank is skipped (1, 2, 2, 4). */
  rank: number;
  gain: number;
  correct: boolean | null;
}

/** Rows are named by alias, never by token. */
export function leaderboard(s: Pick<HostState, "players" | "code">): BoardRow[] {
  const sorted = Object.entries(s.players)
    .map(([token, p]) => ({ id: aliasOf(s.code, token), p }))
    .sort((a, b) => b.p.score - a.p.score || a.p.joinedAt - b.p.joinedAt || a.p.name.localeCompare(b.p.name));
  let rank = 0;
  return sorted.map(({ id, p }, i) => {
    if (i === 0 || p.score !== sorted[i - 1].p.score) rank = i + 1;
    return { id, name: p.name, score: p.score, rank, gain: p.lastGain, correct: p.lastCorrect };
  });
}

// ---------------------------------------------------------------------------
// What the players are told
// ---------------------------------------------------------------------------

export interface PublicState {
  code: string;
  seq: number;
  phase: Phase;
  total: number;
  index: number;
  timeLimitMs: number;
  /** Time left on the clock at the moment this was sent. A phone adds its own receipt time: clocks are never compared. */
  remainingMs: number | null;
  /** The current question — without its answer. */
  question: { text: string; options: string[] } | null;
  /** Revealed, and only then. */
  correct: number | null;
  distribution: number[] | null;
  /** Who has answered the current question (aliases). */
  answered: string[];
  players: { id: string; name: string }[];
  board: BoardRow[] | null;
}

export function publicState(s: HostState, now: number): PublicState {
  const q = s.index >= 0 ? s.questions[s.index] : undefined;
  const showQuestion = q && (s.phase === "question" || s.phase === "reveal");
  const revealed = s.phase === "reveal";
  return {
    code: s.code,
    seq: s.seq,
    phase: s.phase,
    total: s.questions.length,
    index: s.index,
    timeLimitMs: s.timeLimitMs,
    remainingMs: s.phase === "question" && s.startedAt !== null ? Math.max(0, s.timeLimitMs - (now - s.startedAt)) : null,
    question: showQuestion ? { text: q.text, options: q.options } : null,
    correct: revealed && q ? q.correct : null,
    distribution: revealed && q ? q.options.map((_, i) => Object.values(s.answers).filter((a) => a.choice === i).length) : null,
    answered: Object.keys(s.answers).map((t) => aliasOf(s.code, t)),
    players: Object.entries(s.players).map(([t, p]) => ({ id: aliasOf(s.code, t), name: p.name })),
    board: s.phase === "reveal" || s.phase === "finished" ? leaderboard(s) : null,
  };
}

// ---------------------------------------------------------------------------
// The wire
// ---------------------------------------------------------------------------

export type Msg =
  | { t: "state"; state: PublicState }
  | { t: "join"; code: string; playerId: string; name: string }
  | { t: "answer"; code: string; playerId: string; choice: number };

export interface Transport {
  send(msg: Msg): void;
  subscribe(cb: (msg: Msg) => void): () => void;
  close(): void;
}

/** A six-digit code, easy to read out and hard to stumble on. */
export function newRoomCode(rnd: () => number = Math.random): string {
  return String(100000 + Math.floor(rnd() * 900000));
}

export const isRoomCode = (s: string) => /^\d{6}$/.test(s);
