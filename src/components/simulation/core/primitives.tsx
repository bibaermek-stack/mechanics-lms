"use client";

// Small reusable 3D pieces: force/velocity arrows, taut strings, floating
// labels and motion trails. Everything is allocation-free per frame — the
// components mutate existing objects inside useFrame rather than re-rendering.

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";

const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Vector arrow (force, velocity, acceleration)
// ---------------------------------------------------------------------------

export interface ArrowHandle {
  /** Point the arrow from `origin` along `dir`, with the given length (m). */
  set: (origin: THREE.Vector3, dir: THREE.Vector3, length: number) => void;
}

export const VectorArrow = forwardRef<
  ArrowHandle,
  { color?: string; radius?: number; opacity?: number }
>(function VectorArrow({ color = "#ef4444", radius = 0.004, opacity = 1 }, ref) {
  const group = useRef<THREE.Group>(null!);
  const shaft = useRef<THREE.Mesh>(null!);
  const head = useRef<THREE.Mesh>(null!);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const dirN = useMemo(() => new THREE.Vector3(), []);

  useImperativeHandle(ref, () => ({
    set(origin, dir, length) {
      const g = group.current;
      if (!g) return;
      const visible = length > 1e-4 && dir.lengthSq() > 1e-12;
      g.visible = visible;
      if (!visible) {
        // Collapse rather than only hide. The shaft is a 1 m unit cylinder, and
        // leaving it at full scale keeps a metre-long box inside every bounding
        // volume the scene computes — which is what sizes the shadow camera.
        shaft.current?.scale.set(1, 1e-5, 1);
        head.current?.scale.set(1, 1e-5, 1);
        return;
      }
      g.position.copy(origin);
      dirN.copy(dir).normalize();
      quat.setFromUnitVectors(UP, dirN);
      g.quaternion.copy(quat);
      const headLen = Math.min(length * 0.32, radius * 9);
      const shaftLen = Math.max(length - headLen, 1e-4);
      shaft.current.scale.set(1, shaftLen, 1);
      shaft.current.position.set(0, shaftLen / 2, 0);
      head.current.scale.set(1, headLen / (radius * 6), 1);
      head.current.position.set(0, shaftLen + headLen / 2, 0);
    },
  }));

  return (
    <group ref={group}>
      <mesh ref={shaft} scale={[1, 1e-5, 1]}>
        <cylinderGeometry args={[radius, radius, 1, 10]} />
        <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh ref={head} scale={[1, 1e-5, 1]}>
        <coneGeometry args={[radius * 2.6, radius * 6, 14]} />
        <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} />
      </mesh>
    </group>
  );
});

// ---------------------------------------------------------------------------
// String / rope segment between two moving points
// ---------------------------------------------------------------------------

export interface SegmentHandle {
  set: (a: THREE.Vector3, b: THREE.Vector3) => void;
}

export const Segment = forwardRef<
  SegmentHandle,
  { color?: string; radius?: number }
>(function Segment({ color = "#f8fafc", radius = 0.0018 }, ref) {
  const mesh = useRef<THREE.Mesh>(null!);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);

  useImperativeHandle(ref, () => ({
    set(a, b) {
      const m = mesh.current;
      if (!m) return;
      dir.subVectors(b, a);
      const len = dir.length();
      if (len < 1e-6) {
        m.visible = false;
        return;
      }
      m.visible = true;
      mid.addVectors(a, b).multiplyScalar(0.5);
      m.position.copy(mid);
      quat.setFromUnitVectors(UP, dir.normalize());
      m.quaternion.copy(quat);
      m.scale.set(1, len, 1);
    },
  }));

  return (
    <mesh ref={mesh}>
      <cylinderGeometry args={[radius, radius, 1, 8]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
});

// ---------------------------------------------------------------------------
// Motion trail (trajectory)
// ---------------------------------------------------------------------------

export interface TrailHandle {
  push: (p: THREE.Vector3) => void;
  clear: () => void;
}

export const Trail = forwardRef<TrailHandle, { color?: string; max?: number }>(
  function Trail({ color = "#f59e0b", max = 320 }, ref) {
    const count = useRef(0);

    const { object, geometry, positions } = useMemo(() => {
      const pos = new Float32Array(max * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setDrawRange(0, 0);
      const obj = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
      obj.frustumCulled = false;
      return { object: obj, geometry: geo, positions: pos };
    }, [max, color]);

    useImperativeHandle(ref, () => ({
      push(p) {
        if (count.current >= max) {
          positions.copyWithin(0, 3);
          count.current = max - 1;
        }
        const i = count.current * 3;
        positions[i] = p.x;
        positions[i + 1] = p.y;
        positions[i + 2] = p.z;
        count.current += 1;
        geometry.setDrawRange(0, count.current);
        geometry.attributes.position.needsUpdate = true;
      },
      clear() {
        count.current = 0;
        geometry.setDrawRange(0, 0);
      },
    }));

    return <primitive object={object} />;
  }
);

// ---------------------------------------------------------------------------
// Floating label anchored to a point in the scene
// ---------------------------------------------------------------------------

export function Tag({
  position,
  children,
  tone = "slate",
}: {
  position: [number, number, number];
  children: React.ReactNode;
  tone?: "slate" | "brand" | "amber" | "emerald" | "rose";
}) {
  const tones: Record<string, { chip: string; dot: string }> = {
    slate: { chip: "bg-slate-900/88 text-white", dot: "bg-slate-900/88" },
    brand: { chip: "bg-brand-600/92 text-white", dot: "bg-brand-600/92" },
    amber: { chip: "bg-amber-500/92 text-slate-900", dot: "bg-amber-500/92" },
    emerald: { chip: "bg-emerald-600/92 text-white", dot: "bg-emerald-600/92" },
    rose: { chip: "bg-rose-600/92 text-white", dot: "bg-rose-600/92" },
  };
  const t = tones[tone];
  // Fixed pixel size rather than drei's distanceFactor: these are annotations,
  // and a label that grows as you dolly in swamps the apparatus it points at.
  return (
    <Html position={position} center zIndexRange={[10, 0]}>
      <div className="pointer-events-none flex flex-col items-center">
        <div
          className={`whitespace-nowrap rounded-lg px-2 py-[3px] text-[10px] font-semibold tracking-tight shadow-raised ${t.chip}`}
        >
          {children}
        </div>
        {/* small stem so the label clearly belongs to the part beneath it */}
        <span className={`h-1.5 w-[2px] ${t.dot}`} />
      </div>
    </Html>
  );
}

/** A ruler drawn along the +X axis, ticked every 10 cm. */
export function ScaleBar({
  length,
  y = 0.002,
  z = 0,
  color = "#475569",
}: {
  length: number;
  y?: number;
  z?: number;
  color?: string;
}) {
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let x = 0; x <= length + 1e-6; x += 0.1) out.push(+x.toFixed(3));
    return out;
  }, [length]);

  return (
    <group position={[0, y, z]}>
      <mesh position={[length / 2, 0, 0]}>
        <boxGeometry args={[length, 0.0015, 0.006]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {ticks.map((x, i) => (
        <mesh key={x} position={[x, 0.0008, 0]}>
          <boxGeometry args={[0.0025, 0.002, i % 5 === 0 ? 0.028 : 0.016]} />
          <meshStandardMaterial color={i % 5 === 0 ? "#1e293b" : color} />
        </mesh>
      ))}
    </group>
  );
}
