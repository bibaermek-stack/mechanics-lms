"use client";

// The three real PASCO devices, shown as the actual photogrammetry scans that
// the simulations run on — not renders, not photos. This is the one section
// where the 3D is the argument rather than the decoration, so each card leads
// with the catalogue number and the true physical size: the same numbers the
// simulation code uses to place the device in the scene.

import { useEffect } from "react";
import { PASCO, type PascoKey } from "@/components/simulation/core/pascoCatalog";
import { preloadPasco } from "@/components/simulation/core/PascoModel";
import { StemObject, type StemObjectKind } from "@/components/three/ObjectStage";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { TiltCard } from "@/components/motion/Magnetic";

const DEVICES: {
  key: PascoKey & StemObjectKind;
  note: string;
  lessons: string;
  distance: number;
}[] = [
  {
    key: "smartCart",
    note: "Ішіне орнатылған күш, үдеу және айналу датчиктері бар арба. Барлық динамика тәжірибесінің негізі.",
    lessons: "3–7 сабақтарда",
    distance: 3.4,
  },
  {
    key: "smartGate",
    note: "Инфрақызыл сәуле кесілген сәтті тіркейді — жылдамдық пен периодты миллисекундтық дәлдікпен береді.",
    lessons: "2, 5, 8 сабақтарда",
    distance: 3.6,
  },
  {
    key: "motionSensor",
    note: "Ультрадыбыстық қашықтық өлшегіш: қозғалыс графигін нақты уақытта тұрғызады.",
    lessons: "1–2 сабақтарда",
    distance: 3.6,
  },
];

/** 0.21 → «21 см»; the catalogue keeps sizes in metres. */
function cm(metres: number) {
  return `${Math.round(metres * 100)} см`;
}

export function PascoShowcase() {
  // Warm the GLB cache on mount rather than when the section scrolls into
  // view, so the scans are decoded by the time the reader gets here. Client
  // only — there is no origin to resolve "/models/..." against on the server.
  useEffect(() => {
    DEVICES.forEach((d) => preloadPasco(PASCO[d.key]));
  }, []);

  return (
    <section
      id="equipment"
      className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-24"
    >
      <Reveal kind="blur">
        <div className="mx-auto max-w-2xl text-center">
          <span className="badge mb-4 inline-flex">Нақты жабдық</span>
          <h2 className="text-h1 text-slate-900 dark:text-white">
            PASCO құралдары — <span className="text-gradient">сканерленген күйінде</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-body text-slate-600 dark:text-slate-400">
            Университет зертханасындағы үш аспап фотограмметрия арқылы 3D-ға
            түсірілді. Төменде көріп тұрғаныңыз — сол сканердің өзі, симуляцияда
            қолданылатын нақты өлшемінде.
          </p>
        </div>
      </Reveal>

      <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" gap={0.09}>
        {DEVICES.map((d) => {
          const spec = PASCO[d.key];
          return (
            <StaggerItem key={d.key} kind="rotate3d" className="h-full">
              <TiltCard className="h-full">
                <article className="glass glass-lit edge-glow flex h-full flex-col rounded-3xl2 p-6">
                  <div className="relative">
                    <StemObject
                      kind={d.key}
                      className="mx-auto h-48 w-full"
                      distance={d.distance}
                      spin={0.32}
                      amplitude={0.08}
                      speed={0.6}
                      tilt={0.3}
                    />
                    {/* Contact glow, so the device reads as resting on something */}
                    <div className="pointer-events-none absolute inset-x-10 bottom-1 h-10 rounded-[50%] bg-brand-500/20 blur-2xl" />
                  </div>

                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <h3 className="text-h3 text-slate-900 dark:text-white">{spec.label}</h3>
                    <span className="data-num shrink-0 text-micro uppercase tracking-wider text-brand-300">
                      {spec.partNo}
                    </span>
                  </div>

                  <p className="mt-2 flex-1 text-label text-slate-600 dark:text-slate-400">
                    {d.note}
                  </p>

                  <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200/60 bg-slate-200/40 text-center dark:border-white/10 dark:bg-white/10">
                    <div className="bg-white/70 px-3 py-3 dark:bg-surface-dark/70">
                      <dt className="text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Нақты өлшем
                      </dt>
                      <dd className="data-num mt-1 text-slate-900 dark:text-white">
                        {cm(spec.realSize)}
                      </dd>
                    </div>
                    <div className="bg-white/70 px-3 py-3 dark:bg-surface-dark/70">
                      <dt className="text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Қолданылуы
                      </dt>
                      <dd className="mt-1 text-label text-slate-900 dark:text-white">
                        {d.lessons}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-micro text-slate-500 dark:text-slate-500">
                    Өлшейді: {spec.measures}
                  </p>
                </article>
              </TiltCard>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
