"use client";

// A mid-size saloon at true scale. The proportions follow a current Toyota
// Camry (XV70): 4,885 m long, 1,84 m wide, 1,445 m high, 2,825 m wheelbase,
// 0,33 m wheel radius. Forward is +X, up is +Y, the origin sits on the ground
// at the car's centre.

import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import { C } from "./materials";

export const CAR = {
  length: 4.885,
  width: 1.84,
  height: 1.445,
  wheelbase: 2.825,
  wheelR: 0.33,
} as const;

export interface CarHandle {
  /** Rotate all four wheels to this angle (rad). Rolling without slipping: angle = distance / wheelR. */
  setRoll: (rad: number) => void;
}

/** Side profile of the body, x along the car, y up. */
function bodyShape() {
  const s = new THREE.Shape();
  s.moveTo(-2.4, 0.24);
  s.lineTo(-2.44, 0.4);
  s.lineTo(-2.44, 0.78);
  s.quadraticCurveTo(-2.43, 0.92, -2.2, 0.96);
  s.lineTo(-1.55, 0.99);
  s.lineTo(-1.18, 1.0);
  s.bezierCurveTo(-0.95, 1.1, -0.85, 1.38, -0.5, 1.445);
  s.lineTo(0.38, 1.445);
  s.bezierCurveTo(0.7, 1.43, 0.85, 1.15, 1.12, 1.02);
  s.lineTo(1.45, 0.98);
  s.lineTo(2.15, 0.86);
  s.quadraticCurveTo(2.4, 0.8, 2.44, 0.62);
  s.lineTo(2.44, 0.4);
  s.lineTo(2.38, 0.24);
  s.closePath();
  return s;
}

/** Window band: the greenhouse, inset from the roof and pillars. */
function glassShape() {
  const s = new THREE.Shape();
  s.moveTo(-1.1, 1.04);
  s.bezierCurveTo(-0.92, 1.12, -0.83, 1.35, -0.54, 1.41);
  s.lineTo(0.37, 1.41);
  s.bezierCurveTo(0.66, 1.4, 0.8, 1.16, 1.04, 1.05);
  s.closePath();
  return s;
}

function Wheel({ x, z, side, registry }: { x: number; z: number; side: 1 | -1; registry: React.MutableRefObject<THREE.Group[]> }) {
  const spokes = useMemo(() => Array.from({ length: 5 }, (_, i) => (i * Math.PI * 2) / 5), []);
  return (
    <group position={[x, CAR.wheelR, z]}>
      {/* dark arch behind the wheel, so it reads as sitting in a wheel well */}
      <mesh position={[0, 0.04, side * 0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.41, 0.41, 0.03, 28]} />
        <meshStandardMaterial color="#10141c" roughness={0.9} />
      </mesh>
      <group ref={(g) => {
          if (g) registry.current.push(g);
        }} position={[0, 0, side * 0.0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[CAR.wheelR, CAR.wheelR, 0.22, 32]} />
          <meshStandardMaterial color={C.rubber} roughness={0.92} />
        </mesh>
        <mesh position={[0, 0, side * 0.112]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.215, 0.215, 0.012, 28]} />
          <meshStandardMaterial color="#d6dce6" metalness={0.85} roughness={0.28} />
        </mesh>
        {spokes.map((a, i) => (
          <mesh key={i} position={[Math.sin(a) * 0.12, Math.cos(a) * 0.12, side * 0.12]} rotation={[0, 0, -a]}>
            <boxGeometry args={[0.055, 0.15, 0.01]} />
            <meshStandardMaterial color="#2a3140" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0, side * 0.124]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.012, 16]} />
          <meshStandardMaterial color="#aab3c0" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

export const Car = forwardRef<CarHandle, { color?: string }>(function Car({ color = C.paintRed }, ref) {
  const wheels = useRef<THREE.Group[]>([]);
  wheels.current = [];

  const body = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(bodyShape(), {
      depth: 1.74,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 14,
    });
    g.translate(0, 0, -0.87);
    return g;
  }, []);
  const glass = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(glassShape(), { depth: 1.88, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -0.94);
    return g;
  }, []);

  useImperativeHandle(ref, () => ({
    setRoll(rad) {
      for (const w of wheels.current) w.rotation.z = -rad;
    },
  }));

  const wx = CAR.wheelbase / 2;
  const track = 0.86;

  return (
    <group>
      <mesh geometry={body} castShadow receiveShadow>
        <meshPhysicalMaterial color={color} metalness={0.35} roughness={0.4} clearcoat={0.35} clearcoatRoughness={0.3} />
      </mesh>
      <mesh geometry={glass}>
        <meshPhysicalMaterial color={C.glass} metalness={0.2} roughness={0.08} clearcoat={1} />
      </mesh>
      {/* B-pillar, painted */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[-0.08, 1.22, s * 0.945]}>
          <boxGeometry args={[0.09, 0.4, 0.012]} />
          <meshStandardMaterial color={color} metalness={0.45} roughness={0.3} />
        </mesh>
      ))}
      {/* underbody */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[4.5, 0.14, 1.6]} />
        <meshStandardMaterial color="#10141c" roughness={0.95} />
      </mesh>
      {/* door seams */}
      {[-1, 1].map((s) =>
        [-1.12, -0.08, 0.96].map((x) => (
          <mesh key={`${s}${x}`} position={[x, 0.7, s * 0.925]}>
            <boxGeometry args={[0.012, 0.5, 0.006]} />
            <meshStandardMaterial color="#1b202b" />
          </mesh>
        ))
      )}
      {/* mirrors */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0.98, 1.06, s * 0.99]} castShadow>
          <boxGeometry args={[0.16, 0.1, 0.12]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
        </mesh>
      ))}
      {/* lamps */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[2.45, 0.72, s * 0.62]}>
            <boxGeometry args={[0.05, 0.13, 0.36]} />
            <meshStandardMaterial color="#fffbe8" emissive="#fff4c4" emissiveIntensity={0.9} />
          </mesh>
          <mesh position={[-2.45, 0.74, s * 0.66]}>
            <boxGeometry args={[0.05, 0.12, 0.42]} />
            <meshStandardMaterial color="#c81e2b" emissive="#ff2030" emissiveIntensity={0.55} />
          </mesh>
        </group>
      ))}
      {/* grille + plates */}
      <mesh position={[2.455, 0.5, 0]}>
        <boxGeometry args={[0.03, 0.14, 0.9]} />
        <meshStandardMaterial color="#10141c" roughness={0.6} />
      </mesh>
      <mesh position={[-2.46, 0.52, 0]}>
        <boxGeometry args={[0.02, 0.12, 0.5]} />
        <meshStandardMaterial color={C.white} roughness={0.6} />
      </mesh>

      <Wheel x={wx} z={track} side={1} registry={wheels} />
      <Wheel x={wx} z={-track} side={-1} registry={wheels} />
      <Wheel x={-wx} z={track} side={1} registry={wheels} />
      <Wheel x={-wx} z={-track} side={-1} registry={wheels} />
    </group>
  );
});

/** The car's silhouette as a see-through snapshot, for stroboscopic "where it was" images. */
export function CarGhost({ color = "#2f6df6", opacity = 0.3 }: { color?: string; opacity?: number }) {
  const geom = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(bodyShape(), {
      depth: 1.7,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.07,
      bevelSegments: 2,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.85);
    return g;
  }, []);
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
