// The arena game server.
//
// Vercel cannot host this — its functions do not stay resident, and a football
// match is nothing but state that has to stay resident — so it runs on its own,
// on Railway. What it buys over the browser-refereed rooms is worth the second
// deployment: one authority instead of a rotating one, no restart when the
// player who happened to arrive first closes their laptop, and the same view of
// the match for everyone rather than a frame's advantage to the referee.
//
// It imports the engine from src/lib/arena rather than carrying its own copy.
// Two implementations of a collision are two implementations to keep in step,
// and they only ever drift.

import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { FIXED_H, createMatch, isOver, step } from "../src/lib/arena/physics";
import { botInputs } from "../src/lib/arena/bots";
import { resetPositions } from "../src/lib/arena/pitch";
import { makeIsBot, rosterDiscs } from "../src/lib/arena/setup";
import { DEFAULT_CONFIG } from "../src/lib/arena/types";
import type { Input, MatchState, Member, Team } from "../src/lib/arena/types";

const PORT = Number(process.env.PORT ?? 8080);
/** How often the authoritative state goes out. */
const STATE_HZ = 20;
/** A room with nobody in it is kept this long, so a reload does not lose it. */
const EMPTY_ROOM_TTL = 60_000;

interface Player {
  member: Member;
  socket: WebSocket;
  input: Input;
}

interface Room {
  code: string;
  players: Map<string, Player>;
  state: MatchState | null;
  started: boolean;
  /** Set when the room went empty, so it can be swept later. */
  emptySince: number | null;
}

const rooms = new Map<string, Room>();

function roster(room: Room): Member[] {
  return [...room.players.values()].map((p) => p.member);
}

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(room: Room, message: unknown) {
  const raw = JSON.stringify(message);
  for (const p of room.players.values()) {
    if (p.socket.readyState === p.socket.OPEN) p.socket.send(raw);
  }
}

function sendRoster(room: Room) {
  broadcast(room, { type: "roster", members: roster(room), started: room.started });
}

/** Builds the line-up and starts the clock. The roster is frozen from here. */
function startMatch(room: Room) {
  const discs = rosterDiscs(roster(room), DEFAULT_CONFIG, null);
  room.state = createMatch(discs, DEFAULT_CONFIG);
  room.started = true;
  broadcast(room, { type: "started" });
  sendRoster(room);
}

function stopMatch(room: Room) {
  room.state = null;
  room.started = false;
  sendRoster(room);
}

// One clock for every room. A timer per room would be tidier to read and much
// worse to run: a hundred rooms is a hundred timers competing for the loop.
let last = Date.now();
let sinceState = 0;

setInterval(() => {
  const now = Date.now();
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  sinceState += dt;
  const publish = sinceState >= 1 / STATE_HZ;
  if (publish) sinceState = 0;

  for (const room of rooms.values()) {
    if (room.players.size === 0) {
      if (room.emptySince && now - room.emptySince > EMPTY_ROOM_TTL) rooms.delete(room.code);
      continue;
    }
    if (!room.state) continue;

    const humanIds = new Set(room.players.keys());
    const isBot = makeIsBot(humanIds);
    let acc = dt;
    let guard = 0;
    while (acc >= FIXED_H && guard < 240) {
      const inputs = botInputs(room.state.discs, DEFAULT_CONFIG.perSide, isBot);
      for (const p of room.players.values()) inputs.set(p.member.id, p.input);
      step(room.state, FIXED_H, inputs, DEFAULT_CONFIG);
      acc -= FIXED_H;
      guard += 1;
    }

    if (publish) broadcast(room, { type: "state", state: room.state });

    if (isOver(room.state, DEFAULT_CONFIG)) {
      broadcast(room, { type: "ended", score: room.state.score });
      stopMatch(room);
    }
  }
}, 1000 / 60);

const http = createServer((req, res) => {
  // Railway health-checks over plain HTTP, and a bare WebSocket port answers
  // nothing, so the same server serves one line of status.
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: http });

wss.on("connection", (socket, req) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const code = (url.searchParams.get("room") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  const id = url.searchParams.get("id")?.slice(0, 64);
  const name = (url.searchParams.get("name") ?? "Ойыншы").slice(0, 24);

  if (!code || !id) {
    send(socket, { type: "error", message: "room and id are required" });
    socket.close();
    return;
  }

  let room = rooms.get(code);
  if (!room) {
    room = { code, players: new Map(), state: null, started: false, emptySince: null };
    rooms.set(code, room);
  }
  room.emptySince = null;

  // A reconnect replaces the old socket rather than adding a second player.
  room.players.get(id)?.socket.close();
  room.players.set(id, {
    member: { id, name, team: 0, joinedAt: Date.now() },
    socket,
    input: { dx: 0, dy: 0, kick: false },
  });

  send(socket, { type: "welcome", id, room: code });
  sendRoster(room);
  if (room.started && room.state) send(socket, { type: "state", state: room.state });

  socket.on("message", (raw) => {
    let msg: { type?: string; [k: string]: unknown };
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const player = room!.players.get(id);
    if (!player) return;

    if (msg.type === "input") {
      player.input = {
        dx: clamp(Number(msg.dx) || 0),
        dy: clamp(Number(msg.dy) || 0),
        kick: Boolean(msg.kick),
      };
      return;
    }
    if (msg.type === "team") {
      const team = (Number(msg.team) === 1 ? 1 : 0) as Team;
      player.member.team = team;
      sendRoster(room!);
      return;
    }
    if (msg.type === "start" && !room!.started) {
      startMatch(room!);
      return;
    }
    if (msg.type === "restart" && room!.state) {
      room!.state.score = [0, 0];
      room!.state.clock = DEFAULT_CONFIG.duration;
      room!.state.t = 0;
      room!.state.celebrating = 0;
      room!.state.lastScorer = null;
      room!.state.lastCollision = null;
      resetPositions(room!.state.discs, DEFAULT_CONFIG.perSide);
    }
  });

  const leave = () => {
    const current = room!.players.get(id);
    if (current?.socket !== socket) return; // already replaced by a reconnect
    room!.players.delete(id);
    if (room!.players.size === 0) {
      room!.emptySince = Date.now();
      room!.state = null;
      room!.started = false;
    } else {
      sendRoster(room!);
    }
  };
  socket.on("close", leave);
  socket.on("error", leave);
});

function clamp(v: number) {
  return Math.max(-1, Math.min(1, v));
}

http.listen(PORT, () => {
  console.log(`[arena] listening on :${PORT}`);
});
