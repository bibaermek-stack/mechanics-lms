// Just enough vector and quaternion arithmetic for the asyq game. Quaternions are [x, y, z, w],
// as in Rapier and three.js. Plain functions on plain arrays: nothing to allocate or dispose.

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  return l === 0 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
};

export const IDENTITY: Quat = [0, 0, 0, 1];

export function qMul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export const qConj = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];

export function qNormalize(q: Quat): Quat {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return l === 0 ? IDENTITY : [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

/** Rotates v by q. */
export function qRotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[3])), cross(u, t));
}

/** Rotates v by the inverse of q: a world vector as the body sees it. */
export const qInvRotate = (q: Quat, v: Vec3): Vec3 => qRotate(qConj(q), v);

export function qFromAxisAngle(axis: Vec3, angle: number): Quat {
  const a = normalize(axis);
  const s = Math.sin(angle / 2);
  return [a[0] * s, a[1] * s, a[2] * s, Math.cos(angle / 2)];
}

/** The shortest rotation taking unit vector a onto unit vector b. */
export function qFromUnitVectors(a: Vec3, b: Vec3): Quat {
  const d = dot(a, b);
  if (d < -0.999999) {
    // opposite: any axis perpendicular to a will do
    const axis = Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]);
    return qFromAxisAngle(axis, Math.PI);
  }
  const c = cross(a, b);
  return qNormalize([c[0], c[1], c[2], 1 + d]);
}

/** Angle in degrees between two unit vectors. */
export const angleDeg = (a: Vec3, b: Vec3) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;

export const DOWN: Vec3 = [0, -1, 0];
export const UP: Vec3 = [0, 1, 0];

/** Direction on the ground for heading θ: 0 is +x, positive turns towards +z (to the right of someone looking along +x). */
export const heading = (theta: number): Vec3 => [Math.cos(theta), 0, Math.sin(theta)];
