"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Sample } from "@/lib/sensors/analysis";
import { NO_EVENTS_AFTER_MS, SampleCollector, motionSupport, type Support } from "@/lib/sensors/recorder";

export type Phase = "idle" | "asking" | "countdown" | "recording" | "done" | "error";

export interface RecorderState {
  phase: Phase;
  /** Seconds left of the countdown or of the recording. */
  left: number;
  /** The latest |a|, m/s², for a live read-out. */
  live: number | null;
  /** Readings per second the device is delivering. */
  rate: number;
  error: string | null;
  samples: Sample[] | null;
}

const IDLE: RecorderState = { phase: "idle", left: 0, live: null, rate: 0, error: null, samples: null };

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

const readEnv = () => ({
  secureContext: window.isSecureContext,
  hasDeviceMotion: typeof window.DeviceMotionEvent !== "undefined",
  needsPermission: typeof (window.DeviceMotionEvent as unknown as PermissionApi | undefined)?.requestPermission === "function",
});

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not every browser vibrates, and some refuse without a tap */
  }
};

/**
 * Records the phone's accelerometer (accelerationIncludingGravity) for a set time,
 * after a countdown that gives the student time to put the phone where it belongs.
 * The countdown already listens, so a device that sends nothing — a computer — is
 * told so after two seconds instead of recording silence.
 */
export function useMotionRecorder({ countdown, seconds }: { countdown: number; seconds: number }) {
  const [state, setState] = useState<RecorderState>(IDLE);
  const [support, setSupport] = useState<Support | null>(null);
  // The recording in progress, if any: how to read its phase, end it with what it has, or throw it away.
  const run = useRef<{ phase: () => string; finish: () => void; cancel: () => void } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    setSupport(motionSupport(readEnv()));
    return () => {
      alive.current = false;
      run.current?.cancel();
    };
  }, []);

  const reset = useCallback(() => {
    run.current?.cancel();
    setState(IDLE);
  }, []);

  const start = useCallback(async () => {
    run.current?.cancel();
    const sup = motionSupport(readEnv());
    if (!sup.ok) {
      setState({ ...IDLE, phase: "error", error: sup.reason });
      return;
    }
    if (sup.needsPermission) {
      setState({ ...IDLE, phase: "asking" });
      try {
        const answer = await (window.DeviceMotionEvent as unknown as PermissionApi).requestPermission!();
        if (!alive.current) return;
        if (answer !== "granted") {
          setState({ ...IDLE, phase: "error", error: "Сенсорға рұқсат берілмеді. Safari баптауларынан немесе бетті жаңартып, қайта рұқсат бер." });
          return;
        }
      } catch {
        setState({ ...IDLE, phase: "error", error: "Сенсорға рұқсат сұралмады. Батырманы басқанда сұрау шығуы керек; бетті жаңартып қайталап көр." });
        return;
      }
    }

    // while counting down, readings only prove that the sensor is alive
    let col = new SampleCollector();
    let phase: "countdown" | "recording" | "stopped" = "countdown";
    let live: number | null = null;
    const startedAt = performance.now();
    let recordingFrom = 0;
    let wake: { release(): Promise<void> } | null = null;

    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || phase === "stopped") return;
      if (col.push(e.timeStamp, a.x, a.y, a.z)) live = Math.hypot(a.x as number, a.y as number, a.z as number);
    };
    window.addEventListener("devicemotion", onMotion);
    try {
      void (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } }).wakeLock
        ?.request("screen")
        .then((l) => (wake = l))
        .catch(() => {});
    } catch {
      /* the screen may dim on a long recording; nothing to do */
    }

    let timer = 0;
    const stopAll = () => {
      phase = "stopped";
      window.removeEventListener("devicemotion", onMotion);
      window.clearInterval(timer);
      void wake?.release().catch(() => {});
      wake = null;
    };

    const finish = () => {
      if (phase !== "recording") return;
      const samples = col.samples.slice();
      stopAll();
      buzz([60, 40, 60]);
      if (samples.length < 10) {
        setState({ ...IDLE, phase: "error", error: "Жазба тым аз деректен тұрады. Қайталап көр." });
      } else {
        setState({ phase: "done", left: 0, live, rate: col.rate, error: null, samples });
      }
    };
    run.current = { phase: () => phase, finish, cancel: stopAll };

    setState({ ...IDLE, phase: "countdown", left: countdown });
    timer = window.setInterval(() => {
      const now = performance.now();
      if (phase === "countdown") {
        if (col.length === 0 && now - startedAt > NO_EVENTS_AFTER_MS) {
          stopAll();
          setState({ ...IDLE, phase: "error", error: "Құрылғыдан сенсор деректері келмеді. Компьютерде сенсор болмайды: телефонда ашыңыз, немесе «Үлгі жазба» мен CSV файлды қолданыңыз." });
          return;
        }
        const left = countdown - (now - startedAt) / 1000;
        if (left <= 0) {
          col = new SampleCollector();
          phase = "recording";
          recordingFrom = now;
          buzz(120);
          setState({ ...IDLE, phase: "recording", left: seconds, live });
        } else {
          setState((s) => ({ ...s, left, live, rate: col.rate }));
        }
        return;
      }
      if (phase === "recording") {
        const left = seconds - (now - recordingFrom) / 1000;
        if (left <= 0) finish();
        else setState((s) => ({ ...s, left, live, rate: col.rate }));
      }
    }, 100);
  }, [countdown, seconds]);

  /** Ends a recording early (keeping what it has), or cancels a countdown. */
  const stop = useCallback(() => {
    const r = run.current;
    if (!r) return;
    if (r.phase() === "recording") r.finish();
    else {
      r.cancel();
      setState(IDLE);
    }
  }, []);

  return { state, support, start, stop, reset };
}
