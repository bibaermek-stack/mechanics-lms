"use client";

// Entry point for the "3D Симуляция" tab. Each scene is code-split so a module
// page only downloads the three.js bundle and the GLB scans it actually needs.

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Boxes, Clock, Headset } from "lucide-react";
import { getSimulation } from "@/data/simulations";
import { vrExperimentForLesson } from "@/lib/vr/experiments";

function Skeleton() {
  return (
    <div className="sim-stage flex h-[440px] w-full items-center justify-center rounded-xl2 ring-1 ring-slate-900/10 dark:ring-white/10">
      <div className="text-center">
        <div className="mx-auto mb-4 h-1.5 w-24 rounded-full bg-brand-200 dark:bg-brand-500/30" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          3D симуляция дайындалуда…
        </p>
        <p className="mt-1 text-xs text-slate-500">Жабдық модельдері жүктелуде</p>
      </div>
    </div>
  );
}

// next/dynamic requires its options to be written out as an object literal, so
// each entry repeats `{ ssr: false, loading: Skeleton }` rather than sharing one.
const SCENES: Record<number, React.ComponentType> = {
  1: dynamic(() => import("./scenes/Sim01Intro").then((m) => m.Sim01Intro), {
    ssr: false,
    loading: Skeleton,
  }),
  2: dynamic(() => import("./scenes/Sim02Kinematics").then((m) => m.Sim02Kinematics), {
    ssr: false,
    loading: Skeleton,
  }),
  3: dynamic(() => import("./scenes/Sim03Dynamics").then((m) => m.Sim03Dynamics), {
    ssr: false,
    loading: Skeleton,
  }),
  4: dynamic(() => import("./scenes/Sim04NewtonLaws").then((m) => m.Sim04NewtonLaws), {
    ssr: false,
    loading: Skeleton,
  }),
  5: dynamic(() => import("./scenes/Sim05Energy").then((m) => m.Sim05Energy), {
    ssr: false,
    loading: Skeleton,
  }),
  6: dynamic(() => import("./scenes/Sim06Momentum").then((m) => m.Sim06Momentum), {
    ssr: false,
    loading: Skeleton,
  }),
  7: dynamic(() => import("./scenes/Sim07Rotation").then((m) => m.Sim07Rotation), {
    ssr: false,
    loading: Skeleton,
  }),
  8: dynamic(() => import("./scenes/Sim08Oscillations").then((m) => m.Sim08Oscillations), {
    ssr: false,
    loading: Skeleton,
  }),
  9: dynamic(() => import("./scenes/Sim09Fluids").then((m) => m.Sim09Fluids), {
    ssr: false,
    loading: Skeleton,
  }),
  10: dynamic(() => import("./scenes/Sim10Engineering").then((m) => m.Sim10Engineering), {
    ssr: false,
    loading: Skeleton,
  }),
  // 11–13 are the prescribed lab works that no lesson-numbered scene covered.
  // They are keyed past the ten lessons because a lab does not have to belong
  // to a lesson of the same number — see src/data/labWorks.ts.
  11: dynamic(() => import("./scenes/Sim11Friction").then((m) => m.Sim11Friction), {
    ssr: false,
    loading: Skeleton,
  }),
  12: dynamic(() => import("./scenes/Sim12FreeFall").then((m) => m.Sim12FreeFall), {
    ssr: false,
    loading: Skeleton,
  }),
  13: dynamic(
    () => import("./scenes/Sim13RotaryKinematics").then((m) => m.Sim13RotaryKinematics),
    { ssr: false, loading: Skeleton }
  ),
};

export function SimulationPanel({ moduleId }: { moduleId: number }) {
  const meta = getSimulation(moduleId);
  const Scene = SCENES[moduleId];
  // Some lessons have an immersive version of the same apparatus. Offer it here
  // rather than only from /vr-lab, where a student mid-lesson will not look.
  const vr = vrExperimentForLesson(moduleId);

  if (!meta || !Scene) {
    return (
      <div className="surface p-6 text-center">
        <Boxes className="mx-auto mb-2 text-slate-500" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Бұл сабаққа 3D симуляция әлі қосылмаған.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Instrument-panel header. The lesson number does the identifying, so
          the blueprint pattern and the glow behind it were dropped. */}
      <div className="flex items-start gap-4 rounded-xl2 border border-slate-800 bg-slate-900 p-5 text-white sm:gap-5 sm:p-6">
        <span className="data-num shrink-0 text-display leading-none text-white/20">
          {String(meta.moduleId).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-label uppercase text-brand-300">Виртуалды зертхана</span>
            <span className="data-num flex items-center gap-1 text-micro text-slate-400">
              <Clock size={12} /> ≈{meta.minutes} мин
            </span>
          </div>
          <h2 className="mt-1.5 text-h2 sm:text-h1">{meta.title}</h2>
          <p className="mt-2 max-w-3xl text-body text-slate-300">{meta.subtitle}</p>
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-white/10 pt-3">
            {meta.devices.map((dev) => (
              <span
                key={dev}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-micro font-medium text-slate-200"
              >
                <Boxes size={11} className="text-brand-300" />
                {dev}
              </span>
            ))}
          </div>
        </div>
      </div>

      {vr && (
        <Link
          href={`/vr-lab/${vr.id}`}
          className="surface flex items-center gap-3.5 p-4 transition-colors hover:border-brand-300 dark:hover:border-brand-400/30"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300">
            <Headset size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label font-semibold text-slate-900 dark:text-white">
              Осы тәжірибенің VR/AR нұсқасы бар
            </p>
            <p className="mt-0.5 text-micro text-slate-600 dark:text-slate-400">
              «{vr.title}» — зертхананың ішіне кіріп, жабдықтың қасында тұрып орындаңыз.
            </p>
          </div>
          <ArrowRight size={16} className="shrink-0 text-slate-400" />
        </Link>
      )}

      <Scene />
    </div>
  );
}

export default SimulationPanel;
