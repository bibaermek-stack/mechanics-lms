"use client";

import { useEffect, useMemo, useState } from "react";
import { useLessons } from "@/components/providers/LessonsProvider";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuthStore } from "@/lib/authStore";
import { buildPractice } from "@/lib/community";
import { loadPeerQuestions, type PeerQuestion } from "@/lib/communityData";
import { FIELD, lessonLabel } from "./shared";

/** Practice on the questions classmates wrote. Not graded: it is for learning, and it is kind to the authors. */
export function PeerQuiz() {
  const user = useAuthStore((s) => s.user);
  const { modules } = useLessons();
  const [lessonId, setLessonId] = useState(5);
  const [questions, setQuestions] = useState<PeerQuestion[] | null>(null);
  const [round, setRound] = useState(0);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setQuestions(null);
    loadPeerQuestions(user, lessonId)
      .then((q) => !cancelled && setQuestions(q))
      .catch(() => !cancelled && setQuestions([]));
    return () => {
      cancelled = true;
    };
  }, [user, lessonId]);

  const items = useMemo(() => (questions ? buildPractice(questions, 1000 * lessonId + round) : []), [questions, lessonId, round]);

  if (!user) return null;
  const item = items[index];
  const done = questions !== null && items.length > 0 && index >= items.length;

  function restart(next?: number) {
    setIndex(0);
    setPicked(null);
    setScore(0);
    if (next !== undefined) setLessonId(next);
    else setRound((r) => r + 1);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-slate-900 dark:text-white">
        Сабақ
        <select className={FIELD} value={lessonId} onChange={(e) => restart(Number(e.target.value))}>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{lessonLabel(modules, m.id)}</option>
          ))}
        </select>
      </label>

      {questions === null ? (
        <p className="text-body text-slate-500 dark:text-slate-400">Жүктелуде…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Бұл сабақтан сыныптастар сұрағы әлі жоқ" hint="Басқа сабақты таңда, немесе «Сұрақ жазу» бөлімінде өзің сұрақ жаз." compact />
      ) : done ? (
        <div role="status" className="space-y-3 rounded-2xl border border-slate-200/70 p-5 text-center dark:border-white/10" data-testid="peer-done">
          <p className="text-h3 text-slate-900 dark:text-white">Жаттығу аяқталды</p>
          <p className="data-num text-h2 text-brand-600 dark:text-brand-300">{score} / {items.length}</p>
          <button onClick={() => restart()} className="btn-primary min-h-[44px]">Тағы бір рет</button>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-slate-200/70 p-4 dark:border-white/10" data-testid="peer-question">
          <p className="text-micro text-slate-500 dark:text-slate-400">{index + 1} / {items.length} · сыныптасың жазған сұрақ</p>
          <p className="text-h3 text-slate-900 dark:text-white">{item.question}</p>
          <div className="grid gap-2" role="group" aria-label="Жауап нұсқалары">
            {item.options.map((o, i) => {
              const answered = picked !== null;
              const right = i === item.correct;
              return (
                <button
                  key={i}
                  disabled={answered}
                  onClick={() => {
                    setPicked(i);
                    if (right) setScore((s) => s + 1);
                  }}
                  className={`min-h-[48px] rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    answered && right
                      ? "border-emerald-400 bg-emerald-500/10 text-slate-900 dark:text-white"
                      : answered && picked === i
                        ? "border-rose-400 bg-rose-500/10 text-slate-900 dark:text-white"
                        : "border-slate-200 text-slate-800 hover:border-brand-400 dark:border-white/10 dark:text-slate-200"
                  }`}
                >
                  {o}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div role="status" className="space-y-2">
              <p className="text-label font-semibold text-slate-900 dark:text-white">{picked === item.correct ? "Дұрыс!" : "Дұрыс емес."}</p>
              {item.explanation && <p className="text-body text-slate-700 dark:text-slate-300">{item.explanation}</p>}
              <button onClick={() => { setIndex((i) => i + 1); setPicked(null); }} className="btn-primary min-h-[44px]">
                {index === items.length - 1 ? "Нәтижені көру" : "Келесі сұрақ"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
