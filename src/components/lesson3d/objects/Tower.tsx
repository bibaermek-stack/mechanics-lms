"use client";

// A 45 m drop tower for the free-fall film: concrete shaft, a release platform
// at the top and a painted height scale down the face.

import { Tag } from "@/components/studio/overlay";
import { C } from "./materials";

export const TOWER_H = 46;

export function Tower({ showScale = 1 }: { showScale?: number }) {
  const marks = [0, 10, 20, 30, 40];
  return (
    <group>
      <mesh position={[0, TOWER_H / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[4, TOWER_H, 4]} />
        <meshStandardMaterial color="#d7dbe2" roughness={0.85} />
      </mesh>
      {/* vertical window slits for scale and realism */}
      {[-1, 1].map((s) =>
        Array.from({ length: 11 }, (_, i) => (
          <mesh key={`${s}${i}`} position={[s * 0.9, 3 + i * 4, 2.01]}>
            <boxGeometry args={[0.7, 1.4, 0.04]} />
            <meshStandardMaterial color="#35506e" roughness={0.2} metalness={0.3} />
          </mesh>
        ))
      )}
      {/* release platform with a rail */}
      <mesh position={[0, TOWER_H + 0.15, 0]} castShadow>
        <boxGeometry args={[6.4, 0.3, 6.4]} />
        <meshStandardMaterial color={C.steelDark} metalness={0.4} roughness={0.55} />
      </mesh>
      {/* gantry arm that holds the balls out beyond the shaft */}
      <mesh position={[4.2, TOWER_H + 0.45, 0]} castShadow>
        <boxGeometry args={[4.4, 0.3, 1.2]} />
        <meshStandardMaterial color="#e4572e" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* height scale painted on the +x face, free of the shaft so the falling ball passes it */}
      <group position={[8.0, 0, 0]}>
        <mesh position={[0, TOWER_H / 2, 0]} castShadow>
          <boxGeometry args={[0.16, TOWER_H, 0.3]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        {Array.from({ length: 46 }, (_, i) => (
          <mesh key={i} position={[0.1, i + 0.5, 0]}>
            <boxGeometry args={[i % 5 === 0 ? 0.9 : 0.5, 0.07, 0.34]} />
            <meshStandardMaterial color={i % 5 === 0 ? "#1f47e6" : "#475569"} />
          </mesh>
        ))}
        {marks.map((m) => (
          <Tag key={m} position={[2.4, m + 0.5, 0]} opacity={showScale}>
            {m} м
          </Tag>
        ))}
      </group>
    </group>
  );
}
