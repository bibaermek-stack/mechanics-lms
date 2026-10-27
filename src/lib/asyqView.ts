// The arithmetic behind the 3D picture of the asyq game, kept out of the WebGL code so it can be tested.
//
// The scene is a lane along +x with the throw line at x = 0. The sakha starts there and slides
// to x = d. The asyqs it must stop beside stand in a row at the lane's right edge (+z), spread
// over exactly the span that counts as a hit, target ± radius; so "beside the asyqs" is what
// the picture shows and what judge() accepts. Lengths are metres, but the bones are drawn far
// larger than life (a real asyq is about 4 cm): at lane scale a real one would be a speck.

import * as THREE from "three";
import type { Vector3Tuple } from "three";

// What the model file says about itself: Asyk.glb's bounding box (m), long axis along x.
// asyqView.test.ts checks these against the file, so swapping the model makes it fail.
export const ASYQ_MODEL = { length: 0.7171234488, height: 0.4236763716, depth: 0.4816456139 } as const;
/** Footprint across the long axis, as a fraction of the length. */
export const ASYQ_WIDTH_RATIO = ASYQ_MODEL.depth / ASYQ_MODEL.length;

export type AsyqView = "chase" | "side" | "top";
export const ASYQ_VIEWS: { id: AsyqView; label: string }[] = [
  { id: "chase", label: "Артынан" },
  { id: "side", label: "Бүйірден" },
  { id: "top", label: "Үстінен" },
];

export const LANE_HALF_WIDTH = 0.9;
/** The row of target asyqs stands this far out from the lane's centre line, on the +z side. */
export const ROW_Z = 1.15;
export const CAMERA_FOV = 42;
export const ROW_COUNT = 5;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Length of a target asyq's picture: grows a little with the lane, so a 12 m lane is not all emptiness. */
export const asyqLength = (target: number) => clamp(target * 0.03, 0.2, 0.34);
/** The sakha is the heavy, larger one. */
export const SAKHA_RATIO = 1.5;
export const sakhaLength = (target: number) => asyqLength(target) * SAKHA_RATIO;

/** Centres of the n asyqs along the lane: n equal cells that together cover target ± radius. */
export function rowPositions(target: number, radius: number, n = ROW_COUNT): number[] {
  return Array.from({ length: n }, (_, i) => target + (radius * (2 * i - (n - 1))) / n);
}

/**
 * How far down the lane the picture reaches: the target with room beyond it, or the farthest stop so
 * far — but never more than three targets, so one wild throw on ice does not shrink the asyqs to dust.
 */
export function viewReach(target: number, stops: readonly number[]): number {
  const far = Math.min(Math.max(0, ...stops) * 1.08, target * 3);
  return Math.max(target * 1.35, far, 6);
}

/** Metres between the labelled marks of the ruler: the smallest of 1, 2, 5, 10… that keeps it to ten marks or fewer. */
export function rulerStep(reach: number): number {
  for (const step of [1, 2, 5, 10, 20, 50, 100]) if (reach / step <= 10) return step;
  return 200;
}

export function rulerMarks(reach: number): number[] {
  const step = rulerStep(reach);
  return Array.from({ length: Math.floor(reach / step) + 1 }, (_, i) => i * step);
}

/** Length of the speed arrow shown while aiming: longer for a harder throw. */
export const aimArrowLength = (v: number) => 0.3 + 0.17 * v;

// ---------------------------------------------------------------------------
// The surface under the lane
// ---------------------------------------------------------------------------

export interface SurfaceLook {
  id: "ice" | "snow" | "wood" | "grass" | "sand" | "earth";
  /** As the round's title names it (folk.ts keeps the same list). */
  name: string;
  /** Ground colour, and the colour of the markings drawn on it. */
  base: string;
  accent: string;
  roughness: number;
  /** The flat colour the 2D fallback tints its lane with. */
  shade: string;
}

const LOOKS: Record<SurfaceLook["id"], SurfaceLook> = {
  ice: { id: "ice", name: "мұз", base: "#94cbea", accent: "#e9f6ff", roughness: 0.12, shade: "#bae6fd" },
  snow: { id: "snow", name: "тығыздалған қар", base: "#dfe8f0", accent: "#c3d3e0", roughness: 0.55, shade: "#e0f2fe" },
  wood: { id: "wood", name: "ағаш еден", base: "#b98a55", accent: "#8d6234", roughness: 0.5, shade: "#d6b88a" },
  grass: { id: "grass", name: "шөп", base: "#5fae4e", accent: "#3f8a36", roughness: 0.9, shade: "#86efac" },
  sand: { id: "sand", name: "құм", base: "#e2c27a", accent: "#c9a45c", roughness: 0.95, shade: "#fcd34d" },
  earth: { id: "earth", name: "топырақ", base: "#8c6d47", accent: "#6a4f30", roughness: 0.95, shade: "#c8a77a" },
};

/** The look of a surface by name (the 3D asyq game names its floors; the lesson game picks one by friction). */
export const lookById = (id: SurfaceLook["id"]): SurfaceLook => LOOKS[id];

export function surfaceLook(mu: number): SurfaceLook {
  if (mu < 0.08) return LOOKS.ice;
  if (mu < 0.2) return LOOKS.snow;
  if (mu < 0.35) return LOOKS.wood;
  if (mu < 0.5) return LOOKS.grass;
  return LOOKS.sand;
}

// ---------------------------------------------------------------------------
// Cameras
// ---------------------------------------------------------------------------

export interface CamPose {
  position: Vector3Tuple;
  target: Vector3Tuple;
}

/** Behind the sakha, above it and to the left (the row of asyqs is on the right), looking down the lane. */
export function chasePose(sakhaX: number, target: number): CamPose {
  const back = 2.3 + 0.1 * target;
  const up = 1.15 + 0.05 * target;
  const side = 1.5 + 0.04 * target;
  const ahead = 2.5 + 0.35 * target;
  return { position: [sakhaX - back, up, -side], target: [sakhaX + ahead, 0.1, 0.15] };
}

/** Points the overview must keep in frame: both ends of the lane, and the row of asyqs with some height. */
function framePoints(reach: number): THREE.Vector3[] {
  const xs = [-0.7, reach + 0.7];
  const pts: THREE.Vector3[] = [];
  for (const x of xs) for (const z of [-(LANE_HALF_WIDTH + 0.4), ROW_Z + 0.4]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.8, z));
  return pts;
}

const MARGIN = 0.94;

/** True if every point lands on the screen (inside ±MARGIN of the normalised view) and in front of the camera. */
export function inFrame(pose: CamPose, points: readonly THREE.Vector3[], aspect: number, fov = CAMERA_FOV): boolean {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.05, 500);
  cam.position.set(...pose.position);
  cam.lookAt(...pose.target);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const toCam = new THREE.Vector3();
  return points.every((p) => {
    toCam.copy(p).applyMatrix4(cam.matrixWorldInverse);
    if (toCam.z >= 0) return false; // behind the camera
    const q = p.clone().project(cam);
    return Math.abs(q.x) <= MARGIN && Math.abs(q.y) <= MARGIN;
  });
}

const ELEVATION = { side: 22, top: 72 } as const;

/**
 * The pose that looks at `centre` along direction `dir` (from the centre to the camera) from as
 * close as will keep every one of `points` on screen, for this shape of screen.
 */
export function fitPose(centre: Vector3Tuple, dir: THREE.Vector3, points: readonly THREE.Vector3[], aspect: number, fov = CAMERA_FOV): CamPose {
  const d = dir.clone().normalize();
  const at = (t: number): CamPose => ({
    position: [centre[0] + d.x * t, centre[1] + d.y * t, centre[2] + d.z * t],
    target: centre,
  });
  let lo = 0.05, hi = 600;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (inFrame(at(mid), points, aspect, fov)) hi = mid;
    else lo = mid;
  }
  return at(hi);
}

/**
 * The whole lane in one picture, from the side or from nearly overhead: the camera is backed off
 * along its viewing line, as little as will fit everything, for this shape of screen.
 */
export function overviewPose(view: "side" | "top", reach: number, aspect: number, fov = CAMERA_FOV): CamPose {
  const el = (ELEVATION[view] * Math.PI) / 180;
  return fitPose([reach / 2, 0, 0.1], new THREE.Vector3(0, Math.sin(el), -Math.cos(el)), framePoints(reach), aspect, fov);
}

/** The points an overview of this reach has to keep on screen (exported for the tests). */
export const overviewPoints = framePoints;

/** Frame-rate independent easing: move `current` towards `goal`, covering 1 − e^(−λ·dt) of the gap. */
export function damp(current: number, goal: number, lambda: number, dt: number): number {
  return goal + (current - goal) * Math.exp(-lambda * dt);
}
