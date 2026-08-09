"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { ALL_MODULES } from "@/data/modules";
import { Save, Youtube } from "lucide-react";

const LS_KEY = "mechanics-lms:videoOverrides";

export default function TeacherLessonsPage() {
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [savedFlash, setSavedFlash] = useState<number | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) setOverrides(JSON.parse(raw));
  }, []);

  function handleSave(moduleId: number, value: string) {
    const next = { ...overrides, [moduleId]: value };
    setOverrides(next);
    window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    setSavedFlash(moduleId);
    setTimeout(() => setSavedFlash(null), 1500);
  }

  return (
    <DashboardShell role="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-h1">Сабақтарды басқару</h1>
          <p className="text-body text-slate-600 dark:text-slate-400">
            Әр сабақтың YouTube бейнесін кодты өзгертпей-ақ ауыстыруға болады. (Демо режимде өзгеріс браузерде сақталады;
            өндірістік нұсқада Firestore-дың <code>videos</code> коллекциясына жазылады.)
          </p>
        </div>

        <div className="grid gap-4">
          {ALL_MODULES.map((m) => {
            const current = overrides[m.id] ?? m.youtubeId;
            return (
              <Card key={m.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Youtube className="text-rose-500" />
                  <div>
                    <p className="font-semibold">Сабақ {m.id}: {m.title}</p>
                    <p className="text-micro text-slate-600">Ағымдағы ID: {current}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    defaultValue={current}
                    onBlur={(e) => handleSave(m.id, e.target.value)}
                    className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-white/5"
                    placeholder="YouTube video ID"
                  />
                  <button
                    onClick={(e) => {
                      const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                      handleSave(m.id, input.value);
                    }}
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                  >
                    <Save size={14} /> {savedFlash === m.id ? "Сақталды" : "Сақтау"}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardShell>
  );
}
