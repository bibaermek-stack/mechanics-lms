"use client";

// One person in a list — search result, pending request or accepted link.
// Shared by the student and teacher screens so the two never drift apart.

import type { PersonSummary } from "@/lib/types";

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

export function PersonRow({
  person,
  subtitle,
  children,
}: {
  person: PersonSummary;
  /** Overrides the default "group · code" line. */
  subtitle?: React.ReactNode;
  /** Action buttons. */
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/60 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
      <Avatar name={person.fullName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
          {person.fullName}
        </p>
        <p className="mt-0.5 truncate text-micro text-slate-500 dark:text-slate-400">
          {subtitle ?? (
            <>
              {person.studyGroup ? `${person.studyGroup} · ` : ""}
              <span className="data-num">{person.userCode}</span>
            </>
          )}
        </p>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </li>
  );
}
