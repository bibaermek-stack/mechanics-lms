"use client";

// Lab equipment modelled procedurally to sit alongside the scanned PASCO
// devices: the bench, the 1.2 m dynamics track, ramps, pulleys, mass hangers,
// stands and bumpers. Dimensions are in metres and follow the real hardware
// closely enough that the scanned cart looks right on the track.

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";

/** Height of the lab bench top. Everything on the bench is placed at this y. */
export const BENCH_H = 0.75;
/** Distance from the bench top to the running surface of the track. */
export const TRACK_H = 0.032;
/** Standard PASCO dynamics track length. */
export const TRACK_L = 1.2;

const ALU = "#b9c2cf";
const ALU_DARK = "#8d97a6";
const STEEL = "#6b7280";
const PASCO_BLUE = "#1e5aa8";

// ---------------------------------------------------------------------------
// Bench
// ---------------------------------------------------------------------------

export function LabBench({
  from = -0.2,
  to = TRACK_L + 0.06,
  depth = 0.62,
}: {
  from?: number;
  to?: number;
  depth?: number;
}) {
  const width = to - from;
  const cx = (from + to) / 2;
  const legX = [from + 0.06, to - 0.06];
  const legZ = [-depth / 2 + 0.06, depth / 2 - 0.06];

  return (
    <group>
      {/* worktop — light enough for the dark PASCO housings to read against */}
      <mesh position={[cx, BENCH_H - 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.04, depth]} />
        <meshStandardMaterial color="#eceef2" roughness={0.62} metalness={0.04} />
      </mesh>
      {/* dark edge banding, the way a real lab bench is trimmed */}
      <mesh position={[cx, BENCH_H - 0.021, 0]} receiveShadow>
        <boxGeometry args={[width + 0.006, 0.026, depth + 0.006]} />
        <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.2} />
      </mesh>
      <mesh position={[cx, BENCH_H - 0.045, 0]} receiveShadow>
        <boxGeometry args={[width - 0.01, 0.012, depth - 0.01]} />
        <meshStandardMaterial color="#8f99a8" roughness={0.9} />
      </mesh>
      {legX.map((x) =>
        legZ.map((z) => (
          <mesh key={`${x}-${z}`} position={[x, (BENCH_H - 0.04) / 2, z]} castShadow>
            <boxGeometry args={[0.035, BENCH_H - 0.04, 0.035]} />
            <meshStandardMaterial color={STEEL} roughness={0.5} metalness={0.5} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dynamics track
// ---------------------------------------------------------------------------

export function DynamicsTrack({
  length = TRACK_L,
  x0 = 0,
  y = BENCH_H,
  z = 0,
  showScale = true,
}: {
  length?: number;
  /** World x of the track's zero mark. */
  x0?: number;
  y?: number;
  z?: number;
  showScale?: boolean;
}) {
  const ticks = useMemo(() => {
    const out: { x: number; major: boolean; label?: string }[] = [];
    for (let i = 0; i <= Math.round(length * 100); i += 5) {
      const major = i % 10 === 0;
      out.push({ x: i / 100, major, label: major ? String(i) : undefined });
    }
    return out;
  }, [length]);

  return (
    <group position={[x0, y, z]}>
      {/* main extrusion */}
      <mesh position={[length / 2, 0.014, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, 0.028, 0.095]} />
        <meshStandardMaterial color={ALU} roughness={0.35} metalness={0.65} />
      </mesh>
      {/* T-slot grooves down each side */}
      {[-0.0475, 0.0475].map((zz) => (
        <mesh key={zz} position={[length / 2, 0.016, zz]}>
          <boxGeometry args={[length + 0.001, 0.008, 0.004]} />
          <meshStandardMaterial color={ALU_DARK} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
      {/* running rails the cart wheels sit on */}
      {[-0.034, 0.034].map((zz) => (
        <mesh key={zz} position={[length / 2, 0.0305, zz]} castShadow>
          <boxGeometry args={[length, 0.005, 0.014]} />
          <meshStandardMaterial color="#d5dbe4" roughness={0.25} metalness={0.7} />
        </mesh>
      ))}
      {/* end stops */}
      {[0, length].map((xx, i) => (
        <mesh key={xx} position={[xx + (i === 0 ? -0.008 : 0.008), 0.031, 0]} castShadow>
          <boxGeometry args={[0.016, 0.062, 0.095]} />
          <meshStandardMaterial color={PASCO_BLUE} roughness={0.4} metalness={0.15} />
        </mesh>
      ))}
      {/* levelling feet */}
      {[0.06, length - 0.06].map((xx) => (
        <mesh key={xx} position={[xx, -0.006, 0]} castShadow>
          <cylinderGeometry args={[0.016, 0.018, 0.012, 16]} />
          <meshStandardMaterial color="#334155" roughness={0.9} />
        </mesh>
      ))}
      {/* printed scale on the front face */}
      {showScale && (
        <group position={[0, 0.014, 0.0485]}>
          <mesh position={[length / 2, 0.004, 0]}>
            <boxGeometry args={[length, 0.016, 0.001]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.85} />
          </mesh>
          {ticks.map((t) => (
            <mesh key={t.x} position={[t.x, t.major ? 0.002 : 0.006, 0.0009]}>
              <boxGeometry args={[0.0012, t.major ? 0.011 : 0.005, 0.0004]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

/** Wraps children in a track that is tilted by `angle` (rad) about its left end. */
export function Incline({
  angle,
  length = TRACK_L,
  x0 = 0,
  children,
}: {
  angle: number;
  length?: number;
  x0?: number;
  children?: React.ReactNode;
}) {
  // The ramp pivots on the bench at its lower (left) end and rises to the
  // right, where an adjustable jack holds it up. A child placed at local
  // x = s therefore sits s metres up the ramp from the foot.
  const jackAt = length - 0.07;
  const rise = jackAt * Math.sin(angle);
  return (
    <group position={[x0, BENCH_H, 0]}>
      <group rotation={[0, 0, angle]}>
        <DynamicsTrack length={length} x0={0} y={0} />
        {children}
      </group>
      {/* support jack under the raised end */}
      <group position={[jackAt * Math.cos(angle), 0, 0]}>
        <mesh position={[0, rise / 2, 0]} castShadow>
          <boxGeometry args={[0.05, Math.max(rise, 0.004), 0.09]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.35} />
        </mesh>
        <mesh position={[0, 0.004, 0]} castShadow>
          <boxGeometry args={[0.11, 0.008, 0.12]} />
          <meshStandardMaterial color="#475569" roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Super pulley with table clamp
// ---------------------------------------------------------------------------

export interface PulleyHandle {
  spin: (deltaAngle: number) => void;
}

/**
 * C-clamp gripping the edge of the bench, carrying a pulley out past the top.
 *
 * A table pulley has to be clamped to something. Without this the pulley's own
 * mounting rod ends in mid air, and anything modelled as standing under it has
 * its base hanging off the edge of the worktop — which is what both the second
 * law and the flywheel scenes were doing.
 *
 * `x` is the outer face of the bench top, `reach` how far past it the load
 * sits, and `postTop` the height the post has to climb to meet that load
 * (omit it when the load's own rod already comes down to the arm).
 */
export function BenchClamp({
  x,
  z = 0,
  reach = 0.04,
  postTop,
}: {
  x: number;
  z?: number;
  reach?: number;
  postTop?: number;
}) {
  const spineH = 0.105;
  const armY = 0.028;
  const postH = postTop === undefined ? 0 : Math.max(postTop - BENCH_H - armY, 0);

  return (
    <group position={[x, BENCH_H, z]}>
      {/* jaws either side of the worktop, and the spine wrapping its edge */}
      <mesh position={[-0.04, 0.006, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.09, 0.012, 0.05]} />
        <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[0.007, 0.012 - spineH / 2, 0]} castShadow>
        <boxGeometry args={[0.014, spineH, 0.05]} />
        <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh position={[-0.04, 0.018 - spineH, 0]} castShadow>
        <boxGeometry args={[0.09, 0.012, 0.05]} />
        <meshStandardMaterial color="#4b5563" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* thumbscrew pinching the top between the jaws */}
      <mesh position={[-0.035, 0.024 - spineH + 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.006, 0.006, 0.04, 12]} />
        <meshStandardMaterial color={STEEL} metalness={0.75} roughness={0.3} />
      </mesh>
      {/* arm carrying the load out past the edge */}
      <mesh position={[reach / 2 + 0.005, armY, 0]} castShadow>
        <boxGeometry args={[reach + 0.024, 0.016, 0.03]} />
        <meshStandardMaterial color="#64748b" roughness={0.45} metalness={0.45} />
      </mesh>
      {postH > 0 && (
        <mesh position={[reach, armY + postH / 2, 0]} castShadow>
          <boxGeometry args={[0.016, postH, 0.024]} />
          <meshStandardMaterial color="#64748b" roughness={0.45} metalness={0.45} />
        </mesh>
      )}
    </group>
  );
}

export const SuperPulley = forwardRef<
  PulleyHandle,
  { position: [number, number, number]; radius?: number }
>(function SuperPulley({ position, radius = 0.025 }, ref) {
  const wheel = useRef<THREE.Group>(null!);
  useImperativeHandle(ref, () => ({
    spin(d) {
      if (wheel.current) wheel.current.rotation.z -= d;
    },
  }));

  return (
    <group position={position}>
      {/* mounting rod down to the clamp */}
      <mesh position={[0, -0.055, 0]} castShadow>
        <cylinderGeometry args={[0.005, 0.005, 0.11, 12]} />
        <meshStandardMaterial color={STEEL} metalness={0.7} roughness={0.35} />
      </mesh>
      {/* fork */}
      {[-0.014, 0.014].map((z) => (
        <mesh key={z} position={[0, -0.005, z]} castShadow>
          <boxGeometry args={[0.01, 0.05, 0.004]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* wheel */}
      <group ref={wheel}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[radius, radius, 0.012, 28]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.0035, 8, 28]} />
          <meshStandardMaterial color={PASCO_BLUE} roughness={0.5} />
        </mesh>
        {/* spoke so the rotation is visible */}
        <mesh position={[0, radius * 0.55, 0]}>
          <boxGeometry args={[0.003, radius * 0.8, 0.013]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>
    </group>
  );
});

// ---------------------------------------------------------------------------
// Mass hanger + slotted masses
// ---------------------------------------------------------------------------

export const MassHanger = forwardRef<
  THREE.Group,
  { discs?: number; mass?: number }
>(function MassHanger({ discs = 3 }, ref) {
  return (
    <group ref={ref}>
      {/* hook */}
      <mesh position={[0, 0.012, 0]}>
        <torusGeometry args={[0.008, 0.0015, 6, 16, Math.PI * 1.4]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* stem */}
      <mesh position={[0, -0.018, 0]} castShadow>
        <cylinderGeometry args={[0.0025, 0.0025, 0.05, 10]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* slotted discs */}
      {Array.from({ length: discs }).map((_, i) => (
        <mesh key={i} position={[0, -0.042 - i * 0.011, 0]} castShadow>
          <cylinderGeometry args={[0.019, 0.019, 0.0095, 24]} />
          <meshStandardMaterial
            color={i % 2 ? "#475569" : "#64748b"}
            metalness={0.6}
            roughness={0.45}
          />
        </mesh>
      ))}
    </group>
  );
});

// ---------------------------------------------------------------------------
// Rod stand (for pendulums, sensors and force probes)
// ---------------------------------------------------------------------------

export function RodStand({
  position = [0, BENCH_H, 0],
  height = 0.5,
  armLength = 0,
}: {
  position?: [number, number, number];
  /** Height of the top of the rod (and of the cross-arm) above the base. */
  height?: number;
  /** Horizontal cross-arm at the top, extending along +x. */
  armLength?: number;
}) {
  const baseH = 0.024;
  const rodH = Math.max(height - baseH, 0.01);
  return (
    <group position={position}>
      <mesh position={[0, baseH / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, baseH, 0.12]} />
        <meshStandardMaterial color="#334155" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, baseH + rodH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.007, 0.007, rodH, 14]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.75} roughness={0.3} />
      </mesh>
      {armLength > 0 && (
        <>
          <mesh position={[armLength / 2, height, 0]} castShadow>
            <boxGeometry args={[armLength, 0.012, 0.012]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.75} roughness={0.3} />
          </mesh>
          <mesh position={[0, height, 0]} castShadow>
            <boxGeometry args={[0.03, 0.03, 0.03]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Helical spring (scales along +x so it compresses and stretches)
// ---------------------------------------------------------------------------

export interface SpringHandle {
  /** Anchor the spring at world x = `x0` and set its length (m). */
  set: (x0: number, length: number) => void;
}

export const Spring = forwardRef<
  SpringHandle,
  { y: number; z?: number; coils?: number; radius?: number; color?: string }
>(function Spring({ y, z = 0, coils = 22, radius = 0.014, color = "#9ca3af" }, ref) {
  const group = useRef<THREE.Group>(null!);

  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const steps = coils * 12;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = u * coils * Math.PI * 2;
      pts.push(new THREE.Vector3(u, Math.cos(a) * radius, Math.sin(a) * radius));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    return new THREE.TubeGeometry(curve, steps, 0.0018, 6, false);
  }, [coils, radius]);

  useImperativeHandle(ref, () => ({
    set(x0, length) {
      const g = group.current;
      if (!g) return;
      g.position.x = x0;
      g.scale.x = Math.max(length, 0.01);
    },
  }));

  return (
    <group ref={group} position={[0, y, z]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial color={color} metalness={0.75} roughness={0.35} />
      </mesh>
    </group>
  );
});

// ---------------------------------------------------------------------------
// Magnetic bumper (fits the front of a Smart Cart)
// ---------------------------------------------------------------------------

export function Bumper({
  position,
  facing = 1,
  color = "#dc2626",
}: {
  position: [number, number, number];
  facing?: 1 | -1;
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh position={[0.004 * facing, 0, 0]} castShadow>
        <boxGeometry args={[0.008, 0.03, 0.05]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * Bracket that lifts a photogate above the track. The scanned gate's clear
 * opening is 2/3 of its height, which is just short of the cart's roof if the
 * gate stands on the bench — mounting it this high lets the cart run through.
 */
export const GATE_LIFT = 0.05;

export function PhotogateMount({
  x,
  y = BENCH_H,
  lift = GATE_LIFT,
  spread = 0.058,
  /** Which way the gate's legs point, so the posts land underneath them. */
  axis = "z",
}: {
  x: number;
  y?: number;
  lift?: number;
  spread?: number;
  axis?: "x" | "z";
}) {
  return (
    <group position={[x, y, 0]}>
      {[-spread, spread].map((d) => (
        <group key={d} position={axis === "z" ? [0, 0, d] : [d, 0, 0]}>
          <mesh position={[0, lift / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.022, lift, 0.022]} />
            <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.005, 0]} castShadow receiveShadow>
            <boxGeometry
              args={axis === "z" ? [0.06, 0.01, 0.05] : [0.05, 0.01, 0.06]}
            />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Small foam/steel block used as a movable load. */
export function Block({
  size,
  color = "#f59e0b",
  metal = false,
}: {
  size: [number, number, number];
  color?: string;
  metal?: boolean;
}) {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        metalness={metal ? 0.7 : 0.1}
        roughness={metal ? 0.35 : 0.75}
      />
    </mesh>
  );
}
