"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import { EXPERIMENTS } from "@/lib/sensors/experiments";
import type { SensorKind } from "@/lib/types";
import { ExperimentPanel } from "./ExperimentPanel";

const SHORT: Record<SensorKind, string> = {
  "rest-g": "g өлшеу",
  jump: "Секіру",
  pendulum: "Маятник",
  elevator: "Лифт",
};

/** The phone laboratory: four experiments, one at a time. */
export function SensorLab() {
  const user = useAuthStore((s) => s.user);
  const [kind, setKind] = useState<SensorKind>("rest-g");
  if (!user) return null;
  const exp = EXPERIMENTS.find((e) => e.kind === kind)!;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Тәжірибелер">
        {EXPERIMENTS.map((e) => (
          <button
            key={e.kind}
            role="tab"
            aria-selected={e.kind === kind}
            onClick={() => setKind(e.kind)}
            className={`min-h-[44px] rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              e.kind === kind ? "bg-brand-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            {SHORT[e.kind]}
          </button>
        ))}
      </div>
      <h2 className="text-h2 text-slate-900 dark:text-white">{exp.title}</h2>
      <ExperimentPanel key={kind} exp={exp} user={user} />
    </div>
  );
}
