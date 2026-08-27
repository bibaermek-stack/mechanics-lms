"use client";

// The arena's key map, and the ability to change it.
//
// Bindings are stored by `KeyboardEvent.code`, not by `key`. A code is the
// physical position of the key, so W is the key above S whether the keyboard is
// set to Latin, Cyrillic or anything else — binding by `key` would break the
// moment a student switched layout mid-match, which on a Kazakh keyboard is
// something they do constantly.

import { useCallback, useEffect, useState } from "react";

export type ArenaAction = "up" | "left" | "down" | "right" | "kick" | "sprint";

/** The order the controls card lists them in. */
export const ACTIONS: ArenaAction[] = ["up", "left", "down", "right", "kick", "sprint"];

export const ACTION_LABELS: Record<ArenaAction, string> = {
  up: "Жоғары",
  left: "Солға",
  down: "Төмен",
  right: "Оңға",
  kick: "Тебу",
  sprint: "Екпін",
};

/** What each control does, in the language of the lesson. */
export const ACTION_HINTS: Record<ArenaAction, string> = {
  up: "Жоғары бағытта күш салу",
  left: "Солға бағытта күш салу",
  down: "Төмен бағытта күш салу",
  right: "Оңға бағытта күш салу",
  kick: "Допқа импульс беру (J = 4 Н·с)",
  sprint: "Қозғаушы күшті 1,9 есе арттыру — қор таусылғанша",
};

export type Keymap = Record<ArenaAction, string[]>;

export const DEFAULT_KEYMAP: Keymap = {
  up: ["KeyW", "ArrowUp"],
  left: ["KeyA", "ArrowLeft"],
  down: ["KeyS", "ArrowDown"],
  right: ["KeyD", "ArrowRight"],
  kick: ["Space", "KeyX"],
  sprint: ["ShiftLeft", "ShiftRight"],
};

/** At most this many keys per action, so the card stays one row per control. */
const MAX_PER_ACTION = 2;

const STORAGE_KEY = "arena.keymap.v1";

function clone(map: Keymap): Keymap {
  return Object.fromEntries(ACTIONS.map((a) => [a, [...map[a]]])) as Keymap;
}

/**
 * A stored map, repaired against the defaults.
 *
 * An action left with no keys — by a half-finished edit, or by a map saved
 * before an action existed — falls back to its default rather than becoming
 * unusable. Losing the kick key with no way to get it back would strand the
 * player mid-match.
 */
export function normaliseKeymap(raw: unknown): Keymap {
  const out = clone(DEFAULT_KEYMAP);
  if (!raw || typeof raw !== "object") return out;
  const source = raw as Record<string, unknown>;
  for (const action of ACTIONS) {
    const codes = source[action];
    if (!Array.isArray(codes)) continue;
    const clean = codes.filter((c): c is string => typeof c === "string" && c.length > 0);
    if (clean.length > 0) out[action] = clean.slice(0, MAX_PER_ACTION);
  }
  return out;
}

export function loadKeymap(): Keymap {
  if (typeof window === "undefined") return clone(DEFAULT_KEYMAP);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normaliseKeymap(JSON.parse(raw)) : clone(DEFAULT_KEYMAP);
  } catch {
    return clone(DEFAULT_KEYMAP);
  }
}

export function saveKeymap(map: Keymap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // A browser with storage disabled still plays; it just forgets the map.
  }
}

/**
 * Binds `code` to `action`, taking it off whatever else held it.
 *
 * One key driving two controls is never what someone meant, and it is worse
 * than the collision they were trying to create: pressing it would kick and run
 * at once with no way to tell which they asked for.
 */
export function bindKey(map: Keymap, action: ArenaAction, code: string): Keymap {
  const next = clone(map);
  for (const other of ACTIONS) {
    next[other] = next[other].filter((c) => c !== code);
  }
  next[action] = [code, ...next[action]].slice(0, MAX_PER_ACTION);
  // The action it was taken from must not be left with nothing to press.
  for (const other of ACTIONS) {
    if (next[other].length === 0) {
      next[other] = DEFAULT_KEYMAP[other].filter((c) => c !== code);
      if (next[other].length === 0) next[other] = [];
    }
  }
  return next;
}

/** Reverse index: code → action, which is what the input hook actually reads. */
export function toLookup(map: Keymap): Map<string, ArenaAction> {
  const out = new Map<string, ArenaAction>();
  for (const action of ACTIONS) {
    for (const code of map[action]) out.set(code, action);
  }
  return out;
}

const NAMED: Record<string, string> = {
  Space: "Бос орын",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ShiftLeft: "Shift",
  ShiftRight: "Shift оң",
  ControlLeft: "Ctrl",
  ControlRight: "Ctrl оң",
  AltLeft: "Alt",
  AltRight: "Alt оң",
  Enter: "Enter",
  Tab: "Tab",
  Backquote: "`",
  Minus: "−",
  Equal: "=",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
};

/** A key code as it should read on a cap. */
export function keyLabel(code: string): string {
  if (NAMED[code]) return NAMED[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

/** Keys the game refuses to take over, because the browser needs them more. */
const RESERVED = new Set(["Escape", "F5", "F11", "F12", "MetaLeft", "MetaRight"]);

export function isBindable(code: string): boolean {
  return Boolean(code) && !RESERVED.has(code);
}

/** The map plus its setters, kept in one place so the game and the card agree. */
export function useKeymap() {
  const [keymap, setKeymap] = useState<Keymap>(DEFAULT_KEYMAP);

  // Read on mount rather than in the initialiser: localStorage does not exist
  // while the page is being rendered on the server, and a first paint that
  // disagreed with the second would be a hydration mismatch.
  useEffect(() => setKeymap(loadKeymap()), []);

  const bind = useCallback((action: ArenaAction, code: string) => {
    setKeymap((prev) => {
      const next = bindKey(prev, action, code);
      saveKeymap(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = clone(DEFAULT_KEYMAP);
    saveKeymap(next);
    setKeymap(next);
  }, []);

  return { keymap, bind, reset };
}
