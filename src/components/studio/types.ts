import type { ComponentType } from "react";
import type { CamKey, LessonScript, Vec3 } from "@/lib/studio/timeline";

/**
 * One lesson film: the 3D world, the 2D graphics drawn over it, the camera
 * path and the script. `World` lives inside the <Canvas>; `Overlay` is plain
 * DOM and is handed the current time, so it can draw graphs and readouts that
 * stay exactly in step with the bodies.
 */
export interface LessonScene {
  moduleId: number;
  script: LessonScript;
  camera: CamKey[];
  /** Added to every camera pose, so keyframes can be written relative to a moving subject. */
  cameraFollow?: (t: number) => Vec3;
  World: ComponentType;
  Overlay: ComponentType<{ t: number }>;
  /** Sky gradient: zenith → horizon. */
  sky?: { top: string; horizon: string };
  /**
   * Key light: where it sits relative to the point it lights, and the half-width
   * of its shadow frustum (metres). `follow` makes the lit point track a moving
   * subject, so a film that travels down a road keeps sharp shadows.
   */
  light?: { offset: Vec3; target?: Vec3; follow?: (t: number) => Vec3; extent: number; extentAt?: (t: number) => number };
  fog?: { color: string; near: number; far: number };
  /** Starting pose when a student takes over the camera in the 3D viewer. */
  viewer?: { pos: Vec3; target: Vec3 };
}

/** What the render tool drives from outside the page. */
export interface StudioApi {
  duration: number;
  /** Resolves once every model has loaded and the first frame is drawn. */
  ready: Promise<void>;
  /** Move to time `t` and resolve once the frame (3D and overlay) is on screen. */
  setTime: (t: number) => Promise<void>;
}
