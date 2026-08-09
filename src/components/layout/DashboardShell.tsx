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
      <div className="flex min-h-screen flex-1 flex-col">
        <Navbar />
        <main className="flex-1 p-4 md:p-6">
          <RequireAuth role={role}>{children}</RequireAuth>
        </main>
      </div>
    </div>
  );
}
