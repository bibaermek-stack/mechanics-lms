import Link from "next/link";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ALL_MODULES } from "@/data/modules";
import { Clock, HelpCircle, Gamepad2 } from "lucide-react";

export default function ModulesPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Оқу сабақтары</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Механика курсының 10 сабағы. Әр сабақта дәріс, глоссарий, викторина, ойын, БӨЖ тапсырмасы, AI тьютор және құзыреттілік бағалау бар.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_MODULES.map((m) => (
            <Link key={m.id} href={`/modules/${m.id}`} className="glass-card block">
              <div className={`mb-3 flex h-28 flex-col justify-between rounded-xl bg-gradient-to-br ${m.colorFrom} ${m.colorTo} p-3 text-white`}>
                <p className="text-xs opacity-80">Сабақ {m.id}</p>
                <p className="text-lg font-bold">{m.title}</p>
              </div>
              <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{m.shortDescription}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1"><Clock size={12} /> {m.videoDurationMinutes} мин</span>
                <span className="flex items-center gap-1"><HelpCircle size={12} /> {m.quiz.length} сұрақ</span>
                <span className="flex items-center gap-1"><Gamepad2 size={12} /> Ойын</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
