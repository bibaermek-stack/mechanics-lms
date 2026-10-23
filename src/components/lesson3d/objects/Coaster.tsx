"use client";

// A roller coaster: track profile, its supports and a car. The ride itself is
// computed from the track height with energy conservation, once, into a table.

import { useMemo } from "react";
import * as THREE from "three";
import { Figure } from "./Figure";
import { C } from "./materials";

const G = 9.8;

/** Control points (x, y) of the track centre line, metres. */
const POINTS: [number, number][] = [
  [-8, 20.8], [0, 20], [7, 18.4], [14, 13.4], [20, 7.2], [26, 3.4], [32, 2.4], [38, 3.8], [45, 8.6],
  [52, 12.2], [58, 12.8], [64, 11], [71, 6.8], [78, 3.4], [86, 2.1], [96, 2.2], [106, 3.0], [118, 3.6],
];

export interface TrackSample {
  s: number;
  x: number;
  y: number;
  /** Slope angle of the track, rad. */
  theta: number;
}

/** The track sampled every ~5 cm of arc length. */
export const TRACK: TrackSample[] = (() => {
  const curve = new THREE.CatmullRomCurve3(POINTS.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, "centripetal");
  const pts = curve.getSpacedPoints(3000);
  const out: TrackSample[] = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) s += pts[i].distanceTo(pts[i - 1]);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    out.push({ s, x: pts[i].x, y: pts[i].y, theta: Math.atan2(b.y - a.y, b.x - a.x) });
  }
  return out;
})();

export const TRACK_LENGTH = TRACK[TRACK.length - 1].s;
/** Arc length at which the car's run starts (the crest at x = 0) and ends. */
export const S_START = TRACK.find((p) => p.x >= 0)!.s;
export const S_END = TRACK[TRACK.length - 1].s - 2;
export const H0 = TRACK.find((p) => p.x >= 0)!.y;

export function sampleTrack(s: number): TrackSample {
  const f = Math.min(TRACK.length - 1, Math.max(0, ((s - TRACK[0].s) / TRACK_LENGTH) * (TRACK.length - 1)));
  const i = Math.floor(f);
  const a = TRACK[i];
  const b = TRACK[Math.min(TRACK.length - 1, i + 1)];
  const u = f - i;
  return { s, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, theta: a.theta + (b.theta - a.theta) * u };
}

export interface RideTable {
  /** Arc length at time t (t in seconds from release). */
  s: (t: number) => number;
  v: (t: number) => number;
  /** Energy dissipated so far per kilogram, J/kg. */
  loss: (t: number) => number;
  duration: number;
}

/**
 * Integrate the ride: v² = v₀² + 2g(h₀ − h) − 2μg·Δs. With μ = 0 nothing is lost.
 * Euler steps of 1 ms are plenty at these speeds.
 */
export function buildRide(mu: number, v0 = 0.8): RideTable {
  const dt = 0.001;
  const s: number[] = [];
  const v: number[] = [];
  let ss = S_START;
  const h0 = sampleTrack(S_START).y;
  for (let i = 0; i < 60000; i++) {
    const h = sampleTrack(ss).y;
    const v2 = v0 * v0 + 2 * G * (h0 - h) - 2 * mu * G * (ss - S_START);
    const vv = Math.sqrt(Math.max(0.09, v2));
    s.push(ss);
    v.push(vv);
    ss += vv * dt;
    if (ss >= S_END) break;
  }
  const n = s.length;
  const at = (t: number) => Math.min(n - 1, Math.max(0, Math.round(t / dt)));
  return {
    s: (t) => s[at(t)],
    v: (t) => v[at(t)],
    loss: (t) => mu * G * (s[at(t)] - S_START),
    duration: n * dt,
  };
}

/** Rails, ties and supports. */
export function CoasterTrack() {
  const { railGeoms, ties, columns } = useMemo(() => {
    const idxs = TRACK.filter((_, i) => i % 6 === 0);
    const mk = (z: number) => {
      const curve = new THREE.CatmullRomCurve3(idxs.map((p) => new THREE.Vector3(p.x, p.y, z)));
      return new THREE.TubeGeometry(curve, idxs.length * 2, 0.09, 8, false);
    };
    const tieList: { x: number; y: number; th: number }[] = [];
    for (let s = 0; s < TRACK_LENGTH; s += 1.4) {
      const p = sampleTrack(s);
      tieList.push({ x: p.x, y: p.y - 0.12, th: p.theta });
    }
    const colList: { x: number; y: number }[] = [];
    for (let x = 0; x <= 118; x += 6) {
      const p = TRACK.reduce((best, q) => (Math.abs(q.x - x) < Math.abs(best.x - x) ? q : best), TRACK[0]);
      colList.push({ x, y: p.y });
    }
    return { railGeoms: [mk(-0.55), mk(0.55)], ties: tieList, columns: colList };
  }, []);

  return (
    <group>
      {railGeoms.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color="#e11d48" metalness={0.5} roughness={0.35} />
        </mesh>
      ))}
      {ties.map((t, i) => (
        <mesh key={i} position={[t.x, t.y, 0]} rotation={[0, 0, t.th]} castShadow>
          <boxGeometry args={[0.2, 0.12, 1.3]} />
          <meshStandardMaterial color="#b8c1ce" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {columns.map((c) => (
        <group key={c.x}>
          {[-0.8, 0.8].map((z) => (
            <mesh key={z} position={[c.x, (c.y - 0.3) / 2, z]} castShadow>
              <boxGeometry args={[0.3, c.y - 0.3, 0.3]} />
              <meshStandardMaterial color="#9aa5b6" metalness={0.4} roughness={0.6} />
            </mesh>
          ))}
          <mesh position={[c.x, c.y - 0.35, 0]} castShadow>
            <boxGeometry args={[0.25, 0.25, 1.9]} />
            <meshStandardMaterial color="#9aa5b6" metalness={0.4} roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* station platform */}
      <mesh position={[-4, 0.4, 0]} receiveShadow>
        <boxGeometry args={[10, 0.8, 5]} />
        <meshStandardMaterial color="#cfd4dc" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** A two-seat car riding on top of the rails; origin on the rail head, forward +X. */
export function CoasterCar() {
  return (
    <group position={[0, 0.5, 0]}>
      <mesh position={[0, 0.0, 0]} castShadow>
        <boxGeometry args={[3.1, 0.7, 1.5]} />
        <meshStandardMaterial color="#2f6df6" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[1.7, -0.05, 0]} castShadow>
        <boxGeometry args={[0.9, 0.5, 1.3]} />
        <meshStandardMaterial color="#1f47e6" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[1.1, 0.5, 0]} castShadow>
        <boxGeometry args={[0.15, 0.5, 1.5]} />
        <meshStandardMaterial color="#e5e7eb" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* riders */}
      {[-0.6, 0.55].map((x, i) => (
        <group key={i} position={[x, 0.2, 0]} scale={0.8}>
          <Figure seated shirt={i ? "#f59e0b" : "#16a34a"} pants="#1f2937" pose={{ armL: 1.9, armR: 1.9, elbowL: 0.2, elbowR: 0.2 }} />
        </group>
      ))}
      {/* wheels under the car */}
      {[-1.1, 1.1].flatMap((x) =>
        [-0.55, 0.55].map((z) => (
          <mesh key={`${x}${z}`} position={[x, -0.55, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.16, 20]} />
            <meshStandardMaterial color={C.rubber} roughness={0.8} />
          </mesh>
        ))
      )}
    </group>
  );
}
