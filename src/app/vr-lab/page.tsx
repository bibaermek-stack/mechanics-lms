"use client";

// The VR/AR laboratory index.
//
// It sits beside /labs rather than inside it: /labs is the register of the ten
// prescribed works and their PASCO hardware, while this page is about a way of
// carrying four of them out. A student looking for "work 3" finds it there; a
// student who has just been handed a headset starts here.

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Headset,
  Info,
  Monitor,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { PASCO } from "@/components/simulation/core/pascoCatalog";
import { LAB_WORKS } from "@/data/labWorks";
import { VR_EXPERIMENTS, vrExperimentForLab } from "@/lib/vr/experiments";

const HOW_TO = [
  {
    icon: Headset,
    title: "VR гарнитурасы",
    text: "Meta Quest, Pico немесе SteamVR. Браузерде бетті ашып, «VR» батырмасын басыңыз. Контроллердің сәулесімен үстелдегі пульттің батырмаларын басасыз.",
  },
  {
    icon: Smartphone,
    title: "Телефон (AR)",
    text: "Android + Chrome. «AR» батырмасын басып, камераны нақты үстелге бағыттаңыз да, зертхананы қоятын жерді түртіңіз.",
  },
  {
    icon: Monitor,
    title: "Кәдімгі компьютер",
    text: "Ешқандай құрылғы қажет емес: тінтуірмен қарайсыз, W/A/S/D-мен жүресіз, батырмаларды шертесіз. Барлық өлшеу бірдей жұмыс істейді.",
  },
];

export default function VrLabIndexPage() {
  const remaining = LAB_WORKS.filter((l) => !vrExperimentForLab(l.id)).length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="VR/AR зертханалық орта"
          description="Зертхананың ішіне кіріп, PASCO жабдығының қасында тұрып тәжірибе жүргізіңіз. Орта A-Frame (WebXR) арқылы құрылған, ал барлық жабдық пен аспап three.js-те модельденген."
          action={<Badge variant="success">{VR_EXPERIMENTS.length} тәжірибе</Badge>}
        />

        {/* How to get in ---------------------------------------------------- */}
        <div className="grid gap-3 sm:grid-cols-3">
          {HOW_TO.map((h) => {
            const Icon = h.icon;
            return (
              <div key={h.title} className="surface p-4">
                <span className="mb-2.5 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300">
                  <Icon size={16} />
                </span>
                <p className="text-label font-semibold text-slate-900 dark:text-white">{h.title}</p>
                <p className="mt-1 text-micro leading-snug text-slate-600 dark:text-slate-400">
                  {h.text}
                </p>
              </div>
            );
          })}
        </div>

        {/* Experiments ------------------------------------------------------ */}
        <div className="grid gap-4 lg:grid-cols-2">
          {VR_EXPERIMENTS.map((exp) => (
            <Link
              key={exp.id}
              href={`/vr-lab/${exp.id}`}
              className="surface group flex flex-col gap-3 p-5 transition-colors hover:border-brand-300 dark:hover:border-brand-400/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label uppercase text-brand-600 dark:text-brand-400">
                    {exp.labIds.map((id) => `№${id}`).join(", ")} зертханалық жұмыс
                  </p>
                  <h2 className="mt-1 text-h3 text-slate-900 dark:text-white">{exp.title}</h2>
                </div>
                <span className="data-num shrink-0 text-data-sm text-slate-300 dark:text-slate-600">
                  {exp.minutes}′
                </span>
              </div>

              <p className="text-body text-slate-600 dark:text-slate-300">{exp.subtitle}</p>

              <div className="flex flex-wrap gap-1.5">
                {exp.devices.map((key) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-brand-50 py-1 pl-2 pr-2.5 text-[11px] font-semibold text-brand-700 dark:border-brand-400/20 dark:bg-brand-900/40 dark:text-brand-200"
                  >
                    <Boxes size={11} />
                    {PASCO[key].label}
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-900/5 pt-3 dark:border-white/10">
                <span className="text-micro text-slate-500 dark:text-slate-400">
                  {exp.lessonId}-сабақтың теориясы
                </span>
                <span className="btn-secondary px-3 py-1.5 text-sm">
                  <Sparkles size={14} /> Кіру
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="flex gap-3 rounded-xl2 border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
          <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <div className="text-micro leading-relaxed text-slate-600 dark:text-slate-400">
            <p>
              Қалған {remaining} зертханалық жұмыс өз сабақтарындағы{" "}
              <strong>3D симуляцияда</strong> орындалады — олар үшін аспаптың қасында тұрудың қосымша пайдасы аз.
              Тізімді <Link href="/labs" className="text-brand-600 underline dark:text-brand-300">Зертханалық жұмыстар</Link>{" "}
              бетінен көріңіз.
            </p>
            <p className="mt-1.5">
              VR/AR ортасы толығымен браузерде жұмыс істейді: ешқандай қосымша
              орнатудың қажеті жоқ, барлық модель мен қаріп жобаның өз серверінен
              жүктеледі.
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
