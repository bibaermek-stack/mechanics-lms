import Link from "next/link";

/**
 * What a panel shows when the student has not produced the data it charts.
 *
 * A chart of zeros looks like a bad result; a blank box looks like a bug.
 * Neither is true for a new account, so say which action would fill it.
 */
export function EmptyState({
  title,
  hint,
  href,
  cta,
  compact = false,
}: {
  title: string;
  hint?: string;
  href?: string;
  cta?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/60 text-center dark:border-white/10 ${
        compact ? "p-6" : "p-10"
      }`}
    >
      <p className="text-label font-semibold text-slate-700 dark:text-slate-300">{title}</p>
      {hint && (
        <p className="mt-1.5 max-w-sm text-micro text-slate-500 dark:text-slate-400">{hint}</p>
      )}
      {href && cta && (
        <Link href={href} className="btn-secondary mt-4 px-4 py-2 text-sm">
          {cta}
        </Link>
      )}
    </div>
  );
}
