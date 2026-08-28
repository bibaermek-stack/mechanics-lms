"use client";

// The controls: what every key does, and how to change it.
//
// Two jobs in one component, because they are the same information. Collapsed
// it is a legend — the answer to "what else can I press?", which the game had no
// answer to before: the kick key existed but was written nowhere on the screen,
// and the sprint did not exist at all. Expanded, each row becomes a button that
// listens for the next key and takes it.

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Keyboard, RotateCcw, X } from "lucide-react";
import type { ArenaAction, Keymap } from "@/lib/arena/keybindings";
import { ACTIONS, ACTION_HINTS, ACTION_LABELS, isBindable, keyLabel } from "@/lib/arena/keybindings";

/** One key, drawn as a key cap. */
function Cap({ code, dim = false }: { code: string; dim?: boolean }) {
  return (
    <kbd
      className={clsx(
        "inline-flex min-w-[1.85rem] items-center justify-center rounded-md border-b-2 px-1.5 py-0.5 font-sans text-[11px] font-bold",
        dim
          ? "border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
          : "border-slate-400 bg-white text-slate-700 shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-slate-100"
      )}
    >
      {keyLabel(code)}
    </kbd>
  );
}

export interface ArenaControlsProps {
  keymap: Keymap;
  bind: (action: ArenaAction, code: string) => void;
  reset: () => void;
  /** Which controls are pressed right now, so the legend lights up. */
  active?: Partial<Record<ArenaAction, 0 | 1>>;
}

export function ArenaControls({ keymap, bind, reset, active }: ArenaControlsProps) {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState<ArenaAction | null>(null);
  const listeningRef = useRef<ArenaAction | null>(null);
  listeningRef.current = listening;

  const stop = useCallback(() => setListening(null), []);

  // While a row is listening it swallows the next key press, so binding W does
  // not also drive the player up in the match running behind the card. Capture
  // phase, because the match's own listener is on window too and would
  // otherwise see it first.
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const action = listeningRef.current;
      if (!action) return;
      if (e.code === "Escape" || !isBindable(e.code)) {
        setListening(null);
        return;
      }
      bind(action, e.code);
      setListening(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [listening, bind]);

  return (
    <div className="surface p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-label uppercase text-slate-500 dark:text-slate-400">
          <Keyboard size={13} /> Басқару
        </p>
        <div className="flex items-center gap-2">
          {open && (
            <button
              onClick={() => {
                reset();
                stop();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-micro font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
            >
              <RotateCcw size={12} /> Әдепкі
            </button>
          )}
          <button
            onClick={() => {
              setOpen((v) => !v);
              stop();
            }}
            className="rounded-lg bg-brand-500 px-2.5 py-1 text-micro font-semibold text-white transition-colors hover:bg-brand-600"
          >
            {open ? "Дайын" : "Пернелерді өзгерту"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {ACTIONS.map((action) => {
          const codes = keymap[action];
          const isListening = listening === action;
          const lit = active?.[action] === 1;
          return (
            <div
              key={action}
              className={clsx(
                "flex min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-2 ring-1 ring-inset transition-colors",
                lit
                  ? "bg-brand-50 ring-brand-300 dark:bg-brand-500/15 dark:ring-brand-400/40"
                  : "bg-slate-50 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10"
              )}
            >
              <div className="min-w-0">
                <p className="truncate text-body font-semibold text-slate-700 dark:text-slate-200">
                  {ACTION_LABELS[action]}
                </p>
                <p className="truncate text-micro text-slate-500 dark:text-slate-400">
                  {ACTION_HINTS[action]}
                </p>
              </div>

              {open ? (
                <button
                  onClick={() => setListening(isListening ? null : action)}
                  className={clsx(
                    "shrink-0 rounded-lg px-2.5 py-1.5 text-micro font-semibold transition-colors",
                    isListening
                      ? "animate-pulse bg-amber-500 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-white dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
                  )}
                >
                  {isListening ? (
                    <span className="inline-flex items-center gap-1">
                      Перне басыңыз <X size={11} />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      {codes.length ? (
                        codes.map((c) => <Cap key={c} code={c} />)
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </span>
                  )}
                </button>
              ) : (
                <span className="flex shrink-0 items-center gap-1">
                  {codes.length ? (
                    codes.map((c, i) => <Cap key={c} code={c} dim={i > 0} />)
                  ) : (
                    <span className="text-micro text-slate-400">тағайындалмаған</span>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {open && (
        <p className="mt-2 text-micro leading-relaxed text-slate-500 dark:text-slate-400">
          Пернені өзгерту үшін жолды басып, қалаған пернені басыңыз. Таңдау{" "}
          <kbd className="font-sans font-semibold">Esc</kbd> арқылы тоқтатылады. Перне
          орналасуы бойынша есептеледі, сондықтан латын/кирилл ауыстырғанда басқару
          өзгермейді. Таңдауыңыз осы браузерде сақталады.
        </p>
      )}
    </div>
  );
}

export default ArenaControls;
