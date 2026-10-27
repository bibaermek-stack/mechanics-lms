"use client";

// The asyq game in 3D, with the scanned bone from public/models/asyk.glb.
//
// A lane runs away from the throw line (x = 0). The sakha — the heavy, painted bone — slides along
// it and stops where friction says; the asyqs it must stop beside stand in a row along the lane's
// right edge, over exactly the span that counts as a hit. Nothing here decides anything: the
// verdict is folk.ts's, the distances are asyqView.ts's, this file only draws them.
//
// The canvas renders on demand, so a round waiting for the player costs no GPU at all.

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { StudioEnvironment } from "@/components/simulation/core/SimStage";
import { slidePosition, slideStopTime, type FolkRound } from "@/lib/folk";
import {
  ASYQ_WIDTH_RATIO,
  CAMERA_FOV,
  LANE_HALF_WIDTH,
  ROW_Z,
  aimArrowLength,
  asyqLength,
  chasePose,
  damp,
  overviewPose,
  rowPositions,
  rulerMarks,
  sakhaLength,
  surfaceLook,
  viewReach,
  type AsyqView,
  type CamPose,
  type SurfaceLook,
} from "@/lib/asyqView";
import { TILE, blobTexture, groundTexture } from "./asyqTextures";
import type { SceneAttempt } from "./FolkScene";

export const ASYQ_MODEL_URL = "/models/asyk.glb";

const SKY = "#bcdcf4";
const SAKHA_TINT = "#f08a3c"; // the sakha is painted; the asyqs are bare bone
const fmt = (x: number, d = 1) => x.toFixed(d).replace(".", ",");

export interface AsyqSceneProps {
  round: FolkRound;
  last: SceneAttempt | null;
  earlier: SceneAttempt[];
  progress: number;
  /** While aiming: the speed on the slider. The sakha waits on the throw line with an arrow that long. */
  aim: { speed: number } | null;
  view: AsyqView;
  reduced: boolean;
}

// ---------------------------------------------------------------------------
// The bone
// ---------------------------------------------------------------------------

/** The scan, centred on x and z, standing on y = 0, one metre long (its long axis is x). */
function normaliseBone(scene: THREE.Object3D): THREE.Group {
  const inner = scene.clone(true);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  inner.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const pivot = new THREE.Group();
  pivot.add(inner);
  pivot.scale.setScalar(1 / size.x);
  const out = new THREE.Group();
  out.add(pivot);
  return out;
}

/** A private copy of the bone: the geometry and the texture are shared, the material is its own to tint. */
function boneInstance(template: THREE.Group, tint: string | null): THREE.Group {
  const copy = template.clone(true);
  copy.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
    mat.metalness = 0;
    mat.roughness = Math.max(mat.roughness, 0.55);
    if (tint) mat.color.set(tint);
    mesh.material = mat;
  });
  return copy;
}

function Bone({
  template,
  length,
  x,
  z = 0,
  yaw = 0,
  tint = null,
  glow = false,
}: {
  template: THREE.Group;
  length: number;
  x: number;
  z?: number;
  yaw?: number;
  tint?: string | null;
  glow?: boolean;
}) {
  const bone = useMemo(() => boneInstance(template, tint), [template, tint]);
  useEffect(() => {
    bone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) (mesh.material as THREE.MeshStandardMaterial).emissive.set(glow ? "#16a34a" : "#000000");
      if (mesh.isMesh) (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = glow ? 0.35 : 0;
    });
  }, [bone, glow]);
  useEffect(
    () => () => {
      bone.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) (mesh.material as THREE.Material).dispose();
      });
    },
    [bone]
  );
  const blob = useMemo(() => blobTexture(), []);
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} renderOrder={1}>
        <planeGeometry args={[length * 1.7, length * ASYQ_WIDTH_RATIO * 1.9]} />
        <meshBasicMaterial map={blob} transparent depthWrite={false} />
      </mesh>
      <primitive object={bone} scale={length} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// The lane
// ---------------------------------------------------------------------------

function Ground({ look, from, to }: { look: SurfaceLook; from: number; to: number }) {
  const tex = useMemo(() => {
    const t = groundTexture(look).clone();
    t.needsUpdate = true;
    t.repeat.set((to - from) / TILE, 80 / TILE);
    return t;
  }, [look, from, to]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(from + to) / 2, 0, 0]}>
      <planeGeometry args={[to - from, 80]} />
      <meshStandardMaterial map={tex} roughness={look.roughness} metalness={look.id === "ice" ? 0.1 : 0} envMapIntensity={look.id === "ice" ? 0.7 : 0.3} />
    </mesh>
  );
}

function Strip({ x0, x1, z0, z1, color, opacity = 0.85, y = 0.006 }: { x0: number; x1: number; z0: number; z1: number; color: string; opacity?: number; y?: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(x0 + x1) / 2, y, (z0 + z1) / 2]}>
      <planeGeometry args={[x1 - x0, z1 - z0]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

function Label({ position, children, near }: { position: [number, number, number]; children: React.ReactNode; near?: number }) {
  return (
    // `near`: shrink with distance (so the marks along a long lane do not pile up); without it the label keeps one size
    <Html position={position} center distanceFactor={near} zIndexRange={[8, 0]} style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold leading-none text-white shadow">{children}</div>
    </Html>
  );
}

function Pole({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.025, 0.03, 1.4, 8]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      <mesh position={[0.17, 1.2, 0]}>
        <boxGeometry args={[0.34, 0.24, 0.012]} />
        <meshStandardMaterial color={color} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function AimArrow({ speed, from }: { speed: number; from: number }) {
  const len = aimArrowLength(speed);
  const head = 0.24;
  const shaft = Math.max(0.05, len - head);
  return (
    <group position={[from, 0.16, 0]}>
      <mesh position={[shaft / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, shaft, 12]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[shaft + head / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.09, head, 16]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// The camera
// ---------------------------------------------------------------------------

/** Glides the camera to its pose; at rest it asks for no more frames. Jumps instead of gliding when motion is reduced. */
function CameraRig({ pose, reduced }: { pose: CamPose; reduced: boolean }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const now = useRef<{ p: THREE.Vector3; t: THREE.Vector3 } | null>(null);
  const goal = useMemo(() => ({ p: new THREE.Vector3(...pose.position), t: new THREE.Vector3(...pose.target) }), [pose]);

  useLayoutEffect(() => {
    if (!now.current) {
      now.current = { p: goal.p.clone(), t: goal.t.clone() };
      camera.position.copy(goal.p);
      camera.lookAt(goal.t);
    }
    invalidate();
  }, [camera, goal, invalidate]);

  useFrame((_, dt) => {
    const cur = now.current;
    if (!cur) return;
    if (reduced) {
      cur.p.copy(goal.p);
      cur.t.copy(goal.t);
    } else {
      const step = Math.min(dt, 0.05); // a long gap since the last frame must not make the camera jump
      for (const k of ["x", "y", "z"] as const) {
        cur.p[k] = damp(cur.p[k], goal.p[k], 5, step);
        cur.t[k] = damp(cur.t[k], goal.t[k], 5, step);
      }
      if (cur.p.distanceToSquared(goal.p) > 1e-6 || cur.t.distanceToSquared(goal.t) > 1e-6) invalidate();
    }
    camera.position.copy(cur.p);
    camera.lookAt(cur.t);
  });
  return null;
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

function World({ round, last, earlier, progress, aim, view, reduced }: AsyqSceneProps) {
  const p = round.params;
  const look = useMemo(() => surfaceLook(p.mu), [p.mu]);
  const gltf = useGLTF(ASYQ_MODEL_URL, false, true);
  const template = useMemo(() => normaliseBone(gltf.scene), [gltf.scene]);
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);

  const attempts = [...earlier, ...(last ? [last] : [])];
  const stops = attempts.map((a) => a.judged.values.d);
  const reach = viewReach(p.target, stops);
  const chaseScale = view === "chase" ? 2.6 : undefined;

  const aiming = aim !== null;
  const sakhaX = last && !aiming ? slidePosition(last.judged.values.v, p.mu, slideStopTime(last.judged.values.v, p.mu) * progress) : 0;
  const settled = !!last && !aiming && progress >= 1;
  const hit = settled && last!.judged.hit;

  const pose = useMemo(() => (view === "chase" ? chasePose(sakhaX, p.target) : overviewPose(view, reach, aspect)), [view, sakhaX, p.target, reach, aspect]);

  const aLen = asyqLength(p.target);
  const sLen = sakhaLength(p.target);
  const row = rowPositions(p.target, p.radius);
  // in the chase view only the marks near the sakha are worth a label; the rest would pile up at the horizon
  const marks = rulerMarks(reach).filter((m) => view !== "chase" || (m >= sakhaX - 3 && m <= sakhaX + 9));
  const markZ = -LANE_HALF_WIDTH - (view === "chase" ? 0.34 : 0.8);
  const lineColor = look.id === "ice" || look.id === "snow" ? "#334155" : "#ffffff";
  const farEnd = Math.max(reach, ...stops, sakhaX) + 160;

  // Stops no longer drawn as the sakha itself: every earlier throw, and the last while the next is being aimed.
  const markers = aiming ? attempts : earlier;

  return (
    <>
      <CameraRig pose={pose} reduced={reduced} />
      <Ground look={look} from={-30} to={farEnd} />

      {/* lane edges, throw line */}
      <Strip x0={-0.6} x1={reach + 0.6} z0={-LANE_HALF_WIDTH - 0.03} z1={-LANE_HALF_WIDTH + 0.03} color={lineColor} opacity={0.7} />
      <Strip x0={-0.6} x1={reach + 0.6} z0={LANE_HALF_WIDTH - 0.03} z1={LANE_HALF_WIDTH + 0.03} color={lineColor} opacity={0.7} />
      <Strip x0={-0.05} x1={0.05} z0={-LANE_HALF_WIDTH} z1={LANE_HALF_WIDTH} color={lineColor} opacity={0.9} />

      {/* the ruler: a tick and a number every few metres along the near edge */}
      {marks.map((m) => (
        <group key={m}>
          <Strip x0={m - 0.02} x1={m + 0.02} z0={-LANE_HALF_WIDTH - 0.2} z1={-LANE_HALF_WIDTH} color={lineColor} opacity={0.9} />
          <Label position={[m, 0.04, markZ]} near={chaseScale}>{m} м</Label>
        </group>
      ))}

      {/* where it counts: the zone across the lane, the flags at its ends, and the asyqs beside it */}
      <Strip x0={p.target - p.radius} x1={p.target + p.radius} z0={-LANE_HALF_WIDTH} z1={LANE_HALF_WIDTH} color={hit ? "#16a34a" : "#22c55e"} opacity={hit ? 0.6 : 0.3} y={0.008} />
      <Pole x={p.target - p.radius} z={-LANE_HALF_WIDTH - 0.08} color={hit ? "#16a34a" : "#ef4444"} />
      <Pole x={p.target + p.radius} z={-LANE_HALF_WIDTH - 0.08} color={hit ? "#16a34a" : "#ef4444"} />
      {row.map((x, i) => (
        <Bone key={i} template={template} length={aLen} x={x} z={ROW_Z} yaw={Math.PI / 2 + (i % 2 ? 0.1 : -0.07)} />
      ))}
      <Label position={[p.target, 1.75, ROW_Z]}>асықтар · {fmt(p.target, 1)} м</Label>

      {/* the scuff the sakha leaves behind it */}
      {sakhaX > 0.01 && <Strip x0={0} x1={sakhaX} z0={-0.05} z1={0.05} color={look.id === "ice" ? "#ffffff" : "#1e293b"} opacity={look.id === "ice" ? 0.7 : 0.28} y={0.005} />}

      {/* earlier throws, as rings on the floor */}
      {markers.map((a, i) => (
        <group key={i} position={[a.judged.values.d, 0, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <ringGeometry args={[0.2, 0.27, 32]} />
            <meshBasicMaterial color="#6d28d9" transparent opacity={0.85} depthWrite={false} />
          </mesh>
          {a.judged.values.d <= reach && <Label position={[0, 0.3, 0]} near={chaseScale}>{i + 1} · {fmt(a.judged.values.d, 2)} м</Label>}
        </group>
      ))}

      <Bone template={template} length={sLen} x={sakhaX} tint={SAKHA_TINT} glow={hit} />
      {aiming && <AimArrow speed={aim.speed} from={sLen * 0.6} />}
      {settled && sakhaX <= reach && <Label position={[sakhaX, 0.55, 0]} near={chaseScale}>d = {fmt(sakhaX, 2)} м</Label>}
    </>
  );
}

function Loader() {
  return (
    <Html center>
      <div className="whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">Асық үлгісі жүктелуде…</div>
    </Html>
  );
}

export default function AsyqScene3D(props: AsyqSceneProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ fov: CAMERA_FOV, near: 0.05, far: 400, position: [-3, 2, -3] }}
      gl={{ antialias: true }}
      aria-hidden
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 45, 150]} />
      <hemisphereLight args={["#eaf3ff", "#7a7467", 1.0]} />
      <directionalLight position={[6, 9, -4]} intensity={2.1} color="#fff6e8" />
      <StudioEnvironment />
      <Suspense fallback={<Loader />}>
        <World {...props} />
      </Suspense>
    </Canvas>
  );
}
