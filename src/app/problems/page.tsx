"use client";

// Есеп шығару — the problem-solving workbench.
//
// The AI gateway has carried `formula`, `extra-problems`, `check-assignment`
// and `simplify` since it was written, and nothing in the app ever called them.
// This page is where they earn their place, next to a formula reference and a
// calculator that do not need a model at all.
//
// The division of labour is the point: the reference and the arithmetic are
// authored data, checked by a round-trip test over every inverse; the model
// explains, generates practice and reads a student's working. A wrong answer
// from a reference table is a much worse failure than a clumsy explanation.

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight, BookOpen, Calculator, Lightbulb, Loader2, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { useLessons } from "@/components/providers/LessonsProvider";
import { FormulaSolver } from "@/components/problems/FormulaSolver";
import { ProblemGenerator } from "@/components/problems/ProblemGenerator";
import { FORMULAS, formulasForModule, modulesWithFormulas } from "@/data/formulas";
import { askAi } from "@/lib/aiClient";

export default function ProblemsPage() {
  const { byId } = useLessons();
  const moduleIds = useMemo(() => modulesWithFormulas(), []);
  const [moduleId, setModuleId] = useState(moduleIds[0]);
  const formulas = useMemo(() => formulasForModule(moduleId), [moduleId]);
  const [formulaId, setFormulaId] = useState(formulas[0]?.id);
  const [extra, setExtra] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  const topic = byId(moduleId)?.title ?? "Механика";
  // The chosen formula, or the first of the topic when the topic just changed.
  const formula = formulas.find((f) => f.id === formulaId) ?? formulas[0];

  async function askForMore() {
    setAsking(true);
    const reply = await askAi({
      task: "formula",
      topic,
      userMessage: `"${topic}" тақырыбы бойынша анықтамалықта жоқ басқа формулаларды да атап бер.`,
      context: `Анықтамалықта бар формулалар: ${formulas.map((f) => f.expr).join("; ")}`,
    });
    setExtra(reply);
    setAsking(false);
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Есеп шығару"
          description="Формулалар анықтамалығы, кез келген шаманы табатын есептегіш және өз деңгейіңе қарай құрастырылатын жаттығу есептері."
          action={<Badge variant="success">{FORMULAS.length} формула</Badge>}
        />

        {/* Topic ------------------------------------------------------------ */}
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-label uppercase text-slate-500 dark:text-slate-400">
            <BookOpen size={13} /> Тақырып
          </p>
          <div className="flex flex-wrap gap-1.5">
            {moduleIds.map((id) => (
              <button
                key={id}
                onClick={() => {
                  setModuleId(id);
                  setFormulaId(formulasForModule(id)[0]?.id);
                  setExtra(null);
                }}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  moduleId === id
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                )}
              >
                {byId(id)?.title ?? `${id}-сабақ`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Reference ----------------------------------------------------- */}
          {/* self-start so a topic with two formulas does not leave a tall
              empty card beside the solver. */}
          <div className="surface self-start p-4">
            <p className="mb-3 flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
              <Sparkles size={13} /> Формулалар
            </p>
            <div className="space-y-1.5">
              {formulas.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormulaId(f.id)}
                  className={clsx(
                    "block w-full rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors",
                    formula?.id === f.id
                      ? "bg-brand-50 ring-brand-300 dark:bg-brand-500/15 dark:ring-brand-400/40"
                      : "bg-slate-50 ring-slate-900/5 hover:bg-white dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10"
                  )}
                >
                  <span className="block font-mono text-body font-semibold text-slate-800 dark:text-slate-100">
                    {f.expr}
                  </span>
                  <span className="block text-micro text-slate-500 dark:text-slate-400">{f.title}</span>
                </button>
              ))}
            </div>

            <button
              onClick={askForMore}
              disabled={asking}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-micro font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              {asking ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
              AI-дан тағы формула сұрау
            </button>

            {extra && (
              <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-micro leading-relaxed text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {extra}
                <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-400">
                  Бұл жауапты AI жазды — жоғарыдағы анықтамалықтан айырмашылығы, ол
                  тексерілмеген. Оқулықпен салыстырып ал.
                </p>
              </div>
            )}
          </div>

          {/* Solver -------------------------------------------------------- */}
          <div className="surface p-4">
            <p className="mb-3 flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
              <Calculator size={13} /> Есептегіш
            </p>
            {formula ? (
              <FormulaSolver key={formula.id} formula={formula} topic={topic} />
            ) : (
              <p className="text-body text-slate-500">Бұл тақырыпта әзірге формула жоқ.</p>
            )}
          </div>
        </div>

        {/* Practice -------------------------------------------------------- */}
        <div className="surface p-4">
          <p className="mb-3 flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
            <Lightbulb size={13} /> Жаттығу есептері — {topic}
          </p>
          <ProblemGenerator key={moduleId} topic={topic} />
        </div>

        <p className="text-micro leading-relaxed text-slate-500 dark:text-slate-400">
          Есептегіштің жауабы қолмен жазылған формулалардан есептеледі, әр
          формуланың кері түрлендіруі автоматты сынақпен тексерілген — сондықтан
          сан дұрыс. Ал түсіндірме мен жаттығу есептерін AI жазады. Теорияны{" "}
          <Link
            href={`/modules/${moduleId}`}
            className="inline-flex items-center gap-0.5 text-brand-600 underline dark:text-brand-300"
          >
            {topic} сабағынан <ArrowUpRight size={11} />
          </Link>{" "}
          қарап ал.
        </p>
      </div>
    </DashboardShell>
  );
}
