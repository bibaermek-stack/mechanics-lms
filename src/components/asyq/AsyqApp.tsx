"use client";

// The asyq game: the rules form, then the arena with its controls, scoreboard and history.
// The game itself (src/lib/asyq/game.ts) owns every rule and all of the physics; this page asks it
// to throw and shows what it reports.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Crown, Eye, Flame, RotateCcw, Settings2, Target } from "lucide-react";
import { SetupPanel } from "./SetupPanel";
import { useAsyqGame } from "./useAsyqGame";
import { playerColour } from "./colours";
import { ARENA_VIEWS, type ArenaView } from "@/lib/asyq/camera";
import { describeRules } from "@/lib/asyq/describe";
import { FACE_INFO } from "@/lib/asyq/faces";
import { PHASES, PHASE_LABEL, type Phase, type ThrowRecord } from "@/lib/asyq/machine";
import { getMode } from "@/lib/asyq/modes";
import { sakhaById, type RuleConfig } from "@/lib/asyq/rules";
import { AIM_LIMIT, speedOf, type ThrowParams } from "@/lib/asyq/throw";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { webglAvailable } from "@/lib/webgl";

const AsyqArena = dynamic(() => import("./AsyqArena"), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-sm text-slate-600">3D алаң жүктелуде…</div>,
});

/** The app's panel, as a plain div so it can carry roles and test ids. */
function Panel({ className = "", ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`surface p-5 ${className}`} {...rest} />;
}

const STORAGE_KEY = "mechanics-lms:asyqRules";
const mode = getMode("asyq-atu");
const fmt = (x: number, d = 1) => x.toFixed(d).replace(".", ",");
const deg = (rad: number) => (rad * 180) / Math.PI;

function loadRules(): RuleConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return mode.normalize({ ...mode.defaults(), ...JSON.parse(raw) }).config;
  } catch {
    // no storage, or a rule set from some other version: start from the defaults
  }
  return mode.defaults();
}

function saveRules(c: RuleConfig) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // not worth failing a game over
  }
}

export function AsyqApp() {
  const [rules, setRules] = useState<RuleConfig | null>(null);
  const [initial, setInitial] = useState<RuleConfig | null>(null);
  useEffect(() => setInitial(loadRules()), []);

  if (!initial) return <Panel className="h-40 animate-pulse" aria-busy="true" />;
  if (!rules) {
    return (
      <SetupPanel
        initial={initial}
        onStart={(c) => {
          saveRules(c);
          setInitial(c);
          setRules(c);
        }}
      />
    );
  }
  return <Play config={rules} onRestart={() => setRules({ ...rules })} onRules={() => setRules(null)} />;
}

// ---------------------------------------------------------------------------

function Stepper({ phase }: { phase: Phase }) {
  const at = PHASES.indexOf(phase);
  const current = useRef<HTMLLIElement | null>(null);
  // on a phone the row scrolls sideways: keep the phase that is in progress in view
  useEffect(() => {
    const el = current.current;
    if (el && el.parentElement) el.parentElement.scrollTo({ left: el.offsetLeft - el.parentElement.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [phase]);
  return (
    <ol className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1" aria-label="Ойын кезеңдері" data-testid="asyq-stepper">
      {PHASES.map((p, i) => (
        <li
          key={p}
          ref={p === phase ? current : undefined}
          aria-current={p === phase ? "step" : undefined}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-micro font-semibold ${
            p === phase
              ? "border-brand-500 bg-brand-500 text-white"
              : i < at
                ? "border-brand-300/60 text-brand-700 dark:text-brand-300"
                : "border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-400"
          }`}
        >
          {PHASE_LABEL[p]}
        </li>
      ))}
    </ol>
  );
}

function FaceChip({ face }: { face: keyof typeof FACE_INFO | null }) {
  return (
    <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-micro font-semibold text-white" title={face ? FACE_INFO[face].how : "шетінде немесе ұшында тұр"}>
      {face ? FACE_INFO[face].name : "шетінде"}
    </span>
  );
}

function ThrowSummary({ rec }: { rec: ThrowRecord }) {
  return (
    <div className="space-y-2" data-testid="asyq-last-throw">
      <p className="text-label font-semibold text-slate-900 dark:text-white">
        {rec.no}-лақтыру · {rec.playerName}
        <span className="ml-2 data-num text-slate-600 dark:text-slate-400">
          бағыты {fmt(deg(rec.params.yaw), 0)}°, жылдамдығы {fmt(rec.speed)} м/с
          {(rec.params.spin !== 0 || rec.params.roll !== 0) && `, айналу ${fmt(rec.params.spin * 100, 0)} % / ${fmt(rec.params.roll * 100, 0)} %`}
        </span>
      </p>
      <ul className="space-y-1 text-body text-slate-700 dark:text-slate-300">
        <li>
          Сақа {rec.touched.length ? `${rec.touched.length} асыққа тиді` : "ешбір асыққа тиген жоқ"}; {rec.moved.length} асық орнынан қозғалды. Сақа{" "}
          <FaceChip face={rec.sakhaFace} /> қырымен жатыр.
        </li>
        {rec.scored.length === 0 ? (
          <li>Шеңберден асық шыққан жоқ.</li>
        ) : (
          rec.scored.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              Асық {s.id} шеңберден шықты <FaceChip face={s.face} />
              <span className="data-num font-semibold text-emerald-700 dark:text-emerald-300">
                +{s.points}
                {s.bonus !== 0 && ` (${s.base} + ${s.bonus} қыры үшін)`}
              </span>
            </li>
          ))
        )}
        <li className="text-slate-600 dark:text-slate-400">
          Ұпай жиыны: <span className="data-num font-semibold">{rec.playerTotal}</span>. {rec.turn.reason}.
          {!rec.simulation.clean && " (Есептеуде асықтар сәл қабаттасты: " + fmt(rec.simulation.maxOverlap * 1000, 1) + " мм.)"}
        </li>
      </ul>
    </div>
  );
}

function Play({ config, onRestart, onRules }: { config: RuleConfig; onRestart: () => void; onRules: () => void }) {
  const { game, version, error } = useAsyqGame(config);
  const reduced = useReducedMotion();
  const [aim, setAim] = useState<ThrowParams>({ yaw: 0, power: 0.65, spin: 0, roll: 0 });
  const [view, setView] = useState<ArenaView>("throw");
  const [gl, setGl] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => setGl(webglAvailable()), []);

  const state = game?.state ?? null;
  const computing = game?.isComputing ?? false;
  const aiming = !!game && state?.phase === "aiming" && !computing && ready;
  void version; // the game changed: read it afresh

  const throwNow = useCallback(() => {
    if (!game || game.state.phase !== "aiming") return;
    void game.throwSakhaAsync(aim).then((ok) => ok && reduced && game.skipPlayback());
  }, [game, aim, reduced]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!aiming) return;
    const step = (d: number) => setAim((a) => ({ ...a, yaw: Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, a.yaw + d)) }));
    const pow = (d: number) => setAim((a) => ({ ...a, power: Math.max(0, Math.min(1, a.power + d)) }));
    if (e.key === "ArrowLeft") (e.preventDefault(), step(-Math.PI / 180));
    else if (e.key === "ArrowRight") (e.preventDefault(), step(Math.PI / 180));
    else if (e.key === "ArrowUp") (e.preventDefault(), pow(0.03));
    else if (e.key === "ArrowDown") (e.preventDefault(), pow(-0.03));
    else if (e.key === "Enter" || e.key === " ") (e.preventDefault(), throwNow());
  };

  const last = state && state.history.length ? state.history[state.history.length - 1] : null;
  const current = state ? state.players[state.current] : null;
  const rules = useMemo(() => describeRules(config), [config]);

  if (gl === false) {
    return (
      <Panel className="space-y-3" role="alert">
        <p className="text-label font-semibold text-slate-900 dark:text-white">Бұл құрылғыда 3D (WebGL) қосулы емес</p>
        <p className="text-body text-slate-700 dark:text-slate-300">Асық ойыны 3D физикаға сүйенеді. WebGL-ді қосыңыз немесе басқа браузерде ашыңыз.</p>
        <button onClick={onRules} className="btn-secondary">Ережеге оралу</button>
      </Panel>
    );
  }
  if (error) {
    return (
      <Panel className="space-y-3" role="alert">
        <p className="text-label font-semibold text-slate-900 dark:text-white">Физика қозғалтқышы жүктелмеді</p>
        <p className="text-micro text-slate-600 dark:text-slate-400">{error}</p>
        <button onClick={onRestart} className="btn-primary">Қайталау</button>
      </Panel>
    );
  }
  if (!game || !state) {
    return (
      <Panel className="flex h-48 items-center justify-center" aria-busy="true">
        <span className="text-body text-slate-600 dark:text-slate-400">Физика қозғалтқышы жүктелуде…</span>
      </Panel>
    );
  }

  const speed = speedOf(aim.power);
  const pending = state.pending;
  const finished = state.phase === "finished";

  return (
    <div className="space-y-5">
      <Stepper phase={state.phase} />

      <div
        className="relative isolate aspect-[16/10] min-h-[260px] w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-sky-100 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-white/10"
        role="application"
        tabIndex={0}
        aria-label="Асық алаңы. Бағытты алаңды басып белгілеңіз немесе сол/оң көрсеткімен өзгертіңіз, күшті жоғары/төмен көрсеткімен, Enter — лақтыру."
        onKeyDown={onKey}
        data-testid="asyq-arena"
        data-phase={state.phase}
        data-ready={ready}
      >
        <AsyqArena game={game} version={version} aim={aim} onAimYaw={(yaw) => setAim((a) => ({ ...a, yaw }))} view={view} reduced={reduced} onReady={() => setReady(true)} />
        {!ready && <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-slate-900">3D алаң жүктелуде…</p>}
        {computing && <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-sm font-semibold text-slate-900">Лақтыру есептелуде…</p>}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Көрініс">
          {ARENA_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
              className={`min-h-[40px] rounded-full border px-3 text-label font-semibold ${view === v.id ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-200"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="max-w-[34ch] text-micro text-slate-500 dark:text-slate-400">Асықтар нақты өлшемнен {6} есе ірі көрсетілген; физика нақты өлшеммен (асық ≈ 4 см) есептеледі.</p>
      </div>

      <p className="sr-only" aria-live="polite">
        {PHASE_LABEL[state.phase]}. {current ? `${current.name} кезегі.` : ""}
      </p>

      {/* whose turn, and the controls */}
      {!finished && current && (
        <Panel className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-label font-semibold text-slate-900 dark:text-white">
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: playerColour(state.current) }} aria-hidden />
              {current.name} · {sakhaById(current.sakha).name}
              {state.streak > 0 && state.phase === "aiming" && (
                <span className="inline-flex items-center gap-1 text-micro text-amber-700 dark:text-amber-300">
                  <Flame size={13} aria-hidden /> қатарынан {state.streak + 1}-лақтыру
                </span>
              )}
            </p>
            <p className="text-micro text-slate-500 dark:text-slate-400">{state.phase === "aiming" ? "Кезек сенде: бағытты белгіле, күшті таңда." : PHASE_LABEL[state.phase] + "…"}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
                Бағыт <span className="data-num" data-testid="asyq-yaw">{fmt(deg(aim.yaw), 0)}°</span>
              </span>
              <input
                type="range"
                min={-deg(AIM_LIMIT)}
                max={deg(AIM_LIMIT)}
                step={1}
                value={Math.round(deg(aim.yaw))}
                disabled={!aiming}
                onChange={(e) => setAim((a) => ({ ...a, yaw: (Number(e.target.value) * Math.PI) / 180 }))}
                className="mt-2 h-8 w-full accent-brand-500"
                aria-label="Лақтыру бағыты, градус"
              />
            </label>
            <label className="block text-sm">
              <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
                Күш <span className="data-num" data-testid="asyq-power">{fmt(aim.power * 100, 0)} % · {fmt(speed)} м/с</span>
              </span>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(aim.power * 100)} aria-label="Күш индикаторы">
                <div className="h-full rounded-full" style={{ width: `${aim.power * 100}%`, background: `linear-gradient(90deg, #22c55e, #eab308 60%, #ef4444)` }} />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(aim.power * 100)}
                disabled={!aiming}
                onChange={(e) => setAim((a) => ({ ...a, power: Number(e.target.value) / 100 }))}
                className="mt-1 h-8 w-full accent-brand-500"
                aria-label="Лақтыру күші, пайыз"
              />
            </label>
            {config.allowSpin && (
              <>
                <label className="block text-sm">
                  <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
                    Айналдыру (жазықтықта) <span className="data-num">{fmt(aim.spin * 100, 0)} %</span>
                  </span>
                  <input type="range" min={-100} max={100} step={5} value={Math.round(aim.spin * 100)} disabled={!aiming} onChange={(e) => setAim((a) => ({ ...a, spin: Number(e.target.value) / 100 }))} className="mt-2 h-8 w-full accent-brand-500" aria-label="Жазықтықта айналдыру" />
                </label>
                <label className="block text-sm">
                  <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
                    Домалату (алға/артқа) <span className="data-num">{fmt(aim.roll * 100, 0)} %</span>
                  </span>
                  <input type="range" min={-100} max={100} step={5} value={Math.round(aim.roll * 100)} disabled={!aiming} onChange={(e) => setAim((a) => ({ ...a, roll: Number(e.target.value) / 100 }))} className="mt-2 h-8 w-full accent-brand-500" aria-label="Алға немесе артқа домалату" />
                </label>
              </>
            )}
          </div>

          <button onClick={throwNow} disabled={!aiming} className="btn-primary inline-flex min-h-[48px] items-center gap-2" data-testid="asyq-throw">
            <Target size={16} aria-hidden /> Лақтыру
          </button>
        </Panel>
      )}

      {/* what is being decided, and what the last throw did */}
      {state.phase === "judging" && pending?.final && (
        <Panel className="space-y-2" role="status">
          <p className="text-label font-semibold text-slate-900 dark:text-white">Нәтиже анықталуда: асықтар тоқтады</p>
          <p className="flex flex-wrap items-center gap-2 text-body text-slate-700 dark:text-slate-300">
            {pending.final.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1">
                {b.kind === "sakha" ? "сақа" : b.id} <FaceChip face={b.face} />
              </span>
            ))}
          </p>
        </Panel>
      )}
      {state.phase === "scoring" && pending?.judgement && (
        <Panel className="space-y-1" role="status">
          <p className="text-label font-semibold text-slate-900 dark:text-white">Ұпай есептелуде</p>
          <p className="text-body text-slate-700 dark:text-slate-300">
            {pending.judgement.scored.length ? `${pending.judgement.scored.length} асық шеңберден шықты: +${pending.judgement.points} ұпай.` : "Шеңберден асық шыққан жоқ."}
          </p>
        </Panel>
      )}
      {last && !["judging", "scoring"].includes(state.phase) && (
        <Panel>
          <ThrowSummary rec={last} />
        </Panel>
      )}

      {finished && (
        <Panel className="space-y-3 border-2 border-amber-400/60" role="status" data-testid="asyq-finished">
          <p className="flex items-center gap-2 text-h3 text-slate-900 dark:text-white">
            <Crown size={20} className="text-amber-500" aria-hidden />
            {state.winners && state.winners.length > 0
              ? state.winners.length === 1
                ? `${state.players[state.winners[0]].name} жеңді!`
                : `Тең: ${state.winners.map((i) => state.players[i].name).join(", ")}`
              : "Ешкім асық ұтқан жоқ"}
          </p>
          <p className="text-body text-slate-700 dark:text-slate-300">Ойын аяқталды: {state.endReason}.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onRestart} className="btn-primary inline-flex min-h-[44px] items-center gap-2" data-testid="asyq-again">
              <RotateCcw size={16} aria-hidden /> Қайта ойнау
            </button>
            <button onClick={onRules} className="btn-secondary inline-flex min-h-[44px] items-center gap-2">
              <Settings2 size={16} aria-hidden /> Ережені өзгерту
            </button>
          </div>
        </Panel>
      )}

      {/* the table */}
      <Panel className="space-y-3">
        <h2 className="text-h3 text-slate-900 dark:text-white">Ұпай кестесі</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-sm" data-testid="asyq-scoreboard">
            <thead className="text-micro text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-1 pr-3 font-semibold">Ойыншы</th>
                <th className="py-1 pr-3 font-semibold">Ұпай</th>
                <th className="py-1 pr-3 font-semibold">Асық</th>
                <th className="py-1 font-semibold">Лақтыру</th>
              </tr>
            </thead>
            <tbody>
              {state.players.map((p, i) => (
                <tr key={i} className={`border-t border-slate-200/60 dark:border-white/10 ${i === state.current && !finished ? "bg-brand-500/5" : ""}`}>
                  <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">
                    <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: playerColour(i) }} aria-hidden />
                    {p.name}
                    {finished && state.winners?.includes(i) && <Crown size={14} className="ml-1 inline text-amber-500" aria-label="жеңімпаз" />}
                  </td>
                  <td className="data-num py-2 pr-3 text-base font-bold">{p.points}</td>
                  <td className="data-num py-2 pr-3">{p.won.length}</td>
                  <td className="data-num py-2">{p.throws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-micro text-slate-500 dark:text-slate-400">Нысанада қалған асық: <span className="data-num">{state.field.length}</span></p>
      </Panel>

      <details className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
        <summary className="flex cursor-pointer items-center gap-2 text-label font-semibold text-slate-900 dark:text-white">
          <Eye size={15} aria-hidden /> Лақтыру тарихы ({state.history.length})
        </summary>
        {state.history.length === 0 ? (
          <p className="mt-2 text-body text-slate-600 dark:text-slate-400">Әлі лақтыру болған жоқ.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm" data-testid="asyq-history">
              <thead className="text-micro text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 pr-3 font-semibold">№</th>
                  <th className="py-1 pr-3 font-semibold">Ойыншы</th>
                  <th className="py-1 pr-3 font-semibold">Бағыт · күш</th>
                  <th className="py-1 pr-3 font-semibold">Тиген</th>
                  <th className="py-1 pr-3 font-semibold">Шыққан асық</th>
                  <th className="py-1 pr-3 font-semibold">Ұпай</th>
                  <th className="py-1 font-semibold">Кезек</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((h) => (
                  <tr key={h.no} className="border-t border-slate-200/60 align-top dark:border-white/10">
                    <td className="data-num py-2 pr-3">{h.no}</td>
                    <td className="py-2 pr-3">{h.playerName}</td>
                    <td className="data-num py-2 pr-3">
                      {fmt(deg(h.params.yaw), 0)}° · {fmt(h.speed)} м/с
                    </td>
                    <td className="data-num py-2 pr-3">{h.touched.length}</td>
                    <td className="py-2 pr-3">
                      {h.scored.length ? h.scored.map((s) => `${s.id} (${s.face ? FACE_INFO[s.face].name : "шетінде"})`).join(", ") : "—"}
                    </td>
                    <td className="data-num py-2 pr-3 font-semibold">+{h.points}</td>
                    <td className="py-2 text-slate-600 dark:text-slate-400">{h.turn.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details className="rounded-2xl border border-slate-200/70 p-4 dark:border-white/10">
        <summary className="cursor-pointer text-label font-semibold text-slate-900 dark:text-white">Бұл ойынның ережесі</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-slate-700 dark:text-slate-300">
          {rules.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {game.toss && (
          <p className="mt-2 text-body text-slate-700 dark:text-slate-300" data-testid="asyq-toss">
            Сақа иіру: {game.toss.rounds[0].map((r) => `${config.players[r.player].name} — ${r.face ? FACE_INFO[r.face].name : "шетінде"}`).join(", ")}.
            {game.toss.rounds.length > 1 ? ` Тең түскендер қайта иіреді (${game.toss.rounds.length - 1}).` : ""} Тәртіп: {game.toss.order.map((i) => config.players[i].name).join(" → ")}.
          </p>
        )}
        <button onClick={onRules} className="btn-secondary mt-3 inline-flex min-h-[40px] items-center gap-2">
          <Settings2 size={15} aria-hidden /> Ережені өзгерту
        </button>
      </details>
    </div>
  );
}
