"use client";

// The arena lobby: practise against bots, or open a room and play someone.
//
// Practice comes first on the page deliberately. It is the half that works
// everywhere — no keys, no second player, no network — and a student who has
// never seen the game should be able to kick a ball before being asked to
// organise a match.

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, Gamepad2, Info, LogIn, Plus, Users, Wifi, WifiOff } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { ArenaMatch } from "@/components/arena/ArenaMatch";
import { useAuthStore } from "@/lib/authStore";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hasArenaServer } from "@/lib/arena/server-net";
import { makeRoomCode, normaliseRoomCode } from "@/lib/arena/net";
import { makeIsBot, practiceDiscs } from "@/lib/arena/setup";
import { TEAM_COLORS, TEAM_NAMES } from "@/lib/arena/pitch";
import { DEFAULT_CONFIG } from "@/lib/arena/types";
import type { Team } from "@/lib/arena/types";

/** Online is possible either way: with a game server, or with Realtime rooms. */
const ONLINE = hasArenaServer || isSupabaseConfigured;

export default function ArenaLobbyPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [team, setTeam] = useState<Team>(0);
  const [perSide, setPerSide] = useState(DEFAULT_CONFIG.perSide);
  const [joinCode, setJoinCode] = useState("");
  const [epoch, setEpoch] = useState(0);

  const me = useMemo(
    () => ({ id: user?.uid ?? "me", name: user?.fullName?.split(" ")[0] ?? "Мен" }),
    [user?.uid, user?.fullName]
  );

  const config = useMemo(() => ({ ...DEFAULT_CONFIG, perSide }), [perSide]);
  // Rebuilt whenever the line-up changes, which is what restarts the match.
  const discs = useMemo(() => practiceDiscs(me, team, config), [me, team, config, epoch]);
  const isBot = useMemo(() => makeIsBot(new Set([me.id])), [me.id]);

  const createRoom = useCallback(() => {
    router.push(`/arena/${makeRoomCode()}`);
  }, [router]);

  const join = useCallback(() => {
    const code = normaliseRoomCode(joinCode);
    if (code.length === 5) router.push(`/arena/${code}`);
  }, [joinCode, router]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Арена — физикалық футбол"
          description="Дөңгелек ойыншылар, серпімді соқтығыс, үйкеліс және импульстің сақталуы. Допты қақпаға кіргіз — әр соқтығыстың импульсі мен энергиясы экранда есептеліп отырады."
          action={
            ONLINE ? (
              <Badge variant="success">
                <Wifi size={12} /> Онлайн қолжетімді
              </Badge>
            ) : (
              <Badge variant="warning">
                <WifiOff size={12} /> Тек жаттығу
              </Badge>
            )
          }
        />

        {/* Practice ---------------------------------------------------------- */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-label uppercase text-slate-500 dark:text-slate-400">
              <Bot size={13} /> Жаттығу — боттарға қарсы
            </span>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
              {([0, 1] as Team[]).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTeam(t);
                    setEpoch((e) => e + 1);
                  }}
                  className="rounded-lg px-3 py-1 text-xs font-semibold transition-colors"
                  style={
                    team === t
                      ? { background: TEAM_COLORS[t], color: "white" }
                      : { color: TEAM_COLORS[t] }
                  }
                >
                  {TEAM_NAMES[t]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setPerSide(n);
                    setEpoch((e) => e + 1);
                  }}
                  className={
                    perSide === n
                      ? "rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white"
                      : "rounded-lg px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-white/10"
                  }
                >
                  {n}×{n}
                </button>
              ))}
            </div>
          </div>

          <ArenaMatch
            key={`${team}-${perSide}-${epoch}`}
            config={config}
            discs={discs}
            localId={me.id}
            isBot={isBot}
          />
        </div>

        {/* Online ------------------------------------------------------------ */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="surface p-5">
            <p className="flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
              <Users size={13} /> Бөлме ашу
            </p>
            <p className="mt-2 text-body text-slate-600 dark:text-slate-300">
              Бес таңбалы код аласың. Кодты сыныптастарыңа айт — олар сол кодпен қосылады.
              {hasArenaServer
                ? " Физиканы ойын сервері жүргізеді."
                : " Бөлмені бірінші ашқан адамның браузері физиканы жүргізеді."}
            </p>
            <button onClick={createRoom} disabled={!ONLINE} className="btn-primary mt-4 disabled:opacity-50">
              <Plus size={15} /> Жаңа бөлме
            </button>
          </div>

          <div className="surface p-5">
            <p className="flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
              <LogIn size={13} /> Кодпен қосылу
            </p>
            <p className="mt-2 text-body text-slate-600 dark:text-slate-300">
              Досың берген бес таңбалы кодты енгіз.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(normaliseRoomCode(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" && join()}
                placeholder="AB12C"
                maxLength={5}
                className="w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center font-mono text-lg font-bold uppercase tracking-widest text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              <button
                onClick={join}
                disabled={!ONLINE || normaliseRoomCode(joinCode).length !== 5}
                className="btn-secondary disabled:opacity-50"
              >
                Кіру
              </button>
            </div>
          </div>
        </div>

        {!ONLINE && (
          <div className="flex gap-3 rounded-xl2 border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-900/15">
            <Info size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-micro leading-relaxed text-amber-800 dark:text-amber-200">
              Онлайн бөлмелер үшін не ойын сервері (<code>NEXT_PUBLIC_ARENA_SERVER</code>),
              не Supabase кілттері керек — бұл нұсқада екеуі де қосылмаған. Жаттығу
              режимі толық жұмыс істейді. Орнату қадамдары{" "}
              <code>DEPLOYMENT.md</code> файлында.
            </p>
          </div>
        )}

        <div className="flex gap-3 rounded-xl2 border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <Gamepad2 size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div className="text-micro leading-relaxed text-slate-600 dark:text-slate-400">
            <p>
              <strong>Басқару:</strong> W/A/S/D немесе тілсызбалар — жүру, <kbd>Бос орын</kbd> —
              тебу. Телефонда экрандағы пульт шығады.
            </p>
            <p className="mt-1.5">
              Ойынның физикасы{" "}
              <Link href="/modules/6" className="text-brand-600 underline dark:text-brand-300">
                6-сабақтағы импульстің сақталу заңымен
              </Link>{" "}
              бірдей: соқтығыста екі денеге шамасы тең, бағыты қарама-қарсы импульс
              беріледі, сондықтан Δp = 0. Тебу — Ньютонның үшінші заңы: доп J/m алса,
              ойыншы қарама-қарсы бағытта J/m жоғалтады.
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
