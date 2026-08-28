"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, AlertTriangle, Filter, Sparkles, Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { ActionItem } from "@/lib/types";

const SEVERITY: Record<
  ActionItem["severity"],
  { label: string; variant: "danger" | "warning" | "neutral"; rule: string }
> = {
  critical: { label: "Шұғыл", variant: "danger", rule: "bg-rose-500" },
  warning: { label: "Назар аудар", variant: "warning", rule: "bg-amber-500" },
  info: { label: "Ұсыныс", variant: "neutral", rule: "bg-slate-300 dark:bg-white/20" },
};

export function ActionList({
  items,
  emptyMessage = "Қазір назар аударуды қажет ететін мәселе жоқ.",
}: {
  items: ActionItem[];
  emptyMessage?: string;
}) {
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});
  const [filterKind, setFilterKind] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [notificationSent, setNotificationSent] = useState(false);

  const toggleComplete = (id: string) => {
    setCompletedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const kinds = Array.from(new Set(items.map((it) => it.kind)));

  const filteredItems = items.filter((it) => {
    if (filterKind !== "all" && it.kind !== filterKind) return false;
    if (filterSeverity !== "all" && it.severity !== filterSeverity) return false;
    return true;
  });

  const completedCount = Object.values(completedIds).filter(Boolean).length;
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  if (items.length === 0) {
    return (
      <div className="surface-sunken p-6 text-center text-body text-slate-600 dark:text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Filter & Progress Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-micro font-semibold text-slate-500 dark:text-slate-400">
            <Filter size={14} /> Фильтр:
          </span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-micro font-medium text-slate-700 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">Барлық деңгей (Шұғыл & Ұсыныстар)</option>
            <option value="critical">Тек Шұғыл</option>
            <option value="warning">Назар аудару</option>
            <option value="info">Ұсыныс</option>
          </select>

          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-micro font-medium text-slate-700 outline-none focus:border-brand-500 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="all">Барлық санаттар</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Action Notification Button */}
          <button
            onClick={() => {
              setNotificationSent(true);
              setTimeout(() => setNotificationSent(false), 3000);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1 text-micro font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-300"
          >
            <Send size={13} />
            {notificationSent ? "Хабарлама жіберілді!" : "Студенттерге ескерту жіберу"}
          </button>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <span className="text-micro font-medium text-slate-600 dark:text-slate-400">
              Орындалды: <strong>{completedCount} / {items.length}</strong>
            </span>
            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Items List */}
      <ol className="space-y-3">
        {filteredItems.map((it, i) => {
          const s = SEVERITY[it.severity];
          const isDone = Boolean(completedIds[it.id]);

          return (
            <li
              key={it.id}
              className={`surface relative overflow-hidden p-4 pl-5 transition-all ${
                isDone ? "opacity-60 bg-slate-50/50 dark:bg-slate-900/40" : ""
              }`}
            >
              <span className={`absolute inset-y-0 left-0 w-1 ${isDone ? "bg-slate-300 dark:bg-slate-700" : s.rule}`} />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleComplete(it.id)}
                    className="mr-1 text-slate-400 hover:text-brand-600 transition-colors"
                    title={isDone ? "Орындалмады деп белгілеу" : "Орындалды деп белгілеу"}
                  >
                    {isDone ? (
                      <CheckCircle2 size={20} className="text-emerald-500" />
                    ) : (
                      <Circle size={20} />
                    )}
                  </button>

                  <span className="data-num text-micro font-bold text-slate-400 dark:text-slate-500">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Badge variant={isDone ? "neutral" : s.variant}>{isDone ? "Орындалды" : s.label}</Badge>
                  <Badge variant="neutral">{it.kind}</Badge>
                </div>

                {it.severity === "critical" && !isDone && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                    <AlertTriangle size={12} /> Жоғары басымдық
                  </span>
                )}
              </div>

              <p className={`mt-2 text-h3 ${isDone ? "line-through text-slate-500" : ""}`}>
                {it.title}
              </p>
              <p className="mt-1 text-body text-slate-600 dark:text-slate-400">{it.evidence}</p>

              {it.names && it.names.length > 0 && (
                <p className="mt-1.5 text-micro text-slate-500 dark:text-slate-400">
                  Студенттер: <span className="font-semibold">{it.names.slice(0, 4).join(", ")}</span>
                  {it.names.length > 4 ? ` және тағы ${it.names.length - 4}` : ""}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
                <p className="text-body font-semibold text-slate-800 dark:text-slate-100">
                  {it.action}
                </p>
                {it.href && (
                  <Link
                    href={it.href}
                    className="-my-1.5 inline-flex shrink-0 items-center gap-1.5 py-1.5 text-body font-semibold text-brand-700 transition-colors hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
                  >
                    Өту <ArrowRight size={15} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default ActionList;
