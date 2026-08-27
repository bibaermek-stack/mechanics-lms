"use client";

// Talking to the game server.
//
// Where the Supabase rooms elect a player to be the referee, here the referee is
// the server: nobody's browser integrates anything, everyone sends input and
// draws what comes back. That is the difference worth having — the match does
// not restart because one player closed a laptop, and no one sees it a frame
// before anyone else.
//
// The server is optional. With NEXT_PUBLIC_ARENA_SERVER unset this module is
// never reached and the Realtime rooms take over, so the platform still runs on
// one deployment for anyone who does not want a second.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArenaTransport } from "./transport";
import type { Input, MatchState, Member, Team } from "./types";

/** Where the server lives. Set on the web deployment, not on the server. */
export const ARENA_SERVER = process.env.NEXT_PUBLIC_ARENA_SERVER?.trim() || "";
export const hasArenaServer = ARENA_SERVER.length > 0;

/** How often our input goes up. The server integrates at 120 Hz regardless. */
const INPUT_HZ = 30;

export type ServerStatus = "idle" | "connecting" | "joined" | "closed" | "error";

export interface ArenaServerRoom {
  status: ServerStatus;
  members: Member[];
  started: boolean;
  transport: ArenaTransport;
  setTeam: (team: Team) => void;
  start: () => void;
  restart: () => void;
}

function socketUrl(code: string, me: { id: string; name: string }) {
  // Accept either ws:// or https:// in the variable, because both are what
  // people paste, and Railway hands out an https URL.
  const base = ARENA_SERVER.replace(/^http/, "ws").replace(/\/$/, "");
  const q = new URLSearchParams({ room: code, id: me.id, name: me.name });
  return `${base}/?${q.toString()}`;
}

export function useArenaServer(
  code: string | null,
  me: { id: string; name: string } | null
): ArenaServerRoom {
  const [status, setStatus] = useState<ServerStatus>("idle");
  const [members, setMembers] = useState<Member[]>([]);
  const [started, setStarted] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<MatchState | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!code || !me || !hasArenaServer) return;
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      setStatus("connecting");
      const socket = new WebSocket(socketUrl(code, me));
      socketRef.current = socket;

      socket.onopen = () => setStatus("joined");
      socket.onmessage = (event) => {
        let msg: { type?: string; [k: string]: unknown };
        try {
          msg = JSON.parse(event.data as string);
        } catch {
          return;
        }
        if (msg.type === "roster") {
          setMembers((msg.members as Member[]) ?? []);
          setStarted(Boolean(msg.started));
        } else if (msg.type === "state") {
          stateRef.current = msg.state as MatchState;
        } else if (msg.type === "started") {
          setStarted(true);
        } else if (msg.type === "ended") {
          setStarted(false);
        }
      };
      socket.onerror = () => setStatus("error");
      socket.onclose = () => {
        if (closed) return;
        setStatus("closed");
        // A dropped connection on a phone changing cell is normal; come back
        // rather than leaving the player staring at a frozen pitch.
        retry = setTimeout(open, 1500);
      };
    };

    open();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
      socketRef.current = null;
      stateRef.current = null;
      setMembers([]);
      setStarted(false);
      setStatus("idle");
    };
  }, [code, me?.id, me?.name, me]);

  const send = useCallback((message: unknown) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const transport = useMemo<ArenaTransport>(
    () => ({
      // Never the host: the authority is the server, so every browser draws
      // what it is sent and integrates nothing.
      isHost: false,
      remoteInputs: () => new Map<string, Input>(),
      sendInput: (input) => {
        const now = performance.now();
        if (now - lastSent.current < 1000 / INPUT_HZ) return;
        lastSent.current = now;
        send({ type: "input", ...input });
      },
      sendState: () => undefined,
      latestState: () => stateRef.current,
    }),
    [send]
  );

  return {
    status,
    members,
    started,
    transport,
    setTeam: useCallback((team: Team) => send({ type: "team", team }), [send]),
    start: useCallback(() => send({ type: "start" }), [send]),
    restart: useCallback(() => send({ type: "restart" }), [send]),
  };
}
