import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { RequireAuth } from "@/components/auth/RequireAuth";
import type { UserRole } from "@/lib/types";

export function DashboardShell({
  children,
  /** Pass "teacher" on teacher-only pages; omit for anything a student may see. */
  role,
}: {
  children: React.ReactNode;
  role?: UserRole;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* min-w-0 is load-bearing: a flex item defaults to min-width:auto, so
          without it one wide child — a table, a long unbroken word — cannot
          shrink and instead widens the whole shell. On a 320 px phone that
          pushed the page out to 864 px and took the fixed background with it. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <RequireAuth role={role}>{children}</RequireAuth>
        </main>
      </div>
    </div>
  );
}
