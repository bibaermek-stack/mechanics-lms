"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useLessons } from "@/components/providers/LessonsProvider";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/lib/authStore";
import { QUESTION_LIMITS, type StudentQuestion } from "@/lib/community";
import { deleteQuestion, listMyQuestions, submitQuestion } from "@/lib/communityData";
import { Count, FIELD, StatusBadge, lessonLabel } from "./shared";

const EMPTY = { lessonId: 5, question: "", options: ["", "", "", ""], correctIndex: 0, explanation: "" };

/** Write a question with one right answer and three tempting wrong ones: the wrong ones are the interesting part. */
export function QuestionWriter() {
  const user = useAuthStore((s) => s.user);
  const { modules } = useLessons();
  const [mine, setMine] = useState<StudentQuestion[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      setMine(await listMyQuestions(user.uid));
    } catch {
      setMine([]);
    }
  }, [user]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!user) return null;
  if (user.role !== "student") return <p className="text-body text-slate-600 dark:text-slate-400">Сұрақ жазу оқушыларға арналған. Мұғалім сұрақтарды «Модерация» бетінде тексереді.</p>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await submitQuestion(user, form);
      setForm({ ...EMPTY, lessonId: form.lessonId });
      setSent(true);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Жіберілмеді");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-h3 text-slate-900 dark:text-white">Сыныптастарыңа сұрақ жаз</h2>
        <p className="mt-1 text-body text-slate-600 dark:text-slate-400">
          Төрт жауап нұсқасы, біреуі дұрыс. Мұғалімің мақұлдағаннан кейін сыныптастарың жаттығу кезінде сенің сұрағыңа жауап береді (аты-жөнің көрсетілмейді).
        </p>
        <form onSubmit={send} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            Сабақ
            <select className={FIELD} value={form.lessonId} onChange={(e) => setForm({ ...form, lessonId: Number(e.target.value) })}>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{lessonLabel(modules, m.id)}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            <span className="flex justify-between">Сұрақ <Count value={form.question} min={QUESTION_LIMITS.text.min} max={QUESTION_LIMITS.text.max} /></span>
            <textarea className={FIELD} rows={2} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-900 dark:text-white">Жауап нұсқалары (дұрысын белгіле)</legend>
            {form.options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={form.correctIndex === i}
                  onChange={() => setForm({ ...form, correctIndex: i })}
                  aria-label={`${i + 1}-нұсқа дұрыс`}
                  className="h-5 w-5 accent-emerald-500"
                />
                <input
                  className={`${FIELD} !mt-0`}
                  value={o}
                  onChange={(e) => setForm({ ...form, options: form.options.map((x, k) => (k === i ? e.target.value : x)) })}
                  placeholder={`${i + 1}-нұсқа`}
                  aria-label={`${i + 1}-нұсқа`}
                  maxLength={300}
                />
              </div>
            ))}
          </fieldset>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            <span className="flex justify-between">Түсініктеме (міндетті емес) <Count value={form.explanation} max={QUESTION_LIMITS.explanation.max} /></span>
            <textarea className={FIELD} rows={2} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
          </label>
          {error && <p role="alert" className="text-body text-rose-500">{error}</p>}
          {sent && <p role="status" className="text-body text-emerald-600 dark:text-emerald-300" data-testid="sent">Жіберілді! Мұғалімің қарап шыққанша күт.</p>}
          <button type="submit" disabled={busy} className="btn-primary min-h-[44px]">{busy ? "Жіберілуде…" : "Мұғалімге жіберу"}</button>
        </form>
      </Card>

      {mine.length > 0 && (
        <section aria-label="Менің сұрақтарым" className="space-y-2">
          <h2 className="text-h3 text-slate-900 dark:text-white">Менің сұрақтарым</h2>
          <ul className="space-y-2" data-testid="my-questions">
            {mine.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-body font-semibold text-slate-900 dark:text-white">{q.question}</p>
                  <p className="text-micro text-slate-500 dark:text-slate-400">{lessonLabel(modules, q.lessonId)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={q.status} />
                  <button
                    aria-label="Сұрақты жою"
                    onClick={async () => { await deleteQuestion(user, q.id); await reload(); }}
                    className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
