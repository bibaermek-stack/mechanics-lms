"use client";

// Gate for everything behind the dashboard shell.
//
// Roles are not decoration here: a teacher screen shows other people's grades,
// so a student landing on /teacher must be turned away rather than shown an
// empty table. The real enforcement is in the database (RLS), this is the part
// that keeps the UI honest about it.

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
import type { UserRole } from "@/lib/types";

export function RequireAuth({
  children,
  role,
}: {
  children: React.ReactNode;
  /** Restrict to one role. Omit to allow any signed-in user. */
  role?: UserRole;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading || user) return;
    // Carry the destination so login can return the person to where they aimed.
    const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [loading, user, pathname, router]);

  if (loading || !user) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-56 animate-none rounded-lg bg-slate-200/70 dark:bg-white/10" />
        <div className="h-40 rounded-2xl bg-slate-200/50 dark:bg-white/5" />
        <div className="h-40 rounded-2xl bg-slate-200/50 dark:bg-white/5" />
        <span className="sr-only">Жүктелуде…</span>
      </div>
    );
  }

  if (role && user.role !== role) {
    return (
      <div className="glass glass-lit mx-auto mt-10 max-w-md rounded-3xl2 p-8 text-center">
        <ShieldAlert size={28} className="mx-auto text-amber-400" />
        <h1 className="mt-4 text-h2 text-slate-900 dark:text-white">Бұл бөлім сізге арналмаған</h1>
        <p className="mt-2 text-body text-slate-600 dark:text-slate-400">
          Бұл бет {role === "teacher" ? "оқытушыларға" : "студенттерге"} арналған. Сіз{" "}
          {user.role === "teacher" ? "оқытушы" : "студент"} ретінде кірдіңіз.
        </p>
        <Link
          href={user.role === "teacher" ? "/teacher" : "/dashboard"}
          className="btn-primary mt-6 inline-flex"
        >
          Өз бетіме оралу
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
