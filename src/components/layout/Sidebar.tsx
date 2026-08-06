"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuthStore } from "@/lib/authStore";
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  BarChart3,
  Award,
  Trophy,
  User,
  Users,
  ClipboardList,
  Video,
  Settings,
} from "lucide-react";

const STUDENT_LINKS = [
  { href: "/dashboard", label: "Басты бет", icon: LayoutDashboard },
  { href: "/modules", label: "Сабақтар", icon: BookOpen },
  { href: "/ai-tutor", label: "AI Тьютор", icon: Bot },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/certificates", label: "Сертификаттар", icon: Award },
  { href: "/leaderboard", label: "Көшбасшылар кестесі", icon: Trophy },
  { href: "/profile", label: "Профиль", icon: User },
];

const TEACHER_LINKS = [
  { href: "/teacher", label: "Басты бет", icon: LayoutDashboard },
  { href: "/teacher/students", label: "Студенттер", icon: Users },
  { href: "/teacher/lessons", label: "Сабақтарды басқару", icon: Video },
  { href: "/teacher/assignments", label: "Тапсырмаларды тексеру", icon: ClipboardList },
  { href: "/teacher/analytics", label: "Есептер мен аналитика", icon: BarChart3 },
  { href: "/profile", label: "Профиль", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role) ?? "student";
  const links = role === "teacher" ? TEACHER_LINKS : STUDENT_LINKS;

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-slate-200/60 bg-white/60 p-4 dark:border-white/10 dark:bg-slate-900/40 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">М</div>
        <div>
          <p className="text-sm font-bold leading-tight">Механика AI</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">LMS платформасы</p>
        </div>
      </div>
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active
                ? "bg-brand-500 text-white shadow-md"
                : "text-slate-600 hover:bg-brand-50 dark:text-slate-300 dark:hover:bg-white/5"
            )}
          >
            <Icon size={18} />
            {link.label}
          </Link>
        );
      })}
    </aside>
  );
}
