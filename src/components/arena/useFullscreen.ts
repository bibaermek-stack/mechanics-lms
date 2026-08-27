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
}

export function useFullscreen(ref: React.RefObject<HTMLElement>): Fullscreen {
  const [native, setNative] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [ref]);

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
      return;
    }
    if (el.requestFullscreen) {
      // A rejected request is not an error worth showing — it happens when the
      // gesture is not trusted — so fall back rather than fail.
      el.requestFullscreen().catch(() => setManual(true));
    } else {
      setManual(true);
    }
  }, [ref, manual]);

  return { active: native || manual, native, toggle };
}
