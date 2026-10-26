import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ALL_MODULES } from "@/data/modules";
import { SiteNav } from "@/components/layout/SiteNav";
import { Hero } from "@/components/landing/Hero";
import { LabCard } from "@/components/landing/LabCard";
import { PascoShowcase } from "@/components/landing/PascoShowcase";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";
import { StemObject, type StemObjectKind } from "@/components/three/ObjectStage";
import { Magnetic } from "@/components/motion/Magnetic";

/**
 * One 3D object per lesson, chosen to match what the simulation actually
 * teaches — the microchip sits with the engineering lesson, the solar system
 * with circular motion, and so on. A random assignment would undercut the
 * point of having distinct objects at all.
 */
const LAB_OBJECT: Record<number, { kind: StemObjectKind; tag: string }> = {
  1: { kind: "books", tag: "Кіріспе" },
  2: { kind: "geometry", tag: "Кинематика" },
  3: { kind: "robot", tag: "Динамика" },
  4: { kind: "drone", tag: "Ньютон заңдары" },
  5: { kind: "rocket", tag: "Энергия" },
  6: { kind: "molecule", tag: "Импульс" },
  7: { kind: "solar", tag: "Айналу" },
  8: { kind: "dna", tag: "Тербеліс" },
  9: { kind: "glassware", tag: "Сұйықтар" },
  10: { kind: "microchip", tag: "Инженерия" },
};

const STACK = [
  {
    kind: "neural" as StemObjectKind,
    title: "AI тьютор",
    desc: "Механика бойынша 24/7 жеке көмекші — тек қазақ тілінде жауап береді, формуланы қадаммен талдайды.",
  },
  {
    kind: "motionSensor" as StemObjectKind,
    title: "Нақты өлшеу",
    desc: "PASCO Smart Cart пен Smart Gate сканерленген модельдері, физикасы шынайы интегратормен есептеледі.",
  },
  {
    kind: "telescope" as StemObjectKind,
    title: "Құзыреттілік аналитикасы",
    desc: "10 критерийлі рубрика, 3D матрица және «не істеу керек» жоспары — оқытушыға да, студентке де.",
  },
  {
    kind: "circuit" as StemObjectKind,
    title: "Ашық архитектура",
    desc: "Next.js, three.js және Supabase. Мок режимінде кілтсіз жұмыс істейді, нақты бэкендке кілттерді қосу арқылы көшеді.",
  },
];

const NUMBERS = [
  { value: 10, suffix: "", label: "оқу сабағы" },
  { value: 10, suffix: "", label: "3D симуляция" },
  { value: 10, suffix: "", label: "бағалау критерийі" },
  { value: 60, suffix: " FPS", label: "интерактив зертхана" },
];

export default function LandingPage() {
  return (
    <>
      <SiteNav />

      <main className="relative">
        <Hero />

        {/* Laboratories ---------------------------------------------------- */}
        <section id="labs" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
          <Reveal kind="blur">
            <div className="mx-auto max-w-2xl text-center">
              <span className="badge mb-4 inline-flex">Виртуалды зертханалар</span>
              <h2 className="text-h1 text-slate-900 dark:text-white">
                Он тәжірибе, әрқайсысы <span className="text-gradient">интерактивті</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-body text-slate-600 dark:text-slate-400">
                Әр сабақта нақты жабдықпен жасалған 3D сахна, тірі графиктер және
                зерттеу тапсырмалары бар.
              </p>
            </div>
          </Reveal>

          <Stagger className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" gap={0.07}>
            {ALL_MODULES.map((m) => {
              const meta = LAB_OBJECT[m.id];
              return (
                <StaggerItem key={m.id} kind="rotate3d" className="h-full">
                  <LabCard
                    id={m.id}
                    title={m.title}
                    description={m.shortDescription}
                    kind={meta.kind}
                    tag={meta.tag}
                  />
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>

        {/* Real scanned equipment ------------------------------------------ */}
        <PascoShowcase />

        {/* Numbers --------------------------------------------------------- */}
        <section id="numbers" className="relative mx-auto max-w-5xl scroll-mt-24 px-6 py-16">
          <Reveal kind="scale">
            <dl className="glass glass-lit grid grid-cols-2 gap-px overflow-hidden rounded-3xl2 md:grid-cols-4">
              {NUMBERS.map((n) => (
                <div key={n.label} className="px-6 py-9 text-center">
                  <dt className="sr-only">{n.label}</dt>
                  <dd>
                    <CountUp
                      value={n.value}
                      suffix={n.suffix}
                      className="block text-data text-gradient"
                    />
                    <span className="mt-2 block text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {n.label}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* Stack ----------------------------------------------------------- */}
        <section id="stack" className="relative mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
          <Reveal kind="blur">
            <div className="mx-auto max-w-2xl text-center">
              <span className="badge mb-4 inline-flex">Платформа</span>
              <h2 className="text-h1 text-slate-900 dark:text-white">
                Оқытуға керектің <span className="text-gradient">бәрі</span> бір жерде
              </h2>
            </div>
          </Reveal>

          <div className="mt-14 space-y-6">
            {STACK.map((s, i) => (
              <Reveal key={s.title} kind={i % 2 ? "right" : "left"} delay={0.05}>
                <div
                  className={`glass glass-lit flex flex-col items-center gap-6 rounded-3xl2 p-7 md:p-9 ${
                    i % 2 ? "md:flex-row-reverse" : "md:flex-row"
                  }`}
                >
                  <StemObject
                    kind={s.kind}
                    className="h-44 w-44 shrink-0"
                    scale={1.05}
                    distance={3.9}
                    phase={i * 1.1}
                    amplitude={0.12}
                    speed={0.75}
                  />
                  <div className={i % 2 ? "md:text-right" : ""}>
                    <h3 className="text-h2 text-slate-900 dark:text-white">{s.title}</h3>
                    <p className="mt-2.5 max-w-lg text-body text-slate-600 dark:text-slate-400">
                      {s.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA ------------------------------------------------------------- */}
        <section className="relative mx-auto max-w-4xl px-6 pb-8">
          <Reveal kind="scale">
            <div className="glass glass-lit relative overflow-hidden rounded-3xl2 px-8 py-16 text-center">
              <span className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
              <span className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />

              <div className="relative">
                <h2 className="text-h1 text-slate-900 dark:text-white">
                  Бүгін <span className="text-gradient">бірінші тәжірибеңді</span> жаса
                </h2>
                <p className="mx-auto mt-4 max-w-md text-body text-slate-600 dark:text-slate-400">
                  Тіркелудің қажеті жоқ — демо режимде барлық зертхана ашық.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Magnetic strength={0.3}>
                    <Link href="/dashboard" className="btn-primary group">
                      Студент ретінде бастау
                      <ArrowRight
                        size={17}
                        className="transition-transform duration-300 group-hover:translate-x-0.5"
                      />
                    </Link>
                  </Magnetic>
                  <Magnetic strength={0.22}>
                    <Link href="/teacher" className="btn-secondary">
                      Оқытушы дашборды
                    </Link>
                  </Magnetic>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
