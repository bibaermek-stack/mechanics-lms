// Statics of a Warren truss bridge: member forces from the method of joints
// (solved as one 26×26 linear system) and the deflection of a simply supported
// span under a point load. Pure maths; the 3D drawing lives in
// components/lesson3d/objects/Structures.tsx.

export const TRUSS = { panels: 6, pitch: 4, h: Math.sqrt(3) * 2 };
export const SPAN = TRUSS.panels * TRUSS.pitch; // 24 m

export interface TrussNode {
  x: number;
  y: number;
}
export interface TrussMember {
  a: number;
  b: number;
  kind: "bottom" | "top" | "diag";
}

/** Nodes: B0…B6 along the bottom chord, then T0…T5 on the top chord. */
export const NODES: TrussNode[] = [
  ...Array.from({ length: TRUSS.panels + 1 }, (_, i) => ({ x: i * TRUSS.pitch, y: 0 })),
  ...Array.from({ length: TRUSS.panels }, (_, i) => ({ x: TRUSS.pitch / 2 + i * TRUSS.pitch, y: TRUSS.h })),
];
const nb = TRUSS.panels + 1; // bottom node count
export const MEMBERS: TrussMember[] = [
  ...Array.from({ length: TRUSS.panels }, (_, i) => ({ a: i, b: i + 1, kind: "bottom" as const })),
  ...Array.from({ length: TRUSS.panels - 1 }, (_, i) => ({ a: nb + i, b: nb + i + 1, kind: "top" as const })),
  ...Array.from({ length: TRUSS.panels }, (_, i) => ({ a: i, b: nb + i, kind: "diag" as const })),
  ...Array.from({ length: TRUSS.panels }, (_, i) => ({ a: nb + i, b: i + 1, kind: "diag" as const })),
];

/** Inverse of the 26×26 equilibrium matrix, built once. */
const INV = (() => {
  const nM = MEMBERS.length; // 23
  const nN = NODES.length; // 13
  const size = 2 * nN; // 26 equations; unknowns = 23 members + 3 reactions
  const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  MEMBERS.forEach((m, k) => {
    const A0 = NODES[m.a];
    const B0 = NODES[m.b];
    const L = Math.hypot(B0.x - A0.x, B0.y - A0.y);
    const ux = (B0.x - A0.x) / L;
    const uy = (B0.y - A0.y) / L;
    // tension pulls each end towards the other
    A[2 * m.a][k] += ux;
    A[2 * m.a + 1][k] += uy;
    A[2 * m.b][k] -= ux;
    A[2 * m.b + 1][k] -= uy;
  });
  // reactions: pin at B0 (x, y), roller at the last bottom node (y)
  A[0][nM] = 1;
  A[1][nM + 1] = 1;
  A[2 * (nb - 1) + 1][nM + 2] = 1;
  // invert by Gauss–Jordan
  const n = size;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row.slice(n));
})();

export interface TrussSolution {
  /** Axial force in each member, kN, tension positive. */
  force: number[];
  /** Support reactions: [Ax, Ay, By], kN. */
  reactions: [number, number, number];
}

/** Solve the truss for a single downward point load `P` (kN) at deck position `x` (m), if on the span. */
export function solveTruss(P: number, x: number): TrussSolution {
  const size = 2 * NODES.length;
  const b = new Array(size).fill(0);
  if (x >= 0 && x <= SPAN) {
    const k = Math.min(TRUSS.panels - 1, Math.floor(x / TRUSS.pitch));
    const xi = (x - k * TRUSS.pitch) / TRUSS.pitch;
    // the load pushes down on the two deck nodes either side, so the equations see −load
    b[2 * k + 1] += P * (1 - xi);
    b[2 * (k + 1) + 1] += P * xi;
  }
  const out = INV.map((row) => row.reduce((s, v, j) => s + v * b[j], 0));
  const nM = MEMBERS.length;
  return { force: out.slice(0, nM), reactions: [out[nM], out[nM + 1], out[nM + 2]] };
}

/**
 * Vertical deflection (m) at position `x` of a simply supported span with a
 * point load at `xp`, scaled so a load at mid-span deflects the middle by `mid`.
 */
export function deflection(x: number, xp: number, mid: number): number {
  if (xp <= 0 || xp >= SPAN) return 0;
  const L = SPAN;
  const a = xp;
  const b = L - xp;
  const raw = x <= a ? (b * x * (L * L - b * b - x * x)) / (6 * L) : (a * (L - x) * (L * L - a * a - (L - x) * (L - x))) / (6 * L);
  const ref = (L * L * L) / 48;
  return (mid * raw) / ref;
}

