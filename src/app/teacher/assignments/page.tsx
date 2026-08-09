"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getAssignmentSubmissions } from "@/lib/dataStore";
import { getModuleById } from "@/data/modules";
import type { AssignmentSubmission } from "@/lib/types";

export default function TeacherAssignmentsPage() {
  const [subs, setSubs] = useState<AssignmentSubmission[]>([]);

  useEffect(() => {
    getAssignmentSubmissions().then(setSubs);
  }, []);

  return (
    <DashboardShell role="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-h1">Тапсырмаларды тексеру</h1>
          <p className="text-body text-slate-600 dark:text-slate-400">Студенттердің БӨЖ тапсырмаларына баға мен кері байланыс қойыңыз.</p>
        </div>

        {subs.length === 0 ? (
          <div className="surface-card text-center text-body text-slate-600 dark:text-slate-400">
            Әзірге жіберілген тапсырма жоқ. Студент сабақ ішіндегі «БӨЖ тапсырмасы» бөлімінен жіберген соң, осында пайда болады.
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map((s) => {
              const mod = getModuleById(s.moduleId);
              return (
                <Card key={s.id}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{mod?.title ?? `Сабақ ${s.moduleId}`}</p>
                    <Badge variant={s.status === "reviewed" ? "success" : "warning"}>
                      {s.status === "reviewed" ? "Тексерілді" : "Күтуде"}
                    </Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{s.content}</p>
                  <p className="mt-2 text-micro text-slate-600">Жіберілген: {new Date(s.submittedAt).toLocaleString("kk-KZ")}</p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
