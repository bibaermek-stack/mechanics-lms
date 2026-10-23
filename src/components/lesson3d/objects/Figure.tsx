"use client";

// A stylised person, 1,75 m tall. Limbs are capsules on pivots so a scene can
// pose it (lean, push, sit) without animation clips. Facing +X.

import { forwardRef, useImperativeHandle, useRef } from "react";
import * as THREE from "three";

export interface Pose {
  /** Torso pitch about the hips, rad; positive leans forward (+X). */
  lean?: number;
  /** Shoulder pitch, rad; positive swings the arm forward. */
  armL?: number;
  armR?: number;
  /** Elbow bend, rad (positive folds the forearm forward). */
  elbowL?: number;
  elbowR?: number;
  /** Hip pitch, rad; positive swings the leg forward. */
  legL?: number;
  legR?: number;
  /** Knee bend, rad (positive folds the shin backward). */
  kneeL?: number;
  kneeR?: number;
  /** Head yaw, rad. */
  head?: number;
}

export interface FigureHandle {
  setPose: (p: Pose) => void;
}

const SKIN = "#e6b896";

function Limb({
  length,
  radius,
  color,
}: {
  length: number;
  radius: number;
  color: string;
}) {
  // A capsule hanging down from its pivot.
  return (
    <mesh position={[0, -length / 2, 0]} castShadow>
      <capsuleGeometry args={[radius, length - radius * 2, 4, 10]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

export const Figure = forwardRef<
  FigureHandle,
  {
    shirt?: string;
    pants?: string;
    hair?: string;
    shoes?: string;
    /** Seated: hips drop to chair height and the thighs go horizontal. */
    seated?: boolean;
    /** Ice skates: a blade under each boot. */
    skates?: boolean;
    pose?: Pose;
  }
>(function Figure(
  { shirt = "#2f6df6", pants = "#2b3447", hair = "#2a1f1a", shoes = "#e5e7eb", seated = false, skates = false, pose },
  ref
) {
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const elbowL = useRef<THREE.Group>(null!);
  const elbowR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const kneeL = useRef<THREE.Group>(null!);
  const kneeR = useRef<THREE.Group>(null!);

  const apply = (p: Pose) => {
    const hip = seated ? Math.PI / 2 : 0;
    const knee = seated ? 1.45 : 0;
    torso.current.rotation.z = -(p.lean ?? 0);
    head.current.rotation.y = p.head ?? 0;
    // A limb hangs along -Y, so a positive rotation about Z swings it towards +X, which is forward.
    armL.current.rotation.z = p.armL ?? 0.06;
    armR.current.rotation.z = p.armR ?? 0.06;
    elbowL.current.rotation.z = p.elbowL ?? 0.12;
    elbowR.current.rotation.z = p.elbowR ?? 0.12;
    legL.current.rotation.z = (p.legL ?? 0) + hip;
    legR.current.rotation.z = (p.legR ?? 0) + hip;
    // The knee folds the shin backwards.
    kneeL.current.rotation.z = -((p.kneeL ?? 0) + knee);
    kneeR.current.rotation.z = -((p.kneeR ?? 0) + knee);
  };

  useImperativeHandle(ref, () => ({ setPose: apply }));

  // Hip height: standing leg length is 0.88 m (thigh 0.44 + shin 0.44).
  const hipY = seated ? 0.5 : 0.9;

  return (
    <group
      ref={(g) => {
        // Initial pose once the refs exist.
        if (g && torso.current) apply(pose ?? {});
      }}
    >
      <group position={[0, hipY, 0]}>
        {/* legs */}
        {([
          [legL, kneeL, 0.1],
          [legR, kneeR, -0.1],
        ] as const).map(([lr, kr, z], i) => (
          <group key={i} ref={lr} position={[0, 0, z]}>
            <Limb length={0.44} radius={0.085} color={pants} />
            <group ref={kr} position={[0, -0.44, 0]}>
              <Limb length={0.44} radius={0.07} color={pants} />
              <mesh position={[0.06, -0.47, 0]} castShadow>
                <boxGeometry args={[0.26, 0.09, 0.11]} />
                <meshStandardMaterial color={shoes} roughness={0.7} />
              </mesh>
              {skates && (
                <mesh position={[0.06, -0.54, 0]} castShadow>
                  <boxGeometry args={[0.32, 0.035, 0.012]} />
                  <meshStandardMaterial color="#cfd6e0" metalness={0.9} roughness={0.2} />
                </mesh>
              )}
            </group>
          </group>
        ))}
        {/* torso, head, arms */}
        <group ref={torso}>
          <mesh position={[0, 0.27, 0]} castShadow>
            <capsuleGeometry args={[0.16, 0.3, 4, 12]} />
            <meshStandardMaterial color={shirt} roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.58, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.06, 0.08, 10]} />
            <meshStandardMaterial color={SKIN} roughness={0.8} />
          </mesh>
          <group ref={head} position={[0, 0.72, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.115, 20, 16]} />
              <meshStandardMaterial color={SKIN} roughness={0.8} />
            </mesh>
            <mesh position={[-0.02, 0.035, 0]} castShadow>
              <sphereGeometry args={[0.12, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color={hair} roughness={0.9} />
            </mesh>
          </group>
          {([
            [armL, elbowL, 0.215],
            [armR, elbowR, -0.215],
          ] as const).map(([ar, er, z], i) => (
            <group key={i} ref={ar} position={[0, 0.5, z]}>
              <Limb length={0.3} radius={0.055} color={shirt} />
              <group ref={er} position={[0, -0.3, 0]}>
                <Limb length={0.28} radius={0.048} color={SKIN} />
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
});
