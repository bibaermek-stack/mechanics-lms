"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useAuthStore } from "@/lib/authStore";
import {
  LayoutDashboard,
  BookOpen,
  Bot,
  FlaskConical,
  Headset,
  Gamepad2,
  BarChart3,
  Award,
  Trophy,
  Swords,
  User,
  UserPlus,
  Users,
  ClipboardList,
  Video,
  Settings,
  Calculator,
} from "lucide-react";

const STUDENT_LINKS = [
  { href: "/dashboard", label: "Басты бет", icon: LayoutDashboard },
  { href: "/modules", label: "Сабақтар", icon: BookOpen },
  { href: "/labs", label: "Зертханалық жұмыстар", icon: FlaskConical },
  { href: "/problems", label: "Есеп шығару", icon: Calculator },
  { href: "/vr-lab", label: "VR/AR зертхана", icon: Headset },
  { href: "/arena", label: "Арена", icon: Gamepad2 },
  { href: "/connections", label: "Менің оқытушым", icon: UserPlus },
  { href: "/duels", label: "Дуэльдер", icon: Swords },
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
  { href: "/labs", label: "Зертханалық жұмыстар", icon: FlaskConical },
  { href: "/problems", label: "Есеп шығару", icon: Calculator },
  { href: "/vr-lab", label: "VR/AR зертхана", icon: Headset },
  { href: "/arena", label: "Арена", icon: Gamepad2 },
  { href: "/teacher/assignments", label: "Тапсырмаларды тексеру", icon: ClipboardList },
  { href: "/teacher/analytics", label: "Есептер мен аналитика", icon: BarChart3 },
  { href: "/profile", label: "Профиль", icon: Settings },
];

/** The links for whoever is signed in. Shared by the rail and the drawer. */
export function useNavLinks() {
  const role = useAuthStore((s) => s.user?.role) ?? "student";
  return role === "teacher" ? TEACHER_LINKS : STUDENT_LINKS;
}

/**
 * The nav itself, without the shell around it.
 *
 * Exported so the phone drawer renders exactly these links rather than a second
 * copy that would drift out of step the first time a route was added.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const links = useNavLinks();
  return (
    <>
      {links.map((link) => {
        const Icon = link.icon;
        const active =
          pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(link.href));
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={clsx(
              // Active state is a left rule plus weight — no shadow, no motion.
              "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-200"
                : "border-transparent font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white"
            )}
          >
            <Icon size={17} className="shrink-0" />
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

/** The wordmark block at the top of both the rail and the drawer. */
export function NavBrand() {
  return (
    <div className="mb-5 flex items-center gap-2.5 px-2 pt-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-bold text-white">
          М
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Механика AI</p>
          <p className="text-micro text-slate-500 dark:text-slate-400">LMS платформасы</p>
        </div>
      </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-0.5 border-r border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-slate-900 md:flex">
      <NavBrand />
      <NavLinks />
    </aside>
  );
}
