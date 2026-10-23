"use client";

// A two-lane road with pavements, trees and lamps, so a moving car has
// something to move *relative to*. Road runs along +X, centred on z = 0.

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LampPost, Show, Tree } from "./common";
import { C } from "./materials";
import { LiveTag } from "@/components/studio/overlay";

/** Height of the asphalt surface; cars stand at this y. */
export const ROAD_Y = 0.02;

function Dashes({ x0, x1, y }: { x0: number; x1: number; y: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const period = 6;
  const n = Math.max(1, Math.ceil((x1 - x0) / period));
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      m.makeTranslation(x0 + i * period + 1.5, y, 0);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [n, x0, y]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, n]} receiveShadow>
      <boxGeometry args={[3, 0.012, 0.16]} />
      <meshStandardMaterial color={C.line} roughness={0.7} />
    </instancedMesh>
  );
}

export function Road({
  x0,
  x1,
  width = 8,
  trees = true,
}: {
  x0: number;
  x1: number;
  width?: number;
  trees?: boolean;
}) {
  const len = x1 - x0;
  const cx = (x0 + x1) / 2;
  const kerb = width / 2 + 0.1;
  const treeList = useMemo(() => {
    if (!trees) return [];
    const out: { x: number; z: number; s: number; tone: number }[] = [];
    // A fixed pseudo-random spread: the film must look identical on every render.
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    // Trees stay out of the strip the camera works in (the near side, z ≈ 8…13),
    // so one never drifts across the lens in the middle of a shot.
    const near = () => width / 2 + 11 + rnd() * 5;
    const far = () => -(width / 2 + 4.5 + rnd() * 5);
    for (let x = Math.ceil(x0 / 13) * 13; x < x1; x += 13) {
      out.push({ x: x + rnd() * 4, z: far(), s: 0.85 + rnd() * 0.5, tone: Math.floor(rnd() * 3) });
      if (rnd() > 0.35) out.push({ x: x + 5 + rnd() * 4, z: near(), s: 0.8 + rnd() * 0.5, tone: Math.floor(rnd() * 3) });
    }
    return out;
  }, [x0, x1, width, trees]);

  const lamps = useMemo(() => {
    const out: number[] = [];
    for (let x = Math.ceil(x0 / 32) * 32; x < x1; x += 32) out.push(x);
    return out;
  }, [x0, x1]);

  return (
    <group>
      {/* asphalt */}
      <mesh position={[cx, ROAD_Y / 2, 0]} receiveShadow>
        <boxGeometry args={[len, ROAD_Y, width]} />
        <meshStandardMaterial color={C.asphalt} roughness={0.92} />
      </mesh>
      {/* pavements with a kerb */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[cx, 0.07, s * (kerb + 1.4)]} receiveShadow>
            <boxGeometry args={[len, 0.14, 2.8]} />
            <meshStandardMaterial color={C.concrete} roughness={0.85} />
          </mesh>
          <mesh position={[cx, 0.075, s * kerb]} receiveShadow>
            <boxGeometry args={[len, 0.15, 0.2]} />
            <meshStandardMaterial color={C.curb} roughness={0.8} />
          </mesh>
          {/* solid edge line */}
          <mesh position={[cx, ROAD_Y + 0.003, s * (width / 2 - 0.35)]} receiveShadow>
            <boxGeometry args={[len, 0.006, 0.14]} />
            <meshStandardMaterial color={C.line} roughness={0.7} />
          </mesh>
        </group>
      ))}
      <Dashes x0={x0} x1={x1} y={ROAD_Y + 0.004} />
      {treeList.map((t, i) => (
        <Tree key={i} position={[t.x, 0, t.z]} scale={t.s} tone={t.tone} />
      ))}
      {lamps.map((x) => (
        <LampPost key={x} position={[x, 0.14, -(kerb + 0.6)]} rotationY={0} />
      ))}
    </group>
  );
}

/** Numbered posts beside the road, like the kilometre stones that let you read a position off. */
export function DistancePosts({
  from,
  step,
  count,
  z,
  unit = "м",
  origin = 0,
  show = () => 1,
}: {
  from: number;
  step: number;
  count: number;
  z: number;
  unit?: string;
  /** The number printed on the first post. */
  origin?: number;
  /** Opacity (0…1) of the whole set at time t. */
  show?: (t: number) => number;
}) {
  return (
    <Show when={(t) => show(t) > 0.01}>
      {Array.from({ length: count }, (_, i) => {
        const x = from + i * step;
        return (
          <group key={i}>
            <mesh position={[x, 0.45, z]} castShadow>
              <boxGeometry args={[0.18, 0.9, 0.18]} />
              <meshStandardMaterial color={i === 0 ? "#f59e0b" : "#f8fafc"} roughness={0.6} />
            </mesh>
            <mesh position={[x, 0.62, z]}>
              <boxGeometry args={[0.2, 0.18, 0.2]} />
              <meshStandardMaterial color="#1f47e6" />
            </mesh>
            <LiveTag tone={i === 0 ? "amber" : undefined} get={(t) => ({ pos: [x, 1.1, z], opacity: show(t) })}>
              {origin + i * step} {unit}
            </LiveTag>
          </group>
        );
      })}
    </Show>
  );
}
