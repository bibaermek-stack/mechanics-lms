"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * First-paint overlay: wordmark, an orbiting-electron mark and a progress bar,
 * then a blurred fade out.
 *
 * Shown once per session (sessionStorage), because a splash on every route
 * change would be an obstacle rather than an entrance. The atom is CSS, not
 * WebGL — the shared three.js canvas has not compiled its shaders yet at this
 * point, so drawing the loader with it would be the slowest possible choice.
 */
export function LoadingScreen() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  // Where the splash is in its life. The effect below runs again whenever `reduced` changes, and
  // `useReducedMotion` starts false and only then reads the real setting, so for a visitor who asked
  // for reduced motion it runs twice on the very first load. The session flag alone cannot tell "a
  // splash I am already showing" from "one shown earlier": it would find the flag set by the first
  // run, walk away, and leave the overlay up for ever, over every control on the page.
  const life = useRef<"new" | "showing" | "done">("new");

  useEffect(() => {
    if (life.current === "new") {
      let seen = false;
      try {
        seen = !!sessionStorage.getItem("stem:seen-intro");
        sessionStorage.setItem("stem:seen-intro", "1");
      } catch {
        // storage blocked: show it, once per page load
      }
      if (seen) {
        life.current = "done";
        return;
      }
      life.current = "showing";
      setVisible(true);
    }
    if (life.current !== "showing") return;
    const finish = () => {
      life.current = "done";
      setVisible(false);
    };

    if (reduced) {
      setProgress(100);
      const t = setTimeout(finish, 220);
      return () => clearTimeout(t);
    }

    // Ease toward 100 rather than stepping linearly, so it decelerates like a
    // real load instead of ticking like a timer.
    let raf = 0;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const start = performance.now();
    const DURATION = 1250;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setProgress(Math.round((1 - Math.pow(1 - t, 3)) * 100));
      if (t < 1) raf = requestAnimationFrame(tick);
      else hide = setTimeout(finish, 260);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(hide);
    };
  }, [reduced]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-testid="splash"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[#05070f]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(14px)", scale: 1.04 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Ambient glow behind the mark */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(51,102,255,0.28),transparent_70%)]" />

          <div className="relative flex flex-col items-center gap-7">
            {/* Atom mark: nucleus plus three inclined electron shells */}
            <div className="relative h-28 w-28">
              {[0, 60, 120].map((deg, i) => (
                <span
                  key={deg}
                  className="absolute inset-0 rounded-full border border-brand-400/45"
                  style={{
                    transform: `rotate(${deg}deg) rotateX(72deg)`,
                    animation: reduced ? undefined : `spin ${2.6 + i * 0.7}s linear infinite`,
                  }}
                />
              ))}
              <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-brand-300 to-cyan-400 shadow-[0_0_28px_6px_rgba(51,102,255,0.7)]" />
              {!reduced &&
                [0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(34,211,238,0.8)]"
                    style={{
                      animation: `orbit-${i} ${2.2 + i * 0.6}s linear infinite`,
                    }}
                  />
                ))}
            </div>

            <div className="text-center">
              <p className="text-h2 text-gradient">Механика AI</p>
              <p className="mt-1 text-micro tracking-[0.22em] text-slate-500">
                STEM ЗЕРТХАНАСЫ ЖҮКТЕЛУДЕ
              </p>
            </div>

            {/* Progress */}
            <div className="w-56">
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 via-violet-500 to-cyan-400"
                  style={{ width: `${progress}%`, transition: "width 90ms linear" }}
                />
              </div>
              <p className="data-num mt-2 text-center text-micro text-slate-500">{progress}%</p>
            </div>
          </div>

          <style jsx>{`
            @keyframes spin {
              to {
                transform: rotate(360deg) rotateX(72deg);
              }
            }
            @keyframes orbit-0 {
              from { transform: translate(-50%, -50%) rotate(0) translateX(56px) rotate(0); }
              to { transform: translate(-50%, -50%) rotate(360deg) translateX(56px) rotate(-360deg); }
            }
            @keyframes orbit-1 {
              from { transform: translate(-50%, -50%) rotate(120deg) translateX(48px) rotate(-120deg); }
              to { transform: translate(-50%, -50%) rotate(480deg) translateX(48px) rotate(-480deg); }
            }
            @keyframes orbit-2 {
              from { transform: translate(-50%, -50%) rotate(240deg) translateX(52px) rotate(-240deg); }
              to { transform: translate(-50%, -50%) rotate(600deg) translateX(52px) rotate(-600deg); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
