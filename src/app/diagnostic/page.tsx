"use client";

// The student's side of the pre/post diagnostic.
//
// Deliberately austere: one sitting per phase, no correct answers shown
// afterwards, no hints. The instrument only measures what the student knows if
// it is the same test, taken once, both times — see src/data/diagnostic.ts.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DIAGNOSTIC_QUESTIONS, POST_UNLOCK_LESSONS } from "@/data/diagnostic";
import { useAuthStore } from "@/lib/authStore";
import { generateId, getDiagnosticAttempts, getQuizAttempts, saveDiagnosticAttempt } from "@/lib/dataStore";
import { diagnosticPercent, diagnosticStatus, gradeDiagnostic, type DiagnosticStatus } from "@/lib/diagnostic";
import type { DiagnosticPhase } from "@/lib/types";

/** dd.mm.yyyy — the same in every browser, unlike toLocaleDateString("kk-KZ"). */
const formatDate = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};

const PHASE_TITLE: Record<DiagnosticPhase, string> = {
  pre: "Бастапқы диагностика",
  post: "Қорытынды диагностика",
};

export default function DiagnosticPage() {
  return (
    <DashboardShell role="student">
      <DiagnosticBody />
    </DashboardShell>
  );
}

function DiagnosticBody() {
  const user = useAuthStore((s) => s.user);
  const [status, setStatus] = useState<DiagnosticStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sitting, setSitting] = useState<DiagnosticPhase | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const [attempts, quiz] = await Promise.all([getDiagnosticAttempts(user.uid), getQuizAttempts(user.uid)]);
      setStatus(diagnosticStatus(attempts, quiz));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жүктеу мүмкін болмады");
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!status) {
    return error ? (
      <p role="alert" className="text-label text-rose-300">
        {error}
      </p>
    ) : (
      <LoadingBlock label="Жүктелуде…" lines={3} />
    );
  }

  if (sitting && user) {
    return (
      <DiagnosticTest
        phase={sitting}
        userId={user.uid}
        onFinished={async () => {
          setSitting(null);
          await load();
        }}
        onCancel={() => setSitting(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Диагностика"
        description="Механика бойынша 20 сұрақтан тұратын тест: курстың басында және соңында бірдей тест тапсырылады, сонда оқу нәтижесі салыстырылады."
      />

      <Card>
        <p className="text-h3">Ережелері</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-body text-slate-700 dark:text-slate-300">
          <li>Әр кезеңді тек бір рет тапсыруға болады, қайта тапсыру жоқ.</li>
          <li>Дұрыс жауаптар көрсетілмейді — қорытынды тестте нәтиже таза болуы үшін.</li>
          <li>Тестті өз бетіңізше, анықтамалықсыз және AI-тьюторсыз тапсырыңыз. Білмесеңіз, ең жақын жауапты таңдаңыз.</li>
          <li>Нәтижені оқытушыңыз зерттеу мақсатында көреді.</li>
        </ul>
      </Card>

      {error && (
        <p role="alert" className="text-label text-rose-300">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PhaseCard
          phase="pre"
          attempt={status.pre}
          action={
            status.next === "pre" && (
              <button onClick={() => setSitting("pre")} className="btn-primary">
                Бастау
              </button>
            )
          }
          hint={!status.pre ? "Оқуды бастамас бұрын тапсырған жөн." : undefined}
        />
        <PhaseCard
          phase="post"
          attempt={status.post}
          locked={!status.pre ? "Алдымен бастапқы диагностиканы тапсырыңыз." : status.postLockedReason}
          lockedProgress={status.pre && status.postLockedReason ? (status.lessonsDone / POST_UNLOCK_LESSONS) * 100 : undefined}
          action={
            status.next === "post" && (
              <button onClick={() => setSitting("post")} className="btn-primary">
                Бастау
              </button>
            )
          }
        />
      </div>

      {status.pre && status.post && (
        <Card>
          <p className="text-h3">Сіздің өсіміңіз</p>
          <p className="mt-2 text-body text-slate-700 dark:text-slate-300">
            {diagnosticPercent(status.pre)}% → {diagnosticPercent(status.post)}% (
            {diagnosticPercent(status.post) - diagnosticPercent(status.pre) >= 0 ? "+" : ""}
            {diagnosticPercent(status.post) - diagnosticPercent(status.pre)} п.п.)
          </p>
        </Card>
      )}
    </div>
  );
}

function PhaseCard({
  phase,
  attempt,
  action,
  hint,
  locked,
  lockedProgress,
}: {
  phase: DiagnosticPhase;
  attempt: DiagnosticStatus["pre"];
  action?: React.ReactNode;
  hint?: string;
  locked?: string | null;
  lockedProgress?: number;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-h3">{PHASE_TITLE[phase]}</p>
        {attempt ? (
          <CheckCircle2 size={20} className="shrink-0 text-emerald-400" aria-label="Тапсырылды" />
        ) : locked ? (
          <Lock size={18} className="shrink-0 text-slate-400" aria-label="Жабық" />
        ) : null}
      </div>

      {attempt ? (
        <p className="mt-3 text-body text-slate-700 dark:text-slate-300">
          Тапсырылды: <strong>{attempt.score} / {attempt.total}</strong> ({diagnosticPercent(attempt)}%) ·{" "}
          {formatDate(attempt.takenAt)}
        </p>
      ) : locked ? (
        <div className="mt-3 space-y-2">
          <p className="text-body text-slate-600 dark:text-slate-400">{locked}</p>
          {lockedProgress !== undefined && <ProgressBar value={lockedProgress} />}
          <Link href="/modules" className="btn-secondary mt-1 inline-flex px-4 py-2 text-sm">
            Сабақтарға өту
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-body text-slate-600 dark:text-slate-400">{hint ?? "Тапсыруға дайын."}</p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

function DiagnosticTest({
  phase,
  userId,
  onFinished,
  onCancel,
}: {
  phase: DiagnosticPhase;
  userId: string;
  onFinished: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const answered = Object.keys(chosen).length;
  const total = DIAGNOSTIC_QUESTIONS.length;

  async function submit() {
    if (answered < total || saving) return;
    if (!window.confirm("Диагностиканы тек бір рет тапсыруға болады. Жауаптарды жіберейік пе?")) return;
    setSaving(true);
    setError(null);
    try {
      const graded = gradeDiagnostic(chosen);
      await saveDiagnosticAttempt({
        id: generateId("diag"),
        userId,
        phase,
        score: graded.score,
        total: graded.total,
        answers: graded.answers,
        takenAt: new Date().toISOString(),
      });
      setResult({ score: graded.score, total: graded.total });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жіберу мүмкін болмады");
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <SectionHeader as="h1" title={PHASE_TITLE[phase]} />
        <Card>
          <p className="text-h3">Жауаптарыңыз сақталды</p>
          <p className="mt-2 text-h1">
            {result.score} / {result.total}
          </p>
          <p className="mt-1 text-body text-slate-600 dark:text-slate-400">
            {phase === "pre"
              ? "Бұл — бастапқы деңгейіңіз. Енді сабақтарға өтіп, курсты бастаңыз."
              : "Қорытынды нәтиже сақталды. Өсіміңізді «Диагностика» бетінен көресіз."}
          </p>
          <button onClick={() => void onFinished()} className="btn-primary mt-4">
            Жалғастыру
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-4">
      <SectionHeader
        as="h1"
        title={PHASE_TITLE[phase]}
        description={`${total} сұрақ. Әр сұрақта бір дұрыс жауап бар.`}
        action={
          <button onClick={onCancel} disabled={saving} className="btn-ghost text-sm">
            Кейін тапсырамын
          </button>
        }
      />

      {DIAGNOSTIC_QUESTIONS.map((q, i) => (
        <fieldset key={q.id} className="surface p-4">
          {/* The legend is for screen readers; a visible <legend> sits on the
              fieldset's border line, which looks like a layout bug. */}
          <legend className="sr-only">
            {i + 1}. {q.question}
          </legend>
          <p aria-hidden className="text-label font-semibold text-slate-900 dark:text-white">
            {i + 1}. {q.question}
          </p>
          <div className="mt-3 space-y-2">
            {q.options.map((opt, oi) => (
              <label
                key={oi}
                className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-body transition-colors ${
                  chosen[q.id] === oi
                    ? "border-brand-400 bg-brand-500/15 text-slate-900 dark:text-white"
                    : "border-slate-200 text-slate-700 hover:border-brand-400/60 dark:border-white/10 dark:text-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={chosen[q.id] === oi}
                  onChange={() => setChosen((c) => ({ ...c, [q.id]: oi }))}
                  className="h-5 w-5 shrink-0 accent-brand-500"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-slate-950/90 md:-mx-6 md:px-6">
        {error && (
          <p role="alert" className="mb-2 text-label text-rose-500 dark:text-rose-300">
            {error}
          </p>
        )}
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="data-num text-micro text-slate-600 dark:text-slate-400">
              Жауап берілді: {answered} / {total}
            </p>
            <ProgressBar value={(answered / total) * 100} />
          </div>
          <button onClick={submit} disabled={answered < total || saving} className="btn-primary shrink-0 disabled:opacity-50">
            {saving ? "Сақталуда…" : "Жіберу"}
          </button>
        </div>
      </div>
    </div>
  );
}
