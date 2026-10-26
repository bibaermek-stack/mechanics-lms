"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppUser } from "@/lib/types";
import type { CohortData } from "@/lib/analytics/cohort";
import { loadCohort } from "@/lib/analytics/records";

/** The signed-in teacher's cohort, loaded once and reloadable on demand. */
export function useCohort(me: AppUser | null) {
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // Only a teacher has a cohort. Without this a student who reached the page
    // would be handed their *teachers* as "students".
    if (!me || me.role !== "teacher") return;
    setLoading(true);
    try {
      setError(null);
      setData(await loadCohort(me));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Аналитиканы жүктеу мүмкін болмады");
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}
