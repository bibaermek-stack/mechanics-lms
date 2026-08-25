// Laboratory work 7: the simple pendulum and its period.
//
// The equation of motion is integrated in full — θ̈ = −(g/L)·sin θ, not the
// small-angle approximation — so the measured period drifts above 2π√(L/g) as
// the amplitude grows. That gap is the point of the third task, and it only
// exists if the physics is not linearised.
//
// The photogate sits at the bottom of the swing and times the crossings, which
// is exactly how the period is measured on the real bench.

import {
  BENCH_H,
  buildBench,
  buildPendulumBob,
  buildStand,
  buildString,
  spanCylinder,
} from "../three-models";
import { loadPascoDevice } from "../pasco-loader";
import type { LabRig, RigContext, RigParams } from "../types";
import type * as THREE_NS from "three";

const G = 9.81;
/**
 * How far above the bench the bob hangs at rest.
 *
 * The scanned Smart Gate is an inverted U — a solid bridge across the top — so
 * a bob hung at bridge height would sit inside it and the string would pass
 * straight through it. The gate is therefore turned over to open upwards, the
 * way a photogate is set under a swinging bob, and the bob rides low enough to
 * cross the beam between the legs with the string clear above them.
 */
const BOB_CLEARANCE = 0.062;
/** The stand's rod. The clamp slides on it as the string length changes. */
const ROD_H = 1.16;

interface State {
  /** Angle from vertical, radians. */
  theta: number;
  /** Angular velocity, rad/s. */
  omega: number;
  /** Simulated time, kept locally so crossings can be timed. */
  t: number;
  lastCrossing: number;
  period: number;
  /** Sign of θ on the previous step, for crossing detection. */
  sign: number;
}

export function createPendulumRig({ THREE, params }: RigContext): LabRig {
  const object = new THREE.Group();
  object.name = "rig-pendulum";
  const content = new THREE.Group();
  object.add(content);

  content.add(buildBench(THREE, { width: 1.5, depth: 0.7 }));

  // Stand at the back of the bench with a boom reaching over the middle. The
  // clamp slides up the rod as the string is lengthened, which is how the
  // apparatus is actually set up: the bob always ends up just above the bench,
  // inside the photogate beam, whatever length is being tested.
  const stand = buildStand(THREE, { height: ROD_H });
  stand.position.set(-0.42, BENCH_H, -0.16);
  content.add(stand);

  const head = new THREE.Group();
  content.add(head);
  const boom = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.46, 14),
    new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.35, metalness: 0.85 })
  );
  boom.castShadow = true;
  boom.rotation.z = Math.PI / 2;
  boom.position.set(-0.21, 0, -0.16);
  head.add(boom);
  const boomZ = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.16, 14),
    new THREE.MeshStandardMaterial({ color: "#6b7280", roughness: 0.35, metalness: 0.85 })
  );
  boomZ.rotation.x = Math.PI / 2;
  boomZ.position.set(0, 0, -0.08);
  head.add(boomZ);
  // Clamp block where the boom meets the rod.
  const clamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.05, 0.032),
    new THREE.MeshStandardMaterial({ color: "#3f4753", roughness: 0.5, metalness: 0.35 })
  );
  clamp.castShadow = true;
  clamp.position.set(-0.42, 0, -0.16);
  head.add(clamp);

  const pivot = new THREE.Vector3();

  const string = buildString(THREE);
  content.add(string);

  const bob = buildPendulumBob(THREE, { radius: 0.024 });
  content.add(bob);

  // Photogate at the bottom of the swing, timing every crossing. Turned over so
  // its opening faces up: the bob drops into it and the string stays clear.
  const gate = new THREE.Group();
  gate.rotation.z = Math.PI;
  gate.position.set(0, BENCH_H, 0);
  const gateScan = loadPascoDevice(THREE, "smartGate");
  gate.add(gateScan.object);
  content.add(gate);
  // Flipping puts the model below its own origin, so it is lifted by its own
  // height once the scan has been measured.
  void gateScan.ready.then((size) => gate.position.set(0, BENCH_H + size.y, 0));

  const sensor = new THREE.Group();
  sensor.position.set(-0.6, BENCH_H, 0);
  sensor.rotation.y = Math.PI / 2;
  sensor.add(loadPascoDevice(THREE, "motionSensor").object);
  content.add(sensor);

  // Angle scale under the pivot: a tick every five degrees, ±40°. It rides
  // with the clamp, so it stays centred on the swing at any string length.
  const scaleMat = new THREE.MeshBasicMaterial({ color: "#94a3b8" });
  const majorMat = new THREE.MeshBasicMaterial({ color: "#3366ff" });
  for (let deg = -40; deg <= 40; deg += 5) {
    const major = deg % 20 === 0;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.0025, major ? 0.028 : 0.016, 0.0025),
      major ? majorMat : scaleMat
    );
    const rad = (deg * Math.PI) / 180;
    const r = 0.15;
    tick.position.set(Math.sin(rad) * r, -Math.cos(rad) * r, 0.02);
    tick.rotation.z = -rad;
    head.add(tick);
  }
  // The vertical, so "zero" is visible.
  const plumb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0008, 0.0008, 0.13, 6),
    new THREE.MeshBasicMaterial({ color: "#475569" })
  );
  plumb.position.set(0, -0.075, 0.02);
  head.add(plumb);

  const state: State = {
    theta: ((params.amplitude ?? 15) * Math.PI) / 180,
    omega: 0,
    t: 0,
    lastCrossing: -1,
    period: 0,
    sign: 1,
  };
  let current: RigParams = { ...params };

  const bobPos = new THREE.Vector3();

  function sync(p: RigParams) {
    const L = p.length;
    // Raise the clamp so the bob rests just above the bench, then hang from it.
    head.position.set(0, BENCH_H + L + BOB_CLEARANCE, 0);
    pivot.set(0, head.position.y, 0);
    bobPos.set(Math.sin(state.theta) * L, pivot.y - Math.cos(state.theta) * L, 0);
    bob.position.copy(bobPos);
    // A heavier bob is drawn bigger — the only visible difference mass makes,
    // which is the answer the first task is fishing for. Capped so the largest
    // bob still clears the sides of the photogate opening.
    const s = 0.72 + p.mass * 0.9;
    bob.scale.setScalar(s);
    spanCylinder(THREE, string, pivot, bobPos);
  }

  sync(params);

  return {
    object,

    reset(p: RigParams) {
      current = p;
      state.theta = (p.amplitude * Math.PI) / 180;
      state.omega = 0;
      state.t = 0;
      state.lastCrossing = -1;
      state.period = 0;
      state.sign = Math.sign(state.theta) || 1;
      sync(p);
    },

    step(h: number, p: RigParams) {
      current = p;
      const L = Math.max(p.length, 0.05);

      // Semi-implicit Euler at the 2 ms step the host runs is stable here and
      // conserves amplitude well enough that the period stays honest.
      state.omega += -(G / L) * Math.sin(state.theta) * h;
      state.theta += state.omega * h;
      state.t += h;

      const sign = Math.sign(state.theta) || state.sign;
      if (sign !== state.sign) {
        state.sign = sign;
        // A full period is two crossings of the vertical.
        if (sign < 0) {
          if (state.lastCrossing >= 0) state.period = state.t - state.lastCrossing;
          state.lastCrossing = state.t;
        }
      }

      sync(p);
    },

    read() {
      const L = Math.max(current.length, 0.05);
      return {
        theta: (state.theta * 180) / Math.PI,
        omega: state.omega,
        Ttheory: 2 * Math.PI * Math.sqrt(L / G),
        Tmeasured: state.period,
      };
    },

    finished: () => false,

    dispose() {},
  };
}
