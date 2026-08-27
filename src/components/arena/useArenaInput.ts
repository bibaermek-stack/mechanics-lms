"use client";

// Keyboard and touch controls for the arena.
//
// The current input lives in a ref rather than in state: the match loop reads it
// sixty times a second, and re-rendering React on every key press would cost far
// more than the game itself.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Input } from "@/lib/arena/types";

const KEYS: Record<string, keyof typeof MOVES | "kick"> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  Space: "kick",
  KeyX: "kick",
  Enter: "kick",
};

const MOVES = { up: 0, down: 0, left: 0, right: 0 };

export interface ArenaInput {
  /** Read by the match loop every step. */
  ref: React.MutableRefObject<Input>;
  /** True once a touch control has been used, so the pad can stay visible. */
  touch: boolean;
  /** Handlers for the on-screen pad. */
  press: (dir: "up" | "down" | "left" | "right" | "kick", down: boolean) => void;
}

export function useArenaInput(enabled = true): ArenaInput {
  const ref = useRef<Input>({ dx: 0, dy: 0, kick: false });
  const held = useRef({ ...MOVES, kick: 0 });
  const [touch, setTouch] = useState(false);

  const apply = useCallback(() => {
    const h = held.current;
    ref.current = {
      dx: (h.right ? 1 : 0) - (h.left ? 1 : 0),
      dy: (h.down ? 1 : 0) - (h.up ? 1 : 0),
      kick: h.kick > 0,
    };
  }, []);

  const press = useCallback(
    (dir: "up" | "down" | "left" | "right" | "kick", down: boolean) => {
      held.current[dir] = down ? 1 : 0;
      setTouch(true);
      apply();
    },
    [apply]
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const action = KEYS[e.code];
      if (!action) return;
      // The arrows and space scroll the page otherwise, which throws the
      // canvas off screen mid-match.
      e.preventDefault();
      held.current[action] = down ? 1 : 0;
      apply();
    };
    const onDown = (e: KeyboardEvent) => onKey(e, true);
    const onUp = (e: KeyboardEvent) => onKey(e, false);
    // A window that loses focus mid-press would otherwise hold that key for ever.
    const onBlur = () => {
      held.current = { ...MOVES, kick: 0 };
      apply();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, apply]);

  return { ref, touch, press };
}
