"use client";

// One match: the canvas, the loop, the controls and the physics readout.
//
// The loop is the same fixed-step accumulator the laboratory simulations use, so
// the game's numbers can be compared with theirs directly. Only the readout is
// mirrored into React state, and only ten times a second — running the score
// through the reconciler at 120 Hz would cost more than the physics does.

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Maximize2, Minimize2, Pause, Play, RotateCcw, Gauge } from "lucide-react";
import { botInputs } from "@/lib/arena/bots";
import { FIXED_H, createMatch, extrapolated, isOver, readings, step } from "@/lib/arena/physics";
import { TEAM_COLORS, TEAM_NAMES, resetPositions } from "@/lib/arena/pitch";
import type { ArenaTransport } from "@/lib/arena/transport";
import type { Disc, Input, MatchConfig, MatchState, Team } from "@/lib/arena/types";
import { useKeymap } from "@/lib/arena/keybindings";
import type { ArenaAction } from "@/lib/arena/keybindings";
import { ArenaControls } from "./ArenaControls";
import { drawMatch } from "./render";
import { useArenaInput } from "./useArenaInput";
import { useFullscreen } from "./useFullscreen";

/** How often the host publishes a snapshot, and the HUD refreshes. */
const NET_HZ = 20;
const HUD_HZ = 10;

export interface ArenaMatchProps {
  config: MatchConfig;
  /** The bodies this match starts with. Taken over by the match. */
  discs: Disc[];
  /** Disc this browser drives, or null when only watching. */
  localId: string | null;
  /** Which discs the machine plays. */
  isBot: (d: Disc) => boolean;
  transport?: ArenaTransport;
  onEnd?: (score: [number, number]) => void;
  /** Hides the transport bar, for the embedded lesson version. */
  compact?: boolean;
}

export function ArenaMatch({
  config,
  discs,
  localId,
  isBot,
  transport,
  onEnd,
  compact = false,
}: ArenaMatchProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<MatchState>(createMatch(discs, config));
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const netRef = useRef(0);
  const hudRef = useRef(0);
  const endedRef = useRef(false);
  // Last snapshot from the authority, and when it landed, so the frames between
  // two snapshots can be carried forward instead of repeating.
  const remoteRef = useRef<MatchState | null>(null);
  const remoteAtRef = useRef(0);

  const fullscreen = useFullscreen(shellRef);
  const [playing, setPlaying] = useState(true);
  const [hud, setHud] = useState(() => snapshotHud(stateRef.current));
  const { keymap, bind, reset: resetKeys } = useKeymap();
  const input = useArenaInput(localId !== null, keymap);

  const playingRef = useRef(playing);
  playingRef.current = playing;

  const restart = useCallback(() => {
    const s = stateRef.current;
    s.score = [0, 0];
    s.clock = config.duration;
    s.t = 0;
    s.celebrating = 0;
    s.lastScorer = null;
    s.lastCollision = null;
    resetPositions(s.discs, config.perSide);
    endedRef.current = false;
    setPlaying(true);
  }, [config.duration, config.perSide]);

  useEffect(() => {
    let raf = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    // A ResizeObserver rather than a window listener: going full screen the
    // browser's way fires a resize, but the CSS fallback only changes the
    // element, and a stale backing store draws blurred and off-centre.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = lastRef.current ? Math.min((now - lastRef.current) / 1000, 0.1) : 0;
      lastRef.current = now;

      const guest = transport && !transport.isHost;

      if (guest) {
        // A guest draws what the authority sends and never integrates: two
        // machines stepping the same physics would drift apart within seconds.
        const remote = transport.latestState();
        if (remote && remote !== remoteRef.current) {
          remoteRef.current = remote;
          remoteAtRef.current = now;
        }
        if (remoteRef.current) {
          const age = Math.min((now - remoteAtRef.current) / 1000, 0.2);
          stateRef.current = extrapolated(remoteRef.current, age);
        }
        if (localId) transport.sendInput(input.ref.current);
      } else if (playingRef.current) {
        accRef.current += dt;
        let guard = 0;
        while (accRef.current >= FIXED_H && guard < 240) {
          const state = stateRef.current;
          const inputs = botInputs(state.discs, config.perSide, isBot);
          if (localId) inputs.set(localId, input.ref.current);
          if (transport) {
            for (const [id, value] of transport.remoteInputs()) inputs.set(id, value);
          }
          step(state, FIXED_H, inputs, config);
          accRef.current -= FIXED_H;
          guard += 1;
        }

        if (transport?.isHost && now - netRef.current > 1000 / NET_HZ) {
          netRef.current = now;
          transport.sendState(stateRef.current);
        }

        if (!endedRef.current && isOver(stateRef.current, config)) {
          endedRef.current = true;
          setPlaying(false);
          onEnd?.([...stateRef.current.score] as [number, number]);
        }
      }

      const rect = canvas.getBoundingClientRect();
      drawMatch(ctx, stateRef.current, rect.width, rect.height);

      if (now - hudRef.current > 1000 / HUD_HZ) {
        hudRef.current = now;
        setHud(snapshotHud(stateRef.current));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [config, isBot, localId, transport, input.ref, onEnd]);

  const guest = Boolean(transport && !transport.isHost);

  return (
    <div
      ref={shellRef}
      className={clsx(
        fullscreen.active
          ? "fixed inset-0 z-50 flex h-screen w-screen flex-col gap-2 bg-slate-950 p-3"
          : "space-y-3"
      )}
    >
      <div
        className={clsx(
          "relative overflow-hidden ring-1 ring-slate-900/10 dark:ring-white/10",
          fullscreen.active ? "min-h-0 flex-1 rounded-xl" : "rounded-xl2"
        )}
      >
        <canvas
          ref={canvasRef}
          className={clsx(
            "block w-full",
            fullscreen.active ? "h-full" : "h-[46vh] max-h-[520px] min-h-[280px]"
          )}
        />

        {/* Full screen sits on the pitch so it is there in the lesson tab too. */}
        <button
          onClick={fullscreen.toggle}
          title={fullscreen.active ? "Толық экраннан шығу" : "Толық экран"}
          aria-label={fullscreen.active ? "Толық экраннан шығу" : "Толық экран"}
          className="absolute right-3 top-3 rounded-lg bg-black/45 p-2 text-white backdrop-blur transition-colors hover:bg-black/65"
        >
          {fullscreen.active ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>

        {/* Scoreboard */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center gap-3 p-3">
          <span className="rounded-lg bg-black/45 px-3 py-1.5 text-sm font-bold text-white backdrop-blur">
            <span style={{ color: TEAM_COLORS[0] }}>{TEAM_NAMES[0]}</span>
            <span className="mx-2 data-num tabular-nums">
              {hud.score[0]} : {hud.score[1]}
            </span>
            <span style={{ color: TEAM_COLORS[1] }}>{TEAM_NAMES[1]}</span>
          </span>
          <span className="data-num rounded-lg bg-black/45 px-2.5 py-1.5 text-sm font-semibold tabular-nums text-white backdrop-blur">
            {formatClock(hud.clock)}
          </span>
        </div>

        {hud.celebrating > 0 && hud.lastScorer !== null && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span
              className="rounded-2xl px-6 py-3 text-h1 font-bold text-white shadow-raised"
              style={{ background: `${TEAM_COLORS[hud.lastScorer]}dd` }}
            >
              ГОЛ! {TEAM_NAMES[hud.lastScorer]}
            </span>
          </div>
        )}

        {!playing && endedRef.current && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/70 backdrop-blur-sm">
            <p className="text-h1 font-bold text-white">
              {hud.score[0] === hud.score[1]
                ? "Тең"
                : `${TEAM_NAMES[hud.score[0] > hud.score[1] ? 0 : 1]} жеңді`}
            </p>
            <p className="data-num text-h2 text-white/80">
              {hud.score[0]} : {hud.score[1]}
            </p>
            {!guest && (
              <button onClick={restart} className="btn-primary mt-1">
                <RotateCcw size={15} /> Қайта бастау
              </button>
            )}
          </div>
        )}
      </div>

      {/* Touch pad, shown once a touch control has been used or on coarse pointers */}
      <TouchPad
        input={input}
        visible={input.touch || localId !== null}
        stamina={hud.myStamina}
      />

      {!compact && !guest && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className={clsx(
              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors",
              playing ? "bg-slate-700 hover:bg-slate-800" : "bg-brand-500 hover:bg-brand-600"
            )}
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? "Кідірту" : "Жалғастыру"}
          </button>
          <button
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            <RotateCcw size={15} /> Қайта
          </button>
        </div>
      )}

      <PhysicsPanel hud={hud} compact={fullscreen.active} />

      {/* Not in full screen: there the pitch is the point, and the legend is
          already burned into the player's hands by the time they open it. */}
      {!fullscreen.active && localId !== null && (
        <ArenaControls keymap={keymap} bind={bind} reset={resetKeys} active={input.active} />
      )}
    </div>
  );
}

function TouchPad({
  input,
  visible,
  stamina,
}: {
  input: ReturnType<typeof useArenaInput>;
  visible: boolean;
  stamina: number;
}) {
  if (!visible) return null;
  const btn =
    "select-none rounded-xl bg-slate-800/90 px-4 py-3 text-white active:bg-brand-500 dark:bg-white/10";
  const hold = (action: ArenaAction) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      input.press(action, true);
    },
    onPointerUp: () => input.press(action, false),
    onPointerLeave: () => input.press(action, false),
    onPointerCancel: () => input.press(action, false),
  });
  return (
    <div className="flex items-center justify-between gap-3 md:hidden">
      <div className="grid grid-cols-3 gap-1.5">
        <span />
        <button className={btn} {...hold("up")} aria-label="Жоғары">↑</button>
        <span />
        <button className={btn} {...hold("left")} aria-label="Солға">←</button>
        <button className={btn} {...hold("down")} aria-label="Төмен">↓</button>
        <button className={btn} {...hold("right")} aria-label="Оңға">→</button>
      </div>
      <div className="flex flex-col items-stretch gap-1.5">
        <button
          className="relative select-none overflow-hidden rounded-xl bg-slate-700 px-5 py-3 text-sm font-bold text-white active:bg-slate-600 disabled:opacity-45"
          disabled={stamina <= 0}
          {...hold("sprint")}
        >
          {/* The reserve fills the button itself, so the thumb never has to
              leave the control to read it. */}
          <span
            className="absolute inset-y-0 left-0 bg-amber-500/45 transition-[width] duration-150"
            style={{ width: `${Math.round(stamina * 100)}%` }}
            aria-hidden
          />
          <span className="relative">Екпін</span>
        </button>
        <button
          className="select-none rounded-2xl bg-amber-500 px-6 py-4 text-base font-bold text-white active:bg-amber-600"
          {...hold("kick")}
        >
          Тебу
        </button>
      </div>
    </div>
  );
}

/** The readout that makes this a mechanics exercise rather than only a game. */
function PhysicsPanel({ hud, compact = false }: { hud: HudSnapshot; compact?: boolean }) {
  const c = hud.collision;
  if (compact) {
    // Full screen: one strip of numbers, no prose. The pitch is what the player
    // came for; the explanation is still a keystroke away.
    return (
      <div className="grid shrink-0 grid-cols-3 gap-2 sm:grid-cols-6">
        <Stat label="Доп v" value={hud.ballSpeed.toFixed(2)} unit="м/с" tone="emerald" />
        <Stat label="Доп p" value={hud.ballMomentum.toFixed(2)} unit="кг·м/с" tone="amber" />
        <Stat label="Менің F" value={hud.myDrive.toFixed(0)} unit="Н" tone="brand" />
        <Stat label="Екпін қоры" value={`${Math.round(hud.myStamina * 100)}`} unit="%" tone="amber" />
        <Stat label="Δp" value={c ? deltaP(c.pAfter - c.pBefore) : "—"} unit="кг·м/с" tone="brand" />
        <Stat
          label="ΔEₖ"
          value={c ? Math.max(c.ekBefore - c.ekAfter, 0).toFixed(2) : "—"}
          unit="Дж"
          tone="rose"
        />
      </div>
    );
  }
  return (
    <div className="surface p-4">
      <p className="mb-3 flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
        <Gauge size={13} /> Физика
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Доптың жылдамдығы" value={hud.ballSpeed.toFixed(2)} unit="м/с" tone="emerald" />
        <Stat label="Доптың импульсі" value={hud.ballMomentum.toFixed(2)} unit="кг·м/с" tone="amber" />
        <Stat label="Жүйенің импульсі" value={hud.totalMomentum.toFixed(1)} unit="кг·м/с" />
        <Stat label="Кинетикалық энергия" value={hud.totalEnergy.toFixed(0)} unit="Дж" />
      </div>

      {/* The sprint key, in numbers: the same body, a bigger F, a bigger a. */}
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Қозғаушы күш F" value={hud.myDrive.toFixed(0)} unit="Н" tone="brand" />
        <Stat label="Үдеу a = F/m" value={hud.myAccel.toFixed(2)} unit="м/с²" tone="brand" />
        <Stat label="Менің v" value={hud.mySpeed.toFixed(2)} unit="м/с" tone="emerald" />
        <Stat
          label="Екпін қоры"
          value={`${Math.round(hud.myStamina * 100)}`}
          unit="%"
          tone={hud.myStamina < 0.2 ? "rose" : "amber"}
        />
      </div>

      {c ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-label uppercase text-slate-500 dark:text-slate-400">
            Соңғы соқтығыс ·{" "}
            {c.what === "kick" ? "тебу" : c.what === "player-ball" ? "ойыншы–доп" : "ойыншы–ойыншы"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="p дейін" value={c.pBefore.toFixed(2)} unit="кг·м/с" />
            <Stat label="p кейін" value={c.pAfter.toFixed(2)} unit="кг·м/с" />
            <Stat
              label="Δp"
              value={deltaP(c.pAfter - c.pBefore)}
              unit="кг·м/с"
              tone="brand"
            />
            <Stat
              label="Энергия жоғалуы"
              value={Math.max(c.ekBefore - c.ekAfter, 0).toFixed(2)}
              unit="Дж"
              tone="rose"
            />
          </div>
          <p className="mt-2 text-[10px] leading-snug text-slate-500">
            Соқтығыста импульс дәл сақталады (Δp = 0) — екі денеге шамасы тең, бағыты
            қарама-қарсы импульс беріледі. Ал кинетикалық энергия серпімділік
            коэффициенті e &lt; 1 болғандықтан кемиді. Бортқа соғылғанда жүйенің импульсі
            өзгереді: борт — сыртқы күш.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-micro text-slate-500 dark:text-slate-400">
          Допқа тиіп көр — соқтығыстың алдындағы және кейінгі импульсі осында шығады.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  tone = "slate",
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "slate" | "brand" | "amber" | "emerald" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "text-slate-700 dark:text-slate-200",
    brand: "text-brand-700 dark:text-brand-300",
    amber: "text-amber-700 dark:text-amber-400",
    emerald: "text-emerald-700 dark:text-emerald-400",
    rose: "text-rose-700 dark:text-rose-400",
  };
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-inset ring-slate-900/5 dark:bg-white/5 dark:ring-white/10">
      <p className="truncate text-label uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className={clsx("font-mono text-[15px] font-bold tabular-nums leading-tight", tones[tone])}>
        {value}
        {unit && <span className="ml-0.5 text-[10px] font-medium opacity-80">{unit}</span>}
      </p>
    </div>
  );
}

interface HudSnapshot {
  score: [number, number];
  clock: number;
  celebrating: number;
  lastScorer: Team | null;
  ballSpeed: number;
  ballMomentum: number;
  totalMomentum: number;
  totalEnergy: number;
  /** The disc this browser drives, so the panel can show the second law on it. */
  mySpeed: number;
  myDrive: number;
  myAccel: number;
  myStamina: number;
  collision: MatchState["lastCollision"];
}

function snapshotHud(state: MatchState): HudSnapshot {
  const r = readings(state);
  return {
    score: [...state.score] as [number, number],
    clock: state.clock,
    celebrating: state.celebrating,
    lastScorer: state.lastScorer,
    collision: state.lastCollision,
    ...r,
  };
}

/**
 * Rounding noise below a twentieth of a gram-metre per second is zero; printing
 * "−0.0000" would read as a fault rather than as the conservation law it is.
 */
function deltaP(value: number): string {
  return Math.abs(value) < 5e-5 ? "0.0000" : value.toFixed(4);
}

function formatClock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default ArenaMatch;
