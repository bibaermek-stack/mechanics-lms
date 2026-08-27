"use client";

// Practice problems, and a check on the student's own working.
//
// Both halves go to the AI, and both are honest about it: an LLM writing
// practice problems is fine — a wrong problem is still a problem to argue with
// — but it is never the thing that produces the answer a student is graded on.
// That is what the solver next door is for.

import { useCallback, useState } from "react";
import clsx from "clsx";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { askAi } from "@/lib/aiClient";

export type Difficulty = "easy" | "medium" | "hard";

const LEVELS: { id: Difficulty; label: string; hint: string }[] = [
  { id: "easy", label: "Жеңіл", hint: "бір формула, тікелей қою" },
  { id: "medium", label: "Орташа", hint: "екі-үш қадам, бірлік аудару" },
  { id: "hard", label: "Күрделі", hint: "бірнеше заң, талдау қажет" },
];

const LEVEL_PROMPT: Record<Difficulty, string> = {
  easy: "Жеңіл деңгей: бір ғана формуланы тікелей қолданатын, сандары бүтін үш есеп.",
  medium: "Орташа деңгей: екі-үш қадамды, бірліктерді аударуды талап ететін үш есеп.",
  hard: "Күрделі деңгей: бірнеше заңды біріктіретін, талдауды қажет ететін үш есеп.",
};

export function ProblemGenerator({ topic }: { topic: string }) {
  const [level, setLevel] = useState<Difficulty>("easy");
  const [problems, setProblems] = useState<string | null>(null);
  const [working, setWorking] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "generate" | "check">("");

  const generate = useCallback(async () => {
    setBusy("generate");
    setFeedback(null);
    const reply = await askAi({
      task: "extra-problems",
      topic,
      context: LEVEL_PROMPT[level],
      userMessage: `"${topic}" тақырыбы бойынша есептер бер. Әр есептің берілгені мен ізделіндісі анық жазылсын, жауабы бірден берілмесін.`,
    });
    setProblems(reply);
    setBusy("");
  }, [topic, level]);

  const check = useCallback(async () => {
    if (!working.trim()) return;
    setBusy("check");
    const reply = await askAi({
      task: "check-assignment",
      topic,
      context: problems ? `Есептердің шарты:\n${problems}` : undefined,
      userMessage: `Менің шешімім:\n${working.trim()}\n\nҚателерім болса көрсет, қай қадамда жаңылысқанымды түсіндір.`,
    });
    setFeedback(reply);
    setBusy("");
  }, [working, problems, topic]);

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-label uppercase text-slate-500 dark:text-slate-400">Деңгей</p>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLevel(l.id)}
              title={l.hint}
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                level === l.id
                  ? "bg-brand-500 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-brand-50 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-micro text-slate-500 dark:text-slate-400">
          {LEVELS.find((l) => l.id === level)!.hint}
        </p>
      </div>

      <button
        onClick={generate}
        disabled={busy !== ""}
        className="btn-primary !py-2 text-sm disabled:opacity-50"
      >
        {busy === "generate" ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        {problems ? "Басқа есептер бер" : "Есептер құрастыр"}
      </button>

      {problems && (
        <>
          <div className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-body leading-relaxed text-slate-700 dark:bg-white/5 dark:text-slate-200">
            {problems}
          </div>

          <div>
            <p className="mb-1.5 text-label uppercase text-slate-500 dark:text-slate-400">
              Шешіміңді жаз — тексеріп берейін
            </p>
            <textarea
              value={working}
              onChange={(e) => setWorking(e.target.value)}
              rows={5}
              placeholder="Берілгені: m = 5 кг, a = 2 м/с²&#10;Формула: F = m·a&#10;Шешуі: F = 5 · 2 = 10 Н"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5"
            />
            <button
              onClick={check}
              disabled={busy !== "" || !working.trim()}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-micro font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "check" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Шешімімді тексер
            </button>
          </div>
        </>
      )}

      {feedback && (
        <div className="whitespace-pre-wrap rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-body leading-relaxed text-slate-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-slate-200">
          {feedback}
        </div>
      )}
    </div>
  );
}

export default ProblemGenerator;
