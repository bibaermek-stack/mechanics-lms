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
 * The first paint is not animated (the server HTML must not start invisible), and
 * the key is the pathname only, not the search params — a filter change should
 * not replay the whole transition.
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
      initial={firstPaint.current ? false : { opacity: 0, y: 14, scale: 0.994, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
