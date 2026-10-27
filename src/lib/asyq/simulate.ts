// A whole throw, worked out in advance and then played back.
//
// Why not step the physics as the frames come? A rigid-body engine at a few hundred steps a second
// lets two fast bones sink into each other by a few millimetres at the instant of impact — on a
// 4 cm bone that is the difference between "it knocked it" and "it went through it" — and the depth
// depends on the step rate, not on anything the player did. So a throw is simulated at once,
// measured, and if any pair of bones overlapped by more than OVERLAP_LIMIT (or anything blew up)
// it is simulated again from the same start at a higher step rate, up to ten runs in all (rare: most throws are clean at the first rate). The accepted
// run is recorded and the picture plays it back, which also makes what the player sees independent
// of how fast their phone is, and lets the history replay any throw.
//
// Everything is deterministic: the same setup gives the same recording, bit for bit.

import {
  AsyqWorld,
  MAX_THROW_TIME,
  type BodyInit,
  type BodyKind,
  type BodyPose,
  type ContactEvent,
  type SurfaceId,
} from "./physics";
import { classifyFace } from "./faces";
import type { Quat, Vec3 } from "./math";

/** The hardest the sakha can be thrown, m/s, and the fastest it can be set spinning, rad/s. */
export const MAX_SPEED = 5.5;
export const MAX_SPIN = 30;

/** Frames recorded per simulated second. */
export const FRAME_HZ = 120;
/**
 * Step rates tried in turn until a run is clean. How deep an impact sinks depends on where the
 * steps happen to fall relative to the instant of contact, so rates that are not simple multiples
 * of each other are worth trying: a rerun at 840 Hz often clears what 480 and 960 do not.
 */
export const STEP_LADDER = [480, 600, 720, 840, 960, 1200, 1440, 1920, 2400, 3000] as const;
/** The deepest two bones (or a bone and the floor) may overlap in an accepted run, metres. */
export const OVERLAP_LIMIT = 0.002;
/**
 * A body this far from the middle of the floor (which is ±ARENA_HALF), or this fast, means the
 * simulation blew up. The farthest an honest throw goes is a sakha sliding on ice, about 30 m.
 */
export const ARENA_RADIUS = 50;
export const MAX_BODY_SPEED = 40;

export interface ThrowSetup {
  surface: SurfaceId;
  /** Every body at its starting pose, in a fixed order. */
  bodies: BodyInit[];
  launch: { id: string; velocity: Vec3; angular: Vec3 };
}

export interface AttemptReport {
  hz: number;
  maxOverlap: number;
  valid: boolean;
  reason?: string;
}

export interface Recording {
  ids: string[];
  kinds: BodyKind[];
  /** Seconds between frames. */
  frameDt: number;
  /** Per frame, 7 numbers per body in `ids` order: x y z, then the quaternion x y z w. */
  frames: Float64Array[];
}

export interface Simulation {
  recording: Recording;
  contacts: ContactEvent[];
  /** Where every body ended up, with the side each lies on. */
  final: BodyPose[];
  /** Seconds simulated. */
  duration: number;
  /** Step rate of the accepted run. */
  hz: number;
  /** Deepest overlap seen in the accepted run, metres. */
  maxOverlap: number;
  /** False if nothing came to rest in time and the bodies were stopped where they were. */
  settled: boolean;
  /** False if no run met OVERLAP_LIMIT: the least bad was kept. */
  clean: boolean;
  attempts: AttemptReport[];
}

interface Attempt {
  report: AttemptReport;
  recording: Recording;
  contacts: ContactEvent[];
  final: BodyPose[];
  duration: number;
  settled: boolean;
}

const STEPS_PER_SLICE = 96;

function* runAttempt(setup: ThrowSetup, hz: number, limit: number): Generator<void, Attempt> {
  const w = AsyqWorld.createReady({ surface: setup.surface, hz });
  for (const b of setup.bodies) w.addBody(b);
  w.launch(setup.launch.id, setup.launch.velocity, setup.launch.angular);

  const ids = w.ids();
  const kinds = setup.bodies.map((b) => b.kind);
  const frameEvery = Math.max(1, Math.round(hz / FRAME_HZ));
  const sampleEvery = Math.max(1, Math.round(hz / 480));
  const frames: Float64Array[] = [];
  const contacts: ContactEvent[] = [];
  const record = () => {
    const f = new Float64Array(ids.length * 7);
    ids.forEach((id, i) => {
      const p = w.pose(id);
      f.set([...p.position, ...p.rotation], i * 7);
    });
    frames.push(f);
  };
  record();

  let maxOverlap = 0;
  let reason: string | undefined;
  let settled = true;
  while (true) {
    w.step();
    contacts.push(...w.drainContacts());
    if (w.steps % sampleEvery === 0) maxOverlap = Math.max(maxOverlap, w.maxPenetration());
    if (w.steps % frameEvery === 0) {
      record();
      const last = frames[frames.length - 1];
      for (let i = 0; i < ids.length && !reason; i++) {
        const [x, y, z] = [last[i * 7], last[i * 7 + 1], last[i * 7 + 2]];
        if (!Number.isFinite(x + y + z) || Math.hypot(x, z) > ARENA_RADIUS || y > 3 || y < -0.5) reason = `${ids[i]} left the arena`;
        else if (Math.hypot(...w.pose(ids[i]).velocity) > MAX_BODY_SPEED) reason = `${ids[i]} reached ${MAX_BODY_SPEED} m/s`;
      }
      if (reason) break;
    }
    if (w.allAtRest()) break;
    if (w.time >= MAX_THROW_TIME) {
      settled = false;
      w.freeze();
      break;
    }
    if (w.steps % STEPS_PER_SLICE === 0) yield;
  }
  if (frames.length === 0 || w.steps % frameEvery !== 0) record();
  const duration = w.time;
  const final = w.poses().map((p) => (p.face === undefined ? { ...p, face: classifyFace(p.rotation).face } : p));
  w.dispose();
  const valid = !reason && maxOverlap <= limit;
  return {
    report: { hz, maxOverlap, valid, ...(reason ? { reason } : maxOverlap > limit ? { reason: `overlap ${(maxOverlap * 1000).toFixed(2)} mm` } : {}) },
    recording: { ids, kinds, frameDt: frameEvery / hz, frames },
    contacts,
    final,
    duration,
    settled,
  };
}

/** Runs the ladder of step rates; yields now and then so a caller can give the browser a turn. */
export function* simulateSteps(setup: ThrowSetup, ladder: readonly number[] = STEP_LADDER, limit: number = OVERLAP_LIMIT): Generator<void, Simulation> {
  const reports: AttemptReport[] = [];
  let best: Attempt | null = null;
  for (const hz of ladder) {
    const a: Attempt = yield* runAttempt(setup, hz, limit);
    reports.push(a.report);
    const blown = a.report.reason !== undefined && !a.report.reason.startsWith("overlap");
    if (!best || (!blown && (best.report.reason !== undefined && !best.report.reason.startsWith("overlap") ? true : a.report.maxOverlap < best.report.maxOverlap))) best = a;
    if (a.report.valid) {
      best = a;
      break;
    }
  }
  const b = best!;
  return {
    recording: b.recording,
    contacts: b.contacts,
    final: b.final,
    duration: b.duration,
    hz: b.report.hz,
    maxOverlap: b.report.maxOverlap,
    settled: b.settled,
    clean: b.report.valid,
    attempts: reports,
  };
}

/** The whole throw at once. Needs loadPhysics() to have resolved. */
export function simulateThrow(setup: ThrowSetup, ladder?: readonly number[], limit?: number): Simulation {
  const g = simulateSteps(setup, ladder, limit);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/** The same, giving the browser a turn between slices so the page stays alive. */
export async function simulateThrowAsync(setup: ThrowSetup, ladder?: readonly number[], limit?: number): Promise<Simulation> {
  const g = simulateSteps(setup, ladder, limit);
  let last = typeof performance !== "undefined" ? performance.now() : 0;
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
    const now = performance.now();
    if (now - last > 10) {
      await new Promise<void>((res) => setTimeout(res, 0));
      last = performance.now();
    }
  }
}

/** The pose of body `i` at time t (seconds into the recording), interpolated between frames. */
export function poseAt(rec: Recording, i: number, t: number): { position: Vec3; rotation: Quat } {
  const f = Math.max(0, Math.min(rec.frames.length - 1, t / rec.frameDt));
  const a = Math.floor(f), b = Math.min(rec.frames.length - 1, a + 1), k = f - a;
  const A = rec.frames[a], B = rec.frames[b], o = i * 7;
  const position: Vec3 = [A[o] + (B[o] - A[o]) * k, A[o + 1] + (B[o + 1] - A[o + 1]) * k, A[o + 2] + (B[o + 2] - A[o + 2]) * k];
  // nlerp the quaternion, taking the short way round
  let d = A[o + 3] * B[o + 3] + A[o + 4] * B[o + 4] + A[o + 5] * B[o + 5] + A[o + 6] * B[o + 6];
  const sgn = d < 0 ? -1 : 1;
  const q: Quat = [0, 0, 0, 0];
  for (let j = 0; j < 4; j++) q[j] = A[o + 3 + j] * (1 - k) + sgn * B[o + 3 + j] * k;
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  d = 0;
  return { position, rotation: [q[0] / l, q[1] / l, q[2] / l, q[3] / l] };
}

export const recordingDuration = (rec: Recording) => (rec.frames.length - 1) * rec.frameDt;
