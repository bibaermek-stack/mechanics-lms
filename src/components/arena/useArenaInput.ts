"use client";

// Keyboard and touch controls for the arena.
//
// The current input lives in a ref rather than in state: the match loop reads it
// sixty times a second, and re-rendering React on every key press would cost far
// more than the game itself.
//
// Which key does what comes from the player's own map — see keybindings.ts — so
// everything here is written against actions, never against particular keys.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArenaAction, Keymap } from "@/lib/arena/keybindings";
import { DEFAULT_KEYMAP, toLookup } from "@/lib/arena/keybindings";
import type { Input } from "@/lib/arena/types";

type Held = Record<ArenaAction, 0 | 1>;

const NONE: Held = { up: 0, left: 0, down: 0, right: 0, kick: 0, sprint: 0 };

export interface ArenaInput {
  /** Read by the match loop every step. */
  ref: React.MutableRefObject<Input>;
  /** True once a touch control has been used, so the pad can stay visible. */
  touch: boolean;
  /** Handlers for the on-screen pad. */
  press: (action: ArenaAction, down: boolean) => void;
  /** Which controls are held right now — for lighting up the on-screen hints. */
  active: Held;
}

export function useArenaInput(enabled = true, keymap: Keymap = DEFAULT_KEYMAP): ArenaInput {
  const ref = useRef<Input>({ dx: 0, dy: 0, kick: false, sprint: false });
  const held = useRef<Held>({ ...NONE });
  const [touch, setTouch] = useState(false);
  // Mirrored into state only so the legend can highlight; the loop never reads it.
  const [active, setActive] = useState<Held>({ ...NONE });

  const lookup = useMemo(() => toLookup(keymap), [keymap]);

  const apply = useCallback(() => {
    const h = held.current;
    ref.current = {
      dx: (h.right ? 1 : 0) - (h.left ? 1 : 0),
      dy: (h.down ? 1 : 0) - (h.up ? 1 : 0),
      kick: h.kick > 0,
      sprint: h.sprint > 0,
    };
    setActive({ ...h });
  }, []);

  const press = useCallback(
    (action: ArenaAction, down: boolean) => {
      held.current[action] = down ? 1 : 0;
      setTouch(true);
      apply();
    },
    [apply]
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      const action = lookup.get(e.code);
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
      held.current = { ...NONE };
      apply();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
      // Rebinding mid-match must not leave the old key stuck down.
      held.current = { ...NONE };
      apply();
    };
  }, [enabled, apply, lookup]);

  return { ref, touch, press, active };
}
