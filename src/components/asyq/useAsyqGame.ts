"use client";

import { useEffect, useState } from "react";
import { AsyqGame } from "@/lib/asyq/game";
import type { RuleConfig } from "@/lib/asyq/rules";

/**
 * Loads the physics engine and creates a game for these rules. `version` changes whenever the game
 * does, so a component that reads the game re-renders exactly then and not once a frame.
 */
export function useAsyqGame(config: RuleConfig | null) {
  const [game, setGame] = useState<AsyqGame | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) {
      setGame(null);
      return;
    }
    let live = true;
    let off: (() => void) | undefined;
    setError(null);
    AsyqGame.create(config, true)
      .then((g) => {
        if (!live) return;
        off = g.subscribe(() => setVersion((v) => v + 1));
        g.start();
        setGame(g);
        setVersion((v) => v + 1);
      })
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
      off?.();
    };
  }, [config]);

  return { game, version, error };
}
