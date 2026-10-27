"use client";

import { DashboardShell } from "@/components/layout/DashboardShell";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { HostPanel } from "@/components/live/HostPanel";
import { useAuthStore } from "@/lib/authStore";

/** The teacher runs a live quiz from here, on a screen the class can see. */
export default function TeacherLivePage() {
  const user = useAuthStore((s) => s.user);
  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <SectionHeader as="h1" title="Тікелей викторина" description="Бөлме аш, кодты экранға шығар, оқушылар телефонынан қосылады." />
        {user && user.role !== "teacher" ? <p className="text-body text-slate-600 dark:text-slate-400">Бұл бет мұғалімдерге арналған.</p> : <HostPanel />}
      </div>
    </DashboardShell>
  );
}
