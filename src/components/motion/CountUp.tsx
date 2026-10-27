"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

/**
 * Counts from 0 to `value` the first time it scrolls into view.
 *
 * Uses an eased rAF loop rather than a spring so the number lands exactly on
 * the target — a spring overshoots, and "76%" briefly reading "78%" is wrong
 * for a figure students are being graded on. Reduced motion prints the final
 * value immediately.
 */
export function CountUp({
  value,
  duration = 1.4,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setShown(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const ms = duration * 1000;
    // easeOutExpo: fast start, long settle — reads as "counting up and landing"
    const ease = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setShown(value * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setShown(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduced]);

  return (
    <span ref={ref} className={`data-num ${className ?? ""}`}>
      {prefix}
      {shown.toFixed(decimals)}
      {suffix}
    </span>
  );
}
