"use client";

// The marking queue.
//
// Until the records moved into the database this page read the *teacher's own*
// browser storage, so it was structurally incapable of showing a student's
// work — it listed whatever the teacher had submitted, which was nothing. Now
// it reads the submissions of accepted students, and RLS is what limits it to
// those: there is no client-side filter here to get wrong.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, Send } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingBlock } from "@/components/ui/Skeleton";
import { useLessons } from "@/components/providers/LessonsProvider";
import {
  gradeAssignment,
  getSubmissionsForReview,
  type SubmissionForReview,
} from "@/lib/dataStore";

type Filter = "pending" | "reviewed" | "all";

export default function TeacherAssignmentsPage() {
  const { byId } = useLessons();
  const [subs, setSubs] = useState<SubmissionForReview[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setSubs(await getSubmissionsForReview());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Тапсырмаларды жүктеу мүмкін болмады");
      setSubs([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pending = (subs ?? []).filter((s) => s.status === "pending");
  const reviewed = (subs ?? []).filter((s) => s.status === "reviewed");
  const shown = useMemo(
    () => (filter === "all" ? (subs ?? []) : filter === "pending" ? pending : reviewed),
    [filter, subs, pending, reviewed]
  );

  const avgGrade = reviewed.length
    ? Math.round(reviewed.reduce((a, s) => a + (s.grade ?? 0), 0) / reviewed.length)
    : null;

  const TABS: { id: Filter; label: string; count: number }[] = [
    { id: "pending", label: "Күтуде", count: pending.length },
    { id: "reviewed", label: "Тексерілді", count: reviewed.length },
    { id: "all", label: "Барлығы", count: (subs ?? []).length },
  ];

  return (
    <DashboardShell role="teacher">
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Тапсырмаларды тексеру"
          description="Сіз қабылдаған студенттердің БӨЖ жұмыстары. Баға мен кері байланыс қойған соң, студент оны бірден көреді."
        />

        {error && (
          <p role="alert" className="text-label text-rose-300">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label="Тексеруді күтуде"
            value={pending.length}
            tone={pending.length > 0 ? "amber" : "default"}
          />
          <StatCard label="Тексерілді" value={reviewed.length} tone="emerald" />
          <StatCard
            label="Орташа баға"
            value={avgGrade ?? "—"}
            unit={avgGrade !== null ? "%" : undefined}
            context={avgGrade === null ? "Әлі баға қойылмаған" : undefined}
            tone="brand"
          />
        </div>

        <div
          role="tablist"
          aria-label="Сүзгі"
          className="flex flex-wrap gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/60 p-1 dark:border-white/10 dark:bg-white/5"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                filter === t.id
                  ? "bg-white text-slate-900 dark:bg-white/10 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="data-num rounded-full bg-brand-500/20 px-1.5 text-[11px] text-brand-200">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {subs === null ? (
          <LoadingBlock lines={4} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={filter === "pending" ? "Тексеретін жұмыс жоқ" : "Тізім бос"}
            hint="Студент сабақ ішіндегі «БӨЖ тапсырмасы» бөлімінен жіберген соң, жұмысы осында пайда болады. Ол үшін студент сіздің тобыңызда болуы керек."
            href="/teacher/students"
            cta="Студенттерім"
          />
        ) : (
          <ul className="space-y-3">
            {shown.map((s) => (
              <SubmissionCard
                key={s.id}
                sub={s}
                lessonTitle={byId(s.moduleId)?.title ?? `Сабақ ${s.moduleId}`}
                onGraded={reload}
              />
            ))}
          </ul>
        )}
      </div>
    </DashboardShell>
  );
}

function SubmissionCard({
  sub,
  lessonTitle,
  onGraded,
}: {
  sub: SubmissionForReview;
  lessonTitle: string;
  onGraded: () => void;
}) {
  // Seeded from the existing mark so re-grading edits rather than restarts.
  const [grade, setGrade] = useState(String(sub.grade ?? ""));
  const [feedback, setFeedback] = useState(sub.teacherFeedback ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const value = Number(grade);
  const valid = grade !== "" && Number.isFinite(value) && value >= 0 && value <= 100;

  async function save() {
    if (!valid) {
      setErr("Баға 0–100 аралығында болуы керек.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await gradeAssignment(sub.id, value, feedback.trim());
      onGraded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Сақтау сәтсіз аяқталды");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="glass glass-lit rounded-3xl2 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-label font-semibold text-slate-900 dark:text-white">
            {sub.student.fullName}
            {sub.student.studyGroup && (
              <span className="ml-2 font-normal text-slate-500">{sub.student.studyGroup}</span>
            )}
          </p>
          <p className="text-micro text-slate-500 dark:text-slate-400">
            <span className="data-num">{sub.student.userCode}</span> · {sub.moduleId}-сабақ ·{" "}
            {lessonTitle} · {new Date(sub.submittedAt).toLocaleString("kk-KZ")}
          </p>
        </div>
        <Badge variant={sub.status === "reviewed" ? "success" : "warning"}>
          {sub.status === "reviewed" ? <Check size={13} /> : <Clock size={13} />}
          {sub.status === "reviewed" ? `Бағаланды · ${sub.grade}%` : "Күтуде"}
        </Badge>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200/60 p-3.5 text-sm text-slate-700 dark:border-white/10 dark:text-slate-300">
        {sub.content}
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start">
        <label className="text-micro uppercase tracking-wider text-slate-500 sm:w-28">
          Баға (%)
          <input
            type="number"
            min={0}
            max={100}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            aria-label={`${sub.student.fullName} — баға`}
            className="input-glow mt-1 w-full"
          />
        </label>
        <label className="flex-1 text-micro uppercase tracking-wider text-slate-500">
          Кері байланыс
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={2}
            placeholder="Не жақсы шыққан, нені түзету керек?"
            aria-label={`${sub.student.fullName} — кері байланыс`}
            className="input-glow mt-1 w-full"
          />
        </label>
        <button
          onClick={save}
          disabled={busy}
          className="btn-primary shrink-0 disabled:opacity-60 sm:mt-5"
        >
          <Send size={15} /> {busy ? "Сақталуда…" : sub.status === "reviewed" ? "Жаңарту" : "Бағалау"}
        </button>
      </div>

      {err && (
        <p role="alert" className="mt-2 text-micro text-rose-300">
          {err}
        </p>
      )}
    </li>
  );
}
