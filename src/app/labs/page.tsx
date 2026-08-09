"use client";

// The ten laboratory works, as the course documentation lists them.
//
// Kept as its own page rather than folded into the lesson list because the two
// numberings genuinely differ: three of the works sit on lesson 2 and three
// lessons carry none. A student looking for "work 8" should find it by its own
// number, not have to know which lesson it hides under.

import Link from "next/link";
import { Boxes, ArrowRight, Wrench } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { LAB_WORKS } from "@/data/labWorks";
import { useLessons } from "@/components/providers/LessonsProvider";

export default function LabsPage() {
  const { byId } = useLessons();
  const ready = LAB_WORKS.filter((l) => l.sceneModuleId !== null).length;

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Зертханалық жұмыстар"
          description="PASCO жабдығымен орындалатын он жұмыс. Әрқайсысы қашықтан орындалады: 3D симуляцияда тәжірибені жүргізіп, графиктерін талдайсың."
          action={
            <Badge variant={ready === LAB_WORKS.length ? "success" : "warning"}>
              {ready}/{LAB_WORKS.length} симуляция дайын
            </Badge>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-micro uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="border-b border-slate-200/70 px-3 py-2.5 dark:border-white/10">№</th>
                <th className="border-b border-slate-200/70 px-3 py-2.5 dark:border-white/10">
                  Зертханалық жұмыс
                </th>
                <th className="border-b border-slate-200/70 px-3 py-2.5 dark:border-white/10">
                  PASCO құрылғылары
                </th>
                <th className="border-b border-slate-200/70 px-3 py-2.5 dark:border-white/10">
                  Негізгі ұғым
                </th>
                <th className="border-b border-slate-200/70 px-3 py-2.5 dark:border-white/10">
                  Қашықтан орындалуы
                </th>
                <th className="border-b border-slate-200/70 px-3 py-2.5 dark:border-white/10" />
              </tr>
            </thead>
            <tbody>
              {LAB_WORKS.map((lab) => {
                const lesson = byId(lab.lessonId);
                return (
                  <tr key={lab.id} className="align-top">
                    <td className="border-b border-slate-200/50 px-3 py-3.5 dark:border-white/5">
                      <span className="data-num text-data-sm text-slate-400 dark:text-slate-600">
                        {lab.id}
                      </span>
                    </td>
                    <td className="border-b border-slate-200/50 px-3 py-3.5 dark:border-white/5">
                      <p className="text-label font-semibold text-slate-900 dark:text-white">
                        {lab.title}
                      </p>
                      <p className="mt-0.5 text-micro text-slate-500 dark:text-slate-400">
                        {lab.lessonId}-сабақ · {lesson?.title ?? ""}
                      </p>
                    </td>
                    <td className="border-b border-slate-200/50 px-3 py-3.5 dark:border-white/5">
                      <ul className="space-y-1">
                        {lab.devices.map((d) => (
                          <li
                            key={d}
                            className="flex items-start gap-1.5 text-micro text-slate-600 dark:text-slate-400"
                          >
                            <Wrench size={12} className="mt-0.5 shrink-0 text-brand-300" />
                            {d}
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="border-b border-slate-200/50 px-3 py-3.5 text-micro text-slate-600 dark:border-white/5 dark:text-slate-400">
                      {lab.concept}
                    </td>
                    <td className="border-b border-slate-200/50 px-3 py-3.5 text-micro text-slate-600 dark:border-white/5 dark:text-slate-400">
                      {lab.remote}
                    </td>
                    <td className="border-b border-slate-200/50 px-3 py-3.5 dark:border-white/5">
                      {lab.sceneModuleId !== null ? (
                        <Link
                          href={`/modules/${lab.lessonId}?tab=simulation`}
                          className="btn-secondary whitespace-nowrap px-3 py-1.5 text-sm"
                        >
                          <Boxes size={14} /> Тәжірибе
                          <ArrowRight size={13} />
                        </Link>
                      ) : (
                        <Badge variant="warning">Дайындалуда</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-micro text-slate-500 dark:text-slate-400">
          Курста бұдан басқа төрт симуляция бар — санақ жүйесі, Ньютонның үш заңы бірге,
          Архимед күші және арқалық иілуі. Олар тізімдегі жұмыстарға кірмейді, бірақ өз
          сабақтарында ашық тұр.
        </p>
      </div>
    </DashboardShell>
  );
}
