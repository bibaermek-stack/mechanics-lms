"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useLessons } from "@/components/providers/LessonsProvider";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/lib/authStore";
import type { ShowcasePost, StudentQuestion } from "@/lib/community";
import { loadReviewQueue, reviewQuestion, reviewShowcase, type Queued } from "@/lib/communityData";
import { lessonLabel } from "./shared";

function Decision({ onDecide, disabled, what }: { onDecide: (approve: boolean) => void; disabled: boolean; what: string }) {
  return (
    <div className="flex gap-2">
      <button onClick={() => onDecide(true)} disabled={disabled} aria-label={`${what}: мақұлдау`} className="btn-primary inline-flex min-h-[44px] items-center gap-1.5">
        <Check size={16} aria-hidden /> Мақұлдау
      </button>
      <button onClick={() => onDecide(false)} disabled={disabled} aria-label={`${what}: қабылдамау`} className="btn-secondary inline-flex min-h-[44px] items-center gap-1.5">
        <X size={16} aria-hidden /> Қабылдамау
      </button>
    </div>
  );
}

/** The teacher's queue: what the accepted students have sent, waiting for a decision. */
export function ModerationQueue() {
  const user = useAuthStore((s) => s.user);
  const { modules } = useLessons();
  const [queue, setQueue] = useState<{ posts: Queued<ShowcasePost>[]; questions: Queued<StudentQuestion>[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      setQueue(await loadReviewQueue(user));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Жүктелмеді");
      setQueue({ posts: [], questions: [] });
    }
  }, [user]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!user) return null;
  if (queue === null) return <p className="text-body text-slate-500 dark:text-slate-400">Жүктелуде…</p>;

  async function decide(run: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Орындалмады");
    } finally {
      setBusy(false);
    }
  }

  const empty = queue.posts.length === 0 && queue.questions.length === 0;
  return (
    <div className="space-y-8">
      {error && <p role="alert" className="text-body text-rose-500">{error}</p>}
      {empty && <EmptyState title="Тексеретін ештеңе жоқ" hint="Оқушылар жұмыс немесе сұрақ жібергенде, олар осында пайда болады." compact />}

      {queue.posts.length > 0 && (
        <section aria-label="Тәжірибелер" className="space-y-3">
          <h2 className="text-h3 text-slate-900 dark:text-white">Үйдегі тәжірибелер ({queue.posts.length})</h2>
          {queue.posts.map((p) => (
            <Card key={p.id}>
              <div className="space-y-2" data-testid="queued-post">
                <p className="text-micro text-slate-500 dark:text-slate-400">{p.author} · {lessonLabel(modules, p.lessonId)}</p>
                <h3 className="text-h3 text-slate-900 dark:text-white">{p.title}</h3>
                <p className="text-body text-slate-700 dark:text-slate-300">{p.what}</p>
                <p className="text-body text-slate-700 dark:text-slate-300"><strong>Физика:</strong> {p.physics}</p>
                {p.materials && <p className="text-micro text-slate-500 dark:text-slate-400">Материалдар: {p.materials}</p>}
                <Decision what={`«${p.title}»`} disabled={busy} onDecide={(a) => decide(() => reviewShowcase(user, p.id, a))} />
              </div>
            </Card>
          ))}
        </section>
      )}

      {queue.questions.length > 0 && (
        <section aria-label="Сұрақтар" className="space-y-3">
          <h2 className="text-h3 text-slate-900 dark:text-white">Оқушы сұрақтары ({queue.questions.length})</h2>
          {queue.questions.map((q) => (
            <Card key={q.id}>
              <div className="space-y-2" data-testid="queued-question">
                <p className="text-micro text-slate-500 dark:text-slate-400">{q.author} · {lessonLabel(modules, q.lessonId)}</p>
                <p className="text-label font-semibold text-slate-900 dark:text-white">{q.question}</p>
                <ol className="space-y-1 text-body text-slate-700 dark:text-slate-300">
                  {q.options.map((o, i) => (
                    <li key={i} className={i === q.correctIndex ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""}>
                      {i === q.correctIndex ? "✓ " : "· "}{o}
                    </li>
                  ))}
                </ol>
                {q.explanation && <p className="text-micro text-slate-500 dark:text-slate-400">Түсініктеме: {q.explanation}</p>}
                <Decision what="сұрақ" disabled={busy} onDecide={(a) => decide(() => reviewQuestion(user, q.id, a))} />
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
