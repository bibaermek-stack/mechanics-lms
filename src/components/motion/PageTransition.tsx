"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Route-change transition: the outgoing page blurs and drops away, the
 * incoming one resolves from a slight scale and blur.
 *
 * `mode="wait"` would leave the viewport blank between routes, so the two
 * overlap instead — the incoming page is what the eye follows. Duration sits
 * at 560ms in and 380ms out: inside the 500–800ms band asked for, but the exit
 * is deliberately quicker so navigation still feels responsive.
 *
 * Keyed on pathname only, not search params — a filter change should not
 * replay the whole transition.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();

  if (reduced) return <>{children}</>;

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 14, scale: 0.994, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, filter: "blur(6px)" }}
        transition={{
          duration: 0.56,
          ease: [0.22, 1, 0.36, 1],
          exit: { duration: 0.38 },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
