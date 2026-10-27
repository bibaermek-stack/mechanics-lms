"use client";

import { Badge } from "@/components/ui/Badge";
import type { ReviewStatus } from "@/lib/community";

export const FIELD =
  "mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder:text-slate-400 dark:border-white/15 dark:bg-white/5 dark:text-white";

export function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "approved") return <Badge variant="success">Мақұлданды</Badge>;
  if (status === "rejected") return <Badge variant="danger">Қабылданбады</Badge>;
  return <Badge variant="warning">Мұғалім тексеруде</Badge>;
}

/** A counter under a text box: 12 / 80. Red outside the allowed range. */
export function Count({ value, min, max }: { value: string; min?: number; max: number }) {
  const n = [...value.trim()].length;
  const bad = n > max || (min !== undefined && n > 0 && n < min);
  return (
    <span className={`data-num text-micro ${bad ? "text-rose-500" : "text-slate-500 dark:text-slate-400"}`}>
      {n} / {max}
    </span>
  );
}

export function lessonLabel(modules: { id: number; title: string }[], id: number) {
  return `${id}. ${modules.find((m) => m.id === id)?.title ?? "Сабақ"}`;
}
