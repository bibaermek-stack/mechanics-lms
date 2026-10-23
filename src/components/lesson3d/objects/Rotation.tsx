"use client";

// Ferris wheel, carousel and the rolling disc and ring of the rotation lesson.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { C } from "./materials";

// ---------------------------------------------------------------------------
// Ferris wheel
// ---------------------------------------------------------------------------

export const WHEEL = { R: 12, hubY: 14.5, n: 12 };
const GONDOLA_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

/** Wheel in the x–y plane facing +Z, hub at (0, hubY, 0). `phi(t)` is its angle. */
export function FerrisWheel({ phi, highlight = 0 }: { phi: (t: number) => number; highlight?: number }) {
  const rim = useRef<THREE.Group>(null!);
  const gondolas = useRef<(THREE.Group | null)[]>([]);
  const { R, hubY, n } = WHEEL;
  useStudioFrame((t) => {
    const a = phi(t);
    rim.current.rotation.z = a;
    gondolas.current.forEach((g, i) => {
      if (!g) return;
      const ang = a + (i * 2 * Math.PI) / n;
      g.position.set(R * Math.cos(ang), hubY + R * Math.sin(ang), 0);
    });
  });
  const spokes = useMemo(() => Array.from({ length: n }, (_, i) => (i * 2 * Math.PI) / n), [n]);
  return (
    <group>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => {
          const dx = sx * 7;
          const len = Math.hypot(dx, hubY);
          return (
            <mesh key={`${sx}${sz}`} position={[dx / 2, hubY / 2, sz * 1.9]} rotation={[0, 0, Math.atan2(-dx, hubY)]} castShadow>
              <boxGeometry args={[0.55, len, 0.55]} />
              <meshStandardMaterial color="#e5e9f0" metalness={0.3} roughness={0.5} />
            </mesh>
          );
        })
      )}
      {/* hub */}
      <mesh position={[0, hubY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 4.6, 24]} />
        <meshStandardMaterial color="#c3342f" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* rotating structure */}
      <group ref={rim} position={[0, hubY, 0]}>
        {[-1.3, 1.3].map((z) => (
          <group key={z} position={[0, 0, z]}>
            <mesh castShadow>
              <torusGeometry args={[R, 0.2, 10, 96]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.35} roughness={0.45} />
            </mesh>
            <mesh>
              <torusGeometry args={[R * 0.55, 0.1, 8, 64]} />
              <meshStandardMaterial color="#c3d0e4" metalness={0.35} roughness={0.5} />
            </mesh>
            {spokes.map((a, i) => (
              <mesh key={i} position={[Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, 0]} rotation={[0, 0, a + Math.PI / 2]}>
                <boxGeometry args={[0.1, R, 0.1]} />
                <meshStandardMaterial color="#dfe6f1" metalness={0.4} roughness={0.5} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 2.8, 16]} />
          <meshStandardMaterial color="#c3342f" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      {/* gondolas, always hanging upright */}
      {Array.from({ length: n }, (_, i) => (
        <group key={i} ref={(g) => { gondolas.current[i] = g; }}>
          <mesh position={[0, -0.7, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.05, 1.4, 8]} />
            <meshStandardMaterial color="#8d97a6" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0, -1.7, 0]} castShadow>
            <boxGeometry args={[1.9, 1.3, 2.4]} />
            <meshStandardMaterial color={i === highlight ? "#ef4444" : GONDOLA_COLORS[(i + 1) % GONDOLA_COLORS.length]} roughness={0.45} metalness={0.2} />
          </mesh>
          <mesh position={[0, -1.55, 1.205]}>
            <boxGeometry args={[1.5, 0.7, 0.02]} />
            <meshStandardMaterial color="#9fc3e6" transparent opacity={0.55} roughness={0.1} />
          </mesh>
          <mesh position={[0, -0.95, 0]} castShadow>
            <boxGeometry args={[2.1, 0.12, 2.6]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Carousel
// ---------------------------------------------------------------------------

function Horse({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.0, 0]} castShadow>
        <boxGeometry args={[1.05, 0.46, 0.34]} />
        <meshStandardMaterial color="#f6efe0" roughness={0.6} />
      </mesh>
      <mesh position={[0.55, 0.32, 0]} rotation={[0, 0, -0.7]} castShadow>
        <boxGeometry args={[0.28, 0.62, 0.26]} />
        <meshStandardMaterial color="#f6efe0" roughness={0.6} />
      </mesh>
      <mesh position={[0.82, 0.58, 0]} rotation={[0, 0, -0.2]} castShadow>
        <boxGeometry args={[0.5, 0.22, 0.22]} />
        <meshStandardMaterial color="#f6efe0" roughness={0.6} />
      </mesh>
      <mesh position={[0.98, 0.5, 0]}>
        <boxGeometry args={[0.1, 0.12, 0.2]} />
        <meshStandardMaterial color="#d9c6a6" />
      </mesh>
      {[[-0.4, -0.12], [-0.4, 0.12], [0.4, -0.12], [0.4, 0.12]].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.4, z]} castShadow>
          <boxGeometry args={[0.1, 0.5, 0.1]} />
          <meshStandardMaterial color="#e9ddc6" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[-0.6, 0.12, 0]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[0.1, 0.55, 0.1]} />
        <meshStandardMaterial color="#8b5a2b" roughness={0.8} />
      </mesh>
      <mesh position={[-0.05, 0.27, 0]} castShadow>
        <boxGeometry args={[0.4, 0.1, 0.42]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  );
}

export const CAROUSEL = { R: 5.2, floorY: 0.6, poleTop: 5.0, radii: [2, 4] as const };

/** Carousel centred on the origin; `psi(t)` is the platform angle about +Y. */
export function Carousel({ psi }: { psi: (t: number) => number }) {
  const spin = useRef<THREE.Group>(null!);
  useStudioFrame((t) => {
    spin.current.rotation.y = psi(t);
  });
  const horses = useMemo(() => {
    const out: { r: number; th: number; color: string }[] = [];
    const colors = ["#e11d48", "#2563eb", "#f59e0b", "#16a34a"];
    CAROUSEL.radii.forEach((r, ri) => {
      for (let k = 0; k < 4; k++) out.push({ r, th: (k * Math.PI) / 2, color: colors[(k + ri) % 4] });
    });
    return out;
  }, []);
  return (
    <group>
      {/* fixed base */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[CAROUSEL.R + 0.4, CAROUSEL.R + 0.6, 0.5, 48]} />
        <meshStandardMaterial color="#9aa5b6" roughness={0.8} />
      </mesh>
      <group ref={spin}>
        <mesh position={[0, CAROUSEL.floorY, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[CAROUSEL.R, CAROUSEL.R, 0.18, 48]} />
          <meshStandardMaterial color="#d9b777" roughness={0.6} />
        </mesh>
        {/* wedge stripes on the floor so rotation is visible */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[0, CAROUSEL.floorY + 0.095, 0]} rotation={[-Math.PI / 2, 0, (i * Math.PI) / 4]}>
            <circleGeometry args={[CAROUSEL.R - 0.05, 12, 0, Math.PI / 8]} />
            <meshStandardMaterial color={i % 2 ? "#b8863f" : "#e2c58b"} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, (CAROUSEL.poleTop + CAROUSEL.floorY) / 2, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.28, CAROUSEL.poleTop - CAROUSEL.floorY, 24]} />
          <meshStandardMaterial color="#e5c05a" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* open top: a canopy would hide the horses from the camera above */}
        <mesh position={[0, CAROUSEL.poleTop + 0.2, 0]} castShadow>
          <sphereGeometry args={[0.6, 20, 14]} />
          <meshStandardMaterial color="#c8302f" roughness={0.5} />
        </mesh>
        <mesh position={[0, CAROUSEL.poleTop - 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.9, 0.9, 0.18, 24]} />
          <meshStandardMaterial color="#f5e7c4" roughness={0.6} />
        </mesh>
        {horses.map((h, i) => (
          <group key={i} position={[h.r * Math.cos(h.th), 0, -h.r * Math.sin(h.th)]}>
            <mesh position={[0, (CAROUSEL.poleTop + CAROUSEL.floorY) / 2, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, CAROUSEL.poleTop - CAROUSEL.floorY, 8]} />
              <meshStandardMaterial color="#e5c05a" metalness={0.7} roughness={0.3} />
            </mesh>
            <group position={[0, 2.2, 0]} rotation={[0, h.th + Math.PI / 2, 0]} scale={1.6}>
              <Horse color={h.color} />
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/** The two highlighted horses (inner and outer ring, same angular position). */
export const HORSE_THETA = [0, 0];

// ---------------------------------------------------------------------------
// Rolling bodies
// ---------------------------------------------------------------------------

export function RollingDisc({ r = 0.4 }: { r?: number }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[r, r, 0.14, 48, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#2563eb" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI]} castShadow>
        <cylinderGeometry args={[r, r, 0.14, 48, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color="#93b4f5" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[r * 0.6, 0, 0.075]}>
        <sphereGeometry args={[0.05, 12, 8]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0, 0, 0.075]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
        <meshStandardMaterial color="#1f2937" metalness={0.6} />
      </mesh>
    </group>
  );
}

export function RollingRing({ r = 0.4 }: { r?: number }) {
  return (
    <group>
      <mesh castShadow>
        <torusGeometry args={[r - 0.04, 0.05, 14, 56]} />
        <meshStandardMaterial color="#ef4444" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[r - 0.04, 0, 0]}>
        <sphereGeometry args={[0.075, 12, 8]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
          <boxGeometry args={[0.012, (r - 0.04) * 2, 0.012]} />
          <meshStandardMaterial color="#f2c5c5" transparent opacity={0.0} />
        </mesh>
      ))}
    </group>
  );
}

void C;
