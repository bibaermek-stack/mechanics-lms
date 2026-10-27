"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Lock, Minus, Pause, Play, Plus, RotateCcw } from "lucide-react";
import { G, frameAt, pchip, simulate, type Run } from "@/lib/coaster";
import {
  CART_MASS,
  LEVELS,
  POINTS,
  TRACK_X,
  Y_MAX,
  Y_MIN,
  Y_STEP,
  evaluate,
  normalise,
  pointsFor,
  scoreOf,
  type Level,
  type Verdict,
} from "@/lib/coasterLevels";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { X, Y, drawScene, makeView, worldY, type CartPose } from "./coasterDraw";

/** Kazakh number format: a decimal comma. */
const n = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

/** The free-play "level": nothing locked, nothing to win, friction and push are the player's. */
const FREE: Level = {
  id: "free",
  title: "Еркін режим",
  task: "Рельсті өз қалауыңша жаса. Үйкеліс пен бастапқы итеріске қара: энергияның қалай түрленетінін энергия бағандарынан көр.",
  hint: "",
  mu: 0,
  locked: {},
  initial: [8, 3, 6, 1.5, 4, 1, 2],
  goal: { kind: "reach", star3: 0, star2: 0 },
};

const DISPLAY_MAX = 20; // s: a swing that never settles is not played for ever
const RATES = [0.5, 1, 2];

interface Result {
  run: Run;
  verdict: Verdict | null;
}

function Stars({ count, size = "text-base" }: { count: number; size?: string }) {
  return (
    <span className={`${size} tracking-tight`} aria-label={`${count} жұлдыз 3-тен`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < count ? "text-amber-400" : "text-slate-400/60 dark:text-white/25"}>
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * A roller-coaster builder. Drag the blue points to shape the track, press play, watch
 * where the energy goes: height (Eп = mgh) turns into speed (Eк = mv²/2) and, with
 * friction, into heat. Six levels each ask one thing the physics decides — how high to
 * start, how fast it arrives, where it stops, how hard it presses, when it floats.
 * All of it is judged by src/lib/coasterLevels.ts; this file draws and keeps the score.
 */
export function CoasterGame({ onComplete }: { onComplete: (score: number) => void }) {
  const reduced = useReducedMotion();
  const [levelIdx, setLevelIdx] = useState(0); // -1 = free play
  const level = levelIdx < 0 ? FREE : LEVELS[levelIdx];
  const [designs, setDesigns] = useState<Record<string, number[]>>({});
  const [mu, setMu] = useState(0.05);
  const [push, setPush] = useState(0);
  const [best, setBest] = useState<Record<string, number>>({});
  const [hint, setHint] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [savedScore, setSavedScore] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);
  const autoReported = useRef(false);

  const ys = useMemo(() => normalise(level, designs[level.id] ?? level.initial), [designs, level]);
  const profile = useMemo(() => pchip(pointsFor(ys)), [ys]);
  const points = useMemo(() => pointsFor(ys), [ys]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth)));
    ro.observe(el);
    setWidth(Math.floor(el.clientWidth));
    return () => ro.disconnect();
  }, []);
  const height = width ? Math.round(Math.min(340, Math.max(230, width * 0.64))) : 0;

  const end = result ? Math.min(result.run.endTime, DISPLAY_MAX) : 0;

  const paint = useCallback(() => {
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
    let cart: CartPose;
    if (result) {
      const f = frameAt(result.run, Math.min(tRef.current, end));
      cart = { x: f.x, y: f.y, angle: f.angle, gForce: f.gForce };
    } else {
      cart = { x: 0, y: profile.y(0), angle: Math.atan(profile.dy(0)), gForce: 1 };
    }
    drawScene(ctx, makeView(width, height), { profile, points, level: levelIdx < 0 ? null : level, cart, active });
  }, [width, height, result, end, profile, points, level, levelIdx, active]);
  const paintRef = useRef(paint);
  paintRef.current = paint;

  // Redraw whenever the picture changes (a drag, a level, a scrub).
  useEffect(() => {
    paint();
  }, [paint, t]);

  // Any change to the track or the rules throws the old run away.
  const discard = useCallback(() => {
    setResult(null);
    setPlaying(false);
    tRef.current = 0;
    setT(0);
  }, []);
  useEffect(discard, [ys, mu, push, levelIdx, discard]);

  // Playback.
  useEffect(() => {
    if (!playing || !result) return;
    let raf = 0, last = performance.now(), lastUi = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      tRef.current = Math.min(end, tRef.current + dt * rate);
      paintRef.current();
      if (now - lastUi > 50 || tRef.current >= end) {
        lastUi = now;
        setT(tRef.current);
      }
      if (tRef.current >= end) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [playing, result, rate, end]);

  const finished = result !== null && t >= end - 1e-3;
  const verdict = finished ? result.verdict : null;

  // Stars are booked once the run has been watched to its end.
  useEffect(() => {
    if (verdict && levelIdx >= 0) setBest((b) => ((b[level.id] ?? 0) >= verdict.stars ? b : { ...b, [level.id]: verdict.stars }));
  }, [verdict, level.id, levelIdx]);

  const total = scoreOf(best);
  // The game ends by itself when every level has a star; the button saves earlier or improves a saved score.
  useEffect(() => {
    if (!autoReported.current && LEVELS.every((l) => (best[l.id] ?? 0) >= 1)) {
      autoReported.current = true;
      setSavedScore(total.score);
      onComplete(total.score);
    }
  }, [best, total.score, onComplete]);

  function setHeights(next: number[]) {
    setDesigns((d) => ({ ...d, [level.id]: normalise(level, next) }));
  }

  function nudge(i: number, delta: number) {
    const next = [...ys];
    next[i] = next[i] + delta;
    setHeights(next);
  }

  function play() {
    if (result && !finished) {
      setPlaying(true);
      return;
    }
    const r: Result =
      levelIdx < 0
        ? { run: simulate(profile, { mu, v0: push, mass: CART_MASS, tMax: 40 }), verdict: null }
        : (() => {
            const v = evaluate(level, ys);
            return { run: v.run, verdict: v };
          })();
    setResult(r);
    tRef.current = 0;
    setT(0);
    if (reduced) {
      tRef.current = Math.min(r.run.endTime, DISPLAY_MAX);
      setT(tRef.current);
      setPlaying(false);
    } else {
      setPlaying(true);
    }
  }

  // Dragging a control point.
  const dragging = useRef<number | null>(null);
  function pick(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const v = makeView(width, height);
    let hit = -1, dist = 26;
    points.forEach((p, i) => {
      if (level.locked[i] !== undefined) return;
      const d = Math.hypot(X(v, p.x) - px, Y(v, p.y) - py);
      if (d < dist) {
        dist = d;
        hit = i;
      }
    });
    if (hit >= 0) {
      dragging.current = hit;
      setActive(hit);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }
  function drag(e: React.PointerEvent<HTMLCanvasElement>) {
    const i = dragging.current;
    if (i === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = worldY(makeView(width, height), e.clientY - rect.top);
    const next = [...ys];
    next[i] = Math.min(Y_MAX, Math.max(Y_MIN, y));
    setHeights(next);
  }
  function drop(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragging.current !== null) e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = null;
    setActive(null);
  }

  const frame = result ? frameAt(result.run, Math.min(t, end)) : null;
  const e0 = result?.run.startEnergy ?? CART_MASS * G * ys[0];
  const bar = (v: number) => `${Math.max(0, Math.min(100, (v / e0) * 100))}%`;
  const kj = (v: number) => n(v / 1000, 1);
  const g = frame?.gForce ?? 1;
  const gNote = g < -0.05 ? "G < 0: вагонша рельстен ұшып кетер еді!" : g > 6 ? "Бұл адамға тым қауіпті" : g > 4 ? "Ауыр жүктеме" : "";

  return (
    <div className="space-y-4">
      {/* levels */}
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Деңгейлер">
        {LEVELS.map((l, i) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={levelIdx === i}
            onClick={() => {
              setLevelIdx(i);
              setHint(false);
            }}
            className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
              levelIdx === i ? "border-brand-500 bg-brand-500/10 text-slate-900 dark:text-white" : "border-slate-200 text-slate-700 hover:border-brand-400 dark:border-white/10 dark:text-slate-300"
            }`}
          >
            <span className="block">{i + 1}. {l.title}</span>
            <Stars count={best[l.id] ?? 0} size="text-sm" />
          </button>
        ))}
        <button
          role="tab"
          aria-selected={levelIdx < 0}
          onClick={() => {
            setLevelIdx(-1);
            setHint(false);
          }}
          className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
            levelIdx < 0 ? "border-brand-500 bg-brand-500/10 text-slate-900 dark:text-white" : "border-slate-200 text-slate-700 hover:border-brand-400 dark:border-white/10 dark:text-slate-300"
          }`}
        >
          <span className="block">Еркін режим</span>
          <span className="text-slate-500 dark:text-slate-400">ұпайсыз</span>
        </button>
      </div>

      <div className="space-y-2 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
        <p className="text-label font-semibold text-slate-900 dark:text-white">
          {levelIdx >= 0 ? `${levelIdx + 1}-деңгей · ` : ""}
          {level.title}
          {level.hard ? <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-micro text-rose-600 dark:text-rose-300">қиын</span> : null}
        </p>
        <p className="text-body text-slate-700 dark:text-slate-300">{level.task}</p>
        {level.hint && (
          <div>
            <button onClick={() => setHint((h) => !h)} className="inline-flex items-center gap-1.5 text-micro font-semibold text-brand-600 dark:text-brand-300" aria-expanded={hint}>
              <Lightbulb size={14} aria-hidden /> {hint ? "Кеңесті жасыру" : "Кеңес"}
            </button>
            {hint && <p className="mt-1 text-body text-slate-600 dark:text-slate-400">{level.hint}</p>}
          </div>
        )}
      </div>

      <div ref={wrapRef} className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: height || undefined, display: "block", touchAction: "none", cursor: active !== null ? "grabbing" : "grab" }}
          role="img"
          aria-label={`Роллер-коастер рельсі: ${TRACK_X.map((x, i) => `${x} м-де ${n(ys[i])} м`).join(", ")}. Көк нүктелерді жоғары-төмен сүйреп өзгертуге болады.`}
          onPointerDown={pick}
          onPointerMove={drag}
          onPointerUp={drop}
          onPointerCancel={drop}
        />
      </div>

      {/* transport */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={playing ? () => setPlaying(false) : play} className="btn-primary inline-flex min-h-[44px] items-center gap-2">
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {playing ? "Кідірту" : finished ? "Қайта іске қосу" : "Іске қосу"}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            tRef.current = 0;
            setT(0);
          }}
          disabled={!result}
          className="btn-secondary inline-flex min-h-[44px] items-center gap-2"
        >
          <RotateCcw size={16} aria-hidden /> Басына
        </button>
        <div className="flex items-center gap-1" role="group" aria-label="Ойнату жылдамдығы">
          {RATES.map((r) => (
            <button
              key={r}
              onClick={() => setRate(r)}
              aria-pressed={rate === r}
              className={`min-h-[44px] rounded-lg px-3 text-xs font-semibold ${rate === r ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"}`}
            >
              ×{String(r).replace(".", ",")}
            </button>
          ))}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(end, 0.01)}
        step={0.01}
        value={Math.min(t, end)}
        disabled={!result}
        aria-label="Уақыт"
        onChange={(e) => {
          setPlaying(false);
          tRef.current = Number(e.target.value);
          setT(tRef.current);
        }}
        className="h-8 w-full accent-brand-500"
      />

      {levelIdx < 0 && (
        <div className="grid gap-3 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">Үйкеліс коэффициенті μ</span>
              <span className="data-num text-label">{n(mu, 2)}</span>
            </span>
            <input type="range" min={0} max={0.3} step={0.01} value={mu} onChange={(e) => setMu(Number(e.target.value))} className="mt-2 h-8 w-full accent-brand-500" />
          </label>
          <label className="block text-sm">
            <span className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-900 dark:text-white">Бастапқы итеріс v₀</span>
              <span className="data-num text-label">{n(push, 1)} м/с</span>
            </span>
            <input type="range" min={0} max={10} step={0.5} value={push} onChange={(e) => setPush(Number(e.target.value))} className="mt-2 h-8 w-full accent-brand-500" />
          </label>
        </div>
      )}

      {/* energy */}
      <div className="space-y-2 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10" aria-live="off">
        <p className="text-label font-semibold text-slate-900 dark:text-white">Энергия (вагонша {CART_MASS} кг)</p>
        {[
          { key: "pe", label: "Потенциалдық Eп = mgh", value: frame?.pe ?? CART_MASS * G * ys[0], color: "bg-sky-500" },
          { key: "ke", label: "Кинетикалық Eк = mv²/2", value: frame?.ke ?? 0, color: "bg-amber-400" },
          { key: "heat", label: "Жылу Q (үйкеліс)", value: frame?.heat ?? 0, color: "bg-rose-500" },
        ].map((b) => (
          <div key={b.key} className="text-sm" data-testid={`bar-${b.key}`}>
            <div className="flex justify-between">
              <span className="text-slate-700 dark:text-slate-300">{b.label}</span>
              <span className="data-num text-slate-900 dark:text-white">{kj(b.value)} кДж</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div className={`h-full ${b.color}`} style={{ width: bar(b.value) }} />
            </div>
          </div>
        ))}
        <p className="data-num text-micro text-slate-500 dark:text-slate-400">
          Eп + Eк + Q = {kj((frame?.pe ?? CART_MASS * G * ys[0]) + (frame?.ke ?? 0) + (frame?.heat ?? 0))} кДж — энергия жоғалмайды, түрленеді.
        </p>
        <dl className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div>
            <dt className="text-micro text-slate-500 dark:text-slate-400">Жылдамдық</dt>
            <dd className="data-num text-h3 text-slate-900 dark:text-white" data-testid="speed">{n(Math.abs(frame?.u ?? 0))} м/с</dd>
          </div>
          <div>
            <dt className="text-micro text-slate-500 dark:text-slate-400">Биіктік</dt>
            <dd className="data-num text-h3 text-slate-900 dark:text-white">{n(frame?.y ?? ys[0])} м</dd>
          </div>
          <div>
            <dt className="text-micro text-slate-500 dark:text-slate-400">G-күш</dt>
            <dd className={`data-num text-h3 ${g < -0.05 ? "text-rose-500" : g > 6 ? "text-amber-500" : "text-slate-900 dark:text-white"}`} data-testid="gforce">{n(g)} g</dd>
          </div>
        </dl>
        {gNote && <p role="status" className="text-center text-micro font-semibold text-rose-500">{gNote}</p>}
      </div>

      {/* verdict */}
      {verdict && (
        <div role="status" className="space-y-2 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-4" data-testid="verdict">
          <p className="flex items-center gap-2 text-label font-semibold text-slate-900 dark:text-white">
            <Stars count={verdict.stars} size="text-xl" /> {verdict.stars === 3 ? "Тамаша!" : verdict.stars > 0 ? "Орындалды" : "Әлі болмады"}
          </p>
          <ul className="space-y-1 text-body text-slate-700 dark:text-slate-300">
            {verdict.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {verdict.stars > 0 && verdict.stars < 3 && levelIdx >= 0 && <p className="text-micro text-slate-500 dark:text-slate-400">Жақсартып көр: үш жұлдызға жету үшін жолды өзгерт.</p>}
          {verdict.stars > 0 && levelIdx >= 0 && levelIdx < LEVELS.length - 1 && (
            <button onClick={() => setLevelIdx(levelIdx + 1)} className="btn-secondary min-h-[44px]">
              Келесі деңгей →
            </button>
          )}
        </div>
      )}
      {finished && levelIdx < 0 && result && (
        <div role="status" className="rounded-2xl border border-slate-200/70 p-4 text-body text-slate-700 dark:border-white/10 dark:text-slate-300" data-testid="free-result">
          {result.run.status === "finished" && `Мәреге жетті: жылдамдық ${n(result.run.endSpeed)} м/с. Жылу: ${kj(result.run.heat)} кДж.`}
          {result.run.status === "stopped" && `Вагонша ${n(result.run.endX)} м жерде тоқтады. Барлық энергия жылуға айналды: ${kj(result.run.heat)} кДж.`}
          {result.run.status === "off-start" && "Вагонша кері домалап, жолдың басынан шығып кетті."}
          {result.run.status === "running" && `Вагонша ${n(result.run.maxX)} м-ге дейін барып, тербеліп жүр. Ең үлкен G-күш: ${n(result.run.maxG)} g.`}
        </div>
      )}

      {/* the points, for fine and keyboard control */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-label font-semibold text-slate-900 dark:text-white">Нүктелердің биіктігі</p>
          <button
            onClick={() => setHeights([...level.initial])}
            className="inline-flex items-center gap-1 text-micro font-semibold text-slate-500 hover:text-brand-500 dark:text-slate-400"
          >
            <RotateCcw size={12} aria-hidden /> Бастапқы жолға қайту
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Рельс нүктелері">
          {ys.map((y, i) => {
            const locked = level.locked[i] !== undefined;
            return (
              <div key={i} className={`rounded-xl border p-2 text-center ${locked ? "border-slate-200 bg-slate-100/60 dark:border-white/10 dark:bg-white/5" : "border-slate-200 dark:border-white/10"}`}>
                <p className="text-micro text-slate-500 dark:text-slate-400">{TRACK_X[i]} м</p>
                <p className="data-num flex items-center justify-center gap-1 text-sm font-semibold text-slate-900 dark:text-white" data-testid={`pt-${i}`}>
                  {locked && <Lock size={11} aria-label="бекітілген" />}
                  {n(y)}
                </p>
                {!locked && (
                  <div className="mt-1 flex justify-center gap-1">
                    <button aria-label={`${i + 1}-нүктені төмендету`} onClick={() => nudge(i, -Y_STEP)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      <Minus size={14} aria-hidden />
                    </button>
                    <button aria-label={`${i + 1}-нүктені көтеру`} onClick={() => nudge(i, Y_STEP)} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">
                      <Plus size={14} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* score */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
        <p className="text-body text-slate-700 dark:text-slate-300">
          Жұлдыз: <strong className="data-num" data-testid="total-stars">{total.stars} / {LEVELS.length * 3}</strong> · Ұпай: <strong className="data-num">{total.score}</strong>
        </p>
        <button
          onClick={() => {
            setSavedScore(total.score);
            onComplete(total.score);
          }}
          disabled={total.score <= savedScore}
          className="btn-primary min-h-[44px]"
        >
          {savedScore > 0 && total.score <= savedScore ? "Сақталды ✓" : "Нәтижені сақтау"}
        </button>
      </div>
    </div>
  );
}
