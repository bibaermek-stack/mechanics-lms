"use client";

import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { trajectory, flightTime } from "@/lib/projectile";
import { ASYQ_VIEWS, type AsyqView } from "@/lib/asyqView";
import { webglAvailable } from "@/lib/webgl";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { G, slidePosition, slideStopTime, type FolkRound, type Judged } from "@/lib/folk";

const W = 600, H = 210, GROUND = 178;

// The 3D scene (three.js, and the scanned bone) is a separate chunk that only the asyq game loads.
const AsyqScene3D = lazy(() => import("./AsyqScene3D"));
const ASYQ_MODEL_URL = "/models/asyk.glb";

export interface SceneAttempt {
  values: Record<string, number>;
  judged: Judged;
}

const fmt = (x: number, d = 0) => x.toFixed(d).replace(".", ",");

function Ground({ color = "#16a34a" }: { color?: string }) {
  return <rect x={0} y={GROUND} width={W} height={H - GROUND} fill={color} opacity={0.5} />;
}

function Bow({ round, last, earlier, progress }: { round: FolkRound; last: SceneAttempt | null; earlier: SceneAttempt[]; progress: number }) {
  const p = round.params;
  const all = [...earlier, ...(last ? [last] : [])];
  const reach = Math.max(p.target * 1.25, ...all.map((a) => a.judged.values.range * 1.05), 40);
  const apex = Math.max(8, ...all.map((a) => Math.max(0, (a.judged.values.v * Math.sin((a.judged.values.angle * Math.PI) / 180)) ** 2 / (2 * G) + p.h0)));
  const X = (x: number) => 30 + (x / reach) * (W - 50);
  const Y = (y: number) => GROUND - (y / (apex * 1.15)) * (GROUND - 24);
  const path = (a: SceneAttempt, upTo = 1) => {
    const pts = trajectory(a.judged.values.v, a.judged.values.angle, G, 60, p.h0);
    const k = Math.max(1, Math.round(upTo * (pts.length - 1)));
    return pts.slice(0, k + 1).map((q, i) => `${i ? "L" : "M"}${X(q.x).toFixed(1)} ${Y(q.y).toFixed(1)}`).join("");
  };
  const head = last ? (() => {
    const T = flightTime(last.judged.values.v, last.judged.values.angle, G, p.h0);
    const t = T * progress;
    const a = (last.judged.values.angle * Math.PI) / 180;
    return { x: last.judged.values.v * Math.cos(a) * t, y: p.h0 + last.judged.values.v * Math.sin(a) * t - 0.5 * G * t * t };
  })() : null;
  return (
    <>
      <Ground />
      <rect x={X(p.target - p.radius)} y={GROUND - 7} width={Math.max(3, X(p.target + p.radius) - X(p.target - p.radius))} height={7} fill="#f43f5e" />
      <line x1={X(p.target)} x2={X(p.target)} y1={GROUND - 26} y2={GROUND} stroke="#f43f5e" strokeWidth={2} />
      <text x={X(p.target)} y={GROUND + 16} textAnchor="middle" fontSize={11} className="fill-slate-700 dark:fill-slate-200">{fmt(p.target)} м</text>
      <circle cx={X(0)} cy={Y(p.h0) - 4} r={5} className="fill-slate-700 dark:fill-slate-200" />
      <line x1={X(0)} x2={X(0)} y1={Y(p.h0)} y2={GROUND} className="stroke-slate-700 dark:stroke-slate-200" strokeWidth={3} />
      {earlier.map((a, i) => <path key={i} d={path(a)} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" />)}
      {last && <path d={path(last, progress)} fill="none" stroke="#2563eb" strokeWidth={2.5} />}
      {head && <circle cx={X(head.x)} cy={Y(Math.max(0, head.y))} r={4} fill="#facc15" stroke="#0f172a" />}
      {last && progress >= 1 && <text x={X(last.judged.values.range)} y={GROUND - 12} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-brand-600 dark:fill-brand-300">{fmt(last.judged.values.range, 1)} м</text>}
    </>
  );
}

function Asyq({ round, last, earlier, progress }: { round: FolkRound; last: SceneAttempt | null; earlier: SceneAttempt[]; progress: number }) {
  const p = round.params;
  const all = [...earlier, ...(last ? [last] : [])];
  const reach = Math.max(p.target * 1.3, ...all.map((a) => a.judged.values.d * 1.05), 6);
  const X = (x: number) => 30 + (x / reach) * (W - 60);
  const lane = GROUND - 60;
  const pos = last ? slidePosition(last.judged.values.v, p.mu, slideStopTime(last.judged.values.v, p.mu) * progress) : 0;
  const shade = p.mu < 0.08 ? "#bae6fd" : p.mu < 0.2 ? "#e0f2fe" : p.mu < 0.35 ? "#d6b88a" : p.mu < 0.5 ? "#86efac" : "#fcd34d";
  return (
    <>
      <rect x={0} y={lane} width={W} height={72} fill={shade} opacity={0.55} />
      <line x1={0} x2={W} y1={lane + 36} y2={lane + 36} stroke="#0f172a" strokeOpacity={0.15} strokeDasharray="3 6" />
      <rect x={X(p.target - p.radius)} y={lane + 4} width={Math.max(3, X(p.target + p.radius) - X(p.target - p.radius))} height={64} fill="#22c55e" opacity={0.25} />
      {[-0.3, -0.15, 0, 0.15, 0.3].map((o, i) => (
        <rect key={i} x={X(p.target + o) - 4} y={lane + 36 - 8} width={8} height={16} rx={3} fill="#f8fafc" stroke="#475569" />
      ))}
      <text x={X(p.target)} y={lane + 88} textAnchor="middle" fontSize={11} className="fill-slate-700 dark:fill-slate-200">асықтар · {fmt(p.target, 1)} м</text>
      {earlier.map((a, i) => <line key={i} x1={X(a.judged.values.d)} x2={X(a.judged.values.d)} y1={lane + 12} y2={lane + 60} stroke="#64748b" strokeDasharray="3 3" />)}
      <circle cx={X(pos)} cy={lane + 36} r={9} fill="#7c3aed" stroke="#fff" strokeWidth={2} />
      <text x={X(0)} y={lane + 88} textAnchor="middle" fontSize={11} className="fill-slate-700 dark:fill-slate-200">лақтыру</text>
      {last && progress >= 1 && <text x={X(last.judged.values.d)} y={lane - 6} textAnchor="middle" fontSize={11} fontWeight={600} className="fill-brand-600 dark:fill-brand-300">{fmt(last.judged.values.d, 2)} м</text>}
    </>
  );
}

function Tug({ round, last, progress }: { round: FolkRound; last: SceneAttempt | null; progress: number }) {
  const mine = last?.judged.values.mine ?? 0, theirs = last?.judged.values.theirs ?? maxOpp(round);
  const top = Math.max(mine, theirs, 1) * 1.1;
  const bar = (v: number) => Math.max(2, (v / top) * 420);
  const lean = last ? Math.max(-1, Math.min(1, (mine - theirs) / theirs)) * progress : 0;
  return (
    <>
      <Ground color="#a16207" />
      <text x={20} y={30} fontSize={12} className="fill-slate-700 dark:fill-slate-200">Сен: {last ? `${fmt(mine)} Н` : "?"}</text>
      <rect x={150} y={18} width={last ? bar(mine) : 0} height={14} rx={4} fill="#2563eb" />
      <text x={20} y={58} fontSize={12} className="fill-slate-700 dark:fill-slate-200">Қарсылас: {fmt(theirs)} Н</text>
      <rect x={150} y={46} width={bar(theirs)} height={14} rx={4} fill="#f43f5e" />
      <line x1={60} x2={W - 60} y1={118} y2={118} stroke="#78350f" strokeWidth={4} />
      <rect x={W / 2 - 4 - lean * 150} y={106} width={8} height={24} fill="#facc15" stroke="#0f172a" />
      <line x1={W / 2} x2={W / 2} y1={96} y2={140} stroke="#0f172a" strokeOpacity={0.4} strokeDasharray="3 3" />
      <text x={60} y={150} fontSize={11} className="fill-slate-700 dark:fill-slate-200">← сен</text>
      <text x={W - 60} y={150} fontSize={11} textAnchor="end" className="fill-slate-700 dark:fill-slate-200">қарсылас →</text>
    </>
  );
}
const maxOpp = (round: FolkRound) => round.params.muOpp * round.params.massOpp * G;

function Rocket({ round, last, progress }: { round: FolkRound; last: SceneAttempt | null; progress: number }) {
  const p = round.params;
  const top = Math.max(p.target * 1.25, (last?.judged.values.total ?? 0) * 1.05);
  const X = (v: number) => 30 + (v / top) * (W - 60);
  const dv1 = (last?.judged.values.dv1 ?? 0) * progress, dv2 = (last?.judged.values.dv2 ?? 0) * progress;
  return (
    <>
      <rect x={30} y={80} width={W - 60} height={26} rx={6} fill="#0f172a" opacity={0.12} />
      <rect x={30} y={80} width={Math.max(0, X(dv1) - 30)} height={26} rx={6} fill="#2563eb" />
      <rect x={X(dv1)} y={80} width={Math.max(0, X(dv1 + dv2) - X(dv1))} height={26} fill="#16a34a" />
      <rect x={X(p.target * 0.97)} y={70} width={X(p.target * 1.03) - X(p.target * 0.97)} height={46} fill="#f43f5e" opacity={0.35} />
      <line x1={X(p.target)} x2={X(p.target)} y1={64} y2={122} stroke="#f43f5e" strokeWidth={2} />
      <text x={X(p.target)} y={58} textAnchor="middle" fontSize={11} className="fill-slate-700 dark:fill-slate-200">керегі {fmt(p.target)} м/с</text>
      <text x={30} y={144} fontSize={11} className="fill-slate-700 dark:fill-slate-200">0</text>
      {last && <text x={Math.min(W - 40, X(dv1 + dv2) + 6)} y={98} fontSize={12} fontWeight={600} className="fill-slate-900 dark:fill-white">{fmt(dv1 + dv2)} м/с</text>}
      <path d={`M${X(dv1 + dv2) - 6} 150 l6 -16 l6 16 z`} fill="#facc15" stroke="#0f172a" />
      <text x={30} y={186} fontSize={11} className="fill-slate-700 dark:fill-slate-200">{p.stages === 2 ? "көк — 1-саты, жасыл — 2-саты" : "көк — бір сатылы зымыран"}</text>
    </>
  );
}

function Flat({ round, last, earlier, progress }: FolkSceneProps) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full rounded-2xl border border-slate-200/70 bg-sky-50 dark:border-white/10 dark:bg-slate-900" role="img" aria-label={label(round)}>
      {round.kind === "bow" && <Bow round={round} last={last} earlier={earlier} progress={progress} />}
      {round.kind === "asyq" && <Asyq round={round} last={last} earlier={earlier} progress={progress} />}
      {round.kind === "tug" && <Tug round={round} last={last} progress={progress} />}
      {round.kind === "rocket" && <Rocket round={round} last={last} progress={progress} />}
    </svg>
  );
}

const label = (round: FolkRound) => `${round.title}: ${round.facts.map((f) => `${f.label} ${f.value}`).join(", ")}`;

/** Falls back to the flat picture if the 3D scene cannot start (no GPU context, model or chunk not fetched). */
class Guard extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Asyq3D(props: FolkSceneProps) {
  const { round, aim, last } = props;
  const reduced = useReducedMotion();
  // After a throw the sakha stays where it stopped until the slider moves: only then does it go back to the line for the next one.
  const aiming = !!aim && !(last && aim.speed === last.values.speed);
  const [mode, setMode] = useState<"checking" | "3d" | "flat">("checking");
  const [view, setView] = useState<AsyqView>("chase");

  useEffect(() => {
    setMode(webglAvailable() ? "3d" : "flat");
    // start fetching the model while the 3D chunk loads: the browser's cache hands it over afterwards
    fetch(ASYQ_MODEL_URL).catch(() => {});
  }, []);

  if (mode === "flat") return <Flat {...props} />;
  const box = "relative isolate aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-sky-100 dark:border-white/10";
  return (
    <div>
      <div className={box} role="img" aria-label={`${label(round)} · 3D көрініс`} data-testid="asyq-3d">
        {mode === "3d" && (
          <Guard onError={() => setMode("flat")}>
            <Suspense fallback={<p className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">3D сахна жүктелуде…</p>}>
              <AsyqScene3D round={round} last={props.last} earlier={props.earlier} progress={props.progress} aim={aiming ? { speed: aim!.speed } : null} view={view} reduced={reduced} />
            </Suspense>
          </Guard>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Көрініс">
          {ASYQ_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`min-h-[40px] rounded-full border px-3 text-label font-semibold transition-colors ${view === v.id ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-slate-700 hover:border-brand-400 dark:border-white/20 dark:text-slate-200"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="max-w-[28ch] text-micro text-slate-500 dark:text-slate-400">Асықтар жол ұзындығына сай ірілетіп көрсетілген. Жасыл белдеу — асықтардың қасы.</p>
      </div>
    </div>
  );
}

export interface FolkSceneProps {
  round: FolkRound;
  last: SceneAttempt | null;
  earlier: SceneAttempt[];
  progress: number;
  /** The slider values while the player is aiming (null while a throw plays or after it): the 3D asyq scene shows the speed as an arrow. */
  aim?: Record<string, number> | null;
}

/** The picture of a round: what the player is aiming at, and the last attempt playing out. */
export function FolkScene(props: FolkSceneProps) {
  if (props.round.kind === "asyq") return <Asyq3D {...props} />;
  return <Flat {...props} />;
}
