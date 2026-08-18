"use client";

// The A-Frame scene, mounted into the page.
//
// React owns the parameters and the 2D controls; A-Frame owns the room. The two
// meet at exactly two places: props are written onto the `lab-rig` entity as
// attributes, and the scene emits `lab-readings` / `lab-action` events back.
// Nothing else crosses the boundary, which is what keeps React's reconciler and
// A-Frame's scene graph from fighting over the same DOM.

import { useEffect, useRef, useState } from "react";
import { Headset, TriangleAlert } from "lucide-react";
import { ensureAframe } from "./aframe/register";
import type { VrExperiment } from "@/lib/vr/types";

export interface VrSceneProps {
  experiment: VrExperiment;
  playing: boolean;
  speed: number;
  params: Record<string, number>;
  /** Bump to restart the run. */
  epoch: number;
  onReadings?: (readings: Record<string, number>, t: number) => void;
  /** Fired by the 3D buttons inside the headset. */
  onAction?: (action: string) => void;
  onFinished?: () => void;
  className?: string;
}

export function VrScene({
  experiment,
  playing,
  speed,
  params,
  epoch,
  onReadings,
  onAction,
  onFinished,
  className,
}: VrSceneProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    ensureAframe()
      .then(() => alive && setStatus("ready"))
      .catch((err) => {
        console.error("[vr-lab] A-Frame жүктелмеді", err);
        if (alive) setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  // Events bubble up to the scene element, so one listener per kind is enough.
  useEffect(() => {
    const host = hostRef.current;
    if (status !== "ready" || !host) return;
    const scene = host.querySelector("a-scene");
    if (!scene) return;

    const handleReadings = (evt: Event) => {
      const detail = (evt as CustomEvent<{ readings: Record<string, number>; t: number }>).detail;
      if (detail) onReadings?.(detail.readings, detail.t);
    };
    const handleAction = (evt: Event) => {
      const detail = (evt as CustomEvent<{ action: string }>).detail;
      if (detail?.action) onAction?.(detail.action);
    };
    const handleFinished = () => onFinished?.();

    scene.addEventListener("lab-readings", handleReadings);
    scene.addEventListener("lab-action", handleAction);
    scene.addEventListener("lab-finished", handleFinished);
    return () => {
      scene.removeEventListener("lab-readings", handleReadings);
      scene.removeEventListener("lab-action", handleAction);
      scene.removeEventListener("lab-finished", handleFinished);
    };
  }, [status, onReadings, onAction, onFinished]);

  if (status === "error") {
    return (
      <div className={className ?? SHELL}>
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <TriangleAlert className="text-amber-500" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            VR ортасын жүктеу мүмкін болмады
          </p>
          <p className="max-w-sm text-xs text-slate-500">
            Бетті қайта жүктеп көріңіз. Проблема қайталанса, браузеріңіз WebGL-ді
            қолдамайтын болуы мүмкін.
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className={className ?? SHELL}>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <Headset className="animate-pulse text-brand-400" size={28} />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-300">
            VR/AR зертхана жүктелуде…
          </p>
          <p className="text-xs text-slate-500">Бөлме, жабдық және PASCO модельдері дайындалуда</p>
        </div>
      </div>
    );
  }

  const rigAttr = [
    `experiment: ${experiment.id}`,
    `playing: ${playing}`,
    `speed: ${speed}`,
    `epoch: ${epoch}`,
    // A-Frame has no object property type, so the sliders travel as JSON.
    `params: ${JSON.stringify(params)}`,
  ].join("; ");

  return (
    <div ref={hostRef} className={className ?? SHELL}>
      <a-scene
        embedded=""
        vr-mode-ui="enabled: true"
        xr-mode-ui="XRMode: xr"
        webxr="referenceSpaceType: local-floor; optionalFeatures: hit-test, anchors, local-floor, bounded-floor, hand-tracking"
        renderer="antialias: true; colorManagement: true; toneMapping: ACESFilmic; exposure: 1.05"
        background="color: #cfd9e6"
        light="defaultLightsEnabled: false"
        device-orientation-permission-ui="enabled: true"
        ar-lab="room: #vr-room; lab: #vr-lab; scale: 0.32"
      >
        {/* Room ------------------------------------------------------------ */}
        <a-entity id="vr-room" lab-room="width: 7; depth: 6.5; height: 3"></a-entity>

        {/* Lighting rig: cool sky fill, warm key from the window side ------- */}
        <a-entity light="type: hemisphere; color: #e8eeff; groundColor: #808a99; intensity: 1.0"></a-entity>
        <a-entity
          light="type: directional; color: #fff6e8; intensity: 1.5; castShadow: true; shadowMapWidth: 2048; shadowMapHeight: 2048; shadowCameraLeft: -3; shadowCameraRight: 3; shadowCameraTop: 3; shadowCameraBottom: -3; shadowBias: -0.0008"
          position="2.2 3.2 1.8"
        ></a-entity>
        <a-entity
          light="type: directional; color: #cfe0ff; intensity: 0.5"
          position="-2.4 2.2 -1.6"
        ></a-entity>

        {/* The laboratory itself. In AR this whole group shrinks onto a table. */}
        <a-entity id="vr-lab" position="0 0 0">
          <a-entity lab-rig={rigAttr}></a-entity>
          <a-entity
            position="0 0.92 0.62"
            rotation="-46 0 0"
            lab-console={`experiment: ${experiment.id}; playing: ${playing}`}
          ></a-entity>
          <a-entity
            position="-0.92 1.66 -0.55"
            rotation="0 24 0"
            info-panel={`title: ${experiment.title}; width: 0.8; height: 0.5; body: ${JSON.stringify(
              experiment.tasks
            )}`}
          ></a-entity>
          <a-entity
            position="0.92 1.66 -0.55"
            rotation="0 -24 0"
            info-panel={`title: Формулалар; width: 0.8; height: 0.5; body: ${JSON.stringify([
              experiment.goal,
              ...experiment.formulas,
            ])}`}
          ></a-entity>
        </a-entity>

        {/* Player: rig on the floor, camera at eye height inside it. The gaze
            starts tilted down so the bench, not the ceiling, is what a student
            sees when the scene opens; in XR the headset pose takes over. */}
        <a-entity id="vr-player" position="0 0 1.55">
          <a-entity
            camera="active: true; fov: 72; near: 0.02; far: 60"
            position="0 1.6 0"
            initial-gaze="pitch: -20"
            look-controls="pointerLockEnabled: false; reverseMouseDrag: false"
            wasd-controls="acceleration: 20; fly: false"
            cursor="rayOrigin: mouse; fuse: false"
            raycaster="objects: .clickable; far: 6"
          ></a-entity>
          <a-entity
            laser-controls="hand: left"
            raycaster="objects: .clickable; far: 6; lineColor: #3366ff; lineOpacity: 0.8"
          ></a-entity>
          <a-entity
            laser-controls="hand: right"
            raycaster="objects: .clickable; far: 6; lineColor: #3366ff; lineOpacity: 0.8"
          ></a-entity>
        </a-entity>
      </a-scene>
    </div>
  );
}

const SHELL =
  "sim-stage relative h-[460px] w-full overflow-hidden rounded-xl2 shadow-lg ring-1 ring-slate-900/10 dark:ring-white/10 sm:h-[560px]";

export default VrScene;
