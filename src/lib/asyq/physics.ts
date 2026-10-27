// The rigid-body world of the asyq game: real-size bones (a 4 cm asyq, a heavier 6 cm sakha) on a
// floor, in SI units, stepped at a fixed 240 Hz by Rapier.
//
// What makes the result repeatable: the step is fixed (never the frame time), nothing here reads a
// clock or Math.random, and bodies are always created in the same order. The same throw on the same
// layout therefore ends in the same poses whether it is run at once in a test, or a frame at a time
// in a browser at any frame rate: the world is a function of how many steps it has taken.
//
// Each body is a convex hull of the scan (model.generated.ts) with its own mass, friction and
// bounce. Rapier's solver keeps convex bodies from sinking into each other or the floor; CCD keeps
// a fast sakha from skipping through a bone. maxPenetration() and lowestPoint() let the tests check
// that, and the faces of resting bones are named only once they have stopped (FaceTracker).

import RAPIER from "@dimforge/rapier3d-compat";
import { HULL_VERTICES } from "./model.generated";
import { FaceTracker, type FaceId } from "./faces";
import { qRotate, type Quat, type Vec3 } from "./math";

export const STEP = 1 / 240;
export const GRAVITY = 9.81;
/** The asyq's long axis, metres. A real one is 3.5–4.5 cm. */
export const ASYQ_LENGTH = 0.04;
/** Bone, kg/m³ — gives a 33 g asyq with this scan's volume. */
export const ASYQ_DENSITY = 1800;

/** A body is at rest when slower than this (m/s and rad/s)… */
export const REST_LINEAR = 0.01;
export const REST_ANGULAR = 0.2;
/** …for this long. Seconds. */
export const REST_TIME = 0.5;
export const REST_STEPS = Math.round(REST_TIME / STEP);
/** A throw that has not settled by now is stopped where it is and flagged. Seconds. */
export const MAX_THROW_TIME = 14;

/** Half the side of the floor, metres: a sakha sliding on ice can go a long way. */
export const ARENA_HALF = 60;

export type SurfaceId = "topyraq" | "agash" | "shop" | "qum" | "muz";

/** The floor. Friction is combined with the bone's by taking the smaller, so ice is slippery and sand is no grippier than bone on bone. */
export const SURFACES: Record<SurfaceId, { name: string; friction: number; restitution: number }> = {
  topyraq: { name: "Топырақ", friction: 0.55, restitution: 0.2 },
  agash: { name: "Ағаш еден", friction: 0.35, restitution: 0.35 },
  shop: { name: "Шөп", friction: 0.4, restitution: 0.12 },
  qum: { name: "Құм", friction: 0.6, restitution: 0.05 },
  muz: { name: "Мұз", friction: 0.05, restitution: 0.2 },
};

export const BONE_FRICTION = 0.45;
export const BONE_RESTITUTION = 0.2;

export type BodyKind = "asyq" | "sakha";

export interface BodyInit {
  id: string;
  kind: BodyKind;
  /** Long axis, metres. */
  length: number;
  /** Kilograms; omitted: the bone's own density gives it. */
  mass?: number;
  /** Centre of mass, metres. */
  position: Vec3;
  rotation: Quat;
}

export interface BodyPose {
  id: string;
  kind: BodyKind;
  position: Vec3;
  rotation: Quat;
  velocity: Vec3;
  angular: Vec3;
  /** Settled side, once it has settled (null = on an edge or an end); undefined while it moves. */
  face: FaceId | null | undefined;
  /** How long it has been at rest, seconds. */
  quiet: number;
}

export interface ContactEvent {
  a: string;
  b: string;
  started: boolean;
  /** Simulated time, seconds. */
  time: number;
}

interface Entry {
  init: BodyInit;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  tracker: FaceTracker;
  quietSteps: number;
}

let ready: Promise<void> | null = null;
/** Loads the physics engine's WebAssembly once. */
export function loadPhysics(): Promise<void> {
  return (ready ??= RAPIER.init());
}

export interface WorldOptions {
  surface: SurfaceId;
  /** Physics steps per second (default 1/STEP). */
  hz?: number;
  /** Thickness the engine adds to every bone when looking for contacts, metres. */
  skin?: number;
}

export class AsyqWorld {
  private readonly world: RAPIER.World;
  private readonly events = new RAPIER.EventQueue(true);
  private readonly ground: RAPIER.Collider;
  private readonly entries = new Map<string, Entry>();
  private readonly byCollider = new Map<number, string>();
  private pending: ContactEvent[] = [];
  /** Number of steps taken. */
  steps = 0;

  /** Seconds per step. */
  readonly dt: number;
  /** Steps a body must stay quiet to count as at rest. */
  private readonly restSteps: number;

  private constructor(readonly surface: SurfaceId, hz: number, readonly skin: number) {
    this.dt = 1 / hz;
    this.restSteps = Math.round(REST_TIME / this.dt);
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = this.dt;
    // everything here is a few centimetres across: tell the solver, or its tolerances are far too coarse
    this.world.lengthUnit = 0.05;
    this.world.numSolverIterations = 6;
    this.world.maxCcdSubsteps = 2;
    const s = SURFACES[surface];
    this.ground = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(ARENA_HALF, 0.5, ARENA_HALF)
        .setTranslation(0, -0.5, 0)
        .setFriction(s.friction)
        .setRestitution(s.restitution)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
    );
  }

  static async create(options: WorldOptions): Promise<AsyqWorld> {
    await loadPhysics();
    return AsyqWorld.createReady(options);
  }

  /** Like create(), for code that has already awaited loadPhysics(). */
  static createReady(options: WorldOptions): AsyqWorld {
    return new AsyqWorld(options.surface, options.hz ?? 1 / STEP, options.skin ?? 0);
  }

  /** The engine's world, for tuning experiments in tests. */
  get raw(): RAPIER.World {
    return this.world;
  }

  /** Simulated time, seconds. */
  get time(): number {
    return this.steps * this.dt;
  }

  ids(): string[] {
    return [...this.entries.keys()];
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  addBody(init: BodyInit): void {
    if (this.entries.has(init.id)) throw new Error(`body ${init.id} already exists`);
    const [x, y, z] = init.position;
    const [qx, qy, qz, qw] = init.rotation;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation({ x: qx, y: qy, z: qz, w: qw }).setCcdEnabled(true).setAngularDamping(0.2)
    );
    const pts = new Float32Array(HULL_VERTICES.length);
    for (let i = 0; i < pts.length; i++) pts[i] = HULL_VERTICES[i] * init.length;
    const desc = RAPIER.ColliderDesc.convexHull(pts);
    if (!desc) throw new Error("the asyq hull is degenerate");
    desc
      .setFriction(BONE_FRICTION)
      .setRestitution(BONE_RESTITUTION)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setContactSkin(this.skin)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
    if (init.mass !== undefined) desc.setMass(init.mass);
    else desc.setDensity(ASYQ_DENSITY);
    const collider = this.world.createCollider(desc, body);
    this.entries.set(init.id, { init, body, collider, tracker: new FaceTracker(this.restSteps), quietSteps: 0 });
    this.byCollider.set(collider.handle, init.id);
  }

  removeBody(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.byCollider.delete(e.collider.handle);
    this.world.removeRigidBody(e.body);
    this.entries.delete(id);
  }

  /** Gives a body its throw: a velocity (m/s) and a spin (rad/s). */
  launch(id: string, velocity: Vec3, angular: Vec3 = [0, 0, 0]): void {
    const e = this.entry(id);
    e.body.setLinvel({ x: velocity[0], y: velocity[1], z: velocity[2] }, true);
    e.body.setAngvel({ x: angular[0], y: angular[1], z: angular[2] }, true);
    e.quietSteps = 0;
    e.tracker.reset();
  }

  /** One fixed step. */
  step(): void {
    this.world.step(this.events);
    this.steps++;
    this.events.drainCollisionEvents((h1, h2, started) => {
      const a = this.byCollider.get(h1), b = this.byCollider.get(h2);
      if (a !== undefined && b !== undefined) this.pending.push({ a, b, started, time: this.time });
    });
    for (const e of this.entries.values()) {
      const v = e.body.linvel(), w = e.body.angvel();
      const moving = Math.hypot(v.x, v.y, v.z) >= REST_LINEAR || Math.hypot(w.x, w.y, w.z) >= REST_ANGULAR;
      e.quietSteps = moving ? 0 : e.quietSteps + 1;
      const r = e.body.rotation();
      e.tracker.update([r.x, r.y, r.z, r.w], moving);
    }
  }

  stepMany(n: number): void {
    for (let i = 0; i < n; i++) this.step();
  }

  /** Contacts that started or ended since the last call. */
  drainContacts(): ContactEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  /** True when every body has been quiet for REST_TIME. */
  allAtRest(): boolean {
    for (const e of this.entries.values()) if (e.quietSteps < this.restSteps) return false;
    return true;
  }

  /** Stops every body where it is. Used when a throw runs out of time, so the result is at least a still picture. */
  freeze(): void {
    for (const e of this.entries.values()) {
      e.body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      e.body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      e.body.sleep();
    }
  }

  pose(id: string): BodyPose {
    const e = this.entry(id);
    const p = e.body.translation(), r = e.body.rotation(), v = e.body.linvel(), w = e.body.angvel();
    return {
      id,
      kind: e.init.kind,
      position: [p.x, p.y, p.z],
      rotation: [r.x, r.y, r.z, r.w],
      velocity: [v.x, v.y, v.z],
      angular: [w.x, w.y, w.z],
      face: e.tracker.result,
      quiet: e.quietSteps * this.dt,
    };
  }

  poses(): BodyPose[] {
    return [...this.entries.keys()].map((id) => this.pose(id));
  }

  /**
   * The deepest any two bones, or a bone and the floor, overlap right now, metres (0 when none do).
   * Bone against bone is the engine's own contact distance; bone against floor is worked out from
   * the hull directly (how far its lowest point is below y = 0), because the engine's distance for
   * the floor's large box occasionally reports a metre-deep contact that is not there.
   */
  maxPenetration(): number {
    let worst = 0;
    // the engine measures between the skinned shapes: add the skin back to get the real hulls' distance
    const note = (m: RAPIER.TempContactManifold) => {
      for (let i = 0; i < m.numContacts(); i++) worst = Math.max(worst, -(m.contactDist(i) + 2 * this.skin));
    };
    const list = [...this.entries.values()];
    for (let i = 0; i < list.length; i++) {
      worst = Math.max(worst, -lowestPointOf(this.positionOf(list[i]), this.rotationOf(list[i]), list[i].init.length));
      for (let j = i + 1; j < list.length; j++) this.world.contactPair(list[i].collider, list[j].collider, note);
    }
    return worst;
  }

  private positionOf(e: Entry): Vec3 {
    const p = e.body.translation();
    return [p.x, p.y, p.z];
  }

  private rotationOf(e: Entry): Quat {
    const r = e.body.rotation();
    return [r.x, r.y, r.z, r.w];
  }

  /** Height of the lowest point of a body above the floor, metres: 0 when it lies on it, positive when it is held up or in the air. */
  lowestPoint(id: string): number {
    const p = this.pose(id);
    return lowestPointOf(p.position, p.rotation, this.entry(id).init.length);
  }

  dispose(): void {
    this.events.free();
    this.world.free();
    this.entries.clear();
    this.byCollider.clear();
  }

  private entry(id: string): Entry {
    const e = this.entries.get(id);
    if (!e) throw new Error(`no body ${id}`);
    return e;
  }
}

/** Height a bone of this length must be at to just touch the floor in this orientation. */
export function restingHeight(rotation: Quat, length: number): number {
  let low = Infinity;
  for (let i = 0; i < HULL_VERTICES.length; i += 3) {
    low = Math.min(low, qRotate(rotation, [HULL_VERTICES[i] * length, HULL_VERTICES[i + 1] * length, HULL_VERTICES[i + 2] * length])[1]);
  }
  return -low;
}

/** Height of the lowest point of a bone of this length at this pose above the floor, metres. */
export function lowestPointOf(position: Vec3, rotation: Quat, length: number): number {
  let low = Infinity;
  for (let i = 0; i < HULL_VERTICES.length; i += 3) {
    const w = qRotate(rotation, [HULL_VERTICES[i] * length, HULL_VERTICES[i + 1] * length, HULL_VERTICES[i + 2] * length]);
    low = Math.min(low, position[1] + w[1]);
  }
  return low;
}
