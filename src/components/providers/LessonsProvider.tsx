"use client";

// The lessons as the signed-in user should see them.
//
// Loaded once per session rather than per page: the override set is small,
// changes rarely, and fetching it on every lesson open would put a round trip
// in front of content that is already in the bundle. Pages read the merged
// list through useLessons() and never touch ALL_MODULES directly.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ALL_MODULES } from "@/data/modules";
import { applyPatch } from "@/lib/lessonContent";
import { useAuthStore } from "@/lib/authStore";
import { loadMyOverrides, type OverrideMap } from "@/lib/supabase/content";
import type { LessonModule } from "@/lib/types";

interface LessonsApi {
  modules: LessonModule[];
  byId: (id: number) => LessonModule | undefined;
  /** Which lessons the teacher has edited — used to mark them in the UI. */
  overridden: Set<number>;
  loading: boolean;
  reload: () => void;
}

const LessonsContext = createContext<LessonsApi>({
  modules: ALL_MODULES,
  byId: (id) => ALL_MODULES.find((m) => m.id === id),
  overridden: new Set(),
  loading: false,
  reload: () => {},
});

export function LessonsProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setOverrides({});
      return;
    }
    setLoading(true);
    loadMyOverrides(user)
      .then((o) => {
        if (!cancelled) setOverrides(o);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, nonce]);

  const value = useMemo<LessonsApi>(() => {
    const modules = ALL_MODULES.map((m) => applyPatch(m, overrides[m.id]));
    const byId = (id: number) => modules.find((m) => m.id === id);
    // Only count a patch that actually carries a field; an empty object is a
    // teacher who opened the editor and saved without changing anything.
    const overridden = new Set(
      Object.entries(overrides)
        .filter(([, p]) => Object.keys(p ?? {}).length > 0)
        .map(([id]) => Number(id))
    );
    return { modules, byId, overridden, loading, reload: () => setNonce((n) => n + 1) };
  }, [overrides, loading]);

  return <LessonsContext.Provider value={value}>{children}</LessonsContext.Provider>;
}

export function useLessons() {
  return useContext(LessonsContext);
}
