"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppUser, TeacherLink } from "@/lib/types";
import { listFriendLinks } from "@/lib/supabase/friends";
import { partitionLinks } from "@/lib/supabase/links";

/**
 * The friendship counterpart of useLinks. Same split, same reload contract, so
 * a page can render both graphs with one set of components.
 */
export function useFriends(me: AppUser | null) {
  const [links, setLinks] = useState<TeacherLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    // Friendship is a student-only graph; a teacher has no list to load.
    if (!me || me.role !== "student") {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setLinks(await listFriendLinks(me));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Достарды жүктеу мүмкін болмады");
    } finally {
      setLoading(false);
    }
  }, [me]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { links, ...partitionLinks(links), loading, error, reload };
}
