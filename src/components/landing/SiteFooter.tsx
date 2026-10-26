"use client";

import Link from "next/link";
import { Github, Globe, Mail } from "lucide-react";
import { Magnetic } from "@/components/motion/Magnetic";
import { ParticleField } from "@/components/fx/ParticleField";

const SOCIAL = [
  { icon: Mail, label: "Электрондық пошта", href: "mailto:info@ayu.edu.kz" },
  { icon: Globe, label: "Университет сайты", href: "https://ayu.edu.kz" },
  { icon: Github, label: "Жоба коды", href: "#" },
];

const COLUMNS = [
  {
    title: "Платформа",
    links: [
      { label: "Сабақтар", href: "/modules" },
      { label: "3D зертхана", href: "/modules/1" },
      { label: "AI тьютор", href: "/ai-tutor" },
      { label: "Аналитика", href: "/analytics" },
    ],
  },
  {
    title: "Оқытушыға",
    links: [
      { label: "Дашборд", href: "/teacher" },
      { label: "Студенттер", href: "/teacher/students" },
      { label: "Есептер", href: "/teacher/analytics" },
      { label: "Тапсырмалар", href: "/teacher/assignments" },
    ],
  },
];

/**
 * Footer with a layered SVG wave, its own particle field and glowing social
 * buttons. The wave is two stacked paths at different opacities and animation
 * offsets — cheaper and crisper than a canvas, and it scales to any width.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden">
      {/* Wave crest */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -translate-y-[99%]">
        <svg viewBox="0 0 1440 130" className="h-[80px] w-full" preserveAspectRatio="none" aria-hidden>
          <path
            d="M0,64 C240,120 480,8 720,48 C960,88 1200,24 1440,72 L1440,130 L0,130 Z"
            className="fill-brand-500/10"
          />
          <path
            d="M0,88 C260,40 520,116 780,72 C1040,28 1260,96 1440,56 L1440,130 L0,130 Z"
            className="fill-violet-500/10"
          />
        </svg>
      </div>

      <div className="relative border-t border-white/10 bg-white/60 dark:bg-white/[0.03]">
        <ParticleField density={0.00004} />

        <div className="relative mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl2 bg-aurora-brand font-bold text-white shadow-glow-brand">
                  М
                </span>
                <span className="text-h3">Механика AI</span>
              </div>
              <p className="mt-3 max-w-xs text-body text-slate-600 dark:text-slate-400">
                Механиканы қашықтықтан оқытуға арналған, 3D зертханасы бар ЖИ
                платформасы.
              </p>
            </div>

            {COLUMNS.map((col) => (
              <div key={col.title}>
                <p className="text-label uppercase text-slate-500 dark:text-slate-400">
                  {col.title}
                </p>
                <ul className="mt-3 space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-body text-slate-600 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div>
              <p className="text-label uppercase text-slate-500 dark:text-slate-400">Байланыс</p>
              <div className="mt-3 flex gap-2">
                {SOCIAL.map((s) => (
                  <Magnetic key={s.label} strength={0.35}>
                    <a
                      href={s.href}
                      aria-label={s.label}
                      className="flex h-10 w-10 items-center justify-center rounded-xl2 border border-white/15 bg-white/5 text-slate-600 transition-all duration-300 hover:border-brand-400/50 hover:text-brand-500 hover:shadow-glow-brand dark:text-slate-300 dark:hover:text-brand-300"
                    >
                      <s.icon size={17} />
                    </a>
                  </Magnetic>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-12 border-t border-white/10 pt-6 text-center text-micro text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} Механика AI LMS — Ахмет Ясауи атындағы
            университет. Магистрлік зерттеу жобасы.
          </p>
        </div>
      </div>
    </footer>
  );
}
