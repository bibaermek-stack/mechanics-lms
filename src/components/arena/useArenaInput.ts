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
  /** Analogue drive from the thumb stick; (0, 0) means hands off. */
  setStick: (dx: number, dy: number) => void;
  /** Which controls are held right now — for lighting up the on-screen hints. */
  active: Held;
}

/**
 * True where the primary input is a finger.
 *
 * The touch controls must key off this rather than off a width breakpoint: a
 * phone held sideways is wider than a small laptop, and hiding the stick at
 * 768 px took the controls away exactly when the player rotated the handset to
 * play the game properly.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse)");
    const read = () => setCoarse(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return coarse;
}

export function useArenaInput(enabled = true, keymap: Keymap = DEFAULT_KEYMAP): ArenaInput {
  const ref = useRef<Input>({ dx: 0, dy: 0, kick: false, sprint: false });
  const held = useRef<Held>({ ...NONE });
  // The stick wins while it is deflected; the keys are what is left when it is
  // centred. Summing the two would let a phone player who also has a keyboard
  // exceed full deflection.
  const stick = useRef({ dx: 0, dy: 0, live: false });
  const [touch, setTouch] = useState(false);
  // Mirrored into state only so the legend can highlight; the loop never reads it.
  const [active, setActive] = useState<Held>({ ...NONE });

  const lookup = useMemo(() => toLookup(keymap), [keymap]);

  const apply = useCallback(() => {
    const h = held.current;
    const s = stick.current;
    ref.current = {
      dx: s.live ? s.dx : (h.right ? 1 : 0) - (h.left ? 1 : 0),
      dy: s.live ? s.dy : (h.down ? 1 : 0) - (h.up ? 1 : 0),
      kick: h.kick > 0,
      sprint: h.sprint > 0,
    };
    setActive({ ...h });
  }, []);

  const setStick = useCallback(
    (dx: number, dy: number) => {
      stick.current = { dx, dy, live: dx !== 0 || dy !== 0 };
      setTouch(true);
      apply();
    },
    [apply]
  );

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
      stick.current = { dx: 0, dy: 0, live: false };
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
      stick.current = { dx: 0, dy: 0, live: false };
      apply();
    };
  }, [enabled, apply, lookup]);

  return { ref, touch, press, setStick, active };
}
