"use client";

// An online room.
//
// Two views in one page: the line-up while people gather, and the pitch once the
// referee starts. The referee is whoever joined first — see src/lib/arena/net.ts
// for why the room elects one rather than being served by one.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Crown, Loader2, Play, Users, WifiOff } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { ArenaMatch } from "@/components/arena/ArenaMatch";
import { useAuthStore } from "@/lib/authStore";
import { normaliseRoomCode, rosterTeams, useArenaRoom } from "@/lib/arena/net";
import { hasArenaServer, useArenaServer } from "@/lib/arena/server-net";
import { makeIsBot, rosterDiscs } from "@/lib/arena/setup";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/arena/pitch";
import { DEFAULT_CONFIG, type Team } from "@/lib/arena/types";

export default function ArenaRoomPage({ params }: { params: { room: string } }) {
  const code = normaliseRoomCode(params.room);
  const user = useAuthStore((s) => s.user);
  const [copied, setCopied] = useState(false);

  const me = useMemo(
    () =>
      user
        ? { id: user.uid, name: user.fullName?.split(" ")[0] ?? "Ойыншы" }
        : { id: "guest", name: "Қонақ" },
    [user]
  );

  // Two ways to run a room, and the better one wins when it is available: a
  // real server has one authority that outlives any single player, where the
  // Realtime rooms have to elect one of the players and start over when they
  // leave. The Realtime path stays for deployments that never stand a server up.
  const server = useArenaServer(hasArenaServer ? code : null, hasArenaServer ? me : null);
  const realtime = useArenaRoom(hasArenaServer ? null : code, hasArenaServer ? null : me);

  const room = hasArenaServer
    ? {
        status: (server.status === "joined"
          ? "joined"
          : server.status === "connecting"
            ? "connecting"
            : server.status === "error"
              ? "error"
              : "connecting") as typeof realtime.status,
        members: server.members,
        // The server referees, so no player wears the crown and everyone may
        // start a match that has not started yet.
        hostId: null as string | null,
        isHost: true,
        transport: server.transport,
        setTeam: server.setTeam,
        started: server.started,
        start: server.start,
      }
    : realtime;

  const config = DEFAULT_CONFIG;

  // The line-up is frozen the moment the match starts, so a late arrival cannot
  // renumber the discs out from under an input that is already in flight.
  const discs = useMemo(
    () => rosterDiscs(room.members, config, me.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room.started, config, me.id]
  );
  const humanIds = useMemo(() => new Set(room.members.map((m) => m.id)), [room.members]);
  const isBot = useMemo(() => makeIsBot(humanIds), [humanIds]);
  const playing = discs.some((d) => d.id === me.id);

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [code]);

  if (!hasArenaServer && room.status === "unavailable") {
    return (
      <DashboardShell>
        <div className="surface mx-auto max-w-lg p-8 text-center">
          <WifiOff className="mx-auto mb-3 text-amber-500" />
          <h1 className="text-h2 text-slate-900 dark:text-white">Онлайн бөлмелер қолжетімсіз</h1>
          <p className="mt-2 text-body text-slate-600 dark:text-slate-300">
            Бұл нұсқада Supabase кілттері қосылмаған, ал бөлмелер Supabase Realtime арқылы
            жұмыс істейді. Жаттығу режимі толық қолжетімді.
          </p>
          <Link href="/arena" className="btn-primary mt-5 inline-flex">
            <ArrowLeft size={15} /> Аренаға оралу
          </Link>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-5">
        <SectionHeader
          as="h1"
          title={`Бөлме ${code}`}
          description={
            hasArenaServer
              ? "Физиканы ойын сервері жүргізеді — бәрі бірдей көріністі көреді."
              : room.isHost
                ? "Сенің браузерің физиканы жүргізеді — бәрі сенің есептеуіңді көреді."
                : "Физиканы бөлмені бірінші ашқан ойыншының браузері жүргізеді."
          }
          action={
            <div className="flex items-center gap-2">
              <button onClick={copy} className="btn-secondary px-3 py-1.5 text-sm">
                <Copy size={14} /> {copied ? "Көшірілді" : "Кодты көшіру"}
              </button>
              <Link href="/arena" className="btn-secondary px-3 py-1.5 text-sm">
                <ArrowLeft size={14} /> Шығу
              </Link>
            </div>
          }
        />

        {room.status === "connecting" && (
          <div className="surface flex items-center gap-3 p-4">
            <Loader2 size={16} className="animate-spin text-brand-500" />
            <p className="text-body text-slate-600 dark:text-slate-300">Бөлмеге қосылуда…</p>
          </div>
        )}

        {room.status === "error" && (
          <div className="rounded-xl2 border border-rose-200 bg-rose-50/70 p-4 text-body text-rose-800 dark:border-rose-500/20 dark:bg-rose-900/20 dark:text-rose-200">
            Бөлмеге қосылу мүмкін болмады. Интернет байланысын тексеріп, бетті қайта
            жүктеп көріңіз.
          </div>
        )}

        {/* Roster ------------------------------------------------------------ */}
        <div className="surface p-4">
          <p className="mb-3 flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
            <Users size={13} /> Ойыншылар ({room.members.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([0, 1] as Team[]).map((t) => (
              <div key={t} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                <p className="mb-2 text-label font-semibold" style={{ color: TEAM_COLORS[t] }}>
                  {TEAM_NAMES[t]}
                </p>
                <ul className="space-y-1">
                  {rosterTeams(room.members)
                    .filter((m) => m.team === t)
                    .map((m) => (
                      <li key={m.id} className="flex items-center gap-1.5 text-body text-slate-700 dark:text-slate-200">
                        {room.hostId === m.id && <Crown size={13} className="text-amber-500" />}
                        {m.name}
                        {m.id === me.id && <span className="text-micro text-slate-400">(сен)</span>}
                      </li>
                    ))}
                  {rosterTeams(room.members).filter((m) => m.team === t).length === 0 && (
                    <li className="text-micro text-slate-400">Бос — бот ойнайды</li>
                  )}
                </ul>
                {!room.started && (
                  <button
                    onClick={() => room.setTeam(t)}
                    className="btn-secondary mt-3 w-full px-3 py-1.5 text-sm"
                  >
                    Осы командаға кіру
                  </button>
                )}
              </div>
            ))}
          </div>

          {!room.started && (
            <div className="mt-4 flex items-center gap-3">
              {room.isHost ? (
                <button onClick={room.start} className="btn-primary">
                  <Play size={15} /> Матчты бастау
                </button>
              ) : (
                <Badge variant="warning">Төрешінің бастауын күтіңіз</Badge>
              )}
              {hasArenaServer && server.status === "closed" && (
                <Badge variant="warning">Байланыс үзілді — қайта қосылуда…</Badge>
              )}
              <p className="text-micro text-slate-500 dark:text-slate-400">
                Бос орындарды боттар толтырады ({config.perSide}×{config.perSide}).
              </p>
            </div>
          )}
        </div>

        {/* Pitch -------------------------------------------------------------- */}
        {room.started && (
          <>
            {!playing && (
              <div className="rounded-xl2 border border-slate-200 bg-slate-50/70 p-3 text-micro text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                Матч сен қосылғанға дейін басталған — қазір бақылаушысың. Келесі матчта
                құрамға кіресің.
              </div>
            )}
            <ArenaMatch
              key={code}
              config={config}
              discs={discs}
              localId={playing ? me.id : null}
              isBot={isBot}
              transport={room.transport}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
