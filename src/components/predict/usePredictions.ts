"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import { getPredictions, savePrediction } from "@/lib/dataStore";
import type { PredictionAttempt } from "@/lib/types";

/** The signed-in student's predictions, newest first, and a way to add one. */
export function usePredictions() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<PredictionAttempt[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getPredictions(user.uid)
      .then((r) => !cancelled && setRows(r))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const record = useCallback(async (a: PredictionAttempt) => {
    await savePrediction(a);
    setRows((r) => [a, ...(r ?? [])]);
  }, []);

  return { rows, record, user };
}
