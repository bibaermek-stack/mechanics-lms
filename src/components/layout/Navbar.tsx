"use client";

import { useState } from "react";
import { Bell, Moon, Sun, Search, Menu } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const darkMode = useAuthStore((s) => s.darkMode);
  const toggleDarkMode = useAuthStore((s) => s.toggleDarkMode);
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200/60 bg-white/70 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60 md:px-6">
      <div className="flex items-center gap-3">
        <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/10 md:hidden">
          <Menu size={20} />
        </button>
        <div className="hidden items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/5 md:flex">
          <Search size={16} className="text-slate-400" />
          <input
            placeholder="Сабақтардан, терминдерден іздеу..."
            className="w-64 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleDarkMode}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          aria-label="Түнгі режим"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            aria-label="Хабарландырулар"
          >
            <Bell size={18} />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-slate-800">
              <p className="mb-2 text-sm font-semibold">Хабарландырулар</p>
              <div className="space-y-2 text-sm">
                <p className="rounded-lg bg-brand-50 p-2 dark:bg-white/5">
                  🎯 «Кинематика» модулінің викторинасын аяқтаңыз.
                </p>
                <p className="rounded-lg bg-emerald-50 p-2 dark:bg-white/5">
                  ✅ БӨЖ тапсырмаңызға оқытушы кері байланыс қалдырды.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-2 py-1.5 dark:bg-white/5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
            {user?.fullName?.charAt(0) ?? "?"}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight">{user?.fullName ?? "Қонақ"}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {user?.role === "teacher" ? "Оқытушы" : "Студент"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
