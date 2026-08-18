// Laboratory works 1–2: uniform and uniformly accelerated motion.
//
// A Smart Cart runs along the 1,2 m dynamics track while the Wireless Motion
// Sensor at the near end pings it with ultrasound. The pings are drawn as
// expanding rings — in a headset they are what makes the sensor read as an
// instrument that is doing something, rather than a box sitting on a bench.

import {
  BENCH_H,
  TRACK_H,
  TRACK_L,
  buildArrow,
  buildBench,
  buildTrack,
  buildTrail,
  type ArrowModel,
  type TrailModel,
} from "../three-models";
import { loadPascoDevice } from "../pasco-loader";
import type { LabRig, RigContext, RigParams } from "../types";
import type * as THREE_NS from "three";

/** The cart cannot get closer to either end stop than this. */
const X_MIN = 0.13;
const X_MAX = TRACK_L - 0.13;
const CART_Y = BENCH_H + TRACK_H;

interface State {
  x: number;
  v: number;
  a: number;
  path: number;
  stopped: boolean;
}

export function createKinematicsRig({ THREE, params }: RigContext): LabRig {
  const object = new THREE.Group();
  object.name = "rig-kinematics";

  // Everything is modelled in track coordinates (x = 0 at the near end stop)
  // and then shifted so the rig is centred on its own origin — a student
  // dropped into the scene should face the middle of the track, not its end.
  const content = new THREE.Group();
  content.position.x = -TRACK_L / 2;
  object.add(content);

  content.add(buildBench(THREE, { width: 1.7, depth: 0.7 }).translateX(TRACK_L / 2));
  content.add(buildTrack(THREE, { length: TRACK_L }));

  const cart = new THREE.Group();
  cart.position.set(params.x0 ?? 0.2, CART_Y, 0);
  cart.add(loadPascoDevice(THREE, "smartCart").object);
  content.add(cart);

  const sensor = new THREE.Group();
  sensor.position.set(-0.055, BENCH_H, 0);
  // The transducer faces +Z in the scan, so a quarter turn aims it down the track.
  sensor.rotation.y = Math.PI / 2;
  sensor.add(loadPascoDevice(THREE, "motionSensor").object);
  content.add(sensor);

  // Ultrasound pulses: three rings that expand as they travel to the cart.
  const pings: THREE_NS.Mesh[] = [];
  const pingMat = new THREE.MeshBasicMaterial({
    color: "#38bdf8",
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 3; i += 1) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.02, 0.026, 28), pingMat.clone());
    ring.rotation.y = Math.PI / 2;
    ring.visible = false;
    content.add(ring);
    pings.push(ring);
  }

  const trail: TrailModel = buildTrail(THREE, { count: 46, color: "#3366ff" });
  content.add(trail.object);

  const vArrow: ArrowModel = buildArrow(THREE, { color: "#10b981", radius: 0.005 });
  const aArrow: ArrowModel = buildArrow(THREE, { color: "#f59e0b", radius: 0.005 });
  content.add(vArrow.object, aArrow.object);

  const state: State = { x: params.x0 ?? 0.2, v: params.v0 ?? 0, a: params.a ?? 0, path: 0, stopped: false };
  let pingClock = 0;
  let trailClock = 0;

  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function sync() {
    cart.position.x = state.x;

    origin.set(state.x, CART_Y + 0.075, 0);
    dir.set(Math.sign(state.v) || 1, 0, 0);
    vArrow.set(origin, dir, Math.min(Math.abs(state.v) * 0.35, 0.4));

    origin.set(state.x, CART_Y + 0.115, 0);
    dir.set(Math.sign(state.a) || 1, 0, 0);
    aArrow.set(origin, dir, Math.min(Math.abs(state.a) * 0.3, 0.35));
  }

  sync();

  return {
    object,

    reset(p: RigParams) {
      state.x = p.x0;
      state.v = p.v0;
      state.a = p.a;
      state.path = 0;
      state.stopped = false;
      pingClock = 0;
      trailClock = 0;
      trail.clear();
      for (const ring of pings) ring.visible = false;
      sync();
    },

    step(h: number, p: RigParams) {
      if (!state.stopped) {
        state.a = p.a;
        state.v += state.a * h;
        state.x += state.v * h;
        state.path += Math.abs(state.v * h);
        if (state.x <= X_MIN || state.x >= X_MAX) {
          // The end stop absorbs the cart rather than bouncing it — the works
          // this rig serves are about reading a graph, not about collisions.
          state.x = Math.min(Math.max(state.x, X_MIN), X_MAX);
          state.v = 0;
          state.a = 0;
          state.stopped = true;
        }
      }

      // Ultrasound: a fresh pulse every 0,25 s, travelling at a slowed-down
      // speed so the eye can follow it.
      pingClock += h;
      for (let i = 0; i < pings.length; i += 1) {
        const age = (pingClock - i * 0.25) % 0.75;
        const ring = pings[i];
        if (age < 0) {
          ring.visible = false;
          continue;
        }
        const travel = age * 1.6;
        if (travel > state.x) {
          ring.visible = false;
          continue;
        }
        ring.visible = true;
        ring.position.set(travel, BENCH_H + 0.045, 0);
        const s = 1 + travel * 3;
        ring.scale.set(s, s, 1);
        (ring.material as THREE_NS.MeshBasicMaterial).opacity = 0.42 * (1 - travel / Math.max(state.x, 0.2));
      }

      trailClock += h;
      if (trailClock > 0.08) {
        trailClock = 0;
        trail.push(new THREE.Vector3(state.x, CART_Y + 0.055, -0.075));
      }

      sync();
    },

    read() {
      return { x: state.x, v: state.v, a: state.a, path: state.path };
    },

    finished: () => state.stopped,

    dispose() {
      trail.clear();
    },
  };
}
