"use client";

// Props for the first lesson's little demonstrations: a wooden crate, a
// seesaw, and a railway wagon with a platform. All in metres.

import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Figure } from "./Figure";
import { C } from "./materials";

// ---------------------------------------------------------------------------
// Crate
// ---------------------------------------------------------------------------

/** A slatted wooden crate. Origin on the floor, centred. */
export function Crate({ size = 0.8, color = C.wood }: { size?: number; color?: string }) {
  const h = size / 2;
  const post = size * 0.09;
  return (
    <group position={[0, h, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      {/* corner posts */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (h - post / 2 + 0.005), 0, sz * (h - post / 2 + 0.005)]} castShadow>
            <boxGeometry args={[post, size + 0.01, post]} />
            <meshStandardMaterial color={C.woodDark} roughness={0.9} />
          </mesh>
        ))
      )}
      {/* horizontal rails on the four faces */}
      {[-1, 1].flatMap((s) =>
        [-0.32, 0, 0.32].flatMap((y) => [
          <mesh key={`x${s}${y}`} position={[s * (h + 0.003), y * size, 0]}>
            <boxGeometry args={[0.012, post * 0.8, size - post]} />
            <meshStandardMaterial color={C.woodDark} roughness={0.9} />
          </mesh>,
          <mesh key={`z${s}${y}`} position={[0, y * size, s * (h + 0.003)]}>
            <boxGeometry args={[size - post, post * 0.8, 0.012]} />
            <meshStandardMaterial color={C.woodDark} roughness={0.9} />
          </mesh>,
        ])
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Seesaw
// ---------------------------------------------------------------------------

/** Plank top height when level. Kids sit on it. */
export const SEESAW_TOP = 0.78;

export interface SeesawHandle {
  /** Tilt of the plank about the fulcrum, rad (positive lowers the +X end). */
  setTilt: (rad: number) => void;
}

/** Height of the pivot axle above the ground. */
export const SEESAW_PIVOT = 0.7;

export const Seesaw = forwardRef<SeesawHandle, { children?: React.ReactNode }>(function Seesaw({ children }, ref) {
  const plank = useRef<THREE.Group>(null!);
  useImperativeHandle(ref, () => ({
    setTilt(rad) {
      plank.current.rotation.z = -rad;
    },
  }));
  return (
    <group>
      {/* A-frame fulcrum */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * 0.18]}>
          <mesh position={[0.18, 0.36, 0]} rotation={[0, 0, -0.35]} castShadow>
            <boxGeometry args={[0.07, 0.8, 0.07]} />
            <meshStandardMaterial color={C.steelDark} metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[-0.18, 0.36, 0]} rotation={[0, 0, 0.35]} castShadow>
            <boxGeometry args={[0.07, 0.8, 0.07]} />
            <meshStandardMaterial color={C.steelDark} metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, SEESAW_PIVOT, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.5, 14]} />
        <meshStandardMaterial color="#d5dbe4" metalness={0.8} roughness={0.3} />
      </mesh>
      <group ref={plank} position={[0, SEESAW_PIVOT, 0]}>
        <mesh position={[0, SEESAW_TOP - SEESAW_PIVOT - 0.03, 0]} castShadow receiveShadow>
          <boxGeometry args={[5, 0.06, 0.34]} />
          <meshStandardMaterial color="#e4572e" roughness={0.6} />
        </mesh>
        {/* distance marks every 0.5 m */}
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[-2 + i * 0.5, SEESAW_TOP - SEESAW_PIVOT + 0.002, 0]}>
            <boxGeometry args={[0.025, 0.004, 0.34]} />
            <meshStandardMaterial color={i === 4 ? "#111827" : "#f8fafc"} />
          </mesh>
        ))}
        {children}
      </group>
    </group>
  );
});

/** A child sitting on the plank (coordinates relative to the pivot), facing along ±X. */
export function Kid({ x, facing, shirt, scale = 0.78 }: { x: number; facing: 1 | -1; shirt: string; scale?: number }) {
  return (
    <group position={[x, SEESAW_TOP - SEESAW_PIVOT - 0.5 * scale, 0]} rotation={[0, facing === 1 ? 0 : Math.PI, 0]} scale={scale}>
      <Figure seated shirt={shirt} pants="#334155" pose={{ armL: 0.9, armR: 0.9, elbowL: 0.3, elbowR: 0.3, lean: 0.05 }} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Railway
// ---------------------------------------------------------------------------

export const RAIL_Y = 0.16;

/** Two rails with sleepers along +X. */
export function Rails({ x0, x1, z = 0 }: { x0: number; x1: number; z?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const n = Math.ceil((x1 - x0) / 0.7);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      m.makeTranslation(x0 + i * 0.7, 0.07, z);
      ref.current.setMatrixAt(i, m);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [n, x0, z]);
  const len = x1 - x0;
  return (
    <group>
      {/* ballast */}
      <mesh position={[(x0 + x1) / 2, 0.03, z]} receiveShadow>
        <boxGeometry args={[len, 0.06, 3.6]} />
        <meshStandardMaterial color="#9a9486" roughness={1} />
      </mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, n]} castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.1, 2.5]} />
        <meshStandardMaterial color="#6b5d4f" roughness={0.95} />
      </instancedMesh>
      {[-0.72, 0.72].map((dz) => (
        <mesh key={dz} position={[(x0 + x1) / 2, 0.16, z + dz]} castShadow>
          <boxGeometry args={[len, 0.12, 0.08]} />
          <meshStandardMaterial color="#c3c9d3" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

export interface WagonHandle {
  setRoll: (rad: number) => void;
}

const WAGON = { length: 18, width: 3, floor: 1.0, roof: 3.55 };

/** A passenger wagon with see-through windows and a seated passenger. Forward is +X. */
export const Wagon = forwardRef<WagonHandle, { passenger?: boolean }>(function Wagon({ passenger = true }, ref) {
  const wheels = useRef<THREE.Group[]>([]);
  wheels.current = [];
  useImperativeHandle(ref, () => ({
    setRoll(rad) {
      for (const w of wheels.current) w.rotation.z = -rad;
    },
  }));

  const pillars = useMemo(() => Array.from({ length: 13 }, (_, i) => -WAGON.length / 2 + 0.6 + i * 1.4), []);
  const bogieX = [-5.8, 5.8];

  return (
    <group>
      {/* underframe */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[WAGON.length, 0.3, 2.4]} />
        <meshStandardMaterial color="#2a303c" metalness={0.4} roughness={0.7} />
      </mesh>
      {/* floor and roof */}
      <mesh position={[0, WAGON.floor + 0.04, 0]} castShadow receiveShadow>
        <boxGeometry args={[WAGON.length, 0.1, WAGON.width]} />
        <meshStandardMaterial color="#cbd0d8" roughness={0.7} />
      </mesh>
      <mesh position={[0, WAGON.roof, 0]} castShadow>
        <boxGeometry args={[WAGON.length, 0.14, WAGON.width]} />
        <meshStandardMaterial color="#e7ebf1" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, WAGON.roof + 0.14, 0]} castShadow>
        <boxGeometry args={[WAGON.length - 0.6, 0.16, WAGON.width - 0.7]} />
        <meshStandardMaterial color="#d6dbe3" roughness={0.5} metalness={0.2} />
      </mesh>
      {/* side walls: lower skirt, upper band, pillars between the windows */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, 0, s * (WAGON.width / 2 - 0.05)]}>
          <mesh position={[0, 1.55, 0]} castShadow>
            <boxGeometry args={[WAGON.length, 0.95, 0.1]} />
            <meshStandardMaterial color="#1f47e6" metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0, 3.3, 0]} castShadow>
            <boxGeometry args={[WAGON.length, 0.4, 0.1]} />
            <meshStandardMaterial color="#1f47e6" metalness={0.3} roughness={0.4} />
          </mesh>
          {pillars.map((x) => (
            <mesh key={x} position={[x, 2.45, 0]} castShadow>
              <boxGeometry args={[0.22, 1.0, 0.1]} />
              <meshStandardMaterial color="#e7ebf1" metalness={0.2} roughness={0.5} />
            </mesh>
          ))}
          <mesh position={[0, 2.45, 0]}>
            <boxGeometry args={[WAGON.length - 0.2, 1.0, 0.02]} />
            <meshStandardMaterial color="#9fc3e6" transparent opacity={0.22} roughness={0.1} metalness={0.1} depthWrite={false} />
          </mesh>
          {/* white stripe */}
          <mesh position={[0, 1.25, 0.055]}>
            <boxGeometry args={[WAGON.length, 0.1, 0.01]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
      ))}
      {/* end walls */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (WAGON.length / 2 - 0.05), 2.3, 0]} castShadow>
          <boxGeometry args={[0.1, 2.5, WAGON.width]} />
          <meshStandardMaterial color="#cfd5de" roughness={0.6} />
        </mesh>
      ))}
      {/* interior bench along the near wall */}
      <mesh position={[0.6, 1.5, -(WAGON.width / 2 - 0.45)]} castShadow>
        <boxGeometry args={[4.2, 0.12, 0.5]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      <mesh position={[0.6, 1.95, -(WAGON.width / 2 - 0.22)]} castShadow>
        <boxGeometry args={[4.2, 0.7, 0.1]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
      {passenger && (
        <group position={[0.6, 1.5 - 0.5, -(WAGON.width / 2 - 0.5)]} rotation={[0, 0, 0]}>
          <Figure seated shirt="#f59e0b" pants="#1f2937" pose={{ armL: 0.5, armR: 0.5, elbowL: 0.9, elbowR: 0.9 }} />
        </group>
      )}
      {/* bogies */}
      {bogieX.map((bx) => (
        <group key={bx} position={[bx, 0, 0]}>
          <mesh position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[2.6, 0.18, 2.0]} />
            <meshStandardMaterial color="#1b202b" metalness={0.5} roughness={0.6} />
          </mesh>
          {[-0.9, 0.9].map((ax) =>
            [-0.72, 0.72].map((az) => (
              <group key={`${ax}${az}`} position={[ax, 0.46, az]}>
                <group ref={(g) => { if (g) wheels.current.push(g); }}>
                  <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
                    <cylinderGeometry args={[0.46, 0.46, 0.12, 28]} />
                    <meshStandardMaterial color="#8d97a6" metalness={0.8} roughness={0.35} />
                  </mesh>
                  <mesh position={[0.3, 0, az > 0 ? 0.07 : -0.07]}>
                    <boxGeometry args={[0.1, 0.1, 0.02]} />
                    <meshStandardMaterial color="#c3342f" />
                  </mesh>
                </group>
              </group>
            ))
          )}
        </group>
      ))}
    </group>
  );
});

/** Raised platform along +X, edge at z = 0, extending to −z by `depth`. Top at y = 1.1. */
export function Platform({ x0, x1, depth = 5, canopy = true }: { x0: number; x1: number; depth?: number; canopy?: boolean }) {
  const len = x1 - x0;
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, 0.55, -depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[len, 1.1, depth]} />
        <meshStandardMaterial color="#c9ced6" roughness={0.9} />
      </mesh>
      <mesh position={[(x0 + x1) / 2, 1.105, -0.35]}>
        <boxGeometry args={[len, 0.01, 0.35]} />
        <meshStandardMaterial color="#f5c518" />
      </mesh>
      {/* canopy columns */}
      {canopy && Array.from({ length: Math.floor(len / 12) }, (_, i) => (
        <mesh key={i} position={[x0 + 6 + i * 12, 2.6, -depth + 0.6]} castShadow>
          <boxGeometry args={[0.2, 3.0, 0.2]} />
          <meshStandardMaterial color={C.steelDark} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {canopy && (
        <mesh position={[(x0 + x1) / 2, 4.15, -depth / 2 - 0.2]} castShadow>
          <boxGeometry args={[len, 0.14, depth + 0.8]} />
          <meshStandardMaterial color="#e4572e" roughness={0.6} />
        </mesh>
      )}
      {/* lamp posts along the back edge */}
      {Array.from({ length: Math.floor(len / 14) }, (_, i) => (
        <group key={i} position={[x0 + 7 + i * 14, 1.1, -depth + 0.4]}>
          <mesh position={[0, 1.6, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 3.2, 10]} />
            <meshStandardMaterial color={C.steelDark} metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, 3.25, 0]}>
            <sphereGeometry args={[0.22, 16, 12]} />
            <meshStandardMaterial color="#fff7d6" emissive="#fff1b0" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
