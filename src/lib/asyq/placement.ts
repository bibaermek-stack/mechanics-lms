// Putting a bone down on a chosen side, facing a chosen way.

import { faceById, type FaceId } from "./faces";
import { DOWN, qFromAxisAngle, qFromUnitVectors, qMul, qRotate, type Quat, type Vec3 } from "./math";
import { restingHeight, type BodyInit, type BodyKind } from "./physics";

/** A hair above the floor, so a bone put down is never born touching it. Metres. */
const CLEARANCE = 0.0003;

/**
 * The orientation that lays the bone on `face` with its long axis pointing along heading `yaw`
 * (0 = +x, positive towards +z). The long axis is the model's x axis.
 */
export function orientationOnFace(face: FaceId, yaw: number): Quat {
  const down = qFromUnitVectors(faceById(face).normal, DOWN);
  const axis = qRotate(down, [1, 0, 0]);
  const now = Math.atan2(axis[2], axis[0]);
  // turning about +y by φ moves a heading h to h − φ
  return qMul(qFromAxisAngle([0, 1, 0], now - yaw), down);
}

/** A body lying on `face` at ground position (x, z), long axis along heading `yaw`. */
export function bodyOnFace(args: { id: string; kind: BodyKind; length: number; mass?: number; face: FaceId; x: number; z: number; yaw: number }): BodyInit {
  const rotation = orientationOnFace(args.face, args.yaw);
  const y = restingHeight(rotation, args.length) + CLEARANCE;
  const init: BodyInit = { id: args.id, kind: args.kind, length: args.length, position: [args.x, y, args.z] as Vec3, rotation };
  if (args.mass !== undefined) init.mass = args.mass;
  return init;
}
