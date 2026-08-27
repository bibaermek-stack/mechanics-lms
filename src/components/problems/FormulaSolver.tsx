"use client";

// One formula, with the arithmetic done here and the explanation asked of the AI.
//
// The split is deliberate. The number is computed locally from the inverse in
// src/data/formulas.ts — verified by a round-trip test — because a physics
// course cannot ship an answer a language model guessed at. The model is only
// asked for the reasoning around a result that is already correct.

import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import { Calculator, Loader2, Sparkles } from "lucide-react";
import { askAi } from "@/lib/aiClient";
import { G, type Formula } from "@/data/formulas";

/** Physical constants worth pre-filling, so g is not typed on every problem. */
const PREFILL: Record<string, number> = { g: G };

/** Enough digits to be useful, few enough to read. */
function show(value: number): string {
  const abs = Math.abs(value);
  if (abs !== 0 && (abs < 1e-3 || abs >= 1e6)) return value.toExponential(3).replace(".", ",");
  const digits = abs >= 100 ? 2 : abs >= 1 ? 3 : 4;
  return value.toFixed(digits).replace(".", ",");
}

export function FormulaSolver({ formula, topic }: { formula: Formula; topic: string }) {
  const solvable = useMemo(() => Object.keys(formula.solve), [formula]);
  const [target, setTarget] = useState(solvable[0]);
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      formula.vars.map((v) => [v.sym, PREFILL[v.sym] !== undefined ? String(PREFILL[v.sym]) : ""])
    )
  );
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState<"" | "explain" | "simplify">("");

  const needed = formula.vars.filter((v) => v.sym !== target);

  // Parsed once per render and reused by both the result and the AI prompt, so
  // the two can never disagree about what was entered.
  const known = useMemo(() => {
    const out: Record<string, number> = {};
    for (const v of needed) {
      // A comma is what a Kazakh keyboard produces for a decimal point.
      const n = Number(String(raw[v.sym] ?? "").replace(",", ".").trim());
      if (String(raw[v.sym] ?? "").trim() !== "" && Number.isFinite(n)) out[v.sym] = n;
    }
    return out;
  }, [raw, needed]);

  const missing = needed.filter((v) => known[v.sym] === undefined);
  const badSign = needed.filter((v) => v.positive && known[v.sym] !== undefined && known[v.sym] <= 0);

  const result = useMemo(() => {
    if (missing.length || badSign.length) return null;
    const value = formula.solve[target](known);
    return Number.isFinite(value) ? value : null;
  }, [formula, target, known, missing.length, badSign.length]);

  const targetVar = formula.vars.find((v) => v.sym === target)!;

  const given = needed
    .map((v) => `${v.sym} = ${known[v.sym] !== undefined ? show(known[v.sym]) : "?"}${v.unit ? " " + v.unit : ""}`)
    .join(", ");

  const ask = useCallback(
    async (task: "formula-explain" | "simplify") => {
      setLoading(task === "formula-explain" ? "explain" : "simplify");
      const context =
        result !== null
          ? `Формула: ${formula.expr}. Берілгені: ${given}. Табылған шама: ${target} = ${show(result)} ${targetVar.unit}.`
          : `Формула: ${formula.expr}. Ізделінді шама: ${targetVar.name} (${target}).`;
      const reply = await askAi({
        task,
        topic: `${topic} — ${formula.title}`,
        context,
        userMessage:
          task === "formula-explain"
            ? "Осы формуланы және есептеу қадамдарын түсіндір."
            : "Осы формуланы қарапайым тілмен түсіндір.",
      });
      setExplanation(reply);
      setLoading("");
    },
    [formula, given, result, target, targetVar, topic]
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-900 px-4 py-3 text-center dark:bg-black/40">
        <p className="font-mono text-h2 font-semibold text-white">{formula.expr}</p>
      </div>
      <p className="text-micro leading-relaxed text-slate-500 dark:text-slate-400">{formula.note}</p>

      <div>
        <p className="mb-1.5 text-label uppercase text-slate-500 dark:text-slate-400">
          Нені табу керек?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {formula.vars.map((v) => {
            const can = solvable.includes(v.sym);
            return (
              <button
                key={v.sym}
                disabled={!can}
                title={can ? undefined : "Бұл шаманы бұл формуладан тікелей өрнектеу мүмкін емес"}
                onClick={() => {
                  setTarget(v.sym);
                  setExplanation(null);
                }}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  target === v.sym
                    ? "bg-brand-500 text-white"
                    : can
                      ? "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                      : "cursor-not-allowed bg-slate-50 text-slate-300 dark:bg-white/[0.02] dark:text-slate-600"
                )}
              >
                {v.sym} — {v.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {needed.map((v) => (
          <label key={v.sym} className="block">
            <span className="text-micro text-slate-500 dark:text-slate-400">
              {v.name} ({v.sym}){v.unit && `, ${v.unit}`}
            </span>
            <input
              inputMode="decimal"
              value={raw[v.sym] ?? ""}
              onChange={(e) => {
                setRaw((r) => ({ ...r, [v.sym]: e.target.value }));
                setExplanation(null);
              }}
              placeholder="0"
              className={clsx(
                "mt-0.5 w-full rounded-xl border bg-slate-50 px-3 py-2 font-mono text-sm outline-none transition-colors focus:border-brand-400 dark:bg-white/5",
                badSign.includes(v)
                  ? "border-rose-400 dark:border-rose-500/60"
                  : "border-slate-200 dark:border-white/10"
              )}
            />
          </label>
        ))}
      </div>

      {badSign.length > 0 ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-micro text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {badSign.map((v) => v.name).join(", ")} — оң сан болуы керек.
        </p>
      ) : missing.length > 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-micro text-slate-500 dark:bg-white/5 dark:text-slate-400">
          Тағы {missing.length} шама керек: {missing.map((v) => v.name).join(", ")}.
        </p>
      ) : result === null ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-micro text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          Бұл мәндермен нәтиже шықпайды — нөлге бөлу немесе теріс саннан түбір алу
          болып тұр. Берілгенді тексер.
        </p>
      ) : (
        <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3 dark:border-brand-400/30 dark:bg-brand-500/10">
          <p className="text-micro text-slate-500 dark:text-slate-400">Берілгені: {given}</p>
          <p className="mt-1 font-mono text-h2 font-bold text-brand-700 dark:text-brand-200">
            {target} = {show(result)}
            {targetVar.unit && <span className="ml-1 text-body font-semibold">{targetVar.unit}</span>}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => ask("formula-explain")}
          disabled={loading !== ""}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-micro font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {loading === "explain" ? <Loader2 size={12} className="animate-spin" /> : <Calculator size={12} />}
          Қадам-қадаммен түсіндір
        </button>
        <button
          onClick={() => ask("simplify")}
          disabled={loading !== ""}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-micro font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          {loading === "simplify" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          Қарапайым тілмен
        </button>
      </div>

      {explanation && (
        <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-body leading-relaxed text-slate-700 dark:bg-white/5 dark:text-slate-200">
          {explanation}
        </div>
      )}
    </div>
  );
}

export default FormulaSolver;
