"use client";

// Online rooms, over Supabase Realtime.
//
// There is no game server and there is nowhere to put one: the platform deploys
// to Vercel's serverless runtime, where nothing stays resident between requests.
// So the room is a Realtime channel and one of the players is the authority —
// the first to arrive runs the physics and publishes the state, everyone else
// sends their input and draws what comes back. That needs no table, no migration
// and no process of our own; the anon key is enough.
//
// The cost of that choice is honest and worth stating: the host's browser is the
// referee, so the host sees the match a frame earlier than everyone else, and if
// the host leaves the room re-elects and the score restarts. For a class playing
// on one campus network that is a fair trade against standing up a server.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase/client";
import type { ArenaTransport } from "./transport";
import type { Input, MatchState, Member, Team } from "./types";

export type RoomStatus = "idle" | "connecting" | "joined" | "unavailable" | "error";

export type { Member };

/** Six characters a student can read out across a classroom without mistakes. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export function normaliseRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

/**
 * The first player to have joined is the referee.
 *
 * Deciding it from the presence roster rather than from a message means every
 * browser reaches the same answer without anyone having to announce it, and the
 * answer survives a reconnect.
 */
function electHost(members: Member[]): string | null {
  if (members.length === 0) return null;
  return [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))[0].id;
}

export interface ArenaRoom {
  status: RoomStatus;
  members: Member[];
  hostId: string | null;
  isHost: boolean;
  transport: ArenaTransport;
  setTeam: (team: Team) => void;
  /** Set by the host when it starts a match, so guests switch to the pitch. */
  started: boolean;
  start: () => void;
}

export function useArenaRoom(
  code: string | null,
  me: { id: string; name: string } | null,
  initialTeam: Team = 0
): ArenaRoom {
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [members, setMembers] = useState<Member[]>([]);
  const [started, setStarted] = useState(false);
  const [team, setTeamState] = useState<Team>(initialTeam);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const inputsRef = useRef(new Map<string, Input>());
  const stateRef = useRef<MatchState | null>(null);
  const teamRef = useRef(team);
  teamRef.current = team;

  const hostId = useMemo(() => electHost(members), [members]);
  const isHost = Boolean(me && hostId === me.id);

  useEffect(() => {
    if (!code || !me) return;
    if (!isSupabaseConfigured || !supabase) {
      setStatus("unavailable");
      return;
    }

    setStatus("connecting");
    const joinedAt = Date.now();
    const channel = supabase.channel(`arena:${code}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const raw = channel.presenceState<Member>();
      const next: Member[] = [];
      for (const entries of Object.values(raw)) {
        const first = entries[0];
        if (first?.id) next.push({ id: first.id, name: first.name, team: first.team, joinedAt: first.joinedAt });
      }
      setMembers(next);
    });

    channel.on("broadcast", { event: "input" }, ({ payload }) => {
      const p = payload as { id: string } & Input;
      if (p?.id) inputsRef.current.set(p.id, { dx: p.dx, dy: p.dy, kick: p.kick });
    });

    channel.on("broadcast", { event: "state" }, ({ payload }) => {
      stateRef.current = payload as MatchState;
    });

    channel.on("broadcast", { event: "start" }, () => setStarted(true));

    channel.subscribe(async (s) => {
      if (s === "SUBSCRIBED") {
        await channel.track({ id: me.id, name: me.name, team: teamRef.current, joinedAt });
        setStatus("joined");
      } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
        setStatus("error");
      }
    });

    return () => {
      channelRef.current = null;
      void channel.unsubscribe();
      supabase?.removeChannel(channel);
      setMembers([]);
      setStarted(false);
      setStatus("idle");
    };
  }, [code, me?.id, me?.name, me]);

  const setTeam = useCallback((next: Team) => {
    setTeamState(next);
    void channelRef.current?.track({ team: next });
  }, []);

  const start = useCallback(() => {
    setStarted(true);
    void channelRef.current?.send({ type: "broadcast", event: "start", payload: {} });
  }, []);

  const transport = useMemo<ArenaTransport>(
    () => ({
      isHost,
      remoteInputs: () => inputsRef.current,
      sendInput: (input) => {
        if (!me) return;
        void channelRef.current?.send({
          type: "broadcast",
          event: "input",
          payload: { id: me.id, ...input },
        });
      },
      // The whole state goes on the wire rather than a hand-packed delta: with
      // seven bodies it is about a kilobyte, twenty times a second, and a format
      // nobody has to keep in step with the engine is worth far more than the
      // bandwidth it saves.
      sendState: (state) => {
        void channelRef.current?.send({ type: "broadcast", event: "state", payload: state });
      },
      latestState: () => stateRef.current,
    }),
    [isHost, me]
  );

  return { status, members, hostId, isHost, transport, setTeam, started, start };
}

/** Team assignment for the roster: the lobby's picks, in join order. */
export function rosterTeams(members: Member[]): Member[] {
  return [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
}
