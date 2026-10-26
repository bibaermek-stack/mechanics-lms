"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Crosshair, Lightbulb, RotateCcw } from "lucide-react";
import {
  ANGLE_MAX,
  ANGLE_MIN,
  HINT_FACTOR,
  MAX_SHOTS,
  PLANETS,
  V_MAX,
  V_MIN,
  flightTime,
  gameScore,
  judgeShot,
  maxHeight,
  rangeOf,
  roundPoints,
  shotPath,
  trajectory,
  type ProjectileBoard,
  type ProjectileRound,
  type ShotOutcome,
} from "@/lib/projectile";
import { useReducedMotion } from "@/lib/useReducedMotion";

interface Shot {
  v: number;
  angle: number;
  outcome: ShotOutcome;
}

type Phase = "aim" | "flying" | "between" | "done";

/** Kazakh number format: a decimal comma. */
const n = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

/** Colours of each world's sky and ground, and the ink that reads on them. */
const LOOK: Record<string, { top: string; bottom: string; ground: string; ink: string; stars?: boolean }> = {
  earth: { top: "#7dd3fc", bottom: "#e0f2fe", ground: "#4d7c0f", ink: "#0f172a" },
  moon: { top: "#020617", bottom: "#1e293b", ground: "#94a3b8", ink: "#f8fafc", stars: true },
  mars: { top: "#9a3412", bottom: "#fdba74", ground: "#7c2d12", ink: "#1c1917" },
  jupiter: { top: "#92400e", bottom: "#fde68a", ground: "#a16207", ink: "#1c1917" },
};

interface View {
  w: number;
  h: number;
  ox: number;
  oy: number;
  scale: number;
}

function makeView(w: number, h: number, round: ProjectileRound): View {
  const left = 28;
  const worldW = Math.max(round.target * 1.3, 30);
  return { w, h, ox: left, oy: h - 30, scale: (w - left - 12) / worldW };
}

const X = (v: View, x: number) => v.ox + x * v.scale;
const Y = (v: View, y: number) => v.oy - y * v.scale;

/** How far along (0–1) a flight is drawn; `null` draws nothing of it. */
interface Live {
  path: { x: number; y: number }[];
  progress: number;
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  view: View,
  round: ProjectileRound,
  done: Shot[],
  angle: number,
  speed: number,
  hint: boolean,
  live: Live | null
) {
  const look = LOOK[round.planet.id];
  const { w, h } = view;
  const g = round.planet.g;

  const sky = ctx.createLinearGradient(0, 0, 0, view.oy);
  sky.addColorStop(0, look.top);
  sky.addColorStop(1, look.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  if (look.stars) {
    ctx.fillStyle = "rgba(248,250,252,0.8)";
    for (let i = 0; i < 40; i++) {
      // A fixed scatter: the same stars on every frame.
      const sx = ((i * 97) % 211) / 211;
      const sy = ((i * 53) % 137) / 137;
      ctx.fillRect(sx * w, sy * (view.oy - 6), 1.5, 1.5);
    }
  }

  ctx.fillStyle = look.ground;
  ctx.fillRect(0, view.oy, w, h - view.oy);

  // Target: a band on the ground as wide as the radius, with a mark at its centre.
  const tx0 = X(view, round.target - round.radius);
  const tx1 = X(view, round.target + round.radius);
  ctx.fillStyle = "rgba(244,63,94,0.95)";
  ctx.fillRect(tx0, view.oy - 4, tx1 - tx0, 8);
  ctx.fillStyle = "#fff";
  ctx.fillRect(X(view, round.target) - 1.5, view.oy - 9, 3, 18);

  // Wall.
  if (round.wall) {
    const wx = X(view, round.wall.x);
    const wh = round.wall.h * view.scale;
    ctx.fillStyle = "#475569";
    ctx.fillRect(wx - 3, view.oy - wh, 6, wh);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(wx - 3, view.oy - wh, 6, 3);
  }

  // Earlier shots this round: a faint path, and its number where it came down.
  ctx.lineWidth = 1.5;
  done.forEach((s, i) => {
    const pts = shotPath(round, s.v, s.angle, 50);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    pts.forEach((p, k) => (k === 0 ? ctx.moveTo(X(view, p.x), Y(view, p.y)) : ctx.lineTo(X(view, p.x), Y(view, p.y))));
    ctx.stroke();
    ctx.setLineDash([]);
    const end = pts[pts.length - 1];
    ctx.fillStyle = look.ink;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), X(view, end.x), view.oy + 14);
  });

  // The prediction, if the player paid for it.
  if (hint && !live) {
    const pts = trajectory(speed, angle, g, 60);
    ctx.strokeStyle = "rgba(250,204,21,0.95)";
    ctx.lineWidth = 2;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    pts.forEach((p, k) => (k === 0 ? ctx.moveTo(X(view, p.x), Y(view, p.y)) : ctx.lineTo(X(view, p.x), Y(view, p.y))));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // The shot in flight, drawn up to `progress`.
  if (live) {
    const last = Math.max(1, Math.round(live.progress * (live.path.length - 1)));
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let k = 0; k <= last; k++) {
      const p = live.path[k];
      if (k === 0) ctx.moveTo(X(view, p.x), Y(view, p.y));
      else ctx.lineTo(X(view, p.x), Y(view, p.y));
    }
    ctx.stroke();
    const head = live.path[last];
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(X(view, head.x), Y(view, head.y), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Gun: a barrel pointing at the chosen angle.
  const a = (angle * Math.PI) / 180;
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(view.ox, view.oy);
  ctx.lineTo(view.ox + Math.cos(a) * 26, view.oy - Math.sin(a) * 26);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#334155";
  ctx.beginPath();
  ctx.arc(view.ox, view.oy, 8, Math.PI, 0);
  ctx.fill();

  // Labels.
  ctx.fillStyle = look.ink;
  ctx.font = "600 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${n(round.target, 0)} м`, X(view, round.target), view.oy + 26);
  if (round.wall) {
    ctx.fillText(`${n(round.wall.h, 1)} м`, X(view, round.wall.x), Y(view, round.wall.h) - 7);
  }
}

/**
 * Aim a gun on four worlds. Angle and speed are sliders; a shot lands where
 * R = v²·sin2θ/g says it does, and each miss says by how much. The prediction
 * (a dotted path and R, H, T) is there for the asking — at a price.
 *
 * Everything that decides the game lives in src/lib/projectile.ts; this file
 * only draws it and keeps score of the rounds.
 */
export function ProjectileGame({
  board,
  onComplete,
}: {
  board: ProjectileBoard;
  onComplete: (score: number) => void;
}) {
  const reduced = useReducedMotion();
  const [roundIdx, setRoundIdx] = useState(0);
  const [angle, setAngle] = useState(45);
  const [speed, setSpeed] = useState(20);
  const [hint, setHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [flight, setFlight] = useState<Shot | null>(null);
  const [points, setPoints] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("aim");
  const [width, setWidth] = useState(0);

  const round = board.rounds[roundIdx];
  const last = shots[shots.length - 1] ?? null;
  const g = round.planet.g;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reported = useRef(false);

  // Follow the container's width (a phone turning round, a window resizing).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)));
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const height = width ? Math.round(Math.min(380, Math.max(240, width * 0.75))) : 0;

  const paint = useCallback(
    (live: Live | null) => {
      const canvas = canvasRef.current;
      if (!canvas || !width) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(ctx, makeView(width, height, round), round, shots, angle, speed, hint, live);
    },
    [width, height, round, shots, angle, speed, hint]
  );

  // At rest: redraw whenever anything the picture shows changes.
  useEffect(() => {
    if (!flight) paint(null);
  }, [flight, paint]);

  // The shot's result is booked once it has landed.
  const settle = useCallback(
    (shot: Shot) => {
      const next = [...shots, shot];
      setShots(next);
      setFlight(null);
      const won = shot.outcome.kind === "hit";
      if (won || next.length >= MAX_SHOTS) {
        setPoints((p) => [...p, roundPoints(won ? next.length : null, hintUsed)]);
        setPhase("between");
      } else {
        setPhase("aim");
      }
    },
    [shots, hintUsed]
  );
  const settleRef = useRef(settle);
  settleRef.current = settle;

  // The flight itself: real time, squeezed into at most two and a half seconds.
  useEffect(() => {
    if (!flight) return;
    const path = shotPath(round, flight.v, flight.angle, 70);
    const seconds = Math.min(2.5, Math.max(1, flightTime(flight.v, flight.angle, g) * 0.5));
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / (seconds * 1000));
      paint({ path, progress: p });
      if (p < 1) raf = requestAnimationFrame(frame);
      else settleRef.current(flight);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // `paint` and `round` are fixed for the length of a flight (controls are locked).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight]);

  function fire() {
    if (phase !== "aim") return;
    const shot: Shot = { v: speed, angle, outcome: judgeShot(round, speed, angle) };
    if (reduced) {
      settle(shot);
    } else {
      setFlight(shot);
      setPhase("flying");
    }
  }

  function toggleHint(on: boolean) {
    setHint(on);
    if (on) setHintUsed(true);
  }

  function next() {
    if (roundIdx === board.rounds.length - 1) {
      setPhase("done");
      if (!reported.current) {
        reported.current = true;
        onComplete(gameScore(points));
      }
      return;
    }
    setRoundIdx((i) => i + 1);
    setShots([]);
    setHint(false);
    setHintUsed(false);
    setPhase("aim");
  }

  function restart() {
    reported.current = false;
    setRoundIdx(0);
    setShots([]);
    setPoints([]);
    setHint(false);
    setHintUsed(false);
    setPhase("aim");
  }

  const running = useMemo(() => points.reduce((a, b) => a + b, 0), [points]);
  const prediction = useMemo(
    () => ({
      R: rangeOf(speed, angle, g),
      H: maxHeight(speed, angle, g),
      T: flightTime(speed, angle, g),
    }),
    [speed, angle, g]
  );

  // ---------------------------------------------------------------- finished
  if (phase === "done") {
    const score = gameScore(points);
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200/70 p-6 text-center dark:border-white/10">
          <p className="text-h2 text-slate-900 dark:text-white">{score} / 100</p>
          <p className="mt-1 text-label text-slate-600 dark:text-slate-400">
            {points.map((p, i) => `${i + 1}-раунд: ${p}`).join(" · ")}
          </p>
          <p className="mt-3 text-body text-slate-600 dark:text-slate-400">
            {score >= 80
              ? "Керемет! Формуланы көзбен өлшейтін деңгейге жеттің."
              : score >= 45
                ? "Жақсы. Болжамды қолданбай-ақ дәл ату үшін R = v²·sin 2θ / g формуласын пайдалан."
                : "Бастау қиын болды. Ең алдымен 45° қой, содан кейін жылдамдықты ғана өзгертіп көр."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/70 p-5 dark:border-white/10">
          <p className="text-label font-semibold text-slate-900 dark:text-white">
            Бір ату — төрт әлем (v = 20 м/с, θ = 45°)
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {Object.values(PLANETS).map((pl) => (
              <li key={pl.id} className="rounded-xl bg-slate-100 p-3 dark:bg-white/5">
                <p className="text-micro text-slate-500 dark:text-slate-400">
                  {pl.name} · g = {n(pl.g, 2)}
                </p>
                <p className="data-num mt-1 text-h3 text-slate-900 dark:text-white">{n(rangeOf(20, 45, pl.g))} м</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-micro text-slate-500 dark:text-slate-400">
            Қашықтық g-ге кері пропорционал: R = v²·sin 2θ / g. Ай Жерден {n(PLANETS.earth.g / PLANETS.moon.g, 1)} есе
            алысқа лақтырады.
          </p>
        </div>

        <button onClick={restart} className="btn-ghost text-sm">
          <RotateCcw size={14} /> Қайта ойнау
        </button>
      </div>
    );
  }

  // --------------------------------------------------------------- the round
  const outcomeText = (s: Shot, idx: number) => {
    const o = s.outcome;
    const head = `${idx + 1}-ату (v = ${n(s.v)} м/с, θ = ${s.angle}°): `;
    if (o.kind === "hit") return `${head}нысанаға тиді! Снаряд ${n(o.range)} м-ге түсті.`;
    if (o.kind === "wall")
      return `${head}қабырғаға соғылды — ${n(round.wall?.x ?? 0, 0)} м-де снаряд ${n(o.heightAtWall)} м биікте, ал қабырға ${n(round.wall?.h ?? 0)} м.`;
    if (o.kind === "short") return `${head}${n(o.range)} м-ге түсті — ${n(-o.error)} м жетпеді.`;
    return `${head}${n(o.range)} м-ге түсті — ${n(o.error)} м асып кетті.`;
  };

  const shotsLeft = MAX_SHOTS - shots.length;
  const roundPts = points[roundIdx];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label font-semibold text-slate-900 dark:text-white">
          {roundIdx + 1}/{board.rounds.length}-раунд · {round.planet.name}{" "}
          <span className="data-num font-normal text-slate-500 dark:text-slate-400">(g = {n(g, 2)} м/с²)</span>
        </p>
        <p className="data-num text-micro text-slate-500 dark:text-slate-400">Ұпай: {running}</p>
      </div>

      <div ref={wrapRef} className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: height || undefined, display: "block" }}
          role="img"
          aria-label={`${round.planet.name}: нысана ${round.target} м қашықтықта${
            round.wall ? `, ${round.wall.x} м-де ${round.wall.h} м биік қабырға` : ""
          }`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-slate-700 dark:text-slate-300">
        <span>
          Нысана: <strong className="data-num">{n(round.target, 0)} м</strong> (±{n(round.radius, 1)} м)
          {round.wall && (
            <>
              {" "}
              · Қабырға: <strong className="data-num">{n(round.wall.x, 0)} м</strong>-де,{" "}
              <strong className="data-num">{n(round.wall.h, 1)} м</strong> биік
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5" aria-label={`Қалған атыс: ${shotsLeft}`}>
          {Array.from({ length: MAX_SHOTS }, (_, i) => (
            <span
              key={i}
              className={`h-2.5 w-2.5 rounded-full ${i < shotsLeft ? "bg-brand-500" : "bg-slate-300 dark:bg-white/20"}`}
            />
          ))}
        </span>
      </div>

      {phase !== "between" && (
        <div className="space-y-4 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">Бұрыш θ</span>
                <span className="data-num text-label">{angle}°</span>
              </span>
              <input
                type="range"
                min={ANGLE_MIN}
                max={ANGLE_MAX}
                step={1}
                value={angle}
                disabled={phase === "flying"}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="mt-2 h-8 w-full accent-brand-500"
              />
            </label>
            <label className="block text-sm">
              <span className="flex items-baseline justify-between">
                <span className="font-semibold text-slate-900 dark:text-white">Жылдамдық v</span>
                <span className="data-num text-label">{n(speed)} м/с</span>
              </span>
              <input
                type="range"
                min={V_MIN}
                max={V_MAX}
                step={0.5}
                value={speed}
                disabled={phase === "flying"}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="mt-2 h-8 w-full accent-brand-500"
              />
            </label>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={hint}
              disabled={phase === "flying"}
              onChange={(e) => toggleHint(e.target.checked)}
              className="h-5 w-5 accent-brand-500"
            />
            <span>
              <Lightbulb size={14} className="mr-1 inline text-amber-500" />
              Болжамды көрсет — раунд ұпайы ×{n(HINT_FACTOR)}
            </span>
          </label>

          {hint && (
            <dl className="data-num grid grid-cols-3 gap-2 rounded-xl bg-amber-500/10 p-3 text-center text-sm">
              <div>
                <dt className="text-micro text-slate-500 dark:text-slate-400">R (қашықтық)</dt>
                <dd className="font-semibold">{n(prediction.R)} м</dd>
              </div>
              <div>
                <dt className="text-micro text-slate-500 dark:text-slate-400">H (биіктік)</dt>
                <dd className="font-semibold">{n(prediction.H)} м</dd>
              </div>
              <div>
                <dt className="text-micro text-slate-500 dark:text-slate-400">T (уақыт)</dt>
                <dd className="font-semibold">{n(prediction.T)} с</dd>
              </div>
            </dl>
          )}

          <button onClick={fire} disabled={phase !== "aim"} className="btn-primary min-h-[48px] w-full">
            <Crosshair size={18} /> Атыс!
          </button>
        </div>
      )}

      <div role="status" aria-live="polite" className="space-y-1 text-sm">
        {shots.map((s, i) => (
          <p
            key={i}
            className={
              s.outcome.kind === "hit"
                ? "font-semibold text-emerald-600 dark:text-emerald-300"
                : "text-slate-700 dark:text-slate-300"
            }
          >
            {outcomeText(s, i)}
          </p>
        ))}
      </div>

      {phase === "between" && last && (
        <div className="space-y-3 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
          <p className="text-label font-semibold text-slate-900 dark:text-white">
            {roundPts > 0
              ? `Раунд аяқталды: +${roundPts} ұпай${hintUsed ? ` (болжаммен — ×${n(HINT_FACTOR)})` : ""}`
              : `${MAX_SHOTS} атыс аяқталды — бұл раундтан ұпай жоқ`}
          </p>
          <p className="data-num rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-white/5 dark:text-slate-300">
            Соңғы атыс: R = v²·sin 2θ / g = {n(last.v)}² · sin {2 * last.angle}° / {n(g, 2)} = {n(last.outcome.range)} м
            {last.outcome.kind === "wall" && " (қабырға жолда тұрды)"}
          </p>
          <button onClick={next} className="btn-primary w-full sm:w-auto">
            {roundIdx === board.rounds.length - 1 ? "Нәтижені көру" : "Келесі раунд"} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
