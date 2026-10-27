"use client";

// The rules of the game, as a form. Every figure here is a parameter of the mode, not of the code:
// regional variants of asyq differ, so nothing about scoring or the end of a game is fixed.

import { useMemo, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FIELD } from "@/components/community/shared";
import { FACE_IDS, FACE_INFO } from "@/lib/asyq/faces";
import { describeRules } from "@/lib/asyq/describe";
import { MODES, getMode } from "@/lib/asyq/modes";
import { SURFACES, type SurfaceId } from "@/lib/asyq/physics";
import { MAX_PLAYERS, RING, SAKHAS, maxTargets, type EndCondition, type ModeId, type RuleConfig } from "@/lib/asyq/rules";
import { playerColour } from "./colours";

const mode = getMode("asyq-atu");

export function SetupPanel({ initial, onStart }: { initial: RuleConfig; onStart: (c: RuleConfig) => void }) {
  const [draft, setDraft] = useState<RuleConfig>(initial);
  const { config, notes } = useMemo(() => mode.normalize(draft), [draft]);
  const set = (patch: Partial<RuleConfig>) => setDraft((d) => ({ ...d, ...patch }));
  const setPlayer = (i: number, patch: Partial<RuleConfig["players"][number]>) =>
    setDraft((d) => ({ ...d, players: d.players.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));

  const players = config.players.length;
  const setPlayers = (n: number) =>
    setDraft((d) => ({
      ...d,
      players: Array.from({ length: n }, (_, i) => d.players[i] ?? { name: `${i + 1}-ойыншы`, sakha: "ortasha" }),
    }));

  const end = config.end;
  const setEnd = (e: EndCondition) => set({ end: e });
  const room = maxTargets(config.ringRadius, config.layout);

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <div>
          <h2 className="text-h3 text-slate-900 dark:text-white">Ойын режимі</h2>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Ойын режимі">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={config.mode === m.id}
                disabled={!m.available}
                onClick={() => m.available && set({ mode: m.id as ModeId })}
                className={`min-h-[44px] rounded-full border px-4 text-label font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  config.mode === m.id ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-200"
                }`}
                title={m.available ? m.summary : "Ережесі кейін қосылады"}
              >
                {m.name}
                {!m.available && " · жақында"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-body text-slate-600 dark:text-slate-400">{mode.summary}</p>
          <p className="mt-1 text-micro text-slate-500 dark:text-slate-400">
            Ханталапай мен Бес табанның ережелері өңірге қарай әртүрлі, сондықтан оларды болжап жазбай, ережесін білетін адам беретін кезде қосамыз.
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-h3 text-slate-900 dark:text-white">Ойыншылар</h2>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Ойыншылар саны">
          {Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={players === n}
              onClick={() => setPlayers(n)}
              className={`h-11 w-11 rounded-full border text-label font-semibold ${players === n ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 text-slate-700 dark:border-white/20 dark:text-slate-200"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {config.players.map((p, i) => (
            <li key={i} className="space-y-2 rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
              <label className="block text-sm">
                <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                  <span className="h-3 w-3 rounded-full" style={{ background: playerColour(i) }} aria-hidden /> {i + 1}-ойыншы
                </span>
                <input className={FIELD} value={draft.players[i]?.name ?? p.name} maxLength={24} onChange={(e) => setPlayer(i, { name: e.target.value })} aria-label={`${i + 1}-ойыншының аты`} />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Сақа</span>
                <select className={FIELD} value={p.sakha} onChange={(e) => setPlayer(i, { sakha: e.target.value })}>
                  {SAKHAS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {Math.round(s.mass * 1000)} г
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
        </ul>
        <label className="block max-w-xs text-sm">
          <span className="font-semibold text-slate-900 dark:text-white">Кім бірінші лақтырады</span>
          <select className={FIELD} value={config.turnOrder} onChange={(e) => set({ turnOrder: e.target.value as RuleConfig["turnOrder"] })}>
            <option value="sequence">Тізім бойынша</option>
            <option value="toss">Сақаны иіру арқылы (алшы → тәйке → бүк → шік)</option>
          </select>
        </label>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-h3 text-slate-900 dark:text-white">Алаң</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
              Нысанадағы асық саны <span className="data-num">{config.targetCount}</span>
            </span>
            <input type="range" min={1} max={room} step={1} value={config.targetCount} onChange={(e) => set({ targetCount: Number(e.target.value) })} className="mt-2 h-8 w-full accent-brand-500" />
            <span className="text-micro text-slate-500 dark:text-slate-400">Бұл шеңберге ең көбі {room} асық сияды.</span>
          </label>
          <label className="block text-sm">
            <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
              Шеңбер диаметрі <span className="data-num">{(config.ringRadius * 2).toFixed(1).replace(".", ",")} м</span>
            </span>
            <input type="range" min={RING.min} max={RING.max} step={0.1} value={config.ringRadius} onChange={(e) => set({ ringRadius: Number(e.target.value) })} className="mt-2 h-8 w-full accent-brand-500" />
            <span className="text-micro text-slate-500 dark:text-slate-400">Кіші шеңберден асық оңай шығады.</span>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">Асықтарды орналастыру</span>
            <select className={FIELD} value={config.layout} onChange={(e) => set({ layout: e.target.value as RuleConfig["layout"] })}>
              <option value="line">Бір қатарға (шеңбердің ортасы арқылы)</option>
              <option value="ring">Кішкентай шеңбер бойына</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">Асық қай қырымен тұрады</span>
            <select className={FIELD} value={config.setupFace} onChange={(e) => set({ setupFace: e.target.value as RuleConfig["setupFace"] })}>
              {FACE_IDS.map((f) => (
                <option key={f} value={f}>
                  {FACE_INFO[f].name} · {FACE_INFO[f].how}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">Жер беті</span>
            <select className={FIELD} value={config.surface} onChange={(e) => set({ surface: e.target.value as SurfaceId })}>
              {(Object.keys(SURFACES) as SurfaceId[]).map((s) => (
                <option key={s} value={s}>
                  {SURFACES[s].name} (үйкеліс {SURFACES[s].friction.toFixed(2).replace(".", ",")})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">Асық қашан «шықты» деп саналады</span>
            <select className={FIELD} value={config.leaveRule} onChange={(e) => set({ leaveRule: e.target.value as RuleConfig["leaveRule"] })}>
              <option value="centre">Ортасы шеңберден шықса</option>
              <option value="whole">Бүкіл денесі шеңберден шықса</option>
            </select>
          </label>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-h3 text-slate-900 dark:text-white">Ұпай және ойынның аяқталуы</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
              Шыққан асық үшін ұпай <span className="data-num">{config.pointsPerAsyq}</span>
            </span>
            <input type="range" min={0} max={10} step={1} value={config.pointsPerAsyq} onChange={(e) => set({ pointsPerAsyq: Number(e.target.value) })} className="mt-2 h-8 w-full accent-brand-500" />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">Асық ұтқан ойыншы</span>
            <select className={FIELD} value={config.turnRule} onChange={(e) => set({ turnRule: e.target.value as RuleConfig["turnRule"] })}>
              <option value="continue">Тағы лақтырады</option>
              <option value="pass">Кезекті береді</option>
            </select>
          </label>
          {config.turnRule === "continue" && (
            <label className="block text-sm">
              <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
                Қатарынан ең көбі <span className="data-num">{config.maxStreak}</span>
              </span>
              <input type="range" min={1} max={10} step={1} value={config.maxStreak} onChange={(e) => set({ maxStreak: Number(e.target.value) })} className="mt-2 h-8 w-full accent-brand-500" />
            </label>
          )}
          <label className="block text-sm">
            <span className="font-semibold text-slate-900 dark:text-white">Ойын қашан аяқталады</span>
            <select
              className={FIELD}
              value={end.kind}
              onChange={(e) => setEnd(e.target.value === "points" ? { kind: "points", target: 5 } : e.target.value === "throws" ? { kind: "throws", perPlayer: 5 } : { kind: "cleared" })}
            >
              <option value="cleared">Нысанадағы асықтар таусылғанда</option>
              <option value="points">Белгілі ұпайға бірінші жеткенде</option>
              <option value="throws">Әр ойыншы бірдей рет лақтырғанда</option>
            </select>
          </label>
          {end.kind === "points" && (
            <label className="block text-sm">
              <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
                Мақсатты ұпай <span className="data-num">{end.target}</span>
              </span>
              <input type="range" min={1} max={50} step={1} value={end.target} onChange={(e) => setEnd({ kind: "points", target: Number(e.target.value) })} className="mt-2 h-8 w-full accent-brand-500" />
            </label>
          )}
          {end.kind === "throws" && (
            <label className="block text-sm">
              <span className="flex justify-between font-semibold text-slate-900 dark:text-white">
                Әрқайсысы лақтыру саны <span className="data-num">{end.perPlayer}</span>
              </span>
              <input type="range" min={1} max={15} step={1} value={end.perPlayer} onChange={(e) => setEnd({ kind: "throws", perPlayer: Number(e.target.value) })} className="mt-2 h-8 w-full accent-brand-500" />
            </label>
          )}
          {end.kind !== "cleared" && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.refillWhenCleared} onChange={(e) => set({ refillWhenCleared: e.target.checked })} className="h-5 w-5 accent-brand-500" />
              <span className="text-slate-800 dark:text-slate-200">Асықтар таусылса, жаңадан тігу</span>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={config.allowSpin} onChange={(e) => set({ allowSpin: e.target.checked })} className="h-5 w-5 accent-brand-500" />
            <span className="text-slate-800 dark:text-slate-200">Лақтырғанда айналдыруға болады</span>
          </label>
        </div>
        <details className="rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
          <summary className="cursor-pointer text-label font-semibold text-slate-900 dark:text-white">Қосымша: қырына қарай қосымша ұпай</summary>
          <p className="mt-2 text-micro text-slate-500 dark:text-slate-400">Шыққан асық қай қырымен жатса, соған қарай ұпай қосылады (немесе азаяды). Көп жерде бұл жоқ, сондықтан әдепкіде нөл.</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FACE_IDS.map((f) => (
              <label key={f} className="block text-sm">
                <span className="text-slate-700 dark:text-slate-300">{FACE_INFO[f].name}</span>
                <input
                  type="number"
                  className={FIELD}
                  min={-10}
                  max={20}
                  value={draft.faceBonus[f]}
                  onChange={(e) => set({ faceBonus: { ...draft.faceBonus, [f]: Number(e.target.value) } })}
                />
              </label>
            ))}
          </div>
          <label className="mt-3 block max-w-[10rem] text-sm">
            <span className="text-slate-700 dark:text-slate-300">Иіру сәті (seed)</span>
            <input type="number" className={FIELD} min={0} value={draft.seed} onChange={(e) => set({ seed: Number(e.target.value) })} />
          </label>
        </details>
      </Card>

      <Card tone="sunken" className="space-y-2">
        <h2 className="text-h3 text-slate-900 dark:text-white">Ойын былай өтеді</h2>
        <ul className="list-disc space-y-1 pl-5 text-body text-slate-700 dark:text-slate-300">
          {describeRules(config).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {notes.length > 0 && (
          <p role="status" className="text-micro text-amber-700 dark:text-amber-300">
            Ереже түзетілді: {notes.join("; ")}.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => onStart(config)} className="btn-primary inline-flex min-h-[48px] items-center gap-2" data-testid="asyq-start">
          <Play size={16} aria-hidden /> Ойынды бастау
        </button>
        <button type="button" onClick={() => setDraft(mode.defaults())} className="btn-secondary inline-flex min-h-[48px] items-center gap-2">
          <RotateCcw size={16} aria-hidden /> Әдепкі ереже
        </button>
      </div>
    </div>
  );
}
