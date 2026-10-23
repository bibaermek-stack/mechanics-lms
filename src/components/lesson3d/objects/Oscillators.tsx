"use client";

// A longcase pendulum clock and a pendulum rig for the oscillation lesson.
// The clock is sized like a real one (2,1 m tall) around a seconds pendulum
// (0,994 m: half a swing per second).

import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

const WOOD = "#7a4a24";
const WOOD_DARK = "#5e3719";
const BRASS = "#c9a24a";

export const CLOCK = { pivotY: 1.72, seconds: 0.994 };

export interface ClockHandle {
  /** Pendulum swing angle (rad) and the clock's running time (s) for the hands. */
  set: (angle: number, seconds: number) => void;
}

export const LongcaseClock = forwardRef<ClockHandle>(function LongcaseClock(_, ref) {
  const pend = useRef<THREE.Group>(null!);
  const hourH = useRef<THREE.Group>(null!);
  const minH = useRef<THREE.Group>(null!);
  const secH = useRef<THREE.Group>(null!);
  useImperativeHandle(ref, () => ({
    set(angle, sec) {
      pend.current.rotation.z = angle;
      // hands: the clock shows 10:08 when the film starts and keeps true time
      const total = 10 * 3600 + 8 * 60 + sec;
      minH.current.rotation.z = -((total / 60) % 60) * ((Math.PI * 2) / 60);
      hourH.current.rotation.z = -((total / 3600) % 12) * ((Math.PI * 2) / 12);
      // a seconds hand that ticks once per second, like the escapement does
      secH.current.rotation.z = -Math.floor(sec) * ((Math.PI * 2) / 60);
    },
  }));
  const wood = (c = WOOD) => <meshStandardMaterial color={c} roughness={0.5} metalness={0.05} />;
  return (
    <group>
      {/* plinth, base */}
      <mesh position={[0, 0.09, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.56, 0.18, 0.36]} />
        {wood(WOOD_DARK)}
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.4, 0.32]} />
        {wood()}
      </mesh>
      {/* waist: sides, back, and a glass door */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.205, 1.17, 0]} castShadow>
          <boxGeometry args={[0.07, 1.1, 0.28]} />
          {wood()}
        </mesh>
      ))}
      <mesh position={[0, 1.17, -0.125]} receiveShadow>
        <boxGeometry args={[0.34, 1.1, 0.04]} />
        <meshStandardMaterial color="#d9c9a8" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.17, 0.13]}>
        <boxGeometry args={[0.34, 1.0, 0.012]} />
        <meshPhysicalMaterial color="#cfe6f5" transparent opacity={0.16} roughness={0.05} depthWrite={false} />
      </mesh>
      {[0.64, 1.7].map((y) => (
        <mesh key={y} position={[0, y, 0.13]}>
          <boxGeometry args={[0.34, 0.04, 0.03]} />
          {wood(WOOD_DARK)}
        </mesh>
      ))}
      {/* hood with the dial */}
      <mesh position={[0, 1.93, 0]} castShadow>
        <boxGeometry args={[0.52, 0.44, 0.3]} />
        {wood()}
      </mesh>
      <mesh position={[0, 2.18, 0]} castShadow>
        <boxGeometry args={[0.58, 0.07, 0.34]} />
        {wood(WOOD_DARK)}
      </mesh>
      <mesh position={[0, 2.25, 0]} castShadow>
        <sphereGeometry args={[0.04, 14, 10]} />
        <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
      </mesh>
      <group position={[0, 1.95, 0.155]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.19, 0.19, 0.012, 48]} />
          <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.172, 0.172, 0.012, 48]} />
          <meshStandardMaterial color="#f7f1e3" roughness={0.7} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return (
            <mesh key={i} position={[Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0.016]} rotation={[0, 0, -a]}>
              <boxGeometry args={[0.012, i % 3 === 0 ? 0.034 : 0.02, 0.004]} />
              <meshStandardMaterial color="#1f2937" />
            </mesh>
          );
        })}
        <group ref={hourH} position={[0, 0, 0.022]}>
          <mesh position={[0, 0.045, 0]}>
            <boxGeometry args={[0.014, 0.09, 0.004]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>
        <group ref={minH} position={[0, 0, 0.026]}>
          <mesh position={[0, 0.065, 0]}>
            <boxGeometry args={[0.01, 0.13, 0.004]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        </group>
        <group ref={secH} position={[0, 0, 0.03]}>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[0.004, 0.15, 0.003]} />
            <meshStandardMaterial color="#c81e1e" />
          </mesh>
        </group>
        <mesh position={[0, 0, 0.032]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.008, 12]} />
          <meshStandardMaterial color={BRASS} metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
      {/* hanging weights */}
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={x} position={[x, 1.05 - i * 0.12, -0.04]} castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.22, 16]} />
          <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {/* pendulum: rod and a brass lens bob on the pivot at the top of the waist */}
      <group ref={pend} position={[0, CLOCK.pivotY, 0.0]}>
        <mesh position={[0, -CLOCK.seconds / 2, 0]} castShadow>
          <cylinderGeometry args={[0.005, 0.005, CLOCK.seconds, 8]} />
          <meshStandardMaterial color="#d6dce6" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0, -CLOCK.seconds, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.085, 0.085, 0.025, 40]} />
          <meshStandardMaterial color={BRASS} metalness={0.95} roughness={0.2} />
        </mesh>
      </group>
    </group>
  );
});

// ---------------------------------------------------------------------------
// Simple pendulum rig
// ---------------------------------------------------------------------------

export interface PendulumHandle {
  setAngle: (rad: number) => void;
}

/** A bob on a string from a pivot at the origin, swinging in the x–y plane. */
export const SimplePendulum = forwardRef<PendulumHandle, { length: number; bobR: number; color: string; metal?: boolean }>(
  function SimplePendulum({ length, bobR, color, metal = false }, ref) {
    const g = useRef<THREE.Group>(null!);
    useImperativeHandle(ref, () => ({
      setAngle(a) {
        g.current.rotation.z = a;
      },
    }));
    return (
      <group ref={g}>
        <mesh position={[0, -length / 2, 0]}>
          <cylinderGeometry args={[0.0055, 0.0055, length, 6]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
        <mesh position={[0, -length - bobR * 0.0, 0]} castShadow>
          <sphereGeometry args={[bobR, 36, 24]} />
          <meshStandardMaterial color={color} metalness={metal ? 0.9 : 0.1} roughness={metal ? 0.25 : 0.55} />
        </mesh>
      </group>
    );
  }
);

/** Horizontal beam on two legs, top at `top`, `width` wide, for hanging pendulums from. */
export function PendulumFrame({ top, width = 1.6 }: { top: number; width?: number }) {
  return (
    <group>
      <mesh position={[0, top, 0]} castShadow>
        <boxGeometry args={[width, 0.05, 0.07]} />
        <meshStandardMaterial color="#1f47e6" roughness={0.45} metalness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (width / 2 - 0.04), 0, 0]}>
          <mesh position={[0, top / 2, 0]} castShadow>
            <boxGeometry args={[0.05, top, 0.05]} />
            <meshStandardMaterial color="#c9d1dc" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.22, 0.03, 0.34]} />
            <meshStandardMaterial color="#1b202b" metalness={0.5} roughness={0.55} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
