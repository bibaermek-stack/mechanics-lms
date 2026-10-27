// A convex hull of the scan that is light enough for a physics engine: the support points of ~170
// directions spread evenly over the sphere (plus the axes), re-hulled. A hull of all 2 500 surface
// vertices would be exact and far too slow to collide; this one is within about half a percent.
import { ConvexHull } from "three/examples/jsm/math/ConvexHull.js";
import { Vector3 } from "three";

export function fibonacciDirections(n) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
  }
  return out;
}

export function supportPoints(vertices, directions) {
  const picked = new Map();
  for (const d of directions) {
    let best = -Infinity, bi = -1;
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const s = v[0] * d[0] + v[1] * d[1] + v[2] * d[2];
      if (s > best) { best = s; bi = i; }
    }
    picked.set(bi, vertices[bi]);
  }
  return [...picked.values()];
}

/** Hull of the points: its vertices, its triangles (indices into `vertices`), volume and centroid. */
export function hullOf(points) {
  const hull = new ConvexHull().setFromPoints(points.map((p) => new Vector3(...p)));
  const index = new Map(), vertices = [], triangles = [];
  const idOf = (pt) => {
    const k = `${pt.x},${pt.y},${pt.z}`;
    if (!index.has(k)) { index.set(k, vertices.length); vertices.push([pt.x, pt.y, pt.z]); }
    return index.get(k);
  };
  for (const f of hull.faces) {
    const ids = [];
    let e = f.edge;
    do { ids.push(idOf(e.head().point)); e = e.next; } while (e !== f.edge);
    for (let i = 1; i + 1 < ids.length; i++) triangles.push([ids[0], ids[i], ids[i + 1]]);
  }
  // volume and centroid from tetrahedra to the first vertex
  const o = vertices[0];
  let vol = 0; const c = [0, 0, 0];
  for (const [a, b, d] of triangles) {
    const A = vertices[a].map((x, i) => x - o[i]), B = vertices[b].map((x, i) => x - o[i]), C = vertices[d].map((x, i) => x - o[i]);
    const v = (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
    vol += v;
    for (let i = 0; i < 3; i++) c[i] += (v * (A[i] + B[i] + C[i])) / 4;
  }
  return { vertices, triangles, volume: Math.abs(vol), centroid: c.map((x, i) => o[i] + x / vol) };
}
