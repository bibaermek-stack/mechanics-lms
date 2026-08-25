"use client";

// Fixed-timestep physics engine shared by all ten simulations.
//
// The mutable physics state lives in a ref and is stepped from inside the
// canvas (see <SimDriver/>), so meshes can be moved every frame without any
// React re-render. Only the sampled readings and the chart series are mirrored
// into React state, at a modest rate, to drive the HUD.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface Sample {
  t: number;
  [key: string]: number;
}

export interface SimEngineConfig<S> {
  /** Builds a fresh physics state. Called on mount and on every reset. */
  init: () => S;
  /** Advances the state by exactly `h` seconds. */
  step: (state: S, h: number) => void;
  /** Values shown in the readout cards and plotted on the chart. */
  read: (state: S, t: number) => Record<string, number>;
  /** Changing any of these re-initialises the simulation. */
  resetKey?: readonly unknown[];
  /** Readings/chart sampling rate (Hz). */
  sampleHz?: number;
  /** Chart ring-buffer length. */
  maxSamples?: number;
  /** Seconds of simulated time after which the run auto-pauses (0 = never). */
  duration?: number;
  /**
   * Auto-pause as soon as this returns true — for runs that end on an event
   * rather than a clock, such as a falling weight reaching the floor. It fires
   * at most once per reset, so the student can press play again to carry on.
   */
  stopWhen?: (state: S, t: number) => boolean;
  autoPlay?: boolean;
  /**
   * Playback rate the scene opens at. Runs that are over in under a second of
   * real time — a ball dropped 70 cm, a cart released down a short ramp — are
   * unwatchable at 1×, so those scenes start slowed down and the student can
   * speed them up from the transport bar.
   */
  initialSpeed?: number;
}

export interface SimEngine<S> {
  stateRef: React.MutableRefObject<S>;
  timeRef: React.MutableRefObject<number>;
  advance: (dtReal: number) => void;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  toggle: () => void;
  reset: () => void;
  speed: number;
  setSpeed: (v: number) => void;
  readings: Record<string, number>;
  series: Sample[];
  /** Increments on every reset — use as a React key to resync visuals. */
  epoch: number;
}

const FIXED_H = 1 / 500; // 2 ms — stable for springs and collisions alike

export function useSimEngine<S>(config: SimEngineConfig<S>): SimEngine<S> {
  const {
    sampleHz = 20,
    maxSamples = 900,
    duration = 0,
    autoPlay = true,
    initialSpeed = 1,
    resetKey = [],
  } = config;

  // Keep the latest callbacks reachable from the animation loop without
  // making `advance` unstable.
  const cfgRef = useRef(config);
  cfgRef.current = config;

  const stateRef = useRef<S>(undefined as unknown as S);
  const initialisedRef = useRef(false);
  if (!initialisedRef.current) {
    stateRef.current = config.init();
    initialisedRef.current = true;
  }

  const timeRef = useRef(0);
  const accRef = useRef(0);
  const lastSampleRef = useRef(-1);
  const pausedTickRef = useRef(0);
  const autoStoppedRef = useRef(false);
  const seriesRef = useRef<Sample[]>([]);

  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState(initialSpeed);
  const [readings, setReadings] = useState<Record<string, number>>(() =>
    config.read(stateRef.current, 0)
  );
  const [series, setSeries] = useState<Sample[]>([]);
  const [epoch, setEpoch] = useState(0);

  const reset = useCallback(() => {
    stateRef.current = cfgRef.current.init();
    timeRef.current = 0;
    accRef.current = 0;
    lastSampleRef.current = -1;
    autoStoppedRef.current = false;
    seriesRef.current = [];
    setSeries([]);
    setReadings(cfgRef.current.read(stateRef.current, 0));
    setEpoch((e) => e + 1);
  }, []);

  // Re-initialise whenever a structural control changes.
  const signature = useMemo(() => JSON.stringify(resetKey), [resetKey]);
  const firstSignature = useRef(signature);
  useEffect(() => {
    if (firstSignature.current === signature) return;
    firstSignature.current = signature;
    reset();
  }, [signature, reset]);

  const advance = useCallback(
    (dtReal: number) => {
      const cfg = cfgRef.current;

      if (!playing) {
        // Paused: still refresh the readings so parameter tweaks stay visible,
        // but throttled — there is no simulated time to key off.
        const now = performance.now();
        if (now - pausedTickRef.current > 120) {
          pausedTickRef.current = now;
          setReadings(cfg.read(stateRef.current, timeRef.current));
        }
        return;
      }

      accRef.current += Math.min(dtReal, 0.1) * speed;
      let guard = 0;
      while (accRef.current >= FIXED_H && guard < 4000) {
        cfg.step(stateRef.current, FIXED_H);
        timeRef.current += FIXED_H;
        accRef.current -= FIXED_H;
        guard += 1;
      }

      const t = timeRef.current;
      const period = 1 / sampleHz;
      if (t - lastSampleRef.current >= period) {
        lastSampleRef.current = t;
        const values = cfg.read(stateRef.current, t);
        setReadings(values);
        const next = [...seriesRef.current, { t, ...values }];
        if (next.length > maxSamples) next.splice(0, next.length - maxSamples);
        seriesRef.current = next;
        setSeries(next);
      }

      if (duration > 0 && t >= duration) setPlaying(false);
      if (!autoStoppedRef.current && cfg.stopWhen?.(stateRef.current, t)) {
        autoStoppedRef.current = true;
        setReadings(cfg.read(stateRef.current, t));
        setPlaying(false);
      }
    },
    [playing, speed, sampleHz, maxSamples, duration]
  );

  const toggle = useCallback(() => setPlaying((p) => !p), []);

  return {
    stateRef,
    timeRef,
    advance,
    playing,
    setPlaying,
    toggle,
    reset,
    speed,
    setSpeed,
    readings,
    series,
    epoch,
  };
}
