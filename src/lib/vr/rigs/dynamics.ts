// Laboratory works 3–4: Newton's second law and the coefficient of friction.
//
// The cart is pulled along the track by a string that runs over a bench pulley
// to a hanging mass. Standing beside the bench in VR, the weight hangs below
// the worktop where a student can look down at it — the part of this experiment
// that a fixed camera on a flat screen always hides.

import {
  BENCH_H,
  TRACK_H,
  TRACK_L,
  buildArrow,
  buildBench,
  buildHangingMass,
  buildPulley,
  buildString,
  buildTrack,
  spanCylinder,
  type ArrowModel,
} from "../three-models";
import { loadPascoDevice } from "../pasco-loader";
import type { LabRig, RigContext, RigParams } from "../types";
import type * as THREE_NS from "three";

const G = 9.81;
const X_START = 0.16;
const X_MAX = TRACK_L - 0.2;
const CART_Y = BENCH_H + TRACK_H;
/** Height of the string above the track: the cart's tow hook. */
const STRING_Y = CART_Y + 0.035;
const PULLEY_X = TRACK_L + 0.055;
const PULLEY_R = 0.026;

interface State {
  x: number;
  v: number;
  a: number;
  /** How far the hanging mass has dropped. */
  drop: number;
  stopped: boolean;
  sheave: number;
}

/** Acceleration of the pair, and whether the system moves at all. */
function solve(p: RigParams) {
  const pull = p.mHang * G;
  const friction = p.mu * p.mCart * G;
  if (pull <= friction) return { a: 0, moving: false, friction: pull };
  return { a: (pull - friction) / (p.mCart + p.mHang), moving: true, friction };
}

export function createDynamicsRig({ THREE, params }: RigContext): LabRig {
  const object = new THREE.Group();
  object.name = "rig-dynamics";
  const content = new THREE.Group();
  content.position.x = -TRACK_L / 2;
  object.add(content);

  content.add(buildBench(THREE, { width: 1.7, depth: 0.7 }).translateX(TRACK_L / 2));
  content.add(buildTrack(THREE, { length: TRACK_L }));

  const cart = new THREE.Group();
  cart.position.set(X_START, CART_Y, 0);
  cart.add(loadPascoDevice(THREE, "smartCart").object);
  content.add(cart);

  // Photogate straddling the track, where the cart's speed is timed.
  const gate = new THREE.Group();
  gate.position.set(0.92, BENCH_H + TRACK_H + 0.008, 0);
  gate.add(loadPascoDevice(THREE, "smartGate").object);
  content.add(gate);

  const pulley = buildPulley(THREE, { radius: PULLEY_R });
  pulley.position.set(PULLEY_X, STRING_Y + PULLEY_R, 0);
  content.add(pulley);
  const sheave = pulley.userData.sheave as THREE_NS.Group;

  // Two string segments: cart → pulley, and pulley → hanging mass.
  const pullString = buildString(THREE);
  const dropString = buildString(THREE);
  content.add(pullString, dropString);

  const hangerHolder = new THREE.Group();
  let hanger = buildHangingMass(THREE, { mass: params.mHang ?? 0.05 });
  hangerHolder.add(hanger);
  content.add(hangerHolder);
  let hangerMass = params.mHang ?? 0.05;

  const tensionArrow: ArrowModel = buildArrow(THREE, { color: "#3366ff", radius: 0.005 });
  const frictionArrow: ArrowModel = buildArrow(THREE, { color: "#ef4444", radius: 0.005 });
  const weightArrow: ArrowModel = buildArrow(THREE, { color: "#f59e0b", radius: 0.005 });
  content.add(tensionArrow.object, frictionArrow.object, weightArrow.object);

  const state: State = { x: X_START, v: 0, a: 0, drop: 0, stopped: false, sheave: 0 };
  // The readout is asked for values outside of a step, so the last parameters
  // used are kept here rather than threaded through `read`.
  let current: RigParams = { ...params };

  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function sync(p: RigParams) {
    cart.position.x = state.x;

    // Cart → pulley, along the track at hook height.
    p0.set(state.x + 0.06, STRING_Y, 0);
    p1.set(PULLEY_X, STRING_Y, 0);
    spanCylinder(THREE, pullString, p0, p1);

    // Pulley → hanging mass, straight down past the edge of the bench.
    const hangY = STRING_Y - 0.12 - state.drop;
    p0.set(PULLEY_X + PULLEY_R, STRING_Y + PULLEY_R, 0);
    p1.set(PULLEY_X + PULLEY_R, hangY, 0);
    spanCylinder(THREE, dropString, p0, p1);
    hangerHolder.position.set(PULLEY_X + PULLEY_R, hangY, 0);

    sheave.rotation.z = -state.sheave;

    const { a, friction } = solve(p);
    const tension = p.mHang * (G - a);

    p0.set(state.x + 0.06, STRING_Y + 0.045, 0);
    dir.set(1, 0, 0);
    tensionArrow.set(p0, dir, Math.min(tension * 0.22, 0.34));

    p0.set(state.x - 0.06, CART_Y + 0.012, 0);
    dir.set(-1, 0, 0);
    frictionArrow.set(p0, dir, Math.min(friction * 0.22, 0.3));

    p0.set(PULLEY_X + PULLEY_R, hangY - 0.09, 0);
    dir.set(0, -1, 0);
    weightArrow.set(p0, dir, Math.min(p.mHang * G * 0.22, 0.3));
  }

  sync(params);

  return {
    object,

    reset(p: RigParams) {
      current = p;
      state.x = X_START;
      state.v = 0;
      state.a = 0;
      state.drop = 0;
      state.stopped = false;
      state.sheave = 0;
      // Restack the hanger only when the load actually changed — rebuilding a
      // handful of discs every reset would churn geometry for nothing.
      if (Math.abs(p.mHang - hangerMass) > 1e-6) {
        hangerHolder.remove(hanger);
        hanger = buildHangingMass(THREE, { mass: p.mHang });
        hangerHolder.add(hanger);
        hangerMass = p.mHang;
      }
      sync(p);
    },

    step(h: number, p: RigParams) {
      current = p;
      if (!state.stopped) {
        const { a, moving } = solve(p);
        state.a = a;
        if (moving) {
          state.v += a * h;
          state.x += state.v * h;
          state.drop += state.v * h;
          state.sheave += (state.v / PULLEY_R) * h;
        }
        // The run ends when the cart reaches the gate end of the track or the
        // weight has run out of floor.
        if (state.x >= X_MAX || state.drop >= 0.55) {
          state.x = Math.min(state.x, X_MAX);
          state.v = 0;
          state.a = 0;
          state.stopped = true;
        }
      }
      sync(p);
    },

    read() {
      const { friction } = solve(current);
      return {
        a: state.a,
        v: state.v,
        T: current.mHang * (G - state.a),
        Ffr: friction,
      };
    },

    finished: () => state.stopped,

    dispose() {},
  };
}
