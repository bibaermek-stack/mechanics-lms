"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, FlaskConical, Play, Square, Smartphone } from "lucide-react";
import { generateId, getSensorResults, saveSensorResult } from "@/lib/dataStore";
import type { AppUser, SensorResult } from "@/lib/types";
import {
  G,
  parseSensorCsv,
  synthesizeJump,
  synthesizeLift,
  synthesizePendulum,
  synthesizeRest,
  type Sample,
} from "@/lib/sensors/analysis";
import { PENDULUM_LENGTH, analyseRun, num, type Experiment } from "@/lib/sensors/experiments";
import { SENSOR_META, STORED_UNIT } from "@/lib/sensors/meta";
import { Card } from "@/components/ui/Card";
import { ClassJumps } from "./ClassJumps";
import { SignalPlot } from "./SignalPlot";
import { useMotionRecorder } from "./useMotionRecorder";

type Source = "sensor" | "file" | "sample";
interface Run {
  samples: Sample[];
  source: Source;
}

const SOURCE_LABEL: Record<Source, string> = {
  sensor: "Телефон сенсоры",
  file: "CSV файл",
  sample: "ҮЛГІ жазба — нақты өлшем емес",
};

const MAX_CSV_BYTES = 8_000_000;

/** The sample recording each experiment can show on a computer. Idealised physics, never saved. */
function sampleRun(exp: Experiment, length: number | undefined, n: number): Sample[] {
  const seed = 100 + n;
  switch (exp.kind) {
    case "rest-g":
      return synthesizeRest(6, 9.79, { seed });
    case "jump":
      return synthesizeJump(0.35, { seed, ramp: 0.03 }).samples;
    case "pendulum":
      return synthesizePendulum(length && length >= PENDULUM_LENGTH.min && length <= PENDULUM_LENGTH.max ? length : PENDULUM_LENGTH.initial, { seed, seconds: 20 }).samples;
    case "elevator":
      return synthesizeLift("up", 0.9, { seed });
  }
}

const parseLength = (s: string) => {
  const v = Number(s.replace(",", ".").trim());
  return s.trim() === "" || !Number.isFinite(v) ? undefined : v;
};

export function ExperimentPanel({ exp, user }: { exp: Experiment; user: AppUser }) {
  const rec = useMotionRecorder({ countdown: exp.countdown, seconds: exp.seconds });
  const [run, setRun] = useState<Run | null>(null);
  const [lengthText, setLengthText] = useState(String(PENDULUM_LENGTH.initial).replace(".", ","));
  const [fileError, setFileError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [history, setHistory] = useState<SensorResult[] | null>(null);
  const [classKey, setClassKey] = useState(0);
  const sampleCount = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const length = parseLength(lengthText);

  useEffect(() => {
    let cancelled = false;
    getSensorResults(user.uid)
      .then((r) => !cancelled && setHistory(r.filter((x) => x.kind === exp.kind)))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [user.uid, exp.kind]);

  // A finished recording becomes the run on show.
  const recorded = rec.state.phase === "done" ? rec.state.samples : null;
  useEffect(() => {
    if (recorded) {
      setRun({ samples: recorded, source: "sensor" });
      setSaved(false);
      setSaveError(null);
    }
  }, [recorded]);

  const outcome = useMemo(() => (run ? analyseRun(exp.kind, run.samples, { length }) : null), [run, exp.kind, length]);
  const analysis = outcome?.ok ? outcome.analysis : null;
  const busy = rec.state.phase === "asking" || rec.state.phase === "countdown" || rec.state.phase === "recording";

  const showRun = (r: Run) => {
    rec.reset();
    setRun(r);
    setSaved(false);
    setSaveError(null);
    setFileError(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setFileError("Файл тым үлкен (8 МБ-тан артық). Жазбаны қысқартып көр.");
      return;
    }
    const parsed = parseSensorCsv(await file.text());
    if (!parsed.ok) {
      setFileError(parsed.reason);
      return;
    }
    showRun({ samples: parsed.samples, source: "file" });
  };

  const save = async () => {
    if (!run || !analysis || run.source === "sample" || !analysis.saveable || saved) return;
    setSaving(true);
    setSaveError(null);
    const row: SensorResult = {
      id: generateId("sens"),
      userId: user.uid,
      kind: exp.kind,
      value: analysis.value,
      unit: STORED_UNIT[exp.kind],
      // only the figures, never the raw recording
      details: JSON.parse(JSON.stringify({ ...analysis.details, source: run.source })),
      createdAt: new Date().toISOString(),
    };
    try {
      await saveSensorResult(row);
      setSaved(true);
      setHistory((h) => [row, ...(h ?? [])]);
      setClassKey((k) => k + 1);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Сақталмады");
    } finally {
      setSaving(false);
    }
  };

  const meta = SENSOR_META[exp.kind];
  const st = rec.state;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-body text-slate-700 dark:text-slate-300">{exp.idea}</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-body text-slate-600 dark:text-slate-400">
          {exp.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {exp.needsLength && (
          <label className="mt-4 block">
            <span className="text-label font-semibold text-slate-900 dark:text-white">Жіптің ұзындығы L, м</span>
            <input
              value={lengthText}
              onChange={(e) => setLengthText(e.target.value)}
              inputMode="decimal"
              aria-invalid={length === undefined || length < PENDULUM_LENGTH.min || length > PENDULUM_LENGTH.max}
              className="mt-1 block w-32 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
            />
            <span className="mt-1 block text-micro text-slate-500 dark:text-slate-400">
              {num(PENDULUM_LENGTH.min, 1)}–{num(PENDULUM_LENGTH.max, 1)} м. Ілу нүктесінен телефонның ортасына дейін.
            </span>
          </label>
        )}
      </Card>

      <Card>
        {rec.support && !rec.support.ok && (
          <p className="mb-3 rounded-xl bg-amber-500/10 p-3 text-body text-amber-900 dark:text-amber-100" role="note">
            {rec.support.reason} Сонда да төмендегі «Үлгі жазба» мен CSV файлды қолдануға болады.
          </p>
        )}

        {st.phase === "countdown" && (
          <div className="text-center" role="status" aria-live="polite">
            <p className="data-num text-6xl font-bold text-brand-500">{Math.ceil(st.left)}</p>
            <p className="mt-1 text-body text-slate-700 dark:text-slate-300">{exp.getReady}</p>
            <p className="mt-1 text-micro text-slate-500 dark:text-slate-400">
              {st.live === null ? "Сенсор күтілуде…" : `Сенсор тірі: |a| = ${num(st.live, 1)} м/с²`}
            </p>
          </div>
        )}

        {st.phase === "recording" && (
          <div className="space-y-2 text-center" role="status" aria-live="polite">
            <p className="text-label font-semibold text-rose-500">● Жазылып жатыр — {Math.ceil(st.left)} с</p>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
              <div className="h-full bg-rose-500" style={{ width: `${(1 - st.left / exp.seconds) * 100}%` }} />
            </div>
            <p className="data-num text-micro text-slate-500 dark:text-slate-400">
              |a| = {st.live === null ? "—" : num(st.live, 1)} м/с² · {Math.round(st.rate)} өлшем/с
            </p>
          </div>
        )}

        {st.phase === "asking" && <p className="text-center text-body text-slate-600 dark:text-slate-400">Сенсорға рұқсат сұралуда…</p>}

        {st.phase === "error" && (
          <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-body text-rose-900 dark:text-rose-100">
            {st.error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {busy ? (
            <button onClick={rec.stop} className="btn-secondary inline-flex min-h-[44px] items-center gap-2">
              <Square size={16} aria-hidden /> {st.phase === "recording" ? "Тоқтату" : "Болдырмау"}
            </button>
          ) : (
            <button onClick={() => void rec.start()} className="btn-primary inline-flex min-h-[44px] items-center gap-2" disabled={rec.support?.ok === false}>
              <Play size={16} aria-hidden /> Бастау
            </button>
          )}
          <button
            onClick={() => showRun({ samples: sampleRun(exp, length, sampleCount.current++), source: "sample" })}
            disabled={busy}
            className="btn-secondary inline-flex min-h-[44px] items-center gap-2"
          >
            <FlaskConical size={16} aria-hidden /> Үлгі жазба
          </button>
          <button onClick={() => fileInput.current?.click()} disabled={busy} className="btn-secondary inline-flex min-h-[44px] items-center gap-2">
            <FileUp size={16} aria-hidden /> CSV жүктеу
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            aria-label="Сенсор қолданбасынан CSV файл таңда"
            tabIndex={-1}
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-2 text-micro text-slate-500 dark:text-slate-400">
          CSV: Phyphox немесе Sensor Logger қолданбасынан, «үдеу g-мен» (Acceleration with g) нұсқасы.
        </p>
        {fileError && (
          <p role="alert" className="mt-2 text-micro text-rose-500">
            {fileError}
          </p>
        )}
      </Card>

      {run && outcome && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-micro font-semibold ${
                run.source === "sample" ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              }`}
            >
              <Smartphone size={12} aria-hidden /> {SOURCE_LABEL[run.source]}
            </span>
          </div>

          {!outcome.ok ? (
            <p role="alert" className="mt-3 text-body text-rose-600 dark:text-rose-300">
              {outcome.reason}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <h3 className="data-num text-h2 text-slate-900 dark:text-white" data-testid="headline">
                {outcome.analysis.headline}
              </h3>
              <ul className="space-y-1 text-body text-slate-700 dark:text-slate-300">
                {outcome.analysis.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {outcome.analysis.warnings.map((w) => (
                <p key={w} role="note" className="rounded-xl bg-amber-500/10 p-3 text-body text-amber-900 dark:text-amber-100">
                  {w}
                </p>
              ))}
              <SignalPlot
                samples={run.samples}
                axis={exp.kind === "pendulum" ? (outcome.analysis.details.axis as "x" | "y" | "z") : undefined}
                fit={exp.kind !== "jump"}
                reference={
                  exp.kind === "rest-g"
                    ? { value: G, label: `g = ${num(G)}` }
                    : exp.kind === "elevator"
                      ? { value: outcome.analysis.details.rest as number, label: "тыныш" }
                      : exp.kind === "jump"
                        ? { value: G, label: "g" }
                        : undefined
                }
                highlights={outcome.analysis.highlights}
                label={`${meta.title}: үдеу уақытқа қарай`}
              />
              <p className="text-micro text-slate-500 dark:text-slate-400">
                {exp.kind === "pendulum" ? "Тербеліс осі бойынша үдеу, м/с²" : "|a| — үдеу векторының ұзындығы, м/с²"} · уақыт секундпен.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {run.source !== "sample" && (
                  <button
                    onClick={() => void save()}
                    disabled={saving || saved || !outcome.analysis.saveable}
                    className="btn-primary min-h-[44px]"
                  >
                    {saved ? "Сақталды ✓" : saving ? "Сақталуда…" : "Нәтижені сақтау"}
                  </button>
                )}
                {run.source === "sample" && (
                  <p className="text-micro text-slate-500 dark:text-slate-400">Үлгі жазба сақталмайды: ол сенің өлшемің емес.</p>
                )}
                {run.source !== "sample" && !outcome.analysis.saveable && (
                  <p className="text-micro text-rose-500">
                    Бұл мән ({num(outcome.analysis.value)} {meta.unit}) нақты өлшемнен тым алыс, сақталмайды. Қайталап көр.
                  </p>
                )}
                {saveError && (
                  <p role="alert" className="text-micro text-rose-500">
                    {saveError}
                  </p>
                )}
              </div>
              {run.source !== "sample" && (
                <p className="text-micro text-slate-500 dark:text-slate-400">Тек нәтиже сақталады (бір сан және бірнеше көрсеткіш), жазбаның өзі емес.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {exp.kind === "jump" && (
        <Card>
          <h3 className="text-h3 text-slate-900 dark:text-white">Сынып қалай секіреді?</h3>
          <div className="mt-3">
            <ClassJumps user={user} current={saved && analysis ? analysis.value : null} refreshKey={classKey} />
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-h3 text-slate-900 dark:text-white">Менің өлшемдерім</h3>
        {history === null ? (
          <p className="mt-2 text-body text-slate-500 dark:text-slate-400">Жүктелуде…</p>
        ) : history.length === 0 ? (
          <p className="mt-2 text-body text-slate-600 dark:text-slate-400">Әлі сақталған өлшем жоқ.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 dark:divide-white/10" data-testid="history">
            {history.slice(0, 6).map((h) => (
              <li key={h.id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="data-num text-body font-semibold text-slate-900 dark:text-white">
                  {meta.quantity} = {num(h.value)} {meta.unit}
                </span>
                <span className="text-micro text-slate-500 dark:text-slate-400">{new Date(h.createdAt).toLocaleDateString("kk-KZ")}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
