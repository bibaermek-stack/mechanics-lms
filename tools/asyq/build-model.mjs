#!/usr/bin/env node
// Builds src/lib/asyq/model.generated.ts from public/models/asyk.glb:
//
//   1. a light convex hull of the scan (what the physics engine collides),
//   2. the four ways the bone comes to rest, found by dropping it a few thousand times in the
//      same physics engine the game uses, and
//   3. which of them is which, from the shape of the scan itself.
//
//   node tools/asyq/build-model.mjs            writes the file
//   node tools/asyq/build-model.mjs --check    fails if the file is out of date (CI-friendly)
//
// Deterministic: a fixed seed and a fixed time step, so running it twice writes the same file.
//
// THE NAMES. How a thrown asyq lies is named by the side that ends up on top (Kazakh sources):
//   бүк   convex back up, lying on the hollow side;     шік   hollow side up, lying on the convex side;
//   алшы  stands on its smooth, flat foot;              тәйке stands on its hollowed foot.
// The scan has two broad sides (one dished, one domed) and two narrow ones (one flatter than the
// other); the script tells them apart by measuring that, and prints the numbers it used. Regional
// usage differs and sources disagree about алшы/тәйке, so the table is a plain data file a person
// can correct: swap two ids in model.generated.ts (or the rule below) and everything follows.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import RAPIER from "@dimforge/rapier3d-compat";
import { readAsyqVertices } from "./glb.mjs";
import { fibonacciDirections, supportPoints, hullOf } from "./hull.mjs";

const GLB = "public/models/asyk.glb";
const OUT = "src/lib/asyq/model.generated.ts";
const DIRECTIONS = Number(process.env.DIRECTIONS ?? 160);
const DROPS = 2400;
const HULL_TOL = Number(process.env.HULL_TOL ?? 0.004); // fraction of the bone length the scan may poke out before a vertex is added
const LENGTH = 0.04; // metres: only used for the drop test, the file is in units of the bone's length

const { vertices } = readAsyqVertices(GLB);
const xs = vertices.map((v) => v[0]);
const L = Math.max(...xs) - Math.min(...xs);

// ---- 1. the hull ---------------------------------------------------------------------------
const dirs = [...fibonacciDirections(DIRECTIONS), [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Outward planes of the hull's triangles, and how far each scan vertex lies outside the worst of them. */
function outside(h, centre, pts) {
  const planes = h.triangles.map(([a, b, c]) => {
    const A = h.vertices[a], B = h.vertices[b], D = h.vertices[c];
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [D[0] - A[0], D[1] - A[1], D[2] - A[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = Math.hypot(...n); n = n.map((x) => x / m);
    let d = n[0] * A[0] + n[1] * A[1] + n[2] * A[2];
    if (n[0] * centre[0] + n[1] * centre[1] + n[2] * centre[2] - d > 0) { n = n.map((x) => -x); d = -d; }
    return { n, d };
  });
  return pts.map((p) => { let w = 0; for (const pl of planes) w = Math.max(w, pl.n[0] * p[0] + pl.n[1] * p[1] + pl.n[2] * p[2] - pl.d); return w; });
}

// Start from the support points of evenly spread directions, then add the scan's worst offenders
// until nothing of the scan pokes out of the hull by more than HULL_TOL of the bone length.
const picked = new Set(supportPoints(vertices, dirs));
let hull = hullOf([...picked]);
const before = Math.max(...outside(hull, hull.centroid, vertices));
for (let i = 0; i < 80; i++) {
  const ex = outside(hull, hull.centroid, vertices);
  const worst = ex.map((e, j) => [e, j]).filter(([e]) => e > HULL_TOL * L).sort((a, b) => b[0] - a[0]).slice(0, 8);
  if (!worst.length) break;
  for (const [, j] of worst) picked.add(vertices[j]);
  hull = hullOf([...picked]);
}
const C = hull.centroid;
// the last sliver: grow the hull about its centroid by just enough to contain the whole scan
let grow = 1;
for (let i = 0; i < 60; i++) {
  const g = hull.vertices.map((v) => v.map((x, k) => C[k] + (x - C[k]) * grow));
  const gh = { ...hull, vertices: g };
  if (Math.max(...outside(gh, C, vertices)) <= 1e-9) { hull = gh; break; }
  grow += 0.0005;
}
console.log(`hull: ${hull.vertices.length} vertices, ${hull.triangles.length} triangles; the plain support hull left ${(before / L).toFixed(4)} L of the scan outside, final hull grown ×${grow.toFixed(4)}`);

const unit = (v) => v.map((x, i) => (x - C[i]) / L);
const hullUnit = hull.vertices.map(unit);
const volumeUnit = hull.volume * grow ** 3 / L ** 3;

// ---- 2. the ways it comes to rest ----------------------------------------------------------
await RAPIER.init();
const k = LENGTH; // hull in units of L → metres for the test
const pts = new Float32Array(hullUnit.flatMap((v) => v.map((x) => x * k)));
function mulberry(a) { return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry(20240607);
const randQuat = () => { const u1 = rnd(), u2 = rnd() * 2 * Math.PI, u3 = rnd() * 2 * Math.PI; const a = Math.sqrt(1 - u1), b = Math.sqrt(u1); return { x: a * Math.sin(u2), y: a * Math.cos(u2), z: b * Math.sin(u3), w: b * Math.cos(u3) }; };
const rotateInv = (q, v) => { const [x, y, z, w] = [-q.x, -q.y, -q.z, q.w]; const [vx, vy, vz] = v; const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx); return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)]; };

const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 240;
world.lengthUnit = 0.05;
world.createCollider(RAPIER.ColliderDesc.cuboid(5, 0.5, 5).setTranslation(0, -0.5, 0).setFriction(0.5).setRestitution(0.2).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min));
const finals = [];
for (let i = 0; i < DROPS; i++) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation((rnd() - 0.5) * 0.4, 0.08 + rnd() * 0.05, (rnd() - 0.5) * 0.4).setRotation(randQuat()).setLinvel((rnd() - 0.5) * 1.5, 0, (rnd() - 0.5) * 1.5).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.convexHull(pts).setDensity(1800).setFriction(0.45).setRestitution(0.3).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min), body);
  let quiet = 0, steps = 0;
  while (steps < 240 * 8 && quiet < 120) {
    world.step(); steps++;
    const lv = body.linvel(), av = body.angvel();
    quiet = Math.hypot(lv.x, lv.y, lv.z) < 0.01 && Math.hypot(av.x, av.y, av.z) < 0.2 ? quiet + 1 : 0;
  }
  finals.push({ down: rotateInv(body.rotation(), [0, -1, 0]), y: body.translation().y / LENGTH });
  world.removeRigidBody(body);
}
const clusters = [];
for (const f of finals) {
  let hit = null;
  for (const c of clusters) if (c.mean[0] * f.down[0] + c.mean[1] * f.down[1] + c.mean[2] * f.down[2] > Math.cos(0.5)) { hit = c; break; }
  if (!hit) { hit = { mean: [...f.down], members: [], sum: [0, 0, 0] }; clusters.push(hit); }
  hit.members.push(f); for (let i = 0; i < 3; i++) hit.sum[i] += f.down[i];
  const m = Math.hypot(...hit.sum); hit.mean = hit.sum.map((s) => s / m);
}
clusters.sort((a, b) => b.members.length - a.members.length);
const stable = clusters.slice(0, 4);
const resting = stable.reduce((a, c) => a + c.members.length, 0);
if (process.env.DEBUG_CLUSTERS) for (const c of clusters) console.log(`cluster ${c.members.length} (${((100 * c.members.length) / DROPS).toFixed(1)} %) down ${c.mean.map((x) => x.toFixed(3)).join(", ")} COM height ${(c.members.reduce((a, m) => a + m.y, 0) / c.members.length).toFixed(3)} L`);
if (stable.length < 4 || resting / DROPS < 0.95) throw new Error(`expected four dominant resting faces, got ${clusters.map((c) => c.members.length)}`);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angleDeg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;

// ---- 3. which is which ---------------------------------------------------------------------
const V = vertices.map((v) => v.map((x, i) => x - C[i]));
function measure(n) {
  const h = Math.max(...V.map((v) => dot(v, n)));
  const patch = V.filter((v) => h - dot(v, n) < 0.015 * L);
  const pc = patch.reduce((a, v) => a.map((x, i) => x + v[i] / patch.length), [0, 0, 0]);
  const proj = (v) => { const d = dot(v, n); return v.map((x, i) => x - d * n[i]); };
  const pcp = proj(pc);
  const near = V.filter((v) => { const p = proj(v); return Math.hypot(p[0] - pcp[0], p[1] - pcp[1], p[2] - pcp[2]) < 0.12 * L; });
  const centreDepth = Math.min(...near.map((v) => h - dot(v, n)));
  const bins = new Map();
  for (const v of V) {
    const p = proj(v);
    if (Math.hypot(p[0] - pcp[0], p[1] - pcp[1], p[2] - pcp[2]) >= 0.25 * L || dot(v, n) <= h - 0.35 * L) continue;
    const key = [0, 1, 2].map((i) => Math.round((p[i] - pcp[i]) / (0.03 * L))).join(",");
    bins.set(key, Math.min(bins.get(key) ?? Infinity, h - dot(v, n)));
  }
  const meanDepth = [...bins.values()].reduce((a, b) => a + b, 0) / bins.size;
  return { height: h / L, centreDepth: centreDepth / L, meanDepth: meanDepth / L };
}
const faces = stable.map((c) => ({ normal: c.mean, share: c.members.length / DROPS, spread: Math.max(...c.members.map((m) => angleDeg(m.down, c.mean))), comHeight: c.members.reduce((a, m) => a + m.y, 0) / c.members.length, ...measure(c.mean) }));
const byHeight = [...faces].sort((a, b) => a.height - b.height);
const broad = byHeight.slice(0, 2), narrow = byHeight.slice(2);
// broad: resting on the dished side (the patch is a rim, the middle is below the plane) = бүк, the dome down = шік
const [dished, domed] = broad[0].centreDepth > broad[1].centreDepth ? [broad[0], broad[1]] : [broad[1], broad[0]];
// narrow: the flatter foot (the surface stays closer to the plane) = алшы, the other = тәйке
const [flat, hollowed] = narrow[0].meanDepth < narrow[1].meanDepth ? [narrow[0], narrow[1]] : [narrow[1], narrow[0]];
dished.id = "buk"; domed.id = "shik"; flat.id = "alshy"; hollowed.id = "tayke";
const order = ["alshy", "tayke", "buk", "shik"];
faces.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
for (const f of faces) console.log(`${f.id.padEnd(5)} ${(f.share * 100).toFixed(1).padStart(5)} %  COM→face ${f.height.toFixed(3)}L  centre depth ${f.centreDepth.toFixed(4)}L  mean depth ${f.meanDepth.toFixed(4)}L  spread ${f.spread.toFixed(1)}°`);
console.log(`${((resting / DROPS) * 100).toFixed(1)} % of ${DROPS} drops ended on one of these four; the rest on an edge or an end`);

// ---- the file ------------------------------------------------------------------------------
const r = (x) => Number(x.toFixed(6));
const sha = createHash("sha256").update(readFileSync(GLB)).digest("hex");
const text = `// GENERATED by tools/asyq/build-model.mjs from public/models/asyk.glb — do not edit by hand.
// Re-run \`node tools/asyq/build-model.mjs\` after changing the model; \`--check\` says whether this is current.
// All lengths are in units of the bone's long axis (so 1 = the bone's length), centred on its centre of mass.

/** sha-256 of the model file this was made from. */
export const MODEL_SHA256 = "${sha}";

/** The bone's length in the model file's own units (what the hull's unit length corresponds to). */
export const MODEL_LENGTH = ${r(L)};

/** Centre of mass in the model file's coordinates (after the node's rotation): subtract it to put the picture on the body. */
export const MODEL_CENTROID: [number, number, number] = [${C.map((x) => r(x)).join(", ")}];

/** Volume of the hull, in cubic bone lengths. */
export const HULL_VOLUME = ${r(volumeUnit)};

/** Vertices of the collision hull, x y z flattened, in bone lengths from the centre of mass. */
export const HULL_VERTICES: readonly number[] = [
${hullUnit.map((v) => "  " + v.map((x) => r(x)).join(", ") + ",").join("\n")}
];

export type FaceId = "alshy" | "tayke" | "buk" | "shik";

export interface RestingFace {
  id: FaceId;
  /** Unit vector, in the bone's own frame, pointing out of the side that touches the ground when the bone lies this way. */
  normal: [number, number, number];
  /** How far the centre of mass is above the ground when it lies this way, in bone lengths. */
  restHeight: number;
  /** Largest angle (degrees) a drop that came to rest on this side was off the normal. */
  spreadDeg: number;
  /** Share of random drops that ended on this side (out of ${DROPS}, 1 mm tolerance ignored). */
  share: number;
  /** What the scan says about this side: how far the middle of it lies below the plane it rests on (0 = domed), and the mean depth over its surroundings. */
  centreDepth: number;
  meanDepth: number;
}

export const RESTING_FACES: readonly RestingFace[] = [
${faces.map((f) => `  { id: "${f.id}", normal: [${f.normal.map((x) => r(x)).join(", ")}], restHeight: ${r(f.comHeight)}, spreadDeg: ${r(f.spread)}, share: ${r(f.share)}, centreDepth: ${r(f.centreDepth)}, meanDepth: ${r(f.meanDepth)} },`).join("\n")}
];
`;
if (process.argv.includes("--check")) {
  const have = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (have !== text) { console.error(`${OUT} is out of date: run node tools/asyq/build-model.mjs`); process.exit(1); }
  console.log(`${OUT} is current`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}`);
}
