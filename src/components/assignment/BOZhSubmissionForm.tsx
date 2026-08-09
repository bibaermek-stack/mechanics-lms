"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Image as ImageIcon, FileUp, Video, Mic, CheckCircle2, Clock } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { getAssignmentSubmissions, submitAssignment, generateId } from "@/lib/dataStore";
import { Badge } from "@/components/ui/Badge";
import type { AssignmentSubmission, BOZhAssignment } from "@/lib/types";

const TYPE_ICONS = {
  text: FileText,
  image: ImageIcon,
  pdf: FileUp,
  video: Video,
  voice: Mic,
};

const TYPE_LABELS: Record<AssignmentSubmission["type"], string> = {
  text: "Мәтін",
  image: "Сурет",
  pdf: "PDF құжат",
  video: "Бейне",
  voice: "Дауыс",
};

export function BOZhSubmissionForm({ moduleId, assignment }: { moduleId: number; assignment: BOZhAssignment }) {
  const user = useAuthStore((s) => s.user);
  const [type, setType] = useState<AssignmentSubmission["type"]>(assignment.submissionTypes[0]);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Previous attempts at this lesson, so the mark and the teacher's comment
  // land back in front of the student. Without this half the loop the work
  // disappears the moment it is sent.
  const [mine, setMine] = useState<AssignmentSubmission[] | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    const all = await getAssignmentSubmissions(user.uid);
    setMine(all.filter((s) => s.moduleId === moduleId));
  }, [user, moduleId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleSubmit() {
    if (!user || !content.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await submitAssignment({
        id: generateId("sub"),
        moduleId,
        userId: user.uid,
        type,
        content,
        submittedAt: new Date().toISOString(),
        status: "pending",
      });
      setContent("");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Жіберу сәтсіз аяқталды");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-card">
        <p className="font-semibold">Жағдаят (кейс)</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{assignment.scenario}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
          {assignment.tasks.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        {assignment.submissionTypes.map((t) => {
          const Icon = TYPE_ICONS[t];
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                type === t ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
              }`}
            >
              <Icon size={14} /> {TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        placeholder={
          type === "text"
            ? "Шешіміңді осында жаз (күштер талдауы, есептеулер, қорытынды)..."
            : "Файл сілтемесін немесе сипаттамасын осында жаз (демо режимде нақты жүктеу өшірілген)..."
        }
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-white/5"
      />

      <button
        onClick={handleSubmit}
        disabled={!content.trim() || busy}
        className="btn-primary disabled:opacity-60"
      >
        {busy ? "Жіберілуде…" : "Тапсырманы жіберу"}
      </button>

      {error && (
        <p role="alert" className="text-label text-rose-300">
          {error}
        </p>
      )}

      {mine && mine.length > 0 && (
        <section className="space-y-2">
          <p className="text-label font-semibold text-slate-900 dark:text-white">
            Осы сабақ бойынша жіберген жұмыстарың
          </p>
          {mine.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-slate-200/70 p-3.5 dark:border-white/10"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-micro text-slate-500 dark:text-slate-400">
                  {new Date(s.submittedAt).toLocaleString("kk-KZ")}
                </span>
                {s.status === "reviewed" ? (
                  <Badge variant={(s.grade ?? 0) >= 70 ? "success" : "warning"}>
                    <CheckCircle2 size={13} /> Баға: {s.grade}%
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <Clock size={13} /> Тексерілуде
                  </Badge>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                {s.content}
              </p>
              {s.teacherFeedback && (
                <p className="mt-2.5 rounded-xl bg-brand-500/10 p-3 text-sm text-brand-100">
                  <span className="font-semibold">Оқытушының пікірі: </span>
                  {s.teacherFeedback}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
