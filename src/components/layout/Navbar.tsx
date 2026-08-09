"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Moon, Sun, Search, Menu } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import { Badge } from "@/components/ui/Badge";
import { signOut } from "@/lib/supabase/accounts";

// Notification kinds are labelled in words, so the meaning does not depend on
// an emoji rendering the same way on every device.
const NOTIFICATIONS: { tag: string; variant: "default" | "success"; text: string }[] = [
  { tag: "Тапсырма", variant: "default", text: "«Кинематика» модулінің викторинасын аяқтаңыз." },
  { tag: "Кері байланыс", variant: "success", text: "БӨЖ тапсырмаңызға оқытушы пікір қалдырды." },
];

export function Navbar() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const darkMode = useAuthStore((s) => s.darkMode);
  const toggleDarkMode = useAuthStore((s) => s.toggleDarkMode);
  const [notifOpen, setNotifOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    // Clear locally too: in mock mode there is no auth event to react to.
    setUser(null);
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-2.5 dark:border-white/10 dark:bg-slate-900 md:px-6">
      <div className="flex items-center gap-3">
        <button className="btn-ghost md:hidden" aria-label="Мәзір">
          <Menu size={20} />
        </button>
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5 md:flex">
          <Search size={16} className="text-slate-500" />
          <input
            placeholder="Сабақтардан, терминдерден іздеу..."
            aria-label="Іздеу"
            className="w-64 bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button onClick={toggleDarkMode} className="btn-ghost" aria-label="Түнгі режим">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="btn-ghost"
            aria-label={`Хабарландырулар (${NOTIFICATIONS.length})`}
            aria-expanded={notifOpen}
          >
            <Bell size={18} />
            {/* Count, not a bare dot: it says how many without needing colour. */}
            <span className="data-num ml-0.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white">
              {NOTIFICATIONS.length}
            </span>
          </button>
          {notifOpen && (
            <div className="surface-raised absolute right-0 mt-2 w-80 p-3">
              <p className="mb-2 text-label uppercase text-slate-500 dark:text-slate-400">
                Хабарландырулар
              </p>
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {NOTIFICATIONS.map((n) => (
                  <li key={n.text} className="flex items-start gap-2.5 py-2.5 first:pt-0 last:pb-0">
                    <Badge variant={n.variant}>{n.tag}</Badge>
                    <p className="text-body text-slate-700 dark:text-slate-200">{n.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 dark:border-white/10">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
            {user?.fullName?.charAt(0) ?? "?"}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight">{user?.fullName ?? "Қонақ"}</p>
            <p className="text-micro text-slate-500 dark:text-slate-400">
              {/* The shareable code sits next to the role because this is where
                  people look when somebody asks "коды қандай?". */}
              {user?.role === "teacher" ? "Оқытушы" : "Студент"}
              {user?.userCode ? ` · ${user.userCode}` : ""}
            </p>
          </div>
        </div>
        <button onClick={handleSignOut} className="btn-ghost" aria-label="Шығу" title="Шығу">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
