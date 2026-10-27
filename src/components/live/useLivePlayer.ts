"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlayerClient, type PlayerView } from "@/lib/liveQuizRuntime";
import { createTransport } from "@/lib/liveQuizTransport";

/** A random secret that stays on this phone; kept for the tab's life so a refresh rejoins as the same player. */
function tokenFor(code: string): string {
  const key = `live-token-${code}`;
  try {
    const have = sessionStorage.getItem(key);
    if (have) return have;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

export function useLivePlayer() {
  const client = useRef<PlayerClient | null>(null);
  const [view, setView] = useState<PlayerView | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [alias, setAlias] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waited, setWaited] = useState(false);

  const leave = useCallback(() => {
    client.current?.close();
    client.current = null;
    setView(null);
    setAlias(null);
    setWaited(false);
  }, []);

  const join = useCallback(
    (code: string, name: string) => {
      leave();
      try {
        const c = new PlayerClient(createTransport(code), code, tokenFor(code), name);
        client.current = c;
        c.subscribe(setView);
        setView(c.view);
        setAlias(c.alias);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Қосылмады");
      }
    },
    [leave]
  );

  const answer = useCallback((choice: number) => client.current?.answer(choice), []);

  // The countdown, and a repeated request to join until the teacher's list has this phone on it.
  const active = view !== null;
  useEffect(() => {
    if (!active) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const c = client.current;
      if (!c) return;
      setRemaining(c.remainingMs());
      if (!c.view.joined) {
        c.join();
        if (Date.now() - started > 5000) setWaited(true);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => () => client.current?.close(), []);

  return { view, remaining, alias, error, waited, join, leave, answer };
}
