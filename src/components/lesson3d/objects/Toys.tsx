"use client";

// Things for the momentum lesson: a pool table with balls and a cue, and
// Newton's cradle. Pool dimensions follow a 9-foot table (playing surface
// 2,54 × 1,27 m) and a standard 57,15 mm / 170 g ball.

import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";
import { C } from "./materials";

export const BALL_R = 0.02858;
export const CLOTH_Y = 0.82;
export const TABLE_W = 2.54;
export const TABLE_D = 1.27;

export function PoolTable() {
  const rail = 0.13;
  const hw = TABLE_W / 2;
  const hd = TABLE_D / 2;
  const pockets: [number, number][] = [
    [-hw, -hd], [0, -hd - 0.02], [hw, -hd], [-hw, hd], [0, hd + 0.02], [hw, hd],
  ];
  return (
    <group>
      {/* slate and cloth */}
      <mesh position={[0, CLOTH_Y - 0.04, 0]} receiveShadow castShadow>
        <boxGeometry args={[TABLE_W + 0.02, 0.08, TABLE_D + 0.02]} />
        <meshStandardMaterial color="#0f6b4a" roughness={0.95} />
      </mesh>
      {/* cushions and wooden rails */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[0, CLOTH_Y + 0.02, s * (hd + rail / 2)]} castShadow receiveShadow>
            <boxGeometry args={[TABLE_W + rail * 2, 0.1, rail]} />
            <meshStandardMaterial color="#6b3f22" roughness={0.5} />
          </mesh>
          <mesh position={[s * (hw + rail / 2), CLOTH_Y + 0.02, 0]} castShadow receiveShadow>
            <boxGeometry args={[rail, 0.1, TABLE_D]} />
            <meshStandardMaterial color="#6b3f22" roughness={0.5} />
          </mesh>
          <mesh position={[0, CLOTH_Y + 0.005, s * (hd - 0.025)]} receiveShadow>
            <boxGeometry args={[TABLE_W - 0.2, 0.05, 0.05]} />
            <meshStandardMaterial color="#0c5a3e" roughness={0.9} />
          </mesh>
          <mesh position={[s * (hw - 0.025), CLOTH_Y + 0.005, 0]} receiveShadow>
            <boxGeometry args={[0.05, 0.05, TABLE_D - 0.2]} />
            <meshStandardMaterial color="#0c5a3e" roughness={0.9} />
          </mesh>
          {/* diamonds */}
          {[-0.95, -0.635, -0.32, 0, 0.32, 0.635, 0.95].map((x) => (
            <mesh key={x} position={[x, CLOTH_Y + 0.073, s * (hd + rail / 2)]}>
              <boxGeometry args={[0.025, 0.004, 0.025]} />
              <meshStandardMaterial color="#f1e3b8" />
            </mesh>
          ))}
        </group>
      ))}
      {pockets.map(([x, z], i) => (
        <mesh key={i} position={[x, CLOTH_Y + 0.003, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.055, 24]} />
          <meshStandardMaterial color="#05070d" roughness={1} />
        </mesh>
      ))}
      {/* legs */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (hw - 0.1), (CLOTH_Y - 0.08) / 2, sz * (hd - 0.1)]} castShadow>
            <boxGeometry args={[0.2, CLOTH_Y - 0.08, 0.2]} />
            <meshStandardMaterial color="#4e2c16" roughness={0.55} />
          </mesh>
        ))
      )}
    </group>
  );
}

export interface BallHandle {
  /** Rolling about the Z axis without slipping: angle = distance / radius. */
  setRoll: (rad: number) => void;
}

export const Ball = forwardRef<BallHandle, { color: string; r?: number; stripe?: boolean; metal?: boolean }>(function Ball(
  { color, r = BALL_R, stripe = false, metal = false },
  ref
) {
  const g = useRef<THREE.Group>(null!);
  useImperativeHandle(ref, () => ({
    setRoll(rad) {
      g.current.rotation.z = -rad;
    },
  }));
  return (
    <group ref={g}>
      <mesh castShadow>
        <sphereGeometry args={[r, 32, 24]} />
        <meshPhysicalMaterial color={color} roughness={metal ? 0.18 : 0.22} metalness={metal ? 0.9 : 0.05} clearcoat={metal ? 0 : 1} clearcoatRoughness={0.1} />
      </mesh>
      {/* a small dot so rolling can be seen */}
      <mesh position={[r * 0.97, 0, 0]}>
        <sphereGeometry args={[r * 0.2, 12, 8]} />
        <meshStandardMaterial color={stripe ? "#f8fafc" : "#1f2937"} />
      </mesh>
      <mesh position={[0, r * 0.97, 0]}>
        <sphereGeometry args={[r * 0.14, 10, 8]} />
        <meshStandardMaterial color={stripe ? "#f8fafc" : "#1f2937"} />
      </mesh>
    </group>
  );
});

/** A cue lying along +X, tip at the origin, extending to -X. */
export function Cue() {
  return (
    <group>
      <mesh position={[-0.7, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.007, 0.0145, 1.4, 20]} />
        <meshStandardMaterial color="#d8b27a" roughness={0.45} />
      </mesh>
      <mesh position={[-1.1, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.0128, 0.0145, 0.6, 20]} />
        <meshStandardMaterial color="#2b1a10" roughness={0.5} />
      </mesh>
      <mesh position={[0.004, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0068, 0.0068, 0.012, 16]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Newton's cradle
// ---------------------------------------------------------------------------

export const CRADLE = { r: 0.025, L: 0.2, top: 0.24, half: 0.07 };

export interface CradleHandle {
  setAngles: (a: number[]) => void;
}

/** Five steel balls on V-strings. Origin on the table; the balls swing in the x–y plane. */
export const NewtonCradle = forwardRef<CradleHandle>(function NewtonCradle(_, ref) {
  const balls = useRef<(THREE.Group | null)[]>([]);
  useImperativeHandle(ref, () => ({
    setAngles(a) {
      a.forEach((ang, i) => {
        const g = balls.current[i];
        if (g) g.rotation.z = ang;
      });
    },
  }));
  const { r, L, top, half } = CRADLE;
  const strLen = Math.hypot(L, half);
  const tilt = Math.atan2(half, L);
  return (
    <group>
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.02, 0.26]} />
        <meshStandardMaterial color="#3a2415" roughness={0.5} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.22, top / 2, sz * half]} castShadow>
            <cylinderGeometry args={[0.005, 0.005, top, 12]} />
            <meshStandardMaterial color="#d6dce6" metalness={0.95} roughness={0.2} />
          </mesh>
        ))
      )}
      {[-1, 1].map((sz) => (
        <mesh key={sz} position={[0, top, sz * half]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.005, 0.005, 0.44, 12]} />
          <meshStandardMaterial color="#d6dce6" metalness={0.95} roughness={0.2} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[(i - 2) * 2 * r, top, 0]} ref={(g) => { balls.current[i] = g; }}>
          <mesh position={[0, -L, 0]} castShadow>
            <sphereGeometry args={[r, 40, 28]} />
            <meshStandardMaterial color="#dfe5ee" metalness={1} roughness={0.12} />
          </mesh>
          {[-1, 1].map((sz) => (
            <mesh key={sz} position={[0, -L / 2, sz * half * 0.5]} rotation={[sz * tilt, 0, 0]}>
              <cylinderGeometry args={[0.0007, 0.0007, strLen, 6]} />
              <meshStandardMaterial color="#e5e7eb" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
});

void C;
