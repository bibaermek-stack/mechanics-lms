"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Lightbulb, X } from "lucide-react";
import { MISCONCEPTIONS, type PredictItem } from "@/data/predictions";
import { hashSeed, seededRandom, seededShuffle } from "@/lib/rng";
import type { Confidence, PredictionAttempt } from "@/lib/types";
import { generateId } from "@/lib/dataStore";
import { ObservationView } from "./ObservationView";

const CONFIDENCE: { value: Confidence; label: string; hint: string }[] = [
  { value: 1, label: "Білмеймін", hint: "болжап тұрмын" },
  { value: 2, label: "Шамамен", hint: "жартылай сенімдімін" },
  { value: 3, label: "Сенімдімін", hint: "дәл білемін" },
];

/**
 * One prediction: say what will happen, say how sure you are, then see it.
 *
 * Two clicks before the answer, on purpose. The second one — how sure? — is what
 * separates a guess from a belief, and it is only worth asking before the answer.
 */
export function PredictCard({
  item,
  userId,
  attempts,
  onAttempt,
  onNext,
  onRetake,
}: {
  item: PredictItem;
  userId: string;
  /** This student's earlier attempts at this item, newest first. */
  attempts: PredictionAttempt[];
  onAttempt: (a: PredictionAttempt) => Promise<void> | void;
  onNext?: () => void;
  /** Start the item again from the question; the panel gives the card a fresh start. */
  onRetake?: () => void;
}) {
  // What this student had done before the card opened. Held fixed: saving the prediction adds a row,
  // and the card must not start calling itself a retake halfway through showing the result.
  const [before] = useState(attempts);
  const [step, setStep] = useState<"choose" | "sure" | "result">("choose");
  const [picked, setPicked] = useState<string | null>(null);
  const [made, setMade] = useState<PredictionAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A fresh order each time the item is retaken, so the right answer is not "the second one".
  const options = useMemo(
    () => seededShuffle(item.options, seededRandom(hashSeed(`${item.id}:${before.length}`))),
    [item, before.length]
  );
  const observation = useMemo(() => (step === "result" ? item.observe() : null), [item, step]);
  const first = before.length === 0;

  async function commit(confidence: Confidence) {
    if (!picked) return;
    const opt = item.options.find((o) => o.id === picked)!;
    const attempt: PredictionAttempt = {
      id: generateId("pred"),
      userId,
      itemId: item.id,
      optionId: picked,
      correct: picked === item.correct,
      misconception: opt.misconception ?? null,
      confidence,
      createdAt: new Date().toISOString(),
    };
    try {
      await onAttempt(attempt);
      setMade(attempt);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Болжам сақталмады");
    }
  }

  const mc = made?.misconception ? MISCONCEPTIONS[made.misconception] : null;
  const rightLabel = item.options.find((o) => o.id === item.correct)!.text;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/70 p-5 dark:border-white/10">
      <div>
        {!first && (
          <p className="mb-1 text-micro text-slate-500 dark:text-slate-400">
            Қайталау · бірінші болжамың: {before[before.length - 1].correct ? "дұрыс" : "дұрыс емес"}
          </p>
        )}
        <p className="text-body text-slate-700 dark:text-slate-300">{item.setup}</p>
        <p className="mt-2 text-h3 text-slate-900 dark:text-white">{item.question}</p>
      </div>

      {step !== "result" && (
        <div className="grid gap-2" role="group" aria-label="Болжам нұсқалары">
          {options.map((o) => (
            <button
              key={o.id}
              disabled={step === "sure" && picked !== o.id}
              onClick={() => {
                setPicked(o.id);
                setStep("sure");
              }}
              className={`min-h-[48px] rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                picked === o.id
                  ? "border-brand-500 bg-brand-500/10 text-slate-900 dark:text-white"
                  : "border-slate-200 text-slate-800 hover:border-brand-400 disabled:opacity-40 dark:border-white/10 dark:text-slate-200"
              }`}
            >
              {o.text}
            </button>
          ))}
        </div>
      )}

      {step === "sure" && (
        <div className="space-y-2" role="group" aria-label="Қаншалықты сенімдісің?">
          <p className="text-label font-semibold text-slate-900 dark:text-white">Қаншалықты сенімдісің?</p>
          <div className="grid grid-cols-3 gap-2">
            {CONFIDENCE.map((c) => (
              <button key={c.value} onClick={() => void commit(c.value)} className="rounded-xl border border-slate-200 px-2 py-3 text-center transition-colors hover:border-brand-400 dark:border-white/10">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">{c.label}</span>
                <span className="block text-micro text-slate-500 dark:text-slate-400">{c.hint}</span>
              </button>
            ))}
          </div>
          <button onClick={() => { setStep("choose"); setPicked(null); }} className="text-micro text-slate-500 underline dark:text-slate-400">
            Басқа нұсқаны таңдау
          </button>
          {error && <p role="alert" className="text-micro text-rose-400">{error}</p>}
        </div>
      )}

      {step === "result" && made && observation && (
        <div className="space-y-4" role="status">
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              made.correct
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                : "border-rose-400/60 bg-rose-500/10 text-rose-900 dark:text-rose-100"
            }`}
          >
            {made.correct ? <Check className="mt-0.5 shrink-0" size={18} /> : <X className="mt-0.5 shrink-0" size={18} />}
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{made.correct ? "Болжамың дұрыс!" : "Болжамың дұрыс емес — бірақ бұл жиі кездеседі."}</p>
              {!made.correct && <p>Дұрыс жауап: {rightLabel}</p>}
            </div>
          </div>

          {mc && (
            <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-4 text-sm text-slate-800 dark:text-slate-200">
              <Lightbulb className="mt-0.5 shrink-0 text-amber-500" size={18} aria-hidden />
              <div>
                <p className="font-semibold">Жиі кездесетін түсінік: «{mc.title}»</p>
                <p className="mt-1">{mc.why}</p>
                {made.confidence === 3 && (
                  <p className="mt-1 text-slate-600 dark:text-slate-400">Сенімді болғаның — жақсы белгі: дәл осындай сәтте жаңа нәрсе ұғылады.</p>
                )}
              </div>
            </div>
          )}

          <ObservationView observation={observation} />
          <p className="text-body text-slate-700 dark:text-slate-300">{item.explain(observation)}</p>

          <div className="flex flex-wrap gap-3">
            {onNext && (
              <button onClick={onNext} className="btn-primary w-full sm:w-auto">
                Келесі болжам <ArrowRight size={16} />
              </button>
            )}
            {onRetake && (
              <button onClick={onRetake} className="btn-ghost text-sm">
                Қайта болжау
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
