// Where the camera stands in the asyq arena. Lengths are real metres; the picture scales the whole
// arena up (the bones are drawn far larger than life, or they would be specks), and so scales these.

import * as THREE from "three";
import type { Vector3Tuple } from "three";
import { CAMERA_FOV, damp, fitPose, type CamPose } from "../asyqView";
import type { Vec3 } from "./math";

export { damp };
export type ArenaView = "throw" | "follow" | "top";

export const ARENA_VIEWS: { id: ArenaView; label: string }[] = [
  { id: "throw", label: "Лақтырушыдан" },
  { id: "follow", label: "Сақаның артынан" },
  { id: "top", label: "Үстінен" },
];

/** Behind the thrower, a little above and to the left, looking across the ring. */
export function throwPose(ringRadius: number): CamPose {
  return { position: [-ringRadius - 0.34, 0.27, -0.17], target: [0.08, 0.0, 0.01] };
}

/** Trailing the sakha as it goes, from behind and beside it. */
export function followPose(sakha: Vec3): CamPose {
  return { position: [sakha[0] - 0.34, sakha[1] + 0.2, sakha[2] - 0.26], target: [sakha[0] + 0.22, 0.01, sakha[2]] };
}

/** Points the overhead view keeps on screen: the ring, the trays beside it, and the thrower behind. */
export function topPoints(ringRadius: number): THREE.Vector3[] {
  const r = ringRadius + 0.32;
  const pts: THREE.Vector3[] = [];
  for (const x of [-r - 0.25, r + 0.2]) for (const z of [-r, r]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x, 0.12, z));
  return pts;
}

export function topPose(ringRadius: number, aspect: number, fov = CAMERA_FOV): CamPose {
  const el = (78 * Math.PI) / 180;
  return fitPose([0, 0, 0], new THREE.Vector3(0, Math.sin(el), -Math.cos(el)), topPoints(ringRadius), aspect, fov);
}

export function arenaPose(view: ArenaView, ringRadius: number, aspect: number, sakha: Vec3 | null): CamPose {
  if (view === "top") return topPose(ringRadius, aspect);
  if (view === "follow" && sakha) return followPose(sakha);
  return throwPose(ringRadius);
}

export const scalePose = (p: CamPose, k: number): CamPose => ({
  position: p.position.map((x) => x * k) as Vector3Tuple,
  target: p.target.map((x) => x * k) as Vector3Tuple,
});
