"use client";

import { createContext, useContext, useRef } from "react";
import { useFrame } from "@react-three/fiber";

/** The film's playhead. Mutable on purpose: scenes read it every frame. */
export interface StudioClock {
  t: number;
  duration: number;
}

export const ClockContext = createContext<StudioClock>({ t: 0, duration: 1 });

export const useClock = () => useContext(ClockContext);

/**
 * Run `cb` every rendered frame with the film time. Scenes are pure functions of
 * `t`, so seeking (the render tool jumps straight to any frame) and live
 * playback go through the same code.
 *
 * `priority` orders callbacks within a frame (lower runs first). The default of
 * -1 puts scene updates ahead of drei's <Html> labels, which read object
 * positions in their own priority-0 callback. Keep it at or below zero: a
 * positive priority makes react-three-fiber stop rendering for you.
 */
export function useStudioFrame(cb: (t: number, dt: number) => void, priority = -1) {
  const clock = useContext(ClockContext);
  const cbRef = useRef(cb);
  cbRef.current = cb;
  const last = useRef<number | null>(null);
  useFrame(() => {
    const t = clock.t;
    const dt = last.current === null ? 0 : t - last.current;
    last.current = t;
    cbRef.current(t, dt);
  }, priority);
}
