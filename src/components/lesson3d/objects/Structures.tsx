"use client";

// Engineering structures for the last lesson: a Warren truss bridge whose
// member forces are solved from statics every frame, a loaded truck, a tensile
// test machine with a dog-bone specimen, and a steel I-beam.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { C } from "./materials";

// Statics live in src/lib/studio/truss.ts; this file draws the result.
import { MEMBERS, NODES } from "@/lib/studio/truss";
export { SPAN, TRUSS } from "@/lib/studio/truss";
import { SPAN } from "@/lib/studio/truss";

const NEUTRAL = new THREE.Color("#a9b3c2");
const TENSION = new THREE.Color("#1d4ed8");
const COMPRESSION = new THREE.Color("#dc2626");

/** One bridge truss, updated each frame from `get(t)` = { force, defl(x) }. Plane z = `z`. */
export function TrussBridge({
  z,
  get,
  fRef = 380,
}: {
  z: number;
  get: (t: number) => { force: number[]; defl: (x: number) => number };
  fRef?: number;
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const nodes = useRef<(THREE.Mesh | null)[]>([]);
  useStudioFrame((t) => {
    const s = get(t);
    const ys = NODES.map((n) => n.y - s.defl(n.x));
    MEMBERS.forEach((m, i) => {
      const mesh = refs.current[i];
      if (!mesh) return;
      const A = NODES[m.a];
      const B = NODES[m.b];
      const ya = ys[m.a];
      const yb = ys[m.b];
      const dx = B.x - A.x;
      const dy = yb - ya;
      const L = Math.hypot(dx, dy);
      mesh.position.set((A.x + B.x) / 2, (ya + yb) / 2, z);
      mesh.rotation.z = Math.atan2(dy, dx);
      mesh.scale.x = L;
      const f = s.force[i];
      const k = Math.min(1, Math.abs(f) / fRef);
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.color.copy(NEUTRAL).lerp(f >= 0 ? TENSION : COMPRESSION, Math.pow(k, 0.7));
    });
    NODES.forEach((n, i) => nodes.current[i]?.position.set(n.x, ys[i], z));
  });
  return (
    <group>
      {MEMBERS.map((m, i) => (
        <mesh key={i} ref={(r) => { refs.current[i] = r; }} castShadow>
          <boxGeometry args={[1, m.kind === "diag" ? 0.28 : 0.36, 0.3]} />
          <meshStandardMaterial color="#a9b3c2" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
      {NODES.map((n, i) => (
        <mesh key={i} ref={(r) => { nodes.current[i] = r; }} position={[n.x, n.y, z]} castShadow>
          <sphereGeometry args={[0.27, 14, 10]} />
          <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Road deck under the bridge, following the bottom chord's deflection. */
export function Deck({ defl }: { defl: (t: number) => (x: number) => number }) {
  const segs = 12;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useStudioFrame((t) => {
    const d = defl(t);
    for (let i = 0; i < segs; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const x0 = (i * SPAN) / segs;
      const x1 = ((i + 1) * SPAN) / segs;
      const y0 = -d(x0);
      const y1 = -d(x1);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2 + 0.28, 0);
      m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    }
  });
  return (
    <group>
      {Array.from({ length: segs }, (_, i) => (
        <mesh key={i} ref={(r) => { refs.current[i] = r; }} castShadow receiveShadow>
          <boxGeometry args={[SPAN / segs + 0.02, 0.36, 7.6]} />
          <meshStandardMaterial color="#4a5160" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Truck
// ---------------------------------------------------------------------------

/** A two-axle tipper, 8,5 m long, forward +X, origin on the road under its centre. */
export function Truck() {
  return (
    <group>
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[8.2, 0.5, 2.3]} />
        <meshStandardMaterial color="#374151" metalness={0.4} roughness={0.6} />
      </mesh>
      <mesh position={[3.1, 2.0, 0]} castShadow>
        <boxGeometry args={[2.1, 2.3, 2.4]} />
        <meshStandardMaterial color="#f97316" metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[4.1, 2.2, 0]}>
        <boxGeometry args={[0.04, 1.0, 2.1]} />
        <meshStandardMaterial color="#1f2937" roughness={0.2} />
      </mesh>
      <mesh position={[-1.0, 2.15, 0]} castShadow>
        <boxGeometry args={[5.9, 1.9, 2.5]} />
        <meshStandardMaterial color="#2563eb" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[-1.0, 3.12, 0]}>
        <boxGeometry args={[5.6, 0.08, 2.2]} />
        <meshStandardMaterial color="#8d6638" roughness={0.9} />
      </mesh>
      {[[-3.0, 1.15], [-3.0, -1.15], [-1.7, 1.15], [-1.7, -1.15], [2.9, 1.15], [2.9, -1.15]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.52, 0.52, 0.34, 20]} />
          <meshStandardMaterial color={C.rubber} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Tensile specimen and machine
// ---------------------------------------------------------------------------

export const SPEC = { rEnd: 0.012, rGauge: 0.0075, gauge: 0.15, end: 0.07 };

/** Round dog-bone specimen standing on y = 0; the gauge section is scaled by strain, with a neck and a break. */
export function Specimen({
  strain,
  neck,
  broken,
}: {
  strain: (t: number) => number;
  neck: (t: number) => number;
  broken: (t: number) => number;
}) {
  const gauge = useRef<THREE.Group>(null!);
  const upperGrip = useRef<THREE.Group>(null!);
  const necking = useRef<THREE.Mesh>(null!);
  const lowerHalf = useRef<THREE.Mesh>(null!);
  const upperHalf = useRef<THREE.Mesh>(null!);
  const cones = useRef<THREE.Group>(null!);
  const { rEnd, rGauge, gauge: G0, end } = SPEC;
  useStudioFrame((t) => {
    const e = strain(t);
    const n = neck(t); // 0 … 1: how far the neck has formed
    const br = broken(t) > 0.5;
    const len = G0 * (1 + e);
    // The gauge is split in two halves with a thinner neck in the middle.
    const r = rGauge / Math.sqrt(1 + (e > 0.002 ? e : 0));
    const neckLen = 0.03 * (1 + e);
    const halfLen = (len - neckLen) / 2;
    lowerHalf.current.scale.set(r / rGauge, halfLen / (G0 / 2), r / rGauge);
    lowerHalf.current.position.y = end + halfLen / 2;
    upperHalf.current.scale.set(r / rGauge, halfLen / (G0 / 2), r / rGauge);
    upperHalf.current.position.y = end + halfLen + neckLen + halfLen / 2;
    const rn = r * (1 - 0.55 * n);
    necking.current.visible = !br;
    necking.current.scale.set(rn / rGauge, neckLen / 0.03, rn / rGauge);
    necking.current.position.y = end + halfLen + neckLen / 2;
    // after the break the two halves part: the upper one rides up with the grip
    const gap = br ? 0.05 * smoothStep((broken(t) - 0.5) * 2) : 0;
    upperHalf.current.position.y += gap;
    cones.current.visible = br;
    cones.current.position.y = end + halfLen + neckLen / 2 + gap / 2;
    upperGrip.current.position.y = len - G0 + gap;
  });
  return (
    <group>
      <mesh position={[0, end / 2, 0]} castShadow>
        <cylinderGeometry args={[rEnd, rEnd, end, 28]} />
        <meshStandardMaterial color="#b8c1ce" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh ref={lowerHalf} position={[0, end + G0 / 4, 0]} castShadow>
        <cylinderGeometry args={[rGauge, rGauge, G0 / 2, 28]} />
        <meshStandardMaterial color="#cfd6e0" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh ref={necking} position={[0, end + G0 / 2, 0]} castShadow>
        <cylinderGeometry args={[rGauge, rGauge, 0.03, 28]} />
        <meshStandardMaterial color="#d8dee8" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh ref={upperHalf} position={[0, end + (3 * G0) / 4, 0]} castShadow>
        <cylinderGeometry args={[rGauge, rGauge, G0 / 2, 28]} />
        <meshStandardMaterial color="#cfd6e0" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* cup-and-cone fracture faces */}
      <group ref={cones} visible={false}>
        <mesh position={[0, -0.006, 0]}>
          <coneGeometry args={[rGauge * 0.5, 0.012, 20]} />
          <meshStandardMaterial color="#9aa3b2" metalness={0.8} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.006, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[rGauge * 0.5, 0.012, 20]} />
          <meshStandardMaterial color="#9aa3b2" metalness={0.8} roughness={0.5} />
        </mesh>
      </group>
      {/* upper end of the specimen moves with the grip */}
      <group ref={upperGrip}>
        <mesh position={[0, end + G0 + end / 2, 0]} castShadow>
          <cylinderGeometry args={[rEnd, rEnd, end, 28]} />
          <meshStandardMaterial color="#b8c1ce" metalness={0.85} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

const smoothStep = (x: number) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

// ---------------------------------------------------------------------------
// I-beam
// ---------------------------------------------------------------------------

/** IPE 300: 300 mm deep, 150 mm wide flanges. Extrusion axis is X (length). */
export function useIBeamGeometry(segLen: number) {
  return useMemo(() => {
    const H = 0.3;
    const B = 0.15;
    const tf = 0.0107;
    const tw = 0.0071;
    const s = new THREE.Shape();
    // profile in the (z, y) plane
    s.moveTo(-B / 2, H / 2);
    s.lineTo(B / 2, H / 2);
    s.lineTo(B / 2, H / 2 - tf);
    s.lineTo(tw / 2, H / 2 - tf);
    s.lineTo(tw / 2, -H / 2 + tf);
    s.lineTo(B / 2, -H / 2 + tf);
    s.lineTo(B / 2, -H / 2);
    s.lineTo(-B / 2, -H / 2);
    s.lineTo(-B / 2, -H / 2 + tf);
    s.lineTo(-tw / 2, -H / 2 + tf);
    s.lineTo(-tw / 2, H / 2 - tf);
    s.lineTo(-B / 2, H / 2 - tf);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: segLen, bevelEnabled: false });
    // shape x → world z, shape y → world y, extrusion z → world x
    g.rotateY(Math.PI / 2);
    g.translate(-segLen / 2, 0, 0);
    return g;
  }, [segLen]);
}
