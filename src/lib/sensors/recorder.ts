// The part of recording that needs no browser: turning a stream of device-motion
// readings into samples, and deciding whether this device can record at all.

import type { Sample } from "./analysis";

/** Hard stop, so a forgotten recording cannot fill the memory: 5 minutes at 60 Hz. */
export const MAX_SAMPLES = 18_000;

/**
 * Collects readings as they arrive. Times are the event's own time stamp (ms),
 * turned into seconds since the first usable reading. A reading is dropped when it is
 * missing or not a number (a computer's browser fires one empty event), or when its
 * time does not move forward (some browsers repeat a stamp).
 */
export class SampleCollector {
  private readonly out: Sample[] = [];
  private t0: number | null = null;
  private last = -Infinity;
  dropped = 0;

  constructor(private readonly max = MAX_SAMPLES) {}

  /** Returns true when the reading was kept. */
  push(timeMs: number, x: number | null | undefined, y: number | null | undefined, z: number | null | undefined): boolean {
    if (this.out.length >= this.max) return false;
    if (![x, y, z].every((v) => typeof v === "number" && Number.isFinite(v)) || !Number.isFinite(timeMs)) {
      this.dropped++;
      return false;
    }
    if (timeMs <= this.last) {
      this.dropped++;
      return false;
    }
    this.t0 ??= timeMs;
    this.last = timeMs;
    this.out.push({ t: (timeMs - this.t0) / 1000, x: x as number, y: y as number, z: z as number });
    return true;
  }

  get samples(): Sample[] {
    return this.out;
  }

  get length(): number {
    return this.out.length;
  }

  /** Readings per second over the recording so far; 0 with fewer than two. */
  get rate(): number {
    if (this.out.length < 2) return 0;
    const span = this.out[this.out.length - 1].t;
    return span > 0 ? (this.out.length - 1) / span : 0;
  }
}

export interface MotionEnv {
  secureContext: boolean;
  hasDeviceMotion: boolean;
  /** iOS 13+: reading the sensors needs an explicit tap and a permission. */
  needsPermission: boolean;
}

export type Support =
  | { ok: true; needsPermission: boolean }
  | { ok: false; reason: string };

export function motionSupport(env: MotionEnv): Support {
  if (!env.hasDeviceMotion) {
    return { ok: false, reason: "Бұл браузер қозғалыс сенсорын көрсетпейді. Телефондағы Chrome немесе Safari арқылы ашыңыз." };
  }
  if (!env.secureContext) {
    return { ok: false, reason: "Сенсорларға тек қауіпсіз (https://) бет арқылы қол жетеді. Сайтты https мекенжайымен ашыңыз." };
  }
  return { ok: true, needsPermission: env.needsPermission };
}

/** A recording that took too long to deliver anything is a device without sensors. */
export const NO_EVENTS_AFTER_MS = 2000;
