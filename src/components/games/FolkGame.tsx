"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Lightbulb } from "lucide-react";
import { arrowSpeed, buildFolk, defaultValues, judge, solutionFor, type FolkKind, type Judged } from "@/lib/folk";
import { MAX_SHOTS, gameScore, roundPoints } from "@/lib/projectile";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { FolkScene, type SceneAttempt } from "./FolkScene";

const GO_LABEL: Record<FolkKind, string> = { bow: "Ату", asyq: "Сақаны жіберу", tug: "Тартысуды бастау", rocket: "Ұшыру" };
const fmt = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

type Phase = "aim" | "playing" | "between" | "done";

/**
 * One of the four traditional-game rounds: read the facts, set the sliders, run it, and be told
 * what the physics did. Up to four attempts a round, like the projectile game, and the same
 * points; the hint sets the sliders to a solution for 70 % of the round's points.
 */
export function FolkGame({ kind, seed, onComplete }: { kind: FolkKind; seed: number; onComplete: (score: number) => void }) {
  const board = useMemo(() => buildFolk(kind, seed), [kind, seed]);
  const reduced = useReducedMotion();
  const [roundIdx, setRoundIdx] = useState(0);
  const round = board.rounds[roundIdx];
  const [values, setValues] = useState<Record<string, number>>(() => defaultValues(board.rounds[0]));
  const [attempts, setAttempts] = useState<SceneAttempt[]>([]);
  const [points, setPoints] = useState<number[]>([]);
  const [hintUsed, setHintUsed] = useState(false);
  const [phase, setPhase] = useState<Phase>("aim");
  const [progress, setProgress] = useState(1);
  const reported = useRef(false);

  const last = attempts[attempts.length - 1] ?? null;
  const earlier = attempts.slice(0, -1);

  function run() {
    if (phase !== "aim") return;
    const judged: Judged = judge(round, values);
    setAttempts((a) => [...a, { values, judged }]);
    if (reduced) {
      setProgress(1);
      settle(judged, attempts.length + 1);
    } else {
      setProgress(0);
      setPhase("playing");
    }
  }

  function settle(judged: Judged, count: number) {
    if (judged.hit || count >= MAX_SHOTS) {
      setPoints((p) => [...p, roundPoints(judged.hit ? count : null, hintUsed)]);
      setPhase("between");
    } else {
      setPhase("aim");
    }
  }

  // The attempt plays out over about two seconds.
  useEffect(() => {
    if (phase !== "playing" || !last) return;
    const t0 = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / 1900);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(frame);
      else settle(last.judged, attempts.length);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // `settle` closes over the round, which cannot change mid-attempt (the controls are locked)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function next() {
    if (roundIdx === board.rounds.length - 1) {
      setPhase("done");
      if (!reported.current) {
        reported.current = true;
        onComplete(gameScore(points));
      }
      return;
    }
    const nextRound = board.rounds[roundIdx + 1];
    setRoundIdx((i) => i + 1);
    setValues(defaultValues(nextRound));
    setAttempts([]);
    setHintUsed(false);
    setProgress(1);
    setPhase("aim");
  }

  function hint() {
    setValues(solutionFor(round));
    setHintUsed(true);
  }

  const running = points.reduce((a, b) => a + b, 0);
  const attemptsLeft = MAX_SHOTS - attempts.length;
  const showResult = last && (phase === "between" || (phase === "aim" && attempts.length > 0) || (phase === "playing" && progress >= 1));
  const locked = phase !== "aim";

  if (phase === "done") {
    const score = gameScore(points);
    return (
      <div className="space-y-4 rounded-2xl border border-slate-200/70 p-5 text-center dark:border-white/10" role="status">
        <p className="text-h2 text-slate-900 dark:text-white">Ойын аяқталды</p>
        <p className="data-num text-h1 text-brand-600 dark:text-brand-300">{score} / 100</p>
        <ul className="mx-auto max-w-xs space-y-1 text-body text-slate-700 dark:text-slate-300">
          {points.map((p, i) => (
            <li key={i} className="flex justify-between"><span>{board.rounds[i].title}</span><strong className="data-num">{p}</strong></li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label font-semibold text-slate-900 dark:text-white">{roundIdx + 1}/{board.rounds.length} · {round.title}</p>
        <p className="data-num text-micro text-slate-500 dark:text-slate-400">Ұпай: {running}</p>
      </div>

      <FolkScene round={round} last={last} earlier={earlier} progress={progress} />

      <p className="text-body text-slate-700 dark:text-slate-300">{round.story}</p>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {round.facts.map((f) => (
          <div key={f.label} className="flex justify-between gap-3 border-b border-slate-200/60 py-1 dark:border-white/10">
            <dt className="text-slate-600 dark:text-slate-400">{f.label}</dt>
            <dd className="data-num font-semibold text-slate-900 dark:text-white">{f.value}</dd>
          </div>
        ))}
      </dl>

      {phase !== "between" && (
        <div className="space-y-4 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
          <div className="grid gap-4 sm:grid-cols-2">
            {round.controls.map((c) => (
              <label key={c.id} className="block text-sm">
                <span className="flex items-baseline justify-between">
                  <span className="font-semibold text-slate-900 dark:text-white">{c.label}</span>
                  <span className="data-num text-label">{fmt(values[c.id], c.decimals)} {c.unit}</span>
                </span>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={values[c.id]}
                  disabled={locked}
                  onChange={(e) => setValues((v) => ({ ...v, [c.id]: Number(e.target.value) }))}
                  className="mt-2 h-8 w-full accent-brand-500"
                />
              </label>
            ))}
          </div>
          {kind === "bow" && (
            <p className="data-num text-micro text-slate-500 dark:text-slate-400">
              E = kx²/2 = {fmt(0.5 * round.params.k * (values.draw / 100) ** 2)} Дж · жебенің жылдамдығы v = {fmt(arrowSpeed(round.params.k, values.draw / 100, round.params.m, round.params.eta))} м/с
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={run} disabled={locked} className="btn-primary inline-flex min-h-[44px] items-center gap-2">
              {GO_LABEL[kind]}
            </button>
            <button onClick={hint} disabled={locked || hintUsed} className="btn-secondary inline-flex min-h-[44px] items-center gap-2" title="Шешімді көрсетеді, бірақ раунд ұпайы 30 %-ға азаяды">
              <Lightbulb size={16} aria-hidden /> Кеңес (−30 %)
            </button>
            <span className="flex items-center gap-1.5" aria-label={`Қалған әрекет: ${attemptsLeft}`}>
              {Array.from({ length: MAX_SHOTS }, (_, i) => (
                <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < attemptsLeft ? "bg-brand-500" : "bg-slate-300 dark:bg-white/20"}`} />
              ))}
            </span>
          </div>
        </div>
      )}

      {showResult && (
        <div role="status" data-testid="folk-result" className={`space-y-2 rounded-2xl border p-4 ${last.judged.hit ? "border-emerald-400/60 bg-emerald-500/10" : "border-amber-400/60 bg-amber-500/10"}`}>
          <p className="text-label font-semibold text-slate-900 dark:text-white">{last.judged.headline}</p>
          <ul className="space-y-1 text-body text-slate-700 dark:text-slate-300">
            {last.judged.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {phase === "between" && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <p className="data-num text-label font-semibold text-slate-900 dark:text-white">+{points[points.length - 1]} ұпай</p>
              <button onClick={next} className="btn-primary inline-flex min-h-[44px] items-center gap-2">
                {roundIdx === board.rounds.length - 1 ? "Аяқтау" : "Келесі раунд"} <ArrowRight size={16} aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
