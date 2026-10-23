import Link from "next/link";
import clsx from "clsx";
import { Badge } from "./Badge";

/**
 * Lesson identity used by the landing page, the dashboard and the lesson list.
 *
 * Each lesson previously carried its own gradient (ten unrelated colour pairs).
 * Those said nothing about the lesson and clashed with each other, so identity
 * is now the lesson *number*, set large in tabular figures, with colour
 * reserved for state: completed vs still to do.
 */
export function LessonCard({
  id,
  title,
  description,
  length,
  done = false,
  compact = false,
}: {
  id: number;
  title: string;
  description?: string;
  /** Running time of the lesson film, already formatted. */
  length?: string;
  done?: boolean;
  /** Tighter variant for dense grids (landing page). */
  compact?: boolean;
}) {
  return (
    <Link
      href={`/modules/${id}`}
      className={clsx(
        "surface group relative block overflow-hidden transition-colors",
        "hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-400/40 dark:hover:bg-white/[0.04]",
        compact ? "p-4" : "p-5"
      )}
    >
      <span
        className={clsx(
          "absolute inset-y-0 left-0 w-1",
          done ? "bg-emerald-500" : "bg-slate-200 group-hover:bg-brand-400 dark:bg-white/10"
        )}
      />
      <div className="flex items-start gap-3 pl-2">
        <span
          className={clsx(
            "data-num shrink-0 tabular-nums",
            compact ? "text-data-sm" : "text-data",
            done ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"
          )}
        >
          {String(id).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-h3 text-slate-900 dark:text-white">{title}</p>
          {description && !compact && (
            <p className="mt-1 line-clamp-2 text-body text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
      </div>

      {!compact && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 pl-2 dark:border-white/5">
          {done ? (
            <Badge variant="success">Аяқталды</Badge>
          ) : (
            <Badge variant="neutral">Оқу керек</Badge>
          )}
          {length !== undefined && (
            <span className="data-num text-micro text-slate-500 dark:text-slate-400">
              {length}
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
