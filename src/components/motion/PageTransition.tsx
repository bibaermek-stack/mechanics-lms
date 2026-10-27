"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Route-change transition: the incoming page resolves from a slight scale and
 * blur.
 *
 * There is deliberately no exit animation. `AnimatePresence` keeps the outgoing
 * page mounted while it fades, but under the App Router that "outgoing" copy is
 * re-rendered with the *new* route's content — so for half a second after every
 * navigation the page existed twice, stacked, with every effect, data load and
 * key handler running twice. Keying the wrapper on the path instead unmounts the
 * old page at once and lets the new one animate in, which is the part the eye
 * follows anyway.
 *
 * The wrapper itself is not animated on the first paint (the server HTML must not
 * start invisible). Scroll-reveals inside a page now start hidden on a first load
 * too, as designed: under the old `AnimatePresence initial={false}` every motion
 * component inside skipped its starting state on the first render, though not
 * after a client-side navigation.
 *
 * Keyed on pathname only, not search params — a filter change should not replay
 * the whole transition.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const firstPaint = useRef(true);
  useEffect(() => {
    firstPaint.current = false;
  }, []);

  if (reduced) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      // A scroll-reveal waits off to one side (x: ±32px) until it is seen. Left alone, that
      // widens the page on a phone; `clip` (unlike `hidden`) makes no scroll container,
      // so sticky headers inside still work.
      className="overflow-x-clip"
      initial={firstPaint.current ? false : { opacity: 0, y: 14, scale: 0.994, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
