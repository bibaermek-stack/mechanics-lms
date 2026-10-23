"use client";

// Apparatus for the fluids lesson: bricks on foam, a hydraulic jack with
// transparent cylinders, a glass tank on a lab jack, and a container ship.

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "./materials";

// ---------------------------------------------------------------------------
// Bricks on foam
// ---------------------------------------------------------------------------

export const BRICK = { a: 0.25, b: 0.065, c: 0.12 };

export function FoamSlab() {
  return (
    <group>
      <mesh position={[0, -0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.28, 0.42]} />
        <meshStandardMaterial color="#f2c14e" roughness={0.95} />
      </mesh>
    </group>
  );
}

export function Brick() {
  return (
    <mesh castShadow>
      <boxGeometry args={[BRICK.a, BRICK.b, BRICK.c]} />
      <meshStandardMaterial color="#b4472c" roughness={0.85} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Hydraulic jack
// ---------------------------------------------------------------------------

export const JACK = { r1: 0.04, r2: 0.08, h: 0.7, gap: 0.5, y0: 0.45 };

export interface JackHandle {
  /** Height of the small piston above the base; the large one follows by volume conservation. */
  set: (y1: number, y2: number) => void;
}

export const HydraulicJack = forwardRef<JackHandle, { children?: React.ReactNode }>(function HydraulicJack({ children }, ref) {
  const w1 = useRef<THREE.Mesh>(null!);
  const w2 = useRef<THREE.Mesh>(null!);
  const p1 = useRef<THREE.Group>(null!);
  const p2 = useRef<THREE.Group>(null!);
  useImperativeHandle(ref, () => ({
    set(y1, y2) {
      p1.current.position.y = y1;
      p2.current.position.y = y2;
      const h1 = Math.max(0.02, y1 - 0.05);
      const h2 = Math.max(0.02, y2 - 0.05);
      w1.current.scale.y = h1;
      w1.current.position.y = 0.05 + h1 / 2;
      w2.current.scale.y = h2;
      w2.current.position.y = 0.05 + h2 / 2;
    },
  }));
  const { r1, r2, h, gap } = JACK;
  const x1 = -gap / 2;
  const x2 = gap / 2;
  return (
    <group>
      {/* base and pipe */}
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[gap + 0.5, 0.05, 0.3]} />
        <meshStandardMaterial color="#1b202b" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.07, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, gap, 16]} />
        <meshPhysicalMaterial color="#9fc3e6" transparent opacity={0.4} roughness={0.1} />
      </mesh>
      {[
        { x: x1, r: r1, ref: w1 },
        { x: x2, r: r2, ref: w2 },
      ].map((c, i) => (
        <group key={i} position={[c.x, 0, 0]}>
          {/* glass cylinder */}
          <mesh position={[0, 0.05 + h / 2, 0]}>
            <cylinderGeometry args={[c.r + 0.006, c.r + 0.006, h, 40, 1, true]} />
            <meshPhysicalMaterial color="#cfe6f5" transparent opacity={0.22} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* water, scaled to the piston height */}
          <mesh ref={c.ref} position={[0, 0.2, 0]}>
            <cylinderGeometry args={[c.r, c.r, 1, 40]} />
            <meshStandardMaterial color="#3b9cd9" transparent opacity={0.65} roughness={0.2} />
          </mesh>
          {/* centimetre marks */}
          {Array.from({ length: 15 }, (_, k) => (
            <mesh key={k} position={[c.r + 0.012, 0.05 + k * 0.05, 0]}>
              <boxGeometry args={[k % 2 ? 0.012 : 0.022, 0.003, 0.003]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          ))}
        </group>
      ))}
      {/* pistons carry whatever is placed on them */}
      <group position={[x1, JACK.y0, 0]} ref={p1}>
        <mesh position={[0, 0.01, 0]} castShadow>
          <cylinderGeometry args={[r1, r1, 0.03, 40]} />
          <meshStandardMaterial color="#b8c1ce" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.01, 0.01, 0.4, 12]} />
          <meshStandardMaterial color="#d6dce6" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.02, 32]} />
          <meshStandardMaterial color="#c3342f" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      <group position={[x2, JACK.y0, 0]} ref={p2}>
        <mesh position={[0, 0.01, 0]} castShadow>
          <cylinderGeometry args={[r2, r2, 0.03, 40]} />
          <meshStandardMaterial color="#b8c1ce" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.22, 0]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, 0.4, 12]} />
          <meshStandardMaterial color="#d6dce6" metalness={0.9} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.02, 40]} />
          <meshStandardMaterial color="#2563eb" metalness={0.5} roughness={0.4} />
        </mesh>
      </group>
      {children}
    </group>
  );
});

// ---------------------------------------------------------------------------
// Glass tank on a lab jack
// ---------------------------------------------------------------------------

export const TANK = { w: 0.34, h: 0.3, water: 0.22 };

/** Glass tank, base at y = 0, water depth `TANK.water`. */
export function GlassTank() {
  const { w, h, water } = TANK;
  return (
    <group>
      <mesh position={[0, 0.006, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.012, w]} />
        <meshPhysicalMaterial color="#cfe6f5" transparent opacity={0.6} roughness={0.05} />
      </mesh>
      {[
        [0, h / 2, w / 2, w, h, 0.008],
        [0, h / 2, -w / 2, w, h, 0.008],
        [w / 2, h / 2, 0, 0.008, h, w],
        [-w / 2, h / 2, 0, 0.008, h, w],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[sx, sy, sz]} />
          <meshPhysicalMaterial color="#cfe6f5" transparent opacity={0.22} roughness={0.05} depthWrite={false} />
        </mesh>
      ))}
      <mesh position={[0, water / 2 + 0.012, 0]}>
        <boxGeometry args={[w - 0.012, water, w - 0.012]} />
        <meshStandardMaterial color="#3b9cd9" transparent opacity={0.42} roughness={0.15} depthWrite={false} />
      </mesh>
      {/* a bright surface so the waterline reads */}
      <mesh position={[0, water + 0.0125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.012, w - 0.012]} />
        <meshBasicMaterial color="#bfe3fb" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Container ship
// ---------------------------------------------------------------------------

export const SHIP = { L: 60, B: 10, H: 6, bow: 8 };

/** Hull plan: 52 m of parallel body and an 8 m bow, 10 m beam. Centred on x = 0. */
export function hullArea() {
  return (SHIP.L - SHIP.bow) * SHIP.B + 0.5 * SHIP.bow * SHIP.B;
}

export function ShipHull({ children }: { children?: React.ReactNode }) {
  const geoms = useMemo(() => {
    const s = new THREE.Shape();
    const L2 = SHIP.L / 2;
    const B2 = SHIP.B / 2;
    s.moveTo(-L2, -B2);
    s.lineTo(L2 - SHIP.bow, -B2);
    s.quadraticCurveTo(L2 - 1, -B2 * 0.5, L2, 0);
    s.quadraticCurveTo(L2 - 1, B2 * 0.5, L2 - SHIP.bow, B2);
    s.lineTo(-L2, B2);
    s.closePath();
    const lower = new THREE.ExtrudeGeometry(s, { depth: 3.4, bevelEnabled: false, curveSegments: 16 });
    const upper = new THREE.ExtrudeGeometry(s, { depth: SHIP.H - 3.4, bevelEnabled: false, curveSegments: 16 });
    // Shapes are built in the XY plane and extruded along +Z; stand them up so Y is the height.
    const fix = (g: THREE.ExtrudeGeometry) => {
      g.rotateX(-Math.PI / 2);
      return g;
    };
    return { lower: fix(lower), upper: fix(upper) };
  }, []);
  return (
    <group>
      <mesh geometry={geoms.lower} castShadow receiveShadow>
        <meshStandardMaterial color="#b3261e" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh geometry={geoms.upper} position={[0, 3.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#1f2a44" roughness={0.55} metalness={0.25} />
      </mesh>
      {/* deck plate */}
      <mesh position={[(-SHIP.bow) / 2 - 0.2, SHIP.H + 0.03, 0]} receiveShadow>
        <boxGeometry args={[SHIP.L - SHIP.bow - 0.2, 0.06, SHIP.B - 0.3]} />
        <meshStandardMaterial color="#6b7280" roughness={0.8} />
      </mesh>
      {/* bridge and funnel at the stern */}
      <mesh position={[-SHIP.L / 2 + 5, SHIP.H + 4.5, 0]} castShadow>
        <boxGeometry args={[7, 9, 8]} />
        <meshStandardMaterial color="#f4f6fa" roughness={0.5} />
      </mesh>
      <mesh position={[-SHIP.L / 2 + 5, SHIP.H + 9.4, 0]} castShadow>
        <boxGeometry args={[7.4, 1.8, 8.4]} />
        <meshStandardMaterial color="#e8ecf2" roughness={0.5} />
      </mesh>
      <mesh position={[-SHIP.L / 2 + 5, SHIP.H + 9.4, 4.22]}>
        <boxGeometry args={[6.6, 1.0, 0.05]} />
        <meshStandardMaterial color="#1f3a5f" roughness={0.2} />
      </mesh>
      {[1, 2, 3].map((r) => (
        <mesh key={r} position={[-SHIP.L / 2 + 5, SHIP.H + 1.4 + r * 2.1, 4.02]}>
          <boxGeometry args={[6, 0.7, 0.05]} />
          <meshStandardMaterial color="#274b78" roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[-SHIP.L / 2 + 3, SHIP.H + 12, 0]} castShadow>
        <cylinderGeometry args={[1.3, 1.5, 4, 20]} />
        <meshStandardMaterial color="#c3342f" roughness={0.5} />
      </mesh>
      {children}
    </group>
  );
}

const CONTAINER_COLORS = ["#d9482b", "#2f6df6", "#f2a900", "#1f9d55", "#8b5cf6", "#e11d74"];

/** One block of containers: 3 along × 2 across × 1 high — a "load" of several containers. */
export function ContainerStack({ index }: { index: number }) {
  return (
    <group>
      {[0, 1, 2].flatMap((i) =>
        [-1, 1].map((j) => (
          <mesh key={`${i}${j}`} position={[(i - 1) * 6.2, 1.25, j * 2.6]} castShadow>
            <boxGeometry args={[6.06, 2.5, 2.44]} />
            <meshStandardMaterial color={CONTAINER_COLORS[(index + i + (j > 0 ? 1 : 0)) % CONTAINER_COLORS.length]} roughness={0.55} metalness={0.2} />
          </mesh>
        ))
      )}
    </group>
  );
}

/** Transparent-fronted test tank: water volume with glass wall; origin at the water surface. */
export function ShipTank({ depth = 9, length = 92, width = 16 }: { depth?: number; length?: number; width?: number }) {
  return (
    <group>
      <mesh position={[0, -depth / 2, 0]}>
        <boxGeometry args={[length, depth, width]} />
        <meshStandardMaterial color="#3b9cd9" transparent opacity={0.4} roughness={0.15} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, width]} />
        <meshBasicMaterial color="#cfeaff" transparent opacity={0.4} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* concrete floor and walls */}
      <mesh position={[0, -depth - 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[length + 2, 1.2, width + 2]} />
        <meshStandardMaterial color="#8d97a6" roughness={0.9} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (length / 2 + 0.6), -depth / 2 + 0.6, 0]} castShadow>
          <boxGeometry args={[1.2, depth + 1.2, width + 2]} />
          <meshStandardMaterial color="#8d97a6" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, -depth / 2 + 0.6, -width / 2 - 0.6]} castShadow>
        <boxGeometry args={[length + 2, depth + 1.2, 1.2]} />
        <meshStandardMaterial color="#9aa5b6" roughness={0.9} />
      </mesh>
      {/* depth scale on the end wall */}
      {Array.from({ length: depth }, (_, i) => (
        <mesh key={i} position={[-length / 2 + 0.02, -i - 0.5, width / 2 - 0.1]}>
          <boxGeometry args={[0.05, 0.05, 1.6]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
      ))}
    </group>
  );
}

void C;
