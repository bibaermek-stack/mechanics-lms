"use client";

// The arena of the asyq game in 3D: the floor, the ring, the thrower's mark, and the scanned bones
// moving as the physics recording says they move. Nothing here decides anything: the game
// (src/lib/asyq/game.ts) owns the rules and the physics, this only draws what it reports.
//
// Bones are real size in the physics (an asyq is 4 cm) and drawn VISUAL_SCALE times larger.
// The canvas renders on demand: while the player is aiming it draws only when something changes.

import { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import { StudioEnvironment } from "@/components/simulation/core/SimStage";
import { blobTexture, groundTexture, TILE } from "@/components/games/asyqTextures";
import { CAMERA_FOV } from "@/lib/asyqView";
import { MODEL_CENTROID, MODEL_LENGTH } from "@/lib/asyq/model.generated";
import { arenaPose, damp, scalePose, type ArenaView } from "@/lib/asyq/camera";
import { FACE_INFO } from "@/lib/asyq/faces";
import { orientationOnFace } from "@/lib/asyq/placement";
import { ARENA_HALF, ASYQ_LENGTH, restingHeight } from "@/lib/asyq/physics";
import { sakhaById } from "@/lib/asyq/rules";
import { AIM_LIMIT, RELEASE_LIFT, SAKHA_ID, SAKHA_START_FACE, type ThrowParams } from "@/lib/asyq/throw";
import { PACE, type AsyqGame } from "@/lib/asyq/game";
import { ASYQ_MODEL_URL, cloneBone, disposeBone } from "./bone";
import { SURFACE_LOOK, VISUAL_SCALE as S, playerColour } from "./colours";

const SKY = "#bcdcf4";
/** The drawn floor: the physical one (±ARENA_HALF) in picture units. */
const GROUND_SIZE = 2 * ARENA_HALF * S;

export interface ArenaProps {
  game: AsyqGame;
  /** Bumps whenever the game changes. */
  version: number;
  aim: ThrowParams;
  onAimYaw: (yaw: number) => void;
  view: ArenaView;
  reduced: boolean;
  /** Called once the scanned bone has loaded and the arena is on screen. */
  onReady?: () => void;
}

// ---------------------------------------------------------------------------
// One bone
// ---------------------------------------------------------------------------

interface BoneProps {
  template: THREE.Object3D;
  length: number;
  tint: string | null;
  glow?: boolean;
  register?: (g: THREE.Group | null) => void;
  shadow?: (g: THREE.Group | null) => void;
  /** Static placement, for bones the game does not move (trays, the held sakha). */
  at?: { position: [number, number, number]; quaternion: [number, number, number, number] };
}

function Bone({ template, length, tint, glow, register, shadow, at }: BoneProps) {
  const bone = useMemo(() => cloneBone(template, tint), [template, tint]);
  useEffect(() => () => disposeBone(bone), [bone]);
  useEffect(() => {
    bone.traverse((o) => {
      const m = (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material as THREE.MeshStandardMaterial) : null;
      if (m) {
        m.emissive.set(glow ? "#16a34a" : "#000000");
        m.emissiveIntensity = glow ? 0.4 : 0;
      }
    });
  }, [bone, glow]);
  const k = (length / MODEL_LENGTH) * S;
  const blob = useMemo(() => blobTexture(), []);
  return (
    <>
      <group ref={shadow} position={at ? [at.position[0], 0.004, at.position[2]] : undefined}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[length * S * 1.9, length * S * 1.9]} />
          <meshBasicMaterial map={blob} transparent depthWrite={false} opacity={0.8} />
        </mesh>
      </group>
      <group ref={register} visible={!!at} position={at?.position} quaternion={at ? new THREE.Quaternion(...at.quaternion) : undefined}>
        <group position={[-MODEL_CENTROID[0] * k, -MODEL_CENTROID[1] * k, -MODEL_CENTROID[2] * k]} scale={k}>
          <primitive object={bone} />
        </group>
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

function Ground({ surface }: { surface: keyof typeof SURFACE_LOOK }) {
  const look = SURFACE_LOOK[surface];
  const tex = useMemo(() => {
    const t = groundTexture(look).clone();
    t.needsUpdate = true;
    t.repeat.set(GROUND_SIZE / TILE, GROUND_SIZE / TILE);
    return t;
  }, [look]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial map={tex} roughness={look.roughness} metalness={look.id === "ice" ? 0.1 : 0} envMapIntensity={look.id === "ice" ? 0.7 : 0.3} />
    </mesh>
  );
}

function Label({ position, children, tone = "dark" }: { position: [number, number, number]; children: React.ReactNode; tone?: "dark" | "good" }) {
  return (
    <Html position={position} center zIndexRange={[8, 0]} style={{ pointerEvents: "none" }}>
      <div className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none text-white shadow ${tone === "good" ? "bg-emerald-600/95" : "bg-slate-900/85"}`}>{children}</div>
    </Html>
  );
}

function AimArrow({ game, aim }: { game: AsyqGame; aim: ThrowParams }) {
  const R = game.state.config.ringRadius;
  const colour = playerColour(game.state.current);
  const len = (0.12 + 0.34 * aim.power) * S;
  const head = 0.09 * S;
  const shaft = Math.max(0.05, len - head);
  return (
    <group position={[-R * S, 0.02 * S, 0]} rotation={[0, -aim.yaw, 0]}>
      <mesh position={[shaft / 2 + 0.08 * S, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.012 * S, 0.012 * S, shaft, 10]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.45} />
      </mesh>
      <mesh position={[shaft + head / 2 + 0.08 * S, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.032 * S, head, 14]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.45} />
      </mesh>
    </group>
  );
}

function CameraRig({ game, view, reduced, aspect }: { game: AsyqGame; view: ArenaView; reduced: boolean; aspect: number }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const now = useRef<{ p: THREE.Vector3; t: THREE.Vector3 } | null>(null);
  useLayoutEffect(() => {
    now.current = null;
    invalidate();
  }, [view, aspect, invalidate]);
  useFrame((_, dt) => {
    const R = game.state.config.ringRadius;
    const sakha = game.poses().find((p) => p.id === SAKHA_ID);
    const pose = scalePose(arenaPose(view, R, aspect, sakha ? sakha.position : null), S);
    const goal = { p: new THREE.Vector3(...pose.position), t: new THREE.Vector3(...pose.target) };
    if (!now.current || reduced) now.current = { p: goal.p.clone(), t: goal.t.clone() };
    else {
      const step = Math.min(dt, 0.05);
      for (const k of ["x", "y", "z"] as const) {
        now.current.p[k] = damp(now.current.p[k], goal.p[k], 5, step);
        now.current.t[k] = damp(now.current.t[k], goal.t[k], 5, step);
      }
      if (now.current.p.distanceToSquared(goal.p) > 1e-5 || now.current.t.distanceToSquared(goal.t) > 1e-5) invalidate();
    }
    camera.position.copy(now.current.p);
    camera.lookAt(now.current.t);
  });
  return null;
}

function World({ game, version, aim, onAimYaw, view, reduced, onReady }: ArenaProps) {
  void version; // re-render when the game changes
  useEffect(() => {
    onReady?.();
    // once, when the model has loaded and this first renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const state = game.state;
  const cfg = state.config;
  const R = cfg.ringRadius;
  const gltf = useGLTF(ASYQ_MODEL_URL, false, true);
  const template = gltf.scene;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const aspect = size.width / Math.max(1, size.height);

  const bodies = useRef(new Map<string, THREE.Group>());
  const shadows = useRef(new Map<string, THREE.Group>());
  const dragging = useRef(false);

  // every body to draw: whatever the game has posed, plus the sakha in the hand while aiming
  const posed = game.poses();
  const aiming = state.phase === "aiming" && !game.isComputing;
  // while a throw is being worked out the sakha stays in the hand
  const held = aiming || (state.phase === "throwing" && game.isComputing);
  const player = state.players[state.current];
  const sakhaSpec = sakhaById(player?.sakha ?? "ortasha");

  const scored = state.pending?.judgement?.scored ?? [];
  const scoredIds = new Set(scored.map((s) => s.id));

  useFrame((_, dt) => {
    game.tick(Math.min(dt, 0.05));
    const trayQuat = TRAY_QUAT;
    const trayHeight = TRAY_HEIGHT;
    const t = Math.min(1, game.phaseTime / (PACE.scoring ?? 1.4));
    const k = state.phase === "scoring" ? t * t * (3 - 2 * t) : 0;
    for (const p of game.poses()) {
      const g = bodies.current.get(p.id);
      if (!g) continue;
      let [x, y, z] = p.position;
      if (game.state.phase === "scoring" && scoredIds.has(p.id)) {
        // a won asyq goes to the thrower's tray
        const to = trayAt(game.state.current, game.state.players[game.state.current].won.length + scored.findIndex((s) => s.id === p.id), game.state.players.length, R);
        x += (to[0] - x) * k;
        z += (to[2] - z) * k;
        y += (trayHeight - y) * k + Math.sin(Math.PI * k) * 0.03;
        g.quaternion.set(p.rotation[0], p.rotation[1], p.rotation[2], p.rotation[3]).slerp(trayQuat, k);
      } else {
        g.quaternion.set(p.rotation[0], p.rotation[1], p.rotation[2], p.rotation[3]);
      }
      g.position.set(x * S, y * S, z * S);
      g.visible = true;
      const sh = shadows.current.get(p.id);
      if (sh) sh.position.set(x * S, 0.004, z * S);
    }
    const phase = game.state.phase;
    if (phase !== "aiming" && phase !== "setup" && phase !== "finished") invalidate();
  });

  const onPoint = (e: ThreeEvent<PointerEvent>) => {
    if (!aiming) return;
    const x = e.point.x / S, z = e.point.z / S;
    const yaw = Math.atan2(z, x + R);
    onAimYaw(Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, yaw)));
  };

  const heldRotation = useMemo(() => orientationOnFace(SAKHA_START_FACE, aim.yaw), [aim.yaw]);
  const heldY = restingHeight(heldRotation, sakhaSpec.length) + 0.0003 + RELEASE_LIFT;
  const finals = state.phase === "judging" || state.phase === "scoring" ? state.pending?.final ?? [] : [];
  const glow = (id: string) => state.phase === "scoring" && scoredIds.has(id);
  // a side is named for the bones something happened to; the ones that never moved would only clutter
  const touchedOrMoved = useMemo(() => {
    const out = new Set<string>();
    const before = new Map((state.pending?.before ?? []).map((b) => [b.id, b.position]));
    for (const b of finals) {
      const was = before.get(b.id);
      if (was && Math.hypot(b.position[0] - was[0], b.position[2] - was[2]) > 0.01) out.add(b.id);
    }
    for (const [a, b] of state.pending?.contacts ?? []) (out.add(a), out.add(b));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pending, state.phase]);

  return (
    <>
      <CameraRig game={game} view={view} reduced={reduced} aspect={aspect} />
      <Ground surface={cfg.surface} />

      {/* the ring: chalk line and a slightly darker floor inside */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <circleGeometry args={[R * S, 96]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.1} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[R * S - 0.05, R * S + 0.05, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.95} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </mesh>
      {/* where the thrower stands */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-R * S - 0.12, 0.014, 0]}>
        <planeGeometry args={[0.05, 0.9]} />
        <meshBasicMaterial color={playerColour(state.current)} transparent opacity={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-4} polygonOffsetUnits={-4} />
      </mesh>

      {/* each player's trays of won asyqs */}
      {state.players.map((p, pi) =>
        p.won.map((id, j) => {
          const at = trayAt(pi, j, state.players.length, R);
          return <Bone key={`tray-${id}`} template={template} length={ASYQ_LENGTH} tint={null} at={{ position: [at[0] * S, TRAY_HEIGHT * S, at[2] * S], quaternion: TRAY_ROTATION }} />;
        })
      )}
      {state.players.map((_, pi) => {
        const at = trayAt(pi, 0, state.players.length, R);
        return (
          <mesh key={`mat-${pi}`} rotation={[-Math.PI / 2, 0, 0]} position={[(at[0] + 0.2) * S, 0.008, at[2] * S]}>
            <planeGeometry args={[0.52 * S, 0.12 * S]} />
            <meshBasicMaterial color={playerColour(pi)} transparent opacity={0.28} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
          </mesh>
        );
      })}

      {/* the bones the game has posed */}
      {posed.map((p) => {
        const isSakha = p.kind === "sakha";
        const spec = isSakha ? sakhaById(state.players[state.current]?.sakha ?? "ortasha") : null;
        return (
          <Bone
            key={p.id}
            template={template}
            length={isSakha ? spec!.length : ASYQ_LENGTH}
            tint={isSakha ? playerColour(state.current) : null}
            glow={glow(p.id)}
            register={(g) => (g ? bodies.current.set(p.id, g) : bodies.current.delete(p.id))}
            shadow={(g) => (g ? shadows.current.set(p.id, g) : shadows.current.delete(p.id))}
          />
        );
      })}

      {/* the sakha in the hand, turned the way it will be thrown */}
      {held && (
        <>
          <Bone
            template={template}
            length={sakhaSpec.length}
            tint={playerColour(state.current)}
            at={{ position: [-R * S, heldY * S, 0], quaternion: heldRotation }}
          />
          {aiming && <AimArrow game={game} aim={aim} />}
        </>
      )}

      {/* the sides the bones came to rest on, and what they won */}
      {finals
        .filter((b) => b.kind === "sakha" || touchedOrMoved.has(b.id) || scoredIds.has(b.id))
        .map((b, i) => {
          const s = scored.find((x) => x.id === b.id);
          const label = b.face ? FACE_INFO[b.face].name : "шетінде";
          // staggered in height, so labels of bones that ended close together do not sit on each other
          return (
            <Label key={`l-${b.id}`} position={[b.position[0] * S, (b.position[1] + 0.045) * S + 0.1 + 0.32 * (i % 3), b.position[2] * S]} tone={s ? "good" : "dark"}>
              {b.kind === "sakha" ? `сақа · ${label}` : label}
              {s ? ` · +${s.points}` : ""}
            </Label>
          );
        })}
      {state.phase === "scoring" && scored.length === 0 && <Label position={[0, 0.6, 0]}>асық шықпады</Label>}

      {/* the floor takes the pointer: pressing or dragging on it aims */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.001, 0]}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
          onPoint(e);
        }}
        onPointerMove={(e) => dragging.current && onPoint(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </>
  );
}

const TRAY_ROTATION = orientationOnFace("alshy", Math.PI / 2);
const TRAY_QUAT = new THREE.Quaternion(...TRAY_ROTATION);
const TRAY_HEIGHT = restingHeight(TRAY_ROTATION, ASYQ_LENGTH) + 0.0003;

/** Where the n-th asyq of player `pi`'s winnings stands: in a row beside the ring, one row per player. */
export function trayAt(pi: number, n: number, players: number, ringRadius: number): [number, number, number] {
  return [ringRadius + 0.22 + n * 0.05, 0, (pi - (players - 1) / 2) * 0.17];
}

function Loader() {
  return (
    <Html center>
      <div className="whitespace-nowrap rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg">Асық үлгісі жүктелуде…</div>
    </Html>
  );
}

export default function AsyqArena(props: ArenaProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ fov: CAMERA_FOV, near: 0.3, far: 600, position: [-4, 2, -2] }}
      gl={{ antialias: true }}
      style={{ touchAction: "pan-y" }}
      aria-hidden
    >
      <color attach="background" args={[SKY]} />
      <fog attach="fog" args={[SKY, 55, 160]} />
      <hemisphereLight args={["#eaf3ff", "#7a7467", 1.0]} />
      <directionalLight position={[5, 9, -4]} intensity={2.1} color="#fff6e8" />
      <StudioEnvironment />
      <Suspense fallback={<Loader />}>
        <World {...props} />
      </Suspense>
    </Canvas>
  );
}
