"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { useAuthStore } from "@/lib/authStore";
import { cleanName, isRoomCode } from "@/lib/liveQuiz";
import { liveAcrossDevices } from "@/lib/liveQuizTransport";
import { OPTION_STYLE, TimeBar, ordinal } from "./shared";
import { useLivePlayer } from "./useLivePlayer";

/** The phone: enter the code, then four big buttons. */
export function PlayerPanel() {
  const user = useAuthStore((s) => s.user);
  const { view, remaining, alias, error, waited, join, leave, answer } = useLivePlayer();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("code");
    if (q && isRoomCode(q)) setCode(q);
  }, []);
  useEffect(() => {
    if (user && !name) setName(cleanName(user.fullName.split(" ")[0] ?? ""));
    // only the first arrival of the user fills the name: later edits are the player's own
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const s = view?.state ?? null;

  if (!view) {
    const ok = isRoomCode(code) && cleanName(name).length > 0;
    return (
      <Card>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) join(code, cleanName(name));
          }}
        >
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            Бөлме коды
            <input
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-center text-3xl font-bold tracking-widest text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              aria-label="Бөлме коды"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-900 dark:text-white">
            Атың (экранда көрінеді)
            <input className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 dark:border-white/15 dark:bg-white/5 dark:text-white" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Атың" />
          </label>
          {!liveAcrossDevices && <p role="note" className="text-micro text-slate-500 dark:text-slate-400">Демо режим: викторина тек мұғалім беті ашық браузерде жұмыс істейді.</p>}
          {error && <p role="alert" className="text-body text-rose-500">{error}</p>}
          <button type="submit" disabled={!ok} className="btn-primary min-h-[48px] w-full">Қосылу</button>
        </form>
      </Card>
    );
  }

  const me = s?.board?.find((r) => r.id === alias) ?? null;
  const q = s?.question ?? null;

  return (
    <div className="space-y-4" data-testid="player" data-phase={s?.phase ?? "connecting"}>
      {!view.joined && (
        <Card>
          <p role="status" className="text-center text-body text-slate-700 dark:text-slate-300" data-testid="connecting">
            {waited ? "Бөлме табылмады, немесе викторина басталып кеткен. Кодты тексер." : "Қосылуда…"}
          </p>
          {waited && <button onClick={leave} className="btn-secondary mt-3 min-h-[44px] w-full">Артқа</button>}
        </Card>
      )}

      {view.joined && s?.phase === "lobby" && (
        <Card>
          <div className="space-y-2 text-center" role="status" data-testid="waiting">
            <p className="text-h3 text-slate-900 dark:text-white">Дайынбыз!</p>
            <p className="text-body text-slate-600 dark:text-slate-400">Мұғалім бастағанша күт. Қазір {s.players.length} ойыншы.</p>
          </div>
        </Card>
      )}

      {view.joined && s?.phase === "question" && q && (
        <div className="space-y-3">
          <p className="data-num text-micro text-slate-500 dark:text-slate-400">{s.index + 1} / {s.total}</p>
          <TimeBar remainingMs={remaining} totalMs={s.timeLimitMs} />
          <p className="text-h3 text-slate-900 dark:text-white" data-testid="player-question">{q.text}</p>
          <div className="grid gap-3" role="group" aria-label="Жауап нұсқалары">
            {q.options.map((o, i) => {
              const mine = view.myChoice === i;
              const locked = view.myChoice !== null || s.answered.includes(alias ?? "");
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={locked || (remaining ?? 1) <= 0}
                  aria-label={`${OPTION_STYLE[i].letter}: ${o}`}
                  className={`flex min-h-[64px] items-center gap-3 rounded-2xl px-4 py-3 text-left text-white shadow-lg transition ${OPTION_STYLE[i].bg} ${mine ? `ring-4 ${OPTION_STYLE[i].ring}` : ""} ${locked && !mine ? "opacity-40" : ""}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/25 text-lg font-bold">{OPTION_STYLE[i].letter}</span>
                  <span className="text-body font-semibold">{o}</span>
                </button>
              );
            })}
          </div>
          {(view.myChoice !== null || s.answered.includes(alias ?? "")) && <p role="status" className="text-center text-label font-semibold text-slate-700 dark:text-slate-300" data-testid="locked">Жауабың қабылданды. Қалғандарын күтеміз…</p>}
        </div>
      )}

      {view.joined && s?.phase === "reveal" && (
        <Card>
          <div className="space-y-3 text-center" role="status" data-testid="my-result">
            <p className={`text-h1 ${me?.correct ? "text-emerald-500" : "text-rose-500"}`}>{me?.correct ? "Дұрыс!" : me?.correct === false && view.myChoice === null ? "Уақыт бітті" : "Қате"}</p>
            {me && <p className="data-num text-h2 text-slate-900 dark:text-white">{me.gain > 0 ? `+${me.gain}` : "+0"}</p>}
            {me && <p className="text-body text-slate-700 dark:text-slate-300">{ordinal(me.rank)} · барлығы <strong className="data-num">{me.score}</strong> ұпай</p>}
            {s.question && s.correct !== null && <p className="text-body text-slate-600 dark:text-slate-400">Дұрыс жауап: <strong>{OPTION_STYLE[s.correct].letter}. {s.question.options[s.correct]}</strong></p>}
          </div>
        </Card>
      )}

      {view.joined && s?.phase === "finished" && (
        <Card>
          <div className="space-y-3 text-center" role="status" data-testid="my-final">
            <p className="text-h2 text-slate-900 dark:text-white">Викторина аяқталды</p>
            {me ? (
              <>
                <p className="data-num text-h1 text-brand-600 dark:text-brand-300">{ordinal(me.rank)}</p>
                <p className="text-body text-slate-700 dark:text-slate-300">{me.score} ұпай</p>
              </>
            ) : (
              <p className="text-body text-slate-600 dark:text-slate-400">Рахмет, қатыстың!</p>
            )}
            <button onClick={leave} className="btn-secondary min-h-[44px]">Шығу</button>
          </div>
        </Card>
      )}
    </div>
  );
}
