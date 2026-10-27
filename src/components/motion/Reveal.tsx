"use client";

import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";

type RevealKind = "up" | "blur" | "scale" | "rotate3d" | "left" | "right";

/**
 * Scroll-triggered entrance. `whileInView` with `once` means an element
 * animates the first time it appears and then stops being watched, so a long
 * page does not keep dozens of observers alive.
 *
 * Only transform and opacity are animated — both compositor properties, so
 * revealing a whole grid never triggers layout.
 */
const VARIANTS: Record<RevealKind, Variants> = {
  up: {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0 },
  },
  // "Blur to clear" from the brief. `filter` is GPU-composited here, but it is
  // the one expensive property in this file, so it is opt-in per element.
  blur: {
    hidden: { opacity: 0, y: 18, filter: "blur(12px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)" },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92 },
    show: { opacity: 1, scale: 1 },
  },
  rotate3d: {
    hidden: { opacity: 0, y: 30, rotateX: -12, transformPerspective: 1000 },
    show: { opacity: 1, y: 0, rotateX: 0, transformPerspective: 1000 },
  },
  left: {
    hidden: { opacity: 0, x: -32 },
    show: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 32 },
    show: { opacity: 1, x: 0 },
  },
};

export function Reveal({
  children,
  kind = "up",
  delay = 0,
  duration = 0.7,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  kind?: RevealKind;
  delay?: number;
  duration?: number;
  className?: string;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduced = useReducedMotion();
  const MotionTag = motion[as] as typeof motion.div;

  if (reduced) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      variants={VARIANTS[kind]}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

/**
 * Parent for staggered children. Pair with <StaggerItem/>; the parent owns the
 * viewport trigger so the children fire in sequence from one observer instead
 * of one observer each.
 */
export function Stagger({
  children,
  className,
  gap = 0.08,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  kind = "up",
}: {
  children: React.ReactNode;
  className?: string;
  kind?: RevealKind;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={VARIANTS[kind]}
      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
