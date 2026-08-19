// Procedural three.js models for the VR/AR laboratory.
//
// A-Frame supplies the room-scale environment — the XR session, the camera rig
// and the controllers — but every object inside the laboratory is built here in
// plain three.js, the same way the desktop simulations model their bench and
// track. Nothing is fetched from a CDN: the geometry is analytic and the only
// external assets are the scanned PASCO devices that already ship in
// `public/models`.
//
// A-Frame bundles its own copy of three.js (super-three), so a builder never
// imports THREE itself — the namespace is passed in by the caller, which hands
// over `AFRAME.THREE`. That keeps every object in the same three.js instance as
// the renderer that draws it. `ThreeNS` is the type of that namespace.
//
// All dimensions are metres and every rig sits on y = 0, so a bench really is
// 75 cm tall next to a 1,7 m student.

import type * as THREE_NS from "three";

export type ThreeNS = typeof THREE_NS;
export type Vec3 = [number, number, number];

/** Height of the laboratory bench top — everything on the bench sits at this y. */
export const BENCH_H = 0.75;
/** Distance from the bench top to the running surface of the dynamics track. */
export const TRACK_H = 0.032;
/** Standard PASCO dynamics track length. */
export const TRACK_L = 1.2;

export const MAT = {
  alu: "#b9c2cf",
  aluDark: "#8d97a6",
  steel: "#6b7280",
  pascoBlue: "#1e5aa8",
  benchTop: "#eceef2",
  benchEdge: "#334155",
  wall: "#dfe6f0",
  wallLower: "#c3ceda",
  floor: "#b7bfc9",
  ceiling: "#f3f6fa",
  accent: "#3366ff",
  danger: "#ef4444",
} as const;

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function std(
  THREE: ThreeNS,
  color: string,
  roughness = 0.55,
  metalness = 0.15,
  extra: Record<string, unknown> = {}
) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function mesh(
  THREE: ThreeNS,
  geometry: THREE_NS.BufferGeometry,
  material: THREE_NS.Material,
  position?: Vec3,
  rotation?: Vec3
) {
  const m = new THREE.Mesh(geometry, material);
  if (position) m.position.set(...position);
  if (rotation) m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Points a unit-height cylinder (three.js builds them along +Y) from `from` to
 * `to` and stretches it to span the gap. Used for every string, rod and cable.
 */
export function spanCylinder(
  THREE: ThreeNS,
  m: THREE_NS.Object3D,
  from: THREE_NS.Vector3,
  to: THREE_NS.Vector3
) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 1e-6) {
    m.visible = false;
    return;
  }
  m.visible = true;
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.scale.set(1, len, 1);
}

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

/**
 * The laboratory shell: floor, four walls, ceiling and a window band.
 *
 * It exists so that a student wearing a headset has somewhere to stand — an
 * object floating in a void gives no sense of scale, and the walls give the
 * eyes something to hold on to, which is what keeps a VR scene comfortable.
 * In AR mode the whole group is hidden and the real room takes over.
 */
export function buildRoom(
  THREE: ThreeNS,
  { width = 7, depth = 6, height = 3 } = {}
): THREE_NS.Group {
  const g = new THREE.Group();
  g.name = "room";

  const floorMat = std(THREE, MAT.floor, 0.9, 0.02);
  const floor = mesh(THREE, new THREE.PlaneGeometry(width, depth), floorMat, [0, 0.001, 0], [
    -Math.PI / 2,
    0,
    0,
  ]);
  floor.castShadow = false;
  g.add(floor);

  // Floor tiling, drawn as thin inset lines rather than a texture.
  const lineMat = std(THREE, "#9aa4b0", 0.95, 0);
  for (let i = -Math.floor(width / 2); i <= Math.floor(width / 2); i += 1) {
    g.add(mesh(THREE, new THREE.PlaneGeometry(0.012, depth), lineMat, [i, 0.002, 0], [-Math.PI / 2, 0, 0]));
  }
  for (let j = -Math.floor(depth / 2); j <= Math.floor(depth / 2); j += 1) {
    g.add(mesh(THREE, new THREE.PlaneGeometry(width, 0.012), lineMat, [0, 0.002, j], [-Math.PI / 2, 0, 0]));
  }

  const wallMat = std(THREE, MAT.wall, 0.95, 0);
  const dadoMat = std(THREE, MAT.wallLower, 0.9, 0.02);
  const walls: { pos: Vec3; rot: Vec3; w: number }[] = [
    { pos: [0, height / 2, -depth / 2], rot: [0, 0, 0], w: width },
    { pos: [0, height / 2, depth / 2], rot: [0, Math.PI, 0], w: width },
    { pos: [-width / 2, height / 2, 0], rot: [0, Math.PI / 2, 0], w: depth },
    { pos: [width / 2, height / 2, 0], rot: [0, -Math.PI / 2, 0], w: depth },
  ];
  for (const w of walls) {
    const panel = mesh(THREE, new THREE.PlaneGeometry(w.w, height), wallMat, w.pos, w.rot);
    panel.castShadow = false;
    g.add(panel);
    // Waist-high dado rail — the detail that makes a wall read as a real room.
    const dado = mesh(
      THREE,
      new THREE.PlaneGeometry(w.w, 0.95),
      dadoMat,
      [w.pos[0] * 0.999, 0.475, w.pos[2] * 0.999],
      w.rot
    );
    dado.castShadow = false;
    g.add(dado);
  }

  // Window band along the far wall, and the daylight it implies.
  const glass = new THREE.MeshStandardMaterial({
    color: "#cfe3ff",
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
    emissive: new THREE.Color("#eaf3ff"),
    emissiveIntensity: 0.6,
  });
  const win = mesh(THREE, new THREE.PlaneGeometry(width * 0.72, 1.15), glass, [0, 1.75, -depth / 2 + 0.02]);
  win.castShadow = false;
  g.add(win);
  const frameMat = std(THREE, "#9099a6", 0.6, 0.35);
  for (let i = -1; i <= 1; i += 1) {
    g.add(
      mesh(THREE, new THREE.BoxGeometry(0.05, 1.2, 0.03), frameMat, [
        i * width * 0.24,
        1.75,
        -depth / 2 + 0.03,
      ])
    );
  }

  const ceil = mesh(THREE, new THREE.PlaneGeometry(width, depth), std(THREE, MAT.ceiling, 0.95, 0), [
    0,
    height,
    0,
  ], [Math.PI / 2, 0, 0]);
  ceil.castShadow = false;
  ceil.receiveShadow = false;
  g.add(ceil);

  // Two luminous ceiling panels. They are emissive rather than real lights —
  // the scene's directional light does the shading, these only read as fixtures.
  const lampMat = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: new THREE.Color("#fff8e8"),
    emissiveIntensity: 1.4,
    roughness: 1,
  });
  for (const z of [-1.1, 1.1]) {
    const lamp = mesh(THREE, new THREE.BoxGeometry(2.2, 0.04, 0.34), lampMat, [0, height - 0.05, z]);
    lamp.castShadow = false;
    g.add(lamp);
  }

  return g;
}

// ---------------------------------------------------------------------------
// Bench
// ---------------------------------------------------------------------------

export function buildBench(
  THREE: ThreeNS,
  { width = 1.6, depth = 0.7 } = {}
): THREE_NS.Group {
  const g = new THREE.Group();
  g.name = "bench";

  g.add(mesh(THREE, new THREE.BoxGeometry(width, 0.04, depth), std(THREE, MAT.benchTop, 0.62, 0.04), [
    0,
    BENCH_H - 0.02,
    0,
  ]));
  g.add(
    mesh(THREE, new THREE.BoxGeometry(width + 0.008, 0.026, depth + 0.008), std(THREE, MAT.benchEdge, 0.55, 0.2), [
      0,
      BENCH_H - 0.021,
      0,
    ])
  );
  g.add(
    mesh(THREE, new THREE.BoxGeometry(width - 0.02, 0.012, depth - 0.02), std(THREE, "#8f99a8", 0.9, 0.05), [
      0,
      BENCH_H - 0.05,
      0,
    ])
  );

  const legMat = std(THREE, "#5b6472", 0.5, 0.45);
  const legGeo = new THREE.BoxGeometry(0.04, BENCH_H - 0.04, 0.04);
  for (const x of [-width / 2 + 0.07, width / 2 - 0.07]) {
    for (const z of [-depth / 2 + 0.07, depth / 2 - 0.07]) {
      g.add(mesh(THREE, legGeo, legMat, [x, (BENCH_H - 0.04) / 2, z]));
    }
  }
  // Cross rail low down, so the legs do not float.
  g.add(
    mesh(THREE, new THREE.BoxGeometry(width - 0.14, 0.025, 0.025), legMat, [0, 0.16, -depth / 2 + 0.07])
  );
  g.add(
    mesh(THREE, new THREE.BoxGeometry(width - 0.14, 0.025, 0.025), legMat, [0, 0.16, depth / 2 - 0.07])
  );

  return g;
}

// ---------------------------------------------------------------------------
// Dynamics track
// ---------------------------------------------------------------------------

/** PASCO 1,2 m dynamics track: extruded aluminium rail with end stops. */
export function buildTrack(
  THREE: ThreeNS,
  { length = TRACK_L, y = BENCH_H } = {}
): THREE_NS.Group {
  const g = new THREE.Group();
  g.name = "track";

  const alu = std(THREE, MAT.alu, 0.34, 0.72);
  const aluDark = std(THREE, MAT.aluDark, 0.4, 0.7);

  // Web and running surface.
  g.add(mesh(THREE, new THREE.BoxGeometry(length, 0.022, 0.096), alu, [length / 2, y + 0.011, 0]));
  g.add(mesh(THREE, new THREE.BoxGeometry(length, 0.01, 0.128), aluDark, [length / 2, y + 0.027, 0]));
  // Side rails the cart's wheels run against.
  for (const z of [-0.06, 0.06]) {
    g.add(mesh(THREE, new THREE.BoxGeometry(length, 0.016, 0.008), aluDark, [length / 2, y + 0.03, z]));
  }
  // Millimetre scale printed along the near rail.
  const tickMat = std(THREE, "#334155", 0.9, 0);
  for (let i = 0; i <= Math.round(length * 10); i += 1) {
    const major = i % 5 === 0;
    g.add(
      mesh(
        THREE,
        new THREE.BoxGeometry(0.0035, 0.001, major ? 0.02 : 0.011),
        tickMat,
        [i * 0.1, y + 0.0355, 0.052]
      )
    );
  }

  // End stops.
  const stopMat = std(THREE, MAT.pascoBlue, 0.45, 0.25);
  for (const x of [0, length]) {
    g.add(mesh(THREE, new THREE.BoxGeometry(0.02, 0.075, 0.13), stopMat, [x, y + 0.06, 0]));
  }
  // Feet.
  const footMat = std(THREE, "#4b5563", 0.7, 0.2);
  for (const x of [0.09, length - 0.09]) {
    g.add(mesh(THREE, new THREE.BoxGeometry(0.05, 0.012, 0.17), footMat, [x, y + 0.005, 0]));
  }

  return g;
}

// ---------------------------------------------------------------------------
// Stand, pulley, hanging mass
// ---------------------------------------------------------------------------

/** Retort stand: cast base plus a vertical rod. */
export function buildStand(THREE: ThreeNS, { height = 0.6 } = {}): THREE_NS.Group {
  const g = new THREE.Group();
  g.name = "stand";
  g.add(mesh(THREE, new THREE.BoxGeometry(0.16, 0.018, 0.11), std(THREE, "#3f4753", 0.6, 0.3), [0, 0.009, 0]));
  g.add(
    mesh(THREE, new THREE.CylinderGeometry(0.007, 0.007, height, 16), std(THREE, MAT.steel, 0.35, 0.85), [
      0,
      height / 2,
      0,
    ])
  );
  return g;
}

/** Table-clamp pulley: bracket, sheave and axle. */
export function buildPulley(THREE: ThreeNS, { radius = 0.026 } = {}): THREE_NS.Group {
  const g = new THREE.Group();
  g.name = "pulley";

  const bracket = std(THREE, "#4b5563", 0.5, 0.4);
  g.add(mesh(THREE, new THREE.BoxGeometry(0.012, 0.09, 0.05), bracket, [0.02, -0.035, 0]));

  const wheel = new THREE.Group();
  wheel.name = "sheave";
  const rim = mesh(
    THREE,
    new THREE.CylinderGeometry(radius, radius, 0.012, 28),
    std(THREE, "#dbe2ec", 0.35, 0.4),
    [0, 0, 0],
    [Math.PI / 2, 0, 0]
  );
  wheel.add(rim);
  // Groove cheeks, so the string visibly sits in a channel.
  for (const z of [-0.008, 0.008]) {
    wheel.add(
      mesh(
        THREE,
        new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.004, 28),
        std(THREE, "#aeb8c6", 0.4, 0.5),
        [0, 0, z],
        [Math.PI / 2, 0, 0]
      )
    );
  }
  // Spokes make the rotation readable — a smooth disc looks static when it spins.
  for (let i = 0; i < 4; i += 1) {
    wheel.add(
      mesh(
        THREE,
        new THREE.BoxGeometry(radius * 1.7, 0.004, 0.014),
        std(THREE, "#8b96a5", 0.5, 0.4),
        [0, 0, 0],
        [0, 0, (i * Math.PI) / 4]
      )
    );
  }
  g.add(wheel);
  g.userData.sheave = wheel;

  g.add(
    mesh(THREE, new THREE.CylinderGeometry(0.004, 0.004, 0.04, 12), std(THREE, MAT.steel, 0.3, 0.9), [0, 0, 0], [
      Math.PI / 2,
      0,
      0,
    ])
  );

  return g;
}

/** Slotted mass hanger. `mass` only changes how many discs are stacked on it. */
export function buildHangingMass(THREE: ThreeNS, { mass = 0.1 } = {}): THREE_NS.Group {
  const g = new THREE.Group();
  g.name = "hanger";
  const steel = std(THREE, MAT.steel, 0.35, 0.8);
  // Hook and stem, hanging from y = 0 downward.
  g.add(mesh(THREE, new THREE.TorusGeometry(0.008, 0.0016, 8, 16, Math.PI * 1.4), steel, [0, -0.008, 0]));
  g.add(mesh(THREE, new THREE.CylinderGeometry(0.0022, 0.0022, 0.05, 8), steel, [0, -0.04, 0]));

  const discs = Math.max(1, Math.min(5, Math.round(mass / 0.05)));
  const discMat = std(THREE, "#59626f", 0.45, 0.75);
  for (let i = 0; i < discs; i += 1) {
    g.add(
      mesh(THREE, new THREE.CylinderGeometry(0.019, 0.019, 0.009, 20), discMat, [0, -0.066 - i * 0.0105, 0])
    );
  }
  return g;
}

// ---------------------------------------------------------------------------
// Ramp
// ---------------------------------------------------------------------------

/** Inclined plane hinged at its low end, with a lifting jack under the high end. */
export function buildRamp(
  THREE: ThreeNS,
  { length = 1.0, width = 0.14 } = {}
): THREE_NS.Group {
  const g = new THREE.Group();
  g.name = "ramp";
  const surface = new THREE.Group();
  surface.name = "surface";
  surface.add(
    mesh(THREE, new THREE.BoxGeometry(length, 0.016, width), std(THREE, MAT.alu, 0.4, 0.6), [
      length / 2,
      -0.008,
      0,
    ])
  );
  for (const z of [-width / 2 + 0.006, width / 2 - 0.006]) {
    surface.add(
      mesh(THREE, new THREE.BoxGeometry(length, 0.018, 0.008), std(THREE, MAT.aluDark, 0.45, 0.6), [
        length / 2,
        0.008,
        z,
      ])
    );
  }
  // Protractor at the hinge — the angle is a number the student should see.
  surface.add(
    mesh(
      THREE,
      new THREE.CircleGeometry(0.07, 24, 0, Math.PI / 3),
      std(THREE, "#f8fafc", 0.9, 0),
      [0, 0, width / 2 + 0.003]
    )
  );
  g.add(surface);
  g.userData.surface = surface;
  return g;
}

// ---------------------------------------------------------------------------
// Pendulum
// ---------------------------------------------------------------------------

export function buildPendulumBob(THREE: ThreeNS, { radius = 0.022 } = {}): THREE_NS.Mesh {
  return mesh(
    THREE,
    new THREE.SphereGeometry(radius, 26, 18),
    std(THREE, "#8b95a5", 0.32, 0.85)
  );
}

/** A taut string: a hair-thin cylinder repositioned with `spanCylinder`. */
export function buildString(THREE: ThreeNS, { color = "#e2e8f0" }: { color?: string } = {}): THREE_NS.Mesh {
  const m = mesh(THREE, new THREE.CylinderGeometry(0.0011, 0.0011, 1, 6), std(THREE, color, 0.85, 0));
  m.castShadow = false;
  return m;
}

// ---------------------------------------------------------------------------
// Vector arrow
// ---------------------------------------------------------------------------

export interface ArrowModel {
  object: THREE_NS.Group;
  /** Point the arrow from `origin` along `dir`, `length` metres long. */
  set: (origin: THREE_NS.Vector3, dir: THREE_NS.Vector3, length: number) => void;
}

/** Force / velocity / acceleration arrow, drawn as a shaft plus a cone. */
export function buildArrow(
  THREE: ThreeNS,
  { color = MAT.danger, radius = 0.005 }: { color?: string; radius?: number } = {}
): ArrowModel {
  const g = new THREE.Group();
  const material = std(THREE, color, 0.5, 0.1, { emissive: new THREE.Color(color), emissiveIntensity: 0.25 });
  const shaft = mesh(THREE, new THREE.CylinderGeometry(radius, radius, 1, 10), material);
  const head = mesh(THREE, new THREE.ConeGeometry(radius * 2.6, radius * 6, 14), material);
  g.add(shaft, head);
  g.visible = false;

  const up = new THREE.Vector3(0, 1, 0);
  const dirN = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  return {
    object: g,
    set(origin, dir, length) {
      const visible = length > 1e-4 && dir.lengthSq() > 1e-12;
      g.visible = visible;
      if (!visible) return;
      g.position.copy(origin);
      dirN.copy(dir).normalize();
      quat.setFromUnitVectors(up, dirN);
      g.quaternion.copy(quat);
      const headLen = Math.min(length * 0.32, radius * 6);
      const shaftLen = Math.max(length - headLen, 1e-4);
      shaft.scale.set(1, shaftLen, 1);
      shaft.position.set(0, shaftLen / 2, 0);
      head.scale.set(1, headLen / (radius * 6), 1);
      head.position.set(0, shaftLen + headLen / 2, 0);
    },
  };
}

// ---------------------------------------------------------------------------
// Motion trail
// ---------------------------------------------------------------------------

export interface TrailModel {
  object: THREE_NS.Object3D;
  push: (p: THREE_NS.Vector3) => void;
  clear: () => void;
}

/**
 * Dotted trail left behind a moving body. Points are instanced once and simply
 * repositioned, so the trail costs nothing per frame.
 */
export function buildTrail(
  THREE: ThreeNS,
  { count = 40, color = MAT.accent, radius = 0.004 }: { count?: number; color?: string; radius?: number } = {}
): TrailModel {
  const geo = new THREE.SphereGeometry(radius, 8, 6);
  const material = std(THREE, color, 0.6, 0, {
    transparent: true,
    opacity: 0.75,
  });
  const inst = new THREE.InstancedMesh(geo, material, count);
  inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  inst.count = 0;
  inst.frustumCulled = false;
  const dummy = new THREE.Object3D();
  let n = 0;

  return {
    object: inst,
    push(p) {
      const i = n % count;
      dummy.position.copy(p);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.instanceMatrix.needsUpdate = true;
      n += 1;
      inst.count = Math.min(n, count);
    },
    clear() {
      n = 0;
      inst.count = 0;
    },
  };
}
