"use client";

// Apparatus for the dynamics lesson: coil spring, spring balance (dynamometer),
// slotted weights on a stand, a bathroom scale and a lift. Real sizes, in metres.

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "./materials";

// ---------------------------------------------------------------------------
// Coil spring
// ---------------------------------------------------------------------------

export interface SpringHandle {
  /** Stretch the coil to this overall length (m). */
  setLength: (len: number) => void;
}

/**
 * A helical spring hanging from y = 0 downwards. The coil is built at its
 * natural length and stretched by scaling along Y, which is exact for the
 * pitch and close enough for the wire (it thickens a little as it compresses).
 */
export const CoilSpring = forwardRef<
  SpringHandle,
  { natural?: number; radius?: number; turns?: number; wire?: number; color?: string }
>(function CoilSpring({ natural = 0.2, radius = 0.022, turns = 14, wire = 0.0032, color = "#c9d1dc" }, ref) {
  const body = useRef<THREE.Mesh>(null!);
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const n = turns * 18;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      pts.push(new THREE.Vector3(Math.cos(u * turns * Math.PI * 2) * radius, -u * natural, Math.sin(u * turns * Math.PI * 2) * radius));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n * 2, wire, 8, false);
  }, [natural, radius, turns, wire]);
  useImperativeHandle(ref, () => ({
    setLength(len) {
      body.current.scale.y = len / natural;
    },
  }));
  return (
    <mesh ref={body} geometry={geom} castShadow>
      <meshStandardMaterial color={color} metalness={0.85} roughness={0.3} />
    </mesh>
  );
});

// ---------------------------------------------------------------------------
// Spring balance (dynamometer)
// ---------------------------------------------------------------------------

export interface BalanceHandle {
  /** Reading as a fraction of full scale, 0…1. */
  setReading: (frac: number) => void;
}

/**
 * A tubular spring balance hanging from y = 0: eye on top, housing, a rod that
 * slides out of the bottom with the hook, and a pointer on the scale. Range is
 * represented by `travel` metres of rod.
 */
export const SpringBalance = forwardRef<BalanceHandle, { travel?: number }>(function SpringBalance({ travel = 0.12 }, ref) {
  const rod = useRef<THREE.Group>(null!);
  const pointer = useRef<THREE.Mesh>(null!);
  useImperativeHandle(ref, () => ({
    setReading(frac) {
      const f = Math.max(0, Math.min(1.1, frac));
      rod.current.position.y = -f * travel;
      pointer.current.position.y = -0.06 - f * 0.15;
    },
  }));
  const ticks = useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);
  return (
    <group>
      {/* suspension eye */}
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.014, 0.004, 10, 20]} />
        <meshStandardMaterial color="#d5dbe4" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* housing */}
      <mesh position={[0, -0.15, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.3, 24]} />
        <meshStandardMaterial color="#f3f5f8" roughness={0.45} metalness={0.15} />
      </mesh>
      <mesh position={[0, -0.001, 0]} castShadow>
        <cylinderGeometry args={[0.024, 0.024, 0.014, 24]} />
        <meshStandardMaterial color="#1f47e6" roughness={0.4} />
      </mesh>
      {/* scale window and ticks, facing +Z */}
      <mesh position={[0, -0.14, 0.0225]}>
        <boxGeometry args={[0.018, 0.2, 0.002]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      {ticks.map((i) => (
        <mesh key={i} position={[i % 5 === 0 ? 0 : -0.002, -0.06 - (i / 10) * 0.15, 0.0236]}>
          <boxGeometry args={[i % 5 === 0 ? 0.016 : 0.009, 0.0016, 0.001]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
      <mesh ref={pointer} position={[0, -0.06, 0.0245]}>
        <boxGeometry args={[0.02, 0.003, 0.002]} />
        <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.4} />
      </mesh>
      {/* rod and hook */}
      <group ref={rod}>
        <mesh position={[0, -0.33, 0]} castShadow>
          <cylinderGeometry args={[0.005, 0.005, 0.07, 10]} />
          <meshStandardMaterial color="#d5dbe4" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.378, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[0.011, 0.0036, 10, 20, Math.PI * 1.6]} />
          <meshStandardMaterial color="#d5dbe4" metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
});

// ---------------------------------------------------------------------------
// Slotted weight
// ---------------------------------------------------------------------------

/** A brass-coloured cylinder sized as a real mass would be (≈ 8 g/cm³). Hook ring on top at y = h. */
export function MassWeight({ kg, color = "#c8a24a" }: { kg: number; color?: string }) {
  const vol = kg / 8000; // m³
  const r = Math.cbrt(vol / (Math.PI * 1.6)); // height = 1.6 · radius·2? keep it stocky
  const h = vol / (Math.PI * r * r);
  return (
    <group>
      <mesh position={[0, -h / 2, 0]} castShadow>
        <cylinderGeometry args={[r, r, h, 32]} />
        <meshStandardMaterial color={color} metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.012, 0.0035, 10, 20]} />
        <meshStandardMaterial color="#d5dbe4" metalness={0.9} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function weightHeight(kg: number) {
  const vol = kg / 8000;
  const r = Math.cbrt(vol / (Math.PI * 1.6));
  return vol / (Math.PI * r * r);
}

// ---------------------------------------------------------------------------
// Retort stand
// ---------------------------------------------------------------------------

/** Base plate, a 1,2 m rod and a horizontal arm reaching +X. The arm's end is at (armLen, height). */
export function RetortStand({ height = 1.3, armLen = 0.35 }: { height?: number; armLen?: number }) {
  return (
    <group>
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.32, 0.02, 0.22]} />
        <meshStandardMaterial color="#1b202b" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[-0.08, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.009, 0.009, height, 14]} />
        <meshStandardMaterial color="#c9d1dc" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[-0.08 + armLen / 2, height - 0.01, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.007, 0.007, armLen, 12]} />
        <meshStandardMaterial color="#c9d1dc" metalness={0.9} roughness={0.28} />
      </mesh>
      <mesh position={[-0.08, height - 0.01, 0]} castShadow>
        <boxGeometry args={[0.03, 0.03, 0.03]} />
        <meshStandardMaterial color="#1f47e6" roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Vertical ruler with millimetre marks, 0 at the top, hanging down along -Y. Faces +Z. */
export function HangingRuler({ length = 0.3, zero = 0 }: { length?: number; zero?: number }) {
  const n = Math.round(length * 100);
  return (
    <group position={[0, zero, 0]}>
      <mesh position={[0, -length / 2, 0]} castShadow>
        <boxGeometry args={[0.03, length, 0.004]} />
        <meshStandardMaterial color="#f7e7a8" roughness={0.6} />
      </mesh>
      {Array.from({ length: n + 1 }, (_, i) => (
        <mesh key={i} position={[-0.009 + (i % 5 === 0 ? 0 : 0.004), -i * 0.01, 0.0025]}>
          <boxGeometry args={[i % 5 === 0 ? 0.014 : 0.007, 0.0008, 0.001]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Bathroom scale
// ---------------------------------------------------------------------------

/** Flat scale, top at y = 0.05. */
export function PlatformScale() {
  return (
    <group>
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.05, 0.34]} />
        <meshStandardMaterial color="#e8ecf2" roughness={0.35} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.0505, 0]} receiveShadow>
        <boxGeometry args={[0.44, 0.002, 0.28]} />
        <meshStandardMaterial color="#1f2937" roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.03, 0.172]}>
        <boxGeometry args={[0.18, 0.025, 0.004]} />
        <meshStandardMaterial color="#0b1220" emissive="#22d3ee" emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Lift
// ---------------------------------------------------------------------------

export const CAB = { w: 2.0, h: 2.4, d: 1.6 };

/** Open-fronted lift cabin (front faces +Z), floor at y = 0. */
export function LiftCabin({ children }: { children?: React.ReactNode }) {
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[CAB.w, 0.1, CAB.d]} />
        <meshStandardMaterial color="#8c93a1" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* back wall */}
      <mesh position={[0, CAB.h / 2, -CAB.d / 2 + 0.03]} castShadow>
        <boxGeometry args={[CAB.w, CAB.h, 0.06]} />
        <meshStandardMaterial color="#d9dee6" roughness={0.5} metalness={0.25} />
      </mesh>
      {/* handrail */}
      <mesh position={[0, 0.95, -CAB.d / 2 + 0.1]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, CAB.w - 0.2, 12]} />
        <meshStandardMaterial color="#c9d1dc" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* side walls: panels with a glass band so the shaft can be seen going by */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (CAB.w / 2 - 0.03), 0, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.06, 0.8, CAB.d]} />
            <meshStandardMaterial color="#d9dee6" roughness={0.5} metalness={0.25} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <boxGeometry args={[0.03, 1.2, CAB.d - 0.1]} />
            <meshStandardMaterial color="#9fc3e6" transparent opacity={0.22} depthWrite={false} roughness={0.1} />
          </mesh>
          <mesh position={[0, 2.3, 0]} castShadow>
            <boxGeometry args={[0.06, 0.2, CAB.d]} />
            <meshStandardMaterial color="#d9dee6" roughness={0.5} metalness={0.25} />
          </mesh>
        </group>
      ))}
      {/* ceiling with a light */}
      <mesh position={[0, CAB.h + 0.04, 0]} castShadow>
        <boxGeometry args={[CAB.w, 0.08, CAB.d]} />
        <meshStandardMaterial color="#aeb5c2" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, CAB.h - 0.005, 0]}>
        <boxGeometry args={[0.8, 0.01, 0.4]} />
        <meshStandardMaterial color="#fffdf2" emissive="#fff6d0" emissiveIntensity={0.9} />
      </mesh>
      {/* hoist yoke */}
      <mesh position={[0, CAB.h + 0.4, 0]} castShadow>
        <boxGeometry args={[0.12, 0.8, 0.12]} />
        <meshStandardMaterial color={C.steelDark} metalness={0.6} roughness={0.45} />
      </mesh>
      {children}
    </group>
  );
}

/** Concrete shaft with floor marks every 4 m: four corner pillars and a rear wall, open to the camera. */
export function LiftShaft({ height = 44 }: { height?: number }) {
  const px = CAB.w / 2 + 0.55;
  const pz = CAB.d / 2 + 0.3;
  return (
    <group>
      {/* only the rear pillars: the front ones would stand between the camera and the cabin */}
      {[-1, 1].flatMap((sx) =>
        [-1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * px, height / 2, sz * pz]} castShadow receiveShadow>
            <boxGeometry args={[0.3, height, 0.3]} />
            <meshStandardMaterial color="#b9c0cc" roughness={0.85} />
          </mesh>
        ))
      )}
      <mesh position={[0, height / 2, -pz - 0.2]} castShadow receiveShadow>
        <boxGeometry args={[px * 2 + 0.6, height, 0.2]} />
        <meshStandardMaterial color="#d3d8e0" roughness={0.9} />
      </mesh>
      {/* floor slabs and numbers */}
      {Array.from({ length: Math.floor(height / 4) + 1 }, (_, i) => (
        <mesh key={i} position={[0, i * 4 - 0.1, -pz + 0.2]} receiveShadow>
          <boxGeometry args={[px * 2 + 0.6, 0.2, 1.2]} />
          <meshStandardMaterial color="#9aa3b2" roughness={0.9} />
        </mesh>
      ))}
      {/* guide rails */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (CAB.w / 2 + 0.1), height / 2, -pz + 0.1]} castShadow>
          <boxGeometry args={[0.06, height, 0.06]} />
          <meshStandardMaterial color={C.steelDark} metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}
