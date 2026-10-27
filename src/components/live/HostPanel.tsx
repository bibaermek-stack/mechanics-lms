"use client";

import { useMemo, useState } from "react";
import { Crown, Play, SkipForward, Square, Users } from "lucide-react";
import { useLessons } from "@/components/providers/LessonsProvider";
import { Card } from "@/components/ui/Card";
import { drawQuiz } from "@/data/modules";
import { leaderboard, type LiveQuestion } from "@/lib/liveQuiz";
import { liveAcrossDevices } from "@/lib/liveQuizTransport";
import { OPTION_STYLE, TimeBar, ordinal } from "./shared";
import { useLiveHost } from "./useLiveHost";

const COUNTS = [5, 10];
const TIMES = [15, 20, 30];

/** The teacher's control room, laid out to be read from the back of a classroom. */
export function HostPanel() {
  const { modules } = useLessons();
  const { state, now, error, open, stop, command } = useLiveHost();
  const [lessonId, setLessonId] = useState<number | null>(null);
  const [count, setCount] = useState(5);
  const [seconds, setSeconds] = useState(20);
  const lessonsWithQuiz = useMemo(() => modules.filter((m) => m.quiz.length >= 4), [modules]);
  const chosen = lessonsWithQuiz.find((m) => m.id === lessonId) ?? lessonsWithQuiz[0];

  if (!state) {
    return (
      <Card>
        <div className="space-y-4">
          <p className="text-body text-slate-600 dark:text-slate-400">
            Сабақтың викторина сұрақтарынан бөлме ашасың. Оқушылар өз телефонынан <strong>/live</strong> бетіне кіріп, 6 таңбалы кодты жазады. Жылдам әрі дұрыс жауап көп ұпай әкеледі. Нәтиже бағаға жазылмайды.
          </p>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            Сабақ
            <select
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
              value={chosen?.id ?? ""}
              onChange={(e) => setLessonId(Number(e.target.value))}
            >
              {lessonsWithQuiz.map((m) => (
                <option key={m.id} value={m.id}>{m.id}. {m.title}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900 dark:text-white">Сұрақ саны</legend>
              <div className="mt-1 flex gap-2">
                {COUNTS.map((n) => (
                  <button key={n} onClick={() => setCount(n)} aria-pressed={count === n} className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold ${count === n ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300"}`}>{n}</button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-sm font-semibold text-slate-900 dark:text-white">Әр сұраққа уақыт</legend>
              <div className="mt-1 flex gap-2">
                {TIMES.map((n) => (
                  <button key={n} onClick={() => setSeconds(n)} aria-pressed={seconds === n} className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-semibold ${seconds === n ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300"}`}>{n} с</button>
                ))}
              </div>
            </fieldset>
          </div>
          {!liveAcrossDevices && (
            <p role="note" className="rounded-xl bg-amber-500/10 p-3 text-body text-amber-900 dark:text-amber-100">
              Демо режим: Supabase қосылмаған, сондықтан викторина тек осы браузердің беттері арасында жұмыс істейді (оқушы бетін келесі қойындыда аш). Нақты сынып үшін Supabase Realtime керек.
            </p>
          )}
          {error && <p role="alert" className="text-body text-rose-500">{error}</p>}
          <button
            disabled={!chosen}
            onClick={() => {
              if (!chosen) return;
              const questions: LiveQuestion[] = drawQuiz(chosen.quiz, count).map((q) => ({ id: q.id, text: q.question, options: q.options, correct: q.correctIndex }));
              open(questions, seconds * 1000);
            }}
            className="btn-primary min-h-[48px]"
          >
            Бөлме ашу
          </button>
        </div>
      </Card>
    );
  }

  const players = Object.keys(state.players).length;
  const q = state.index >= 0 ? state.questions[state.index] : null;
  const answered = Object.keys(state.answers).length;
  const remaining = state.startedAt === null ? null : Math.max(0, state.timeLimitMs - (now - state.startedAt));
  const board = leaderboard(state);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/live?code=${state.code}` : `/live?code=${state.code}`;

  return (
    <div className="space-y-5" data-testid="host" data-phase={state.phase}>
      {state.phase === "lobby" && (
        <Card>
          <div className="space-y-4 text-center">
            <p className="text-body text-slate-600 dark:text-slate-400">Кіру коды</p>
            <p className="data-num text-6xl font-bold tracking-widest text-brand-600 dark:text-brand-300 sm:text-7xl" data-testid="room-code">{state.code}</p>
            <p className="break-all text-micro text-slate-500 dark:text-slate-400">{joinUrl}</p>
            <p className="flex items-center justify-center gap-2 text-label font-semibold text-slate-900 dark:text-white"><Users size={18} aria-hidden /> {players} ойыншы</p>
            <ul className="flex flex-wrap justify-center gap-2" data-testid="lobby-players">
              {Object.values(state.players).map((p) => (
                <li key={p.name} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800 dark:bg-white/10 dark:text-slate-100">{p.name}</li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-center gap-2">
              <button disabled={players === 0} onClick={() => command({ type: "start" })} className="btn-primary inline-flex min-h-[48px] items-center gap-2"><Play size={18} aria-hidden /> Бастау</button>
              <button onClick={stop} className="btn-secondary min-h-[48px]">Бөлмені жабу</button>
            </div>
          </div>
        </Card>
      )}

      {(state.phase === "question" || state.phase === "reveal") && q && (
        <Card>
          <div className="space-y-4">
            <p className="data-num text-micro text-slate-500 dark:text-slate-400">{state.index + 1} / {state.questions.length}</p>
            <h2 className="text-h2 text-slate-900 dark:text-white" data-testid="host-question">{q.text}</h2>
            {state.phase === "question" && <TimeBar remainingMs={remaining} totalMs={state.timeLimitMs} />}
            <ul className="grid gap-2 sm:grid-cols-2">
              {q.options.map((o, i) => {
                const reveal = state.phase === "reveal";
                const right = reveal && i === q.correct;
                const counts = reveal ? Object.values(state.answers).filter((a) => a.choice === i).length : null;
                return (
                  <li key={i} className={`flex items-center justify-between gap-3 rounded-xl p-3 text-white ${OPTION_STYLE[i].bg} ${reveal && !right ? "opacity-40" : ""} ${right ? "ring-4 ring-white" : ""}`}>
                    <span className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/25 font-bold">{OPTION_STYLE[i].letter}</span> <span className="text-body font-semibold">{o}{right ? " ✓" : ""}</span></span>
                    {counts !== null && <span className="data-num text-label font-bold">{counts}</span>}
                  </li>
                );
              })}
            </ul>
            {state.phase === "question" && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="data-num text-label font-semibold text-slate-900 dark:text-white" data-testid="answered">Жауап берді: {answered} / {players}</p>
                <button onClick={() => command({ type: "reveal" })} className="btn-secondary inline-flex min-h-[44px] items-center gap-2"><SkipForward size={16} aria-hidden /> Жауаптарды көрсету</button>
              </div>
            )}
          </div>
        </Card>
      )}

      {state.phase === "reveal" && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-h3 text-slate-900 dark:text-white">Көшбасшылар</h3>
            <ol className="space-y-1" data-testid="board">
              {board.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3 py-2 dark:bg-white/5">
                  <span className="flex items-center gap-3"><span className="data-num w-6 text-center font-bold text-slate-500">{r.rank}</span> <span className="text-body font-semibold text-slate-900 dark:text-white">{r.name}</span></span>
                  <span className="data-num text-body text-slate-900 dark:text-white">{r.score} {r.gain > 0 && <span className="text-emerald-600 dark:text-emerald-300">+{r.gain}</span>}</span>
                </li>
              ))}
            </ol>
            <button onClick={() => command({ type: "next" })} className="btn-primary inline-flex min-h-[48px] items-center gap-2"><SkipForward size={18} aria-hidden /> {state.index + 1 === state.questions.length ? "Қорытынды" : "Келесі сұрақ"}</button>
          </div>
        </Card>
      )}

      {state.phase === "finished" && (
        <Card>
          <div className="space-y-4" data-testid="podium">
            <h2 className="flex items-center gap-2 text-h2 text-slate-900 dark:text-white"><Crown className="text-amber-500" aria-hidden /> Нәтиже</h2>
            <ol className="space-y-2">
              {board.map((r) => (
                <li key={r.id} className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${r.rank === 1 ? "bg-amber-400/20" : "bg-slate-100 dark:bg-white/5"}`}>
                  <span className="flex items-center gap-3"><span className="data-num w-8 text-center text-label font-bold">{r.rank}</span> <span className="text-label font-semibold text-slate-900 dark:text-white">{r.name}</span></span>
                  <span className="data-num text-label text-slate-900 dark:text-white">{r.score}</span>
                </li>
              ))}
            </ol>
            <button onClick={stop} className="btn-primary inline-flex min-h-[48px] items-center gap-2"><Square size={16} aria-hidden /> Жаңа ойын</button>
          </div>
        </Card>
      )}

      {state.phase !== "lobby" && state.phase !== "finished" && (
        <button onClick={() => command({ type: "end" })} className="text-micro font-semibold text-slate-500 underline dark:text-slate-400">Викторинаны мерзімінен бұрын аяқтау</button>
      )}
    </div>
  );
}
