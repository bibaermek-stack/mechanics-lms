"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useReducedMotion } from "@/lib/useReducedMotion";
import { ArrowRight, ChevronDown, Play } from "lucide-react";
import { Magnetic } from "@/components/motion/Magnetic";
import { StemObject } from "@/components/three/ObjectStage";

/**
 * Full-viewport hero: a central 3D atom framed by orbiting STEM objects, over
 * the animated background.
 *
 * The satellite objects are positioned in percentages so the composition holds
 * from 1280px down to tablet, and they are hidden below `md` — at phone widths
 * they would collide with the headline, and eight extra 3D viewports is the
 * wrong thing to ask of a phone GPU anyway.
 */

const ORBIT = [
  { kind: "rocket", pos: "left-[6%] top-[18%]", size: "h-28 w-28", scale: 1.15, phase: 0 },
  { kind: "dna", pos: "right-[7%] top-[14%]", size: "h-32 w-32", scale: 1.05, phase: 1.1 },
  { kind: "microchip", pos: "left-[12%] bottom-[20%]", size: "h-28 w-28", scale: 0.95, phase: 2.2 },
  { kind: "satellite", pos: "right-[10%] bottom-[24%]", size: "h-28 w-28", scale: 1.1, phase: 3 },
  { kind: "atom", pos: "left-[26%] top-[8%]", size: "h-24 w-24", scale: 1, phase: 0.6 },
  // The photogate scan, orbiting the cart it actually times.
  { kind: "smartGate", pos: "right-[25%] bottom-[10%]", size: "h-28 w-28", scale: 1, phase: 1.8 },
] as const;

/** Formulas drifting in the background, the "physics in space" motif. */
const FORMULAS = [
  { t: "F = ma", pos: "left-[18%] top-[38%]", d: 0 },
  { t: "E = mc²", pos: "right-[16%] top-[44%]", d: 0.4 },
  { t: "τ = Iα", pos: "left-[30%] bottom-[26%]", d: 0.8 },
  { t: "p = mv", pos: "right-[30%] top-[22%]", d: 1.2 },
  { t: "a꜀ = ω²r", pos: "left-[8%] top-[58%]", d: 1.6 },
  { t: "F_A = ρgV", pos: "right-[8%] bottom-[38%]", d: 2 },
];

export function Hero() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  // Parallax: content drifts up and fades as the next section arrives.
  const y = useTransform(scrollYProgress, [0, 0.18], [0, -70]);
  const opacity = useTransform(scrollYProgress, [0, 0.14], [1, 0]);

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-6 pb-24 pt-28">
      {/* Floating STEM objects around the headline */}
      <div className="pointer-events-none absolute inset-0 hidden md:block">
        {ORBIT.map((o) => (
          <StemObject
            key={o.kind}
            kind={o.kind}
            className={`absolute ${o.pos} ${o.size}`}
            scale={o.scale}
            phase={o.phase}
            amplitude={0.16}
            speed={0.7}
            tilt={0.35}
          />
        ))}
      </div>

      {/* Drifting formulas */}
      {!reduced && (
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {FORMULAS.map((f) => (
            <motion.span
              key={f.t}
              className={`absolute ${f.pos} font-mono text-sm text-brand-300/45`}
              animate={{ y: [0, -16, 0], opacity: [0.25, 0.6, 0.25] }}
              transition={{ duration: 9, delay: f.d, repeat: Infinity, ease: "easeInOut" }}
            >
              {f.t}
            </motion.span>
          ))}
        </div>
      )}

      <motion.div style={reduced ? undefined : { y, opacity }} className="relative z-10 mx-auto max-w-3xl text-center">
        <motion.span
          className="badge mb-6 inline-flex"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          Магистрлік зерттеу жобасы · Ахмет Ясауи университеті
        </motion.span>

        <motion.h1
          className="text-display text-slate-900 dark:text-white"
          initial={{ opacity: 0, y: 26, filter: "blur(14px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.95, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          Механиканы <span className="text-gradient">3D зертханада</span> үйрен
        </motion.h1>

        <motion.p
          className="mx-auto mt-6 max-w-xl text-body text-slate-600 dark:text-slate-300/90"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45 }}
        >
          Нақты PASCO жабдығымен сканерленген, физикасы шынайы есептелетін он
          виртуалды тәжірибе. AI тьютор, құзыреттілікке негізделген бағалау және
          өзіндік жұмыс жоспары — бәрі бір платформада.
        </motion.p>

        {/* Central 3D object */}
        <motion.div
          className="relative mx-auto mt-8 h-[300px] w-full max-w-lg sm:h-[360px]"
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* The scanned Smart Cart, not a stand-in: the claim in the
              paragraph above is that the hardware is real, so the hero should
              be the hardware. It spins slowly because a scan only reads as a
              scan once you have seen its back. */}
          <StemObject
            kind="smartCart"
            className="h-full w-full"
            scale={1.35}
            distance={3.5}
            spin={0.25}
            amplitude={0.09}
            speed={0.6}
            tilt={0.4}
          />
          {/* Ground glow so it does not float in a vacuum */}
          <div className="pointer-events-none absolute inset-x-10 bottom-2 h-16 rounded-[50%] bg-brand-500/25 blur-2xl" />
        </motion.div>

        <motion.div
          className="mt-4 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          <Magnetic strength={0.3}>
            <Link href="/dashboard" className="btn-primary group">
              Зертханаға кіру
              <ArrowRight size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </Magnetic>
          <Magnetic strength={0.22}>
            <Link href="/modules/1" className="btn-secondary">
              <Play size={16} /> Демо симуляция
            </Link>
          </Magnetic>
        </motion.div>
      </motion.div>

      {/* Scroll hint */}
      <motion.a
        href="#labs"
        aria-label="Төмен айналдыру"
        className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-slate-500 dark:text-slate-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.6 }}
      >
        <span className="flex h-10 w-6 items-start justify-center rounded-full border border-current/40 pt-1.5">
          <ChevronDown size={14} className="animate-scroll-hint" />
        </span>
      </motion.a>
    </section>
  );
}
