import { DashboardShell } from "@/components/layout/DashboardShell";
import { GlassCard } from "@/components/ui/GlassCard";
import { ALL_MODULES } from "@/data/modules";
import { Users, ClipboardList, BarChart3, Video } from "lucide-react";
import Link from "next/link";

const STAT_CARDS = [
  { icon: Users, label: "Белсенді студенттер", value: "38" },
  { icon: ClipboardList, label: "Тексерілмеген тапсырмалар", value: "7" },
  { icon: Video, label: "Жарияланған сабақтар", value: `${ALL_MODULES.length}` },
  { icon: BarChart3, label: "Орташа құзыреттілік", value: "76%" },
];

export default function TeacherDashboard() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Оқытушы дашборды</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Студенттерді, сабақтарды және тапсырмаларды осында басқарыңыз.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAT_CARDS.map((c) => (
            <GlassCard key={c.label}>
              <c.icon className="mb-2 text-brand-500" />
              <p className="text-2xl font-bold">{c.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
            </GlassCard>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Link href="/teacher/students" className="glass-card">
            <Users className="mb-2 text-brand-500" />
            <p className="font-semibold">Студенттерді басқару</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Тізім, прогресс, құзыреттілік көрсеткіштері.</p>
          </Link>
          <Link href="/teacher/lessons" className="glass-card">
            <Video className="mb-2 text-brand-500" />
            <p className="font-semibold">Сабақтарды басқару</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">YouTube сілтемелерін, викторина мен ойындарды өзгерту.</p>
          </Link>
          <Link href="/teacher/assignments" className="glass-card">
            <ClipboardList className="mb-2 text-brand-500" />
            <p className="font-semibold">Тапсырмаларды тексеру</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">БӨЖ тапсырмаларына баға мен кері байланыс қою.</p>
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
