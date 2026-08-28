"use client";

// Full-screen for the pitch.
//
// The native Fullscreen API is used where it exists, and there is a fallback
// because on iOS it does not: Safari on iPhone only ever grants full screen to a
// <video>, so asking a <div> for it there silently does nothing. When the API is
// missing the element is pinned over the page instead, which looks the same to a
// player even though the browser chrome stays.

import { useCallback, useEffect, useState } from "react";

export interface Fullscreen {
  active: boolean;
  /** True when the browser is doing it, false when the fallback is. */
  native: boolean;
  toggle: () => void;
  /** True while the screen is taller than it is wide — the pitch is 24 × 14 m. */
  portrait: boolean;
}

/**
 * Turns the phone sideways, where the browser allows it.
 *
 * Only Android and desktop Chromium implement this, and only while something is
 * full screen; iOS Safari has no orientation lock at all. So the rejection is
 * expected rather than exceptional, and the caller falls back to asking the
 * player to rotate the phone themselves.
 */
async function lockLandscape() {
  const orientation = window.screen?.orientation as
    | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
    | undefined;
  try {
    await orientation?.lock?.("landscape");
  } catch {
    // Refused. The rotate hint covers it.
  }
}

function unlockOrientation() {
  try {
    window.screen?.orientation?.unlock?.();
  } catch {
    // Never locked in the first place.
  }
}

export function useFullscreen(ref: React.RefObject<HTMLElement>): Fullscreen {
  const [native, setNative] = useState(false);
  const [manual, setManual] = useState(false);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const isFull = document.fullscreenElement === ref.current;
      setNative(isFull);
      // Leaving full screen must give the orientation back: a page that stayed
      // locked landscape after the match would be the app's fault, not the
      // player's.
      if (!isFull) unlockOrientation();
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

  // Tracked rather than read on render, so the rotate hint disappears the
  // moment the phone is turned.
  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const read = () => setPortrait(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  // Escape leaves the fallback, since the browser only handles the real thing.
  useEffect(() => {
    if (!manual) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setManual(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [manual]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    if (document.fullscreenElement === el) {
      void document.exitFullscreen?.();
      return;
    }
    if (manual) {
      setManual(false);
      unlockOrientation();
      return;
    }
    if (el.requestFullscreen) {
      // A rejected request is not an error worth showing — it happens when the
      // gesture is not trusted — so fall back rather than fail.
      el.requestFullscreen()
        .then(lockLandscape)
        .catch(() => setManual(true));
    } else {
      setManual(true);
    }
  }, [ref, manual]);

  return { active: native || manual, native, toggle, portrait };
}
