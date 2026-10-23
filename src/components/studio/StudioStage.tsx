"use client";

// The 3D half of a lesson film: canvas, lights, sky, camera path and the
// plumbing that lets a host (the render tool, or the live player) move the
// playhead and know when a frame is ready.

import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { StudioEnvironment } from "@/components/simulation/core/SimStage";
import { sampleCamera, type CamKey, type Vec3 } from "@/lib/studio/timeline";
import { ClockContext, useStudioFrame, type StudioClock } from "./clock";
import type { LessonScene } from "./types";

const DEFAULT_SKY = { top: "#7fb2f0", horizon: "#e8f1fb" };

/** Shadow-casting key light that can track a moving subject. */
function KeyLight({
  offset,
  target,
  follow,
  extent,
  extentAt,
  size,
}: {
  offset: Vec3;
  target: Vec3;
  follow?: (t: number) => Vec3;
  extent: number;
  /** Lets a film that moves between a bench and a harbour resize the shadow frustum as it goes. */
  extentAt?: (t: number) => number;
  size: number;
}) {
  const light = useMemo(() => new THREE.DirectionalLight("#fff4e2", 2.1), []);
  const place = (p: Vec3) => {
    light.target.position.set(p[0], p[1], p[2]);
    light.position.set(p[0] + offset[0], p[1] + offset[1], p[2] + offset[2]);
    light.target.updateMatrixWorld();
  };
  useEffect(() => {
    place(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light, offset[0], offset[1], offset[2], target[0], target[1], target[2]]);
  useStudioFrame((t) => {
    if (follow) place(follow(t));
    if (extentAt) {
      const e = extentAt(t);
      const cam = light.shadow.camera;
      if (Math.abs(cam.right - e) > 1e-3) {
        cam.left = -e;
        cam.right = e;
        cam.top = e;
        cam.bottom = -e;
        cam.far = e * 6;
        cam.updateProjectionMatrix();
      }
    }
  }, -2);
  return (
    <>
      <primitive
        object={light}
        castShadow
        shadow-mapSize={[size, size]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={0.5}
        shadow-camera-far={extent * 6}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      <primitive object={light.target} />
    </>
  );
}

/** Vertical gradient dome. Unlit and un-tone-mapped so the colours are exactly as written. */
function Sky({ top, horizon }: { top: string; horizon: string }) {
  const mesh = useRef<THREE.Mesh>(null!);
  const geometry = useMemo(() => {
    const g = new THREE.SphereGeometry(180, 32, 20);
    const pos = g.getAttribute("position");
    const colors = new Float32Array(pos.count * 3);
    const cTop = new THREE.Color(top);
    const cHor = new THREE.Color(horizon);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / 180);
      c.copy(cHor).lerp(cTop, Math.pow(h, 0.65));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [top, horizon]);
  // The dome travels with the camera, so a film can happen anywhere in the world.
  useFrame(({ camera }) => mesh.current.position.copy(camera.position));
  return (
    <mesh ref={mesh} geometry={geometry} renderOrder={-10} frustumCulled={false}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  );
}

/** Drives the perspective camera from the scene's keyframes. */
function CameraPath({
  keys,
  follow,
  sway,
}: {
  keys: CamKey[];
  follow?: (t: number) => Vec3;
  sway: boolean;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const look = useMemo(() => new THREE.Vector3(), []);
  useStudioFrame((t) => {
    const p = sampleCamera(keys, t);
    const f = follow ? follow(t) : ([0, 0, 0] as Vec3);
    // A breath of drift keeps a held shot from looking frozen.
    const k = sway ? 1 : 0;
    camera.position.set(
      f[0] + p.pos[0] + Math.sin(t * 0.37) * 0.035 * k,
      f[1] + p.pos[1] + Math.sin(t * 0.29 + 1.3) * 0.018 * k,
      f[2] + p.pos[2] + Math.cos(t * 0.31) * 0.035 * k
    );
    look.set(f[0] + p.target[0], f[1] + p.target[1], f[2] + p.target[2]);
    camera.lookAt(look);
    if (Math.abs(camera.fov - p.fov) > 1e-4) {
      camera.fov = p.fov;
      camera.updateProjectionMatrix();
    }
  }, -3);
  return null;
}

/** Advances the playhead during live playback. Runs before every scene callback. */
function LiveDriver({
  clock,
  playing,
  onTick,
}: {
  clock: StudioClock;
  playing: boolean;
  onTick: (t: number) => void;
}) {
  const acc = useRef(0);
  useFrame((_, delta) => {
    if (playing) {
      // A tab that was in the background hands back a huge delta; cap it so the
      // film does not lurch forward.
      clock.t = (clock.t + Math.min(delta, 0.1)) % clock.duration;
    }
    acc.current += delta;
    if (acc.current > 1 / 24) {
      acc.current = 0;
      onTick(clock.t);
    }
  }, -4);
  return null;
}

/**
 * Colour handling for an explainer film: the neutral tone-mapper keeps paint and
 * grass the colour they were written as (ACES washes everything towards grey),
 * and the studio environment is dimmed so it lights metal without flattening
 * the shadows.
 */
function Grade() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 0.92;
    scene.environmentIntensity = 0.5;
  }, [gl, scene]);
  return null;
}

/** Hands the host the function that renders exactly one frame. */
function RenderBridge({ onAdvance }: { onAdvance: (fn: (ts: number) => void) => void }) {
  const advance = useThree((s) => s.advance);
  useEffect(() => {
    onAdvance((ts) => advance(ts, true));
  }, [advance, onAdvance]);
  return null;
}

/** Mounted last inside <Suspense>, so its effect only fires once every model has loaded. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export interface StudioStageProps {
  scene: LessonScene;
  clock: StudioClock;
  mode: "render" | "live";
  playing?: boolean;
  /** Let the student orbit instead of following the director's camera. */
  orbit?: boolean;
  dpr?: number;
  onTick?: (t: number) => void;
  onAdvance?: (fn: (ts: number) => void) => void;
  onReady?: () => void;
}

export function StudioStage({
  scene,
  clock,
  mode,
  playing = true,
  orbit = false,
  dpr = 1,
  onTick,
  onAdvance,
  onReady,
}: StudioStageProps) {
  const sky = scene.sky ?? DEFAULT_SKY;
  const light = scene.light ?? { offset: [4, 8, 5] as Vec3, extent: 6 };
  const first = scene.camera[0];
  const render = mode === "render";
  const shadowSize = render ? 2048 : 1024;
  const target: Vec3 = light.target ?? [0, 0, 0];

  return (
    <ClockContext.Provider value={clock}>
      <Canvas
        shadows
        dpr={dpr}
        frameloop={render ? "never" : "always"}
        gl={{ antialias: true, preserveDrawingBuffer: render, powerPreference: "high-performance" }}
        camera={{ position: first.pos, fov: first.fov ?? 38, near: 0.05, far: 400 }}
      >
        <Grade />
        <Sky top={sky.top} horizon={sky.horizon} />
        {scene.fog && <fog attach="fog" args={[scene.fog.color, scene.fog.near, scene.fog.far]} />}

        <hemisphereLight args={["#eaf2ff", "#7d8798", 0.8]} />
        <KeyLight
          offset={light.offset}
          target={target}
          follow={light.follow}
          extent={light.extent}
          extentAt={light.extentAt}
          size={shadowSize}
        />
        <directionalLight position={[-5, 3, -4]} intensity={0.55} color="#cfe0ff" />
        <StudioEnvironment />

        <Suspense fallback={null}>
          <scene.World />
          {onReady && <ReadySignal onReady={onReady} />}
        </Suspense>

        {orbit ? (
          <OrbitControls
            makeDefault
            enableDamping
            target={scene.viewer?.target ?? first.target}
            maxPolarAngle={Math.PI / 2 - 0.02}
          />
        ) : (
          <CameraPath keys={scene.camera} follow={scene.cameraFollow} sway={!render} />
        )}
        {!render && onTick && <LiveDriver clock={clock} playing={playing} onTick={onTick} />}
        {render && onAdvance && <RenderBridge onAdvance={onAdvance} />}
      </Canvas>
    </ClockContext.Provider>
  );
}
