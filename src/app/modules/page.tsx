"use client";

import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useLessons } from "@/components/providers/LessonsProvider";

export default function ModulesPage() {
  const { modules } = useLessons();

  return (
    <DashboardShell>
      <div className="space-y-6">
        <SectionHeader
          as="h1"
          title="Оқу сабақтары"
          description="Механика курсының 10 сабағы. Әр сабақта дәріс, 3D симуляция, глоссарий, викторина, ойын, БӨЖ тапсырмасы, AI тьютор және құзыреттілік бағалау бар."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.id}
              href={`/modules/${m.id}`}
              className="surface group relative block overflow-hidden p-5 transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-400/40 dark:hover:bg-white/[0.04]"
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-slate-200 group-hover:bg-brand-400 dark:bg-white/10" />
              <div className="flex items-start gap-3 pl-2">
                <span className="data-num shrink-0 text-data text-slate-300 dark:text-slate-600">
                  {String(m.id).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <p className="text-h3 text-slate-900 dark:text-white">{m.title}</p>
                  <p className="mt-1 line-clamp-2 text-body text-slate-600 dark:text-slate-400">
                    {m.shortDescription}
                  </p>
                </div>
              </div>

              {/* Contents of the lesson, as figures rather than icon rows */}
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pl-2 pt-3 dark:border-white/5">
                {[
                  { label: "Дәріс", value: `${m.videoDurationMinutes} мин` },
                  { label: "Викторина", value: `${m.quiz.length} сұрақ` },
                  { label: "Глоссарий", value: `${m.glossary.length} термин` },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="text-label uppercase text-slate-500 dark:text-slate-400">
                      {s.label}
                    </dt>
                    <dd className="data-num text-body font-semibold text-slate-700 dark:text-slate-200">
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
