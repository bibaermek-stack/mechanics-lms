"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppUser, TeacherLink } from "@/lib/types";
import { listLinks, partitionLinks } from "@/lib/supabase/links";

/**
 * Loads every edge touching `me` and splits it four ways. `reload` is passed
 * down to the action buttons so the lists re-settle after an accept, a decline
 * or a withdrawal without the caller threading state through.
 */
export function useLinks(me: AppUser | null) {
  const [links, setLinks] = useState<TeacherLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!me) return;
    try {
      setError(null);
      setLinks(await listLinks(me));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Байланыстарды жүктеу мүмкін болмады");
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { links, ...partitionLinks(links), loading, error, reload };
}
