"use client";

// Building blocks shared by the lesson scenes: ground, arrows that follow a
// body, and a ribbon that draws a path as the film plays.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { VectorArrow, type ArrowHandle } from "@/components/simulation/core/primitives";
import { useStudioFrame } from "@/components/studio/clock";
import type { Vec3 } from "@/lib/studio/timeline";
import { C } from "./materials";
import { grassTexture, pavingTexture } from "./textures";

export function Ground({
  size = 600,
  color = C.grass,
  y = -0.05,
  x = 0,
  z = 0,
}: {
  size?: number;
  color?: string;
  y?: number;
  x?: number;
  z?: number;
}) {
  // One lawn tile covers about 12 m.
  const map = grassTexture(size / 12, size / 12);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, y, z]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color={color} map={map} roughness={0.95} />
    </mesh>
  );
}

/** A flat paved area: `w` along x, `d` along z, centred at (x, z). One slab is 1 m. */
export function Paving({ x = 0, z = 0, w, d, y = 0.02, color = "#ffffff" }: { x?: number; z?: number; w: number; d: number; y?: number; color?: string }) {
  const map = pavingTexture(w / 4, d / 4);
  return (
    <mesh position={[x, y, z]} receiveShadow>
      <boxGeometry args={[w, 0.04, d]} />
      <meshStandardMaterial color={color} map={map} roughness={0.9} />
    </mesh>
  );
}

/** Shows its children only while `when(t)` holds. (Labels inside must manage their own opacity.) */
export function Show({ when, children }: { when: (t: number) => boolean; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null!);
  useStudioFrame((t) => {
    g.current.visible = when(t);
  });
  return <group ref={g}>{children}</group>;
}

export interface ArrowSpec {
  origin: Vec3;
  /** Direction; need not be normalised. */
  dir: Vec3;
  /** Length in metres. */
  len: number;
}

/**
 * A vector arrow whose geometry comes from a function of time. Return null to
 * hide it. The arrow keeps its own scratch vectors, so nothing is allocated per frame.
 */
export function Arrow({
  color,
  radius = 0.05,
  get,
  opacity = 1,
}: {
  color: string;
  radius?: number;
  opacity?: number;
  get: (t: number) => ArrowSpec | null;
}) {
  const ref = useRef<ArrowHandle>(null);
  const o = useMemo(() => new THREE.Vector3(), []);
  const d = useMemo(() => new THREE.Vector3(), []);
  const dot = useRef<THREE.Mesh>(null!);
  useStudioFrame((t) => {
    const a = get(t);
    if (!a || a.len < 1e-3) {
      ref.current?.set(o.set(0, -100, 0), d.set(0, 1, 0), 0);
      dot.current.visible = false;
      return;
    }
    ref.current?.set(o.set(...a.origin), d.set(...a.dir), a.len);
    // A ball at the tail marks the point the vector is applied to.
    dot.current.visible = true;
    dot.current.position.set(...a.origin);
  });
  return (
    <>
      <VectorArrow ref={ref} color={color} radius={radius} opacity={opacity} />
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[radius * 1.9, 14, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  );
}

/**
 * A flat ribbon along a polyline (in the XZ plane at height `y`) that is drawn
 * up to `progress(t)` of its length — a trajectory laying itself down.
 */
export function Ribbon({
  points,
  width = 0.3,
  y = 0.03,
  color,
  progress,
  opacity = 1,
}: {
  points: [number, number][];
  width?: number;
  y?: number;
  color: string;
  progress: (t: number) => number;
  opacity?: number;
}) {
  const geom = useMemo(() => {
    const n = points.length;
    const pos = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
      const a = points[Math.max(0, i - 1)];
      const b = points[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0];
      let tz = b[1] - a[1];
      const len = Math.hypot(tx, tz) || 1;
      tx /= len;
      tz /= len;
      // Left/right of the path, perpendicular to its direction.
      const nx = -tz * (width / 2);
      const nz = tx * (width / 2);
      pos.set([points[i][0] + nx, y, points[i][1] + nz], i * 6);
      pos.set([points[i][0] - nx, y, points[i][1] - nz], i * 6 + 3);
    }
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }, [points, width, y]);

  useStudioFrame((t) => {
    const segs = Math.floor(Math.max(0, Math.min(1, progress(t))) * (points.length - 1));
    geom.setDrawRange(0, segs * 6);
  });

  return (
    <mesh geometry={geom} frustumCulled={false}>
      <meshBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

/** A tree: trunk and two stacked crowns. Cheap enough to scatter by the dozen. */
export function Tree({ position, scale = 1, tone = 0 }: { position: Vec3; scale?: number; tone?: number }) {
  const crown = ["#4f9a52", "#5aa85a", "#478f4c"][tone % 3];
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.24, 2.2, 8]} />
        <meshStandardMaterial color="#7a5a3a" roughness={0.95} />
      </mesh>
      <mesh position={[0, 3.0, 0]} castShadow>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshStandardMaterial color={crown} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.5, 4.1, 0.2]} castShadow>
        <icosahedronGeometry args={[1.0, 1]} />
        <meshStandardMaterial color={crown} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/** Street lamp. */
export function LampPost({ position, rotationY = 0 }: { position: Vec3; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 3.2, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 6.4, 10]} />
        <meshStandardMaterial color={C.steelDark} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[0.7, 6.3, 0]} castShadow>
        <boxGeometry args={[1.5, 0.08, 0.1]} />
        <meshStandardMaterial color={C.steelDark} metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh position={[1.35, 6.22, 0]}>
        <boxGeometry args={[0.5, 0.12, 0.26]} />
        <meshStandardMaterial color="#fff7d6" emissive="#fff1b0" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}
