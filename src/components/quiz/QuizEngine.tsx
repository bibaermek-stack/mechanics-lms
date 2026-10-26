"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { randomizeQuiz } from "@/data/modules";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useAuthStore } from "@/lib/authStore";
import { saveQuizAttempt, generateId } from "@/lib/dataStore";
import type { QuizAttempt } from "@/lib/types";

export function QuizEngine({ moduleId }: { moduleId: number }) {
  const user = useAuthStore((s) => s.user);
  const [attemptKey, setAttemptKey] = useState(0);
  const questions = useMemo(() => randomizeQuiz(moduleId), [moduleId, attemptKey]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const answeredCount = Object.keys(answers).length;
  const score = submitted
    ? questions.reduce((acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0), 0)
    : 0;

  async function handleSubmit() {
    setSubmitted(true);
    if (!user) return;
    setSaving(true);
    const attempt: QuizAttempt = {
      id: generateId("quiz"),
      moduleId,
      userId: user.uid,
      score: questions.reduce((acc, q) => acc + (answers[q.id] === q.correctIndex ? 1 : 0), 0),
      total: questions.length,
      answers: questions.map((q) => ({
        questionId: q.id,
        chosenIndex: answers[q.id] ?? -1,
        correct: answers[q.id] === q.correctIndex,
      })),
      takenAt: new Date().toISOString(),
    };
    await saveQuizAttempt(attempt);
    setSaving(false);
  }

  function handleRetry() {
    setAnswers({});
    setSubmitted(false);
    setAttemptKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      {submitted && (
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-body text-slate-600 dark:text-slate-400">Викторина нәтижесі</p>
            <p className="text-h1">
              {score} / {questions.length}
            </p>
          </div>
          <ProgressBar value={(score / questions.length) * 100} className="w-40" />
          <button onClick={handleRetry} className="btn-secondary text-sm">
            <RotateCcw size={16} /> Қайта тапсыру
          </button>
        </Card>
      )}

      {!submitted && (
        <ProgressBar
          value={(answeredCount / questions.length) * 100}
          label={`Жауап берілді: ${answeredCount} / ${questions.length}`}
        />
      )}

      {questions.map((q, idx) => {
        const chosen = answers[q.id];
        const isCorrect = chosen === q.correctIndex;
        return (
          <Card key={q.id}>
            <p className="mb-3 font-semibold">
              {idx + 1}. {q.question}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((opt, i) => {
                const selected = chosen === i;
                let stateClasses = "border-slate-200 dark:border-white/10 hover:border-brand-300";
                if (submitted) {
                  if (i === q.correctIndex) stateClasses = "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20";
                  else if (selected && !isCorrect) stateClasses = "border-rose-400 bg-rose-50 dark:bg-rose-900/20";
                } else if (selected) {
                  stateClasses = "border-brand-500 bg-brand-50 dark:bg-brand-900/20";
                }
                return (
                  <button
                    key={i}
                    disabled={submitted}
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: i }))}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${stateClasses}`}
                  >
                    {submitted && i === q.correctIndex && <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />}
                    {submitted && selected && !isCorrect && <XCircle size={16} className="shrink-0 text-rose-600" />}
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {submitted && (
              <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                <strong>Түсіндірме:</strong> {q.explanation}
              </p>
            )}
          </Card>
        );
      })}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={answeredCount < questions.length}
          className="btn-primary w-full sm:w-auto"
        >
          Викторинаны аяқтау
        </button>
      )}
      {saving && <p className="text-micro text-slate-600">Нәтиже сақталуда...</p>}
    </div>
  );
}
