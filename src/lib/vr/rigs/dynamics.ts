// Laboratory works 3–4: Newton's second law and the coefficient of friction.
//
// The cart is pulled along the track by a string that runs over a pulley
// clamped to the edge of the bench, down to a hanging mass. Standing beside the
// bench in VR, the weight hangs past the edge where a student can look down at
// it — the part of this experiment that a fixed camera on a flat screen always
// hides.
//
// The run has two phases, and both matter. While the weight is falling the pair
// accelerates together; when the weight reaches the floor the string goes slack
// and the cart coasts on, slowing under friction alone, until it either stops
// or reaches the end stop. Cutting the run off at the landing — as this rig
// first did — leaves the cart stranded halfway down a track it never finishes,
// short of the photogate that is supposed to time it.

import {
  BENCH_H,
  TRACK_H,
  TRACK_L,
  buildArrow,
  buildBench,
  buildBenchClamp,
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

/** Bench top: 1,5 m of it, ending just short of the pulley. */
const BENCH_W = 1.5;
const BENCH_CX = 0.5;
const BENCH_EDGE = BENCH_CX + BENCH_W / 2;

const X_START = 0.16;
/** The cart's centre when its nose meets the far end stop. */
const X_MAX = TRACK_L - 0.115;
const CART_Y = BENCH_H + TRACK_H;
/** Height of the string above the track: the cart's tow hook. */
const STRING_Y = CART_Y + 0.035;

const PULLEY_R = 0.026;
/** Far enough past the bench edge that the falling weight clears the top. */
const PULLEY_X = BENCH_EDGE + 0.012;
/** Where the string drops: the far tangent of the sheave. */
const DROP_X = PULLEY_X + PULLEY_R;

/** Top of the hanger relative to the string, and how far below it hangs. */
const HANGER_OFFSET = 0.12;
const HANGER_LENGTH = 0.13;
/** The weight touches the floor after this much drop. */
const DROP_MAX = STRING_Y - HANGER_OFFSET - HANGER_LENGTH;

/** Where the photogate straddles the track. */
const GATE_X = 0.92;
/**
 * The scanned Smart Gate is an inverted U with a 9,6 cm × 5,9 cm opening, and
 * the scanned cart is 9,8 cm across the wheels — two millimetres too wide to
 * pass between the legs. So the gate is raised on a pair of spacers to clear
 * the cart body, and the cart carries a flag that runs through the beam, which
 * is how a photogate is used with a dynamics cart anyway.
 */
const GATE_Y = CART_Y + 0.063;
/** Height of the cart's timing flag above the top of the cart. */
const FLAG_H = 0.055;

interface State {
  x: number;
  v: number;
  a: number;
  /** How far the hanging mass has dropped. */
  drop: number;
  /** The weight is on the floor: the string is slack from here on. */
  landed: boolean;
  stopped: boolean;
  sheave: number;
}

/** Acceleration of the pair while the string is taut, and whether it moves. */
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

  content.add(buildBench(THREE, { width: BENCH_W, depth: 0.7 }).translateX(BENCH_CX));
  content.add(buildTrack(THREE, { length: TRACK_L }));

  const cart = new THREE.Group();
  cart.position.set(X_START, CART_Y, 0);
  const cartScan = loadPascoDevice(THREE, "smartCart");
  cart.add(cartScan.object);
  content.add(cart);

  // Timing flag on the cart, sized to pass through the gate's opening. It is
  // added once the scan has been measured so it stands on top of the cart
  // rather than at a guessed height.
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, FLAG_H, 0.03),
    new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.7 })
  );
  flag.castShadow = true;
  cart.add(flag);
  void cartScan.ready.then((size) => flag.position.set(0, size.y + FLAG_H / 2, 0));

  // Photogate straddling the track, raised on spacers so the cart passes
  // beneath it and only the flag breaks the beam.
  const gate = new THREE.Group();
  gate.position.set(GATE_X, GATE_Y, 0);
  gate.add(loadPascoDevice(THREE, "smartGate").object);
  content.add(gate);
  const spacer = new THREE.BoxGeometry(0.03, GATE_Y - CART_Y, 0.022);
  const spacerMat = new THREE.MeshStandardMaterial({
    color: "#8d97a6",
    roughness: 0.4,
    metalness: 0.6,
  });
  for (const z of [-0.055, 0.055]) {
    const post = new THREE.Mesh(spacer, spacerMat);
    post.castShadow = true;
    post.position.set(GATE_X, (CART_Y + GATE_Y) / 2, z);
    content.add(post);
  }

  // The pulley is clamped to the bench edge, so the weight hangs past the top
  // rather than through it.
  const clamp = buildBenchClamp(THREE, { topThickness: 0.05 });
  clamp.position.set(BENCH_EDGE, BENCH_H, 0);
  content.add(clamp);

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

  const state: State = {
    x: X_START,
    v: 0,
    a: 0,
    drop: 0,
    landed: false,
    stopped: false,
    sheave: 0,
  };
  // The readout is asked for values outside of a step, so the last parameters
  // used are kept here rather than threaded through `read`.
  let current: RigParams = { ...params };

  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const dir = new THREE.Vector3();

  /** String tension. Zero once the weight is on the floor. */
  function tensionNow(p: RigParams) {
    if (state.landed) return 0;
    return p.mHang * (G - state.a);
  }

  function sync(p: RigParams) {
    cart.position.x = state.x;

    // Cart → pulley, along the track at hook height.
    p0.set(state.x + 0.06, STRING_Y, 0);
    p1.set(PULLEY_X, STRING_Y, 0);
    spanCylinder(THREE, pullString, p0, p1);

    // Pulley → hanging mass, straight down past the edge of the bench.
    const hangY = STRING_Y - HANGER_OFFSET - state.drop;
    p0.set(DROP_X, STRING_Y + PULLEY_R, 0);
    p1.set(DROP_X, hangY, 0);
    spanCylinder(THREE, dropString, p0, p1);
    hangerHolder.position.set(DROP_X, hangY, 0);

    sheave.rotation.z = -state.sheave;

    const tension = tensionNow(p);
    const friction = p.mu * p.mCart * G;

    p0.set(state.x + 0.06, STRING_Y + 0.045, 0);
    dir.set(1, 0, 0);
    tensionArrow.set(p0, dir, Math.min(tension * 0.22, 0.34));

    // Friction only opposes an actual motion (or an actual pull).
    p0.set(state.x - 0.06, CART_Y + 0.012, 0);
    dir.set(-1, 0, 0);
    const frictionShown = state.v > 1e-4 || tension > 0 ? Math.min(friction, tension || friction) : 0;
    frictionArrow.set(p0, dir, Math.min(frictionShown * 0.22, 0.3));

    p0.set(DROP_X, hangY - 0.09, 0);
    dir.set(0, -1, 0);
    weightArrow.set(p0, dir, state.landed ? 0 : Math.min(p.mHang * G * 0.22, 0.3));
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
      state.landed = false;
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
        if (!state.landed) {
          // Phase 1 — the weight is falling and the string is taut.
          const { a, moving } = solve(p);
          state.a = a;
          if (moving) {
            state.v += a * h;
            state.x += state.v * h;
            state.drop += state.v * h;
            state.sheave += (state.v / PULLEY_R) * h;
          }
          if (state.drop >= DROP_MAX) {
            state.drop = DROP_MAX;
            state.landed = true;
          }
        } else {
          // Phase 2 — slack string. The cart coasts, friction alone slowing it.
          const decel = p.mu * G;
          state.a = state.v > 0 ? -decel : 0;
          state.v = Math.max(0, state.v - decel * h);
          state.x += state.v * h;
          if (state.v <= 0) {
            state.a = 0;
            state.stopped = true; // came to rest on the track
          }
        }

        if (state.x >= X_MAX) {
          state.x = X_MAX;
          state.v = 0;
          state.a = 0;
          state.stopped = true; // reached the end stop
        }
      }
      sync(p);
    },

    read() {
      const { friction } = solve(current);
      return {
        a: state.a,
        v: state.v,
        T: tensionNow(current),
        // Once moving, friction is kinetic whatever the string is doing.
        Ffr: state.v > 1e-4 || state.landed ? current.mu * current.mCart * G : friction,
      };
    },

    finished: () => state.stopped,

    dispose() {},
  };
}
