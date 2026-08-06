import Link from "next/link";
import {
  Rocket,
  Bot,
  Trophy,
  BarChart3,
  Award,
  Gamepad2,
  ShieldCheck,
} from "lucide-react";
import { ALL_MODULES } from "@/data/modules";

const FEATURES = [
  { icon: Bot, title: "AI Тьютор", desc: "Механика бойынша 24/7 жеке көмекші, тек қазақ тілінде жауап береді." },
  { icon: Gamepad2, title: "Интерактивті ойындар", desc: "Әр сабақта сәйкестендіру, жады, флэш-карточка және басқа да ойындар." },
  { icon: BarChart3, title: "Оқу аналитикасы", desc: "Прогресс, құзыреттілік өсуі және белсенділік графиктер арқылы көрінеді." },
  { icon: Award, title: "Сертификаттар", desc: "QR-код арқылы расталатын электронды сертификаттар." },
  { icon: Trophy, title: "Көшбасшылар кестесі", desc: "Ұпай жинап, топтастарыңмен жарысыңыз." },
  { icon: ShieldCheck, title: "Құзыреттілік бағалау", desc: "10 критерий бойынша ғылыми негізделген рубрика." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">М</div>
          <span className="font-bold">Механика AI LMS</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary text-sm">Кіру</Link>
          <Link href="/dashboard" className="btn-primary text-sm">Демо нұсқаны көру</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center md:py-24">
        <span className="badge mb-4">Магистрлік диссертация жобасы · ЖИ негізіндегі білім беру</span>
        <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">
          Механиканы қашықтықтан оқыту үшін
          <span className="bg-gradient-to-r from-brand-500 to-indigo-600 bg-clip-text text-transparent"> жасанды интеллект</span> негізіндегі платформа
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-slate-600 dark:text-slate-300">
          Студенттердің ақпараттық-коммуникативтік құзыреттілігін қалыптастыруға арналған,
          10 сабақтан тұратын, AI тьютор, интерактивті ойындар және құзыреттілікке негізделген
          бағалау жүйесі бар заманауи оқыту ортасы.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard" className="btn-primary">
            <Rocket size={18} /> Студент ретінде бастау
          </Link>
          <Link href="/teacher" className="btn-secondary">
            Оқытушы дашбордын көру
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card">
              <f.icon className="mb-3 text-brand-500" size={28} />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-6 text-center text-2xl font-bold">10 оқу сабағы</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {ALL_MODULES.map((m) => (
            <Link
              key={m.id}
              href={`/modules/${m.id}`}
              className={`rounded-xl2 bg-gradient-to-br ${m.colorFrom} ${m.colorTo} p-4 text-white shadow-md transition hover:-translate-y-1`}
            >
              <p className="text-xs opacity-80">Сабақ {m.id}</p>
              <p className="mt-1 font-semibold">{m.title}</p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200/60 px-6 py-8 text-center text-xs text-slate-400 dark:border-white/10">
        © {new Date().getFullYear()} Механика AI LMS — Ахмет Ясауи атындағы университет. Магистрлік зерттеу жобасы.
      </footer>
    </div>
  );
}
