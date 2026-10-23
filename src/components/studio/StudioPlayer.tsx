"use client";

// Hosts one lesson film. In "render" mode the page is driven from outside by
// the render tool (it calls window.__studio.setTime for every frame); in "live"
// mode it plays by itself with a scrubber, so the same scene can run in the
// lesson page and let a student orbit the apparatus.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Pause, Play, RotateCcw, Orbit } from "lucide-react";
import { StudioStage } from "./StudioStage";
import { Chrome } from "./overlay";
import type { StudioApi, LessonScene } from "./types";
import type { StudioClock } from "./clock";
import "./studio.css";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function mmss(sec: number) {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function StudioPlayer({
  scene,
  mode = "live",
  dpr,
  autoPlay = true,
  onApi,
  className,
}: {
  scene: LessonScene;
  mode?: "live" | "render";
  dpr?: number;
  autoPlay?: boolean;
  /** Render mode only: receives the handle the tool drives the film with. */
  onApi?: (api: StudioApi) => void;
  className?: string;
}) {
  const duration = scene.script.duration;
  const clock = useMemo<StudioClock>(() => ({ t: 0, duration }), [duration, scene]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [orbit, setOrbit] = useState(false);
  const advance = useRef<((ts: number) => void) | null>(null);
  const readyResolve = useRef<() => void>(() => {});
  const readyPromise = useMemo(() => new Promise<void>((res) => (readyResolve.current = res)), [scene]);
  const [bridgeUp, setBridgeUp] = useState(false);
  const [modelsUp, setModelsUp] = useState(false);

  const onAdvance = useCallback((fn: (ts: number) => void) => {
    advance.current = fn;
    setBridgeUp(true);
  }, []);
  const onReady = useCallback(() => setModelsUp(true), []);

  // Ready means both: the stage can render a frame, and every model has loaded.
  useEffect(() => {
    if (mode === "render" && bridgeUp && modelsUp) readyResolve.current();
  }, [mode, bridgeUp, modelsUp]);

  useEffect(() => {
    if (mode !== "render" || !onApi) return;
    onApi({
      duration,
      ready: readyPromise,
      setTime: async (time: number) => {
        clock.t = time;
        flushSync(() => setT(time));
        advance.current?.(time);
        // Two frames: the first lets React commit the overlay, the second lets
        // the browser composite canvas and DOM together.
        await nextFrame();
        await nextFrame();
      },
    });
  }, [mode, onApi, duration, clock, readyPromise]);

  const seek = (v: number) => {
    clock.t = v;
    setT(v);
  };

  return (
    <div className={`st-root${className ? ` ${className}` : ""}`}>
      <div className="st-canvas">
        <StudioStage
          scene={scene}
          clock={clock}
          mode={mode}
          playing={playing}
          orbit={orbit}
          dpr={dpr ?? (mode === "render" ? 1 : Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio))}
          onTick={mode === "live" ? setT : undefined}
          onAdvance={mode === "render" ? onAdvance : undefined}
          onReady={onReady}
        />
      </div>
      <div className="st-layer">
        <Chrome script={scene.script} t={t} />
        <scene.Overlay t={t} />
      </div>
      {mode === "live" && (
        <div className="st-ui">
          <button type="button" aria-label={playing ? "Кідірту" : "Ойнату"} onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            type="button"
            aria-label="Басынан бастау"
            onClick={() => {
              seek(0);
              setPlaying(true);
            }}
          >
            <RotateCcw size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.05}
            value={t}
            aria-label="Бейне уақыты"
            onChange={(e) => seek(parseFloat(e.target.value))}
          />
          <time>
            {mmss(t)} / {mmss(duration)}
          </time>
          <button type="button" aria-pressed={orbit} onClick={() => setOrbit((o) => !o)}>
            <Orbit size={16} style={{ marginRight: "0.4cqw" }} /> 3D айналдыру
          </button>
        </div>
      )}
    </div>
  );
}
