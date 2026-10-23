"use client";

// Lesson 5 — Work and energy. A sled pulled at an angle (A = F·s·cosα), two
// hoists of different power, and a roller coaster that turns potential energy
// into kinetic energy — first without friction, then with it.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Bars, Card, Dip, Formula, LiveTag, num, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, clamp, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { Segment, type SegmentHandle } from "@/components/simulation/core/primitives";
import { Arrow, Ground, Paving, Tree } from "../objects/common";
import { Crate } from "../objects/Props";
import { Figure, type FigureHandle } from "../objects/Figure";
import { Q } from "../objects/materials";
import { buildRide, CoasterCar, CoasterTrack, H0, sampleTrack } from "../objects/Coaster";

const S = LESSON_SCRIPTS[5];
const at = (id: string) => chapterById(S, id);
const G = 9.8;

const CH = {
  workA: at("workA").from,
  workB: at("workB").from,
  power: at("powerA").from,
  energy: at("energyA").from,
  energyB: at("energyB").from,
  energyC: at("energyC").from,
  outro: at("outro").from,
};

// ---- places -----------------------------------------------------------------
const SNOW_Z = -400;
const HOIST_X = 300;
const RUN1 = 31.6;
const RUN2 = 47.6;
const M_CAR = 500;

// ---- sled: constant pull at 30° ----------------------------------------------
const F_PULL = 50;
const ALPHA = Math.PI / 6;
const S_TOTAL = 20;
const sledX = (t: number) => (t < CH.workB ? 0 : S_TOTAL * clamp((t - CH.workB) / (CH.power - CH.workB - 0.3)));
const ROPE_RUN = 1.2; // horizontal run of the rope, so tan α = (hand − hook) / run

// ---- hoists ------------------------------------------------------------------
const LIFT0 = 21;
const M_LOAD = 100;
const H_LIFT = 5;
const T_FAST = 5;
const T_SLOW = 10;
const liftY = (t: number, T: number) => H_LIFT * clamp((t - LIFT0) / T);

// ---- coaster rides ----------------------------------------------------------
const ride1 = buildRide(0);
const ride2 = buildRide(0.04);
interface RideState {
  s: number;
  v: number;
  loss: number;
}
function rideAt(t: number): RideState {
  if (t < RUN2 - 0.2) {
    const tau = Math.max(0, t - RUN1);
    return { s: ride1.s(tau), v: ride1.v(tau) * (tau === 0 ? 0.8 : 1), loss: ride1.loss(tau) };
  }
  const tau = Math.max(0, t - RUN2);
  return { s: ride2.s(tau), v: ride2.v(tau), loss: ride2.loss(tau) };
}
const carPose = (t: number) => sampleTrack(rideAt(t).s);
const energies = (t: number) => {
  const r = rideAt(t);
  const p = sampleTrack(r.s);
  const ep = (M_CAR * G * p.y) / 1000;
  const ek = (0.5 * M_CAR * r.v * r.v) / 1000;
  const q = (M_CAR * r.loss) / 1000;
  return { ep, ek, e: ep + ek, q };
};

const camX = (t: number) => clamp(carPose(t).x, 14, 106);
const anchor = (t: number): Vec3 => {
  if (t < CH.workA) return [60, 0, 0];
  if (t < CH.power) return [sledX(t), 0, SNOW_Z];
  if (t < CH.energy) return [0, 0, 0];
  if (t >= CH.outro) return [60, 0, 0];
  return [camX(t), 0.55 * carPose(t).y, 0];
};

// ---- world ------------------------------------------------------------------
function Sled() {
  return (
    <group>
      {/* runners and deck */}
      {[-0.2, 0.2].map((z) => (
        <mesh key={z} position={[0, 0.06, z]} castShadow>
          <boxGeometry args={[1.25, 0.05, 0.05]} />
          <meshStandardMaterial color="#b8c1ce" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0.62, 0.12, 0.2]} rotation={[0, 0, 0.5]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.05]} />
        <meshStandardMaterial color="#b8c1ce" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.62, 0.12, -0.2]} rotation={[0, 0, 0.5]} castShadow>
        <boxGeometry args={[0.18, 0.04, 0.05]} />
        <meshStandardMaterial color="#b8c1ce" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.14, 0]} castShadow>
        <boxGeometry args={[1.1, 0.06, 0.5]} />
        <meshStandardMaterial color="#c0392b" roughness={0.6} />
      </mesh>
      <group position={[-0.1, 0.17, 0]} scale={0.7}>
        <Crate size={0.5} />
      </group>
    </group>
  );
}

function Rope({ a, b }: { a: (t: number) => Vec3; b: (t: number) => Vec3 }) {
  const h = useRef<SegmentHandle>(null);
  const va = useMemo(() => new THREE.Vector3(), []);
  const vb = useMemo(() => new THREE.Vector3(), []);
  useStudioFrame((t) => h.current?.set(va.set(...a(t)), vb.set(...b(t))));
  return <Segment ref={h} color="#5d4a36" radius={0.012} />;
}

function Hoist({ x, color, T, label }: { x: number; color: string; T: number; label: string }) {
  const load = useRef<THREE.Group>(null!);
  useStudioFrame((t) => load.current.position.set(0, 0.02 + liftY(t, T), 0));
  const motorY = 6.6;
  return (
    <group position={[x, 0, 0]}>
      {[-1.3, 1.3].map((dx) => (
        <mesh key={dx} position={[dx, 3.5, 0]} castShadow>
          <boxGeometry args={[0.18, 7, 0.18]} />
          <meshStandardMaterial color="#9aa5b6" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 7, 0]} castShadow>
        <boxGeometry args={[3, 0.24, 0.3]} />
        <meshStandardMaterial color="#f5b82e" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[0, motorY - 0.1, 0]} castShadow>
        <boxGeometry args={[0.9, 0.5, 0.6]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.45} />
      </mesh>
      <group ref={load}>
        <Crate size={0.7} color={color} />
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
      <Rope a={() => [x, motorY - 0.35, 0]} b={(t) => [x, 0.02 + 0.72 + liftY(t, T), 0]} />
      <LiveTag tone="brand" get={(t) => (t >= CH.power + 0.5 && t < CH.energy ? { pos: [x, 7.7, 0], opacity: seg(t, CH.power + 0.5, CH.power + 1.5) } : null)}>
        {label}
      </LiveTag>
    </group>
  );
}

function World() {
  const car = useRef<THREE.Group>(null!);
  const sled = useRef<THREE.Group>(null!);
  const fig = useRef<THREE.Group>(null!);
  const figH = useRef<FigureHandle>(null!);

  useStudioFrame((t) => {
    const p = carPose(t);
    car.current.position.set(p.x, p.y, 0);
    car.current.rotation.z = p.theta;

    const x = sledX(t);
    sled.current.position.set(x, 0.02, SNOW_Z);
    const handX = x + 0.6 + ROPE_RUN;
    fig.current.position.set(handX + 0.35, 0.02, SNOW_Z);
    const moving = t >= CH.workB ? 1 : 0;
    const w = (t - CH.workB) * 6;
    figH.current?.setPose({
      lean: 0.18,
      armL: -0.5,
      armR: -0.5,
      elbowL: -0.1,
      elbowR: -0.1,
      legL: 0.5 * Math.sin(w) * moving,
      legR: -0.5 * Math.sin(w) * moving,
      kneeL: Math.max(0, -Math.sin(w)) * 0.9 * moving,
      kneeR: Math.max(0, Math.sin(w)) * 0.9 * moving,
    });
  });

  const hookY = 0.3;
  const handY = hookY + ROPE_RUN * Math.tan(ALPHA);

  return (
    <>
      <Ground size={1400} x={150} />
      {/* the snow field is a patch, not a second world-sized floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, -0.03, SNOW_Z]} receiveShadow>
        <planeGeometry args={[160, 90]} />
        <meshStandardMaterial color="#f2f6fb" roughness={0.9} />
      </mesh>

      {/* ---- coaster park ---- */}
      <CoasterTrack />
      <group ref={car}>
        <CoasterCar />
      </group>
      <LiveTag
        tone="brand"
        text={(t) => `h = ${num(carPose(t).y, 1)} м · v = ${num(rideAt(t).v, 1)} м/с`}
        get={(t) => (t >= CH.energy + 0.5 && t < CH.outro ? { pos: [carPose(t).x, carPose(t).y + 2.6, 0], opacity: seg(t, CH.energy + 0.5, CH.energy + 1.5) } : null)}
      >
        h
      </LiveTag>
      {[-18, -12, 12, 30, 52, 70, 92, 112, 130].map((x, i) => (
        <Tree key={x} position={[x, 0, 12 + (i % 3) * 3]} scale={1.3 + (i % 2) * 0.3} tone={i} />
      ))}
      {[-14, 6, 24, 44, 66, 84, 104, 126].map((x, i) => (
        <Tree key={`b${x}`} position={[x, 0, -14 - (i % 3) * 3]} scale={1.4} tone={i + 1} />
      ))}

      {/* ---- snow field with the sled ---- */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i}>
          <mesh position={[i * 5, 0.5, SNOW_Z - 2.6]} castShadow>
            <boxGeometry args={[0.14, 1, 0.14]} />
            <meshStandardMaterial color={i === 0 ? "#f59e0b" : "#f8fafc"} />
          </mesh>
          <LiveTag tone={i === 0 ? "amber" : undefined} get={(t) => (t >= CH.workA && t < CH.power ? { pos: [i * 5, 1.2, SNOW_Z - 2.6], opacity: seg(t, CH.workA + 0.5, CH.workA + 1.5) } : null)}>
            {i * 5} м
          </LiveTag>
        </group>
      ))}
      <group ref={sled}>
        <Sled />
      </group>
      <group ref={fig}>
        <Figure ref={figH} shirt="#16a34a" pants="#1f2937" hair="#2a1f1a" />
      </group>
      <Rope a={(t) => [sledX(t) + 0.6, hookY, SNOW_Z]} b={(t) => [sledX(t) + 0.6 + ROPE_RUN, handY, SNOW_Z]} />
      <Arrow color={Q.force} radius={0.03} get={(t) => (t >= CH.workA + 0.5 && t < CH.power ? { origin: [sledX(t) + 0.6, hookY, SNOW_Z + 0.5], dir: [Math.cos(ALPHA), Math.sin(ALPHA), 0], len: 1.6 * smooth(seg(t, CH.workA + 0.5, CH.workA + 1.3)) } : null)} />
      <Arrow color={Q.velocity} radius={0.025} get={(t) => (t >= CH.workA + 2 && t < CH.power ? { origin: [sledX(t) + 0.6, hookY, SNOW_Z + 0.5], dir: [1, 0, 0], len: 1.6 * Math.cos(ALPHA) * smooth(seg(t, CH.workA + 2, CH.workA + 2.8)) } : null)} />
      <Arrow color="#0ea5e9" radius={0.025} get={(t) => (t >= CH.workA + 3 && t < CH.power ? { origin: [sledX(t) + 0.6 + 1.6 * Math.cos(ALPHA), hookY, SNOW_Z + 0.5], dir: [0, 1, 0], len: 1.6 * Math.sin(ALPHA) * smooth(seg(t, CH.workA + 3, CH.workA + 3.8)) } : null)} />
      <LiveTag tone="red" get={(t) => (t >= CH.workA + 1 && t < CH.power ? { pos: [sledX(t) + 1.5, 1.55, SNOW_Z + 0.5], opacity: seg(t, CH.workA + 1, CH.workA + 1.8) } : null)}>
        F = 50 Н
      </LiveTag>
      <LiveTag tone="green" get={(t) => (t >= CH.workA + 2.2 && t < CH.power ? { pos: [sledX(t) + 1.5, 0.35, SNOW_Z + 0.5], opacity: seg(t, CH.workA + 2.2, CH.workA + 3) } : null)}>
        F·cosα
      </LiveTag>

      {/* ---- two hoists ---- */}
      <Paving x={HOIST_X} z={0} w={26} d={14} />
      <Hoist x={HOIST_X - 3.2} color="#3b82f6" T={T_SLOW} label="N₁" />
      <Hoist x={HOIST_X + 3.2} color="#f97316" T={T_FAST} label="N₂" />
      {[-9, -5, 6, 10].map((x, i) => (
        <Tree key={x} position={[HOIST_X + x * 1.3, 0, -9 - (i % 2) * 2]} scale={1.2} tone={i} />
      ))}
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const e = energies(t);
  const run = t >= RUN2 - 0.2 ? 2 : 1;
  const sNow = sledX(t);
  return (
    <>
      <Dip t={t} at={CH.workA} />
      <Dip t={t} at={CH.power} />
      <Dip t={t} at={CH.energy} />
      <Dip t={t} at={RUN2} />

      <Card t={t} from={CH.workA + 0.5} to={CH.power} place={{ right: "2.2cqw", top: "14cqh" }} title="Механикалық жұмыс">
        <Formula note="Дж">A = F · s · cosα</Formula>
        {t >= CH.workB && (
          <div style={{ marginTop: "0.5cqw" }}>
            <Row label="s" value={num(sNow, 1)} unit="м" color="#f59e0b" />
            <Row label="A = F·s·cos30°" value={num(F_PULL * sNow * Math.cos(ALPHA), 0)} unit="Дж" color={Q.force} />
          </div>
        )}
      </Card>

      <Card t={t} from={CH.power + 0.5} to={CH.energy} place={{ right: "2.2cqw", top: "14cqh" }} title="Қуат">
        <Formula note="Вт">N = A / t</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="A = mgh" value="4900" unit="Дж" color={Q.weight} />
          {t > LIFT0 + T_FAST && <Row label="N₂ = A/5 с" value="980" unit="Вт" color="#f97316" />}
          {t > LIFT0 + T_SLOW && <Row label="N₁ = A/10 с" value="490" unit="Вт" color="#3b82f6" />}
        </div>
      </Card>

      <Card t={t} from={CH.energy + 0.4} to={CH.outro} place={{ left: "2.2cqw", top: "17cqh" }} title={run === 1 ? "Энергия · үйкеліссіз" : "Энергия · үйкеліспен"}>
        <Bars
          items={[
            { label: "Eₚ", value: e.ep, color: "#2563eb" },
            { label: "Eₖ", value: e.ek, color: "#ea580c" },
            { label: "Eₚ+Eₖ", value: e.e, color: "#16a34a" },
            ...(run === 2 ? [{ label: "Q", value: e.q, color: "#dc2626" }] : []),
          ]}
          max={110}
        />
      </Card>
      <Card t={t} from={CH.energy + 0.4} to={CH.energyC} place={{ right: "2.2cqw", top: "14cqh" }}>
        <Formula note="Eₖ = mv²/2">Eₚ = mgh</Formula>
        <div style={{ fontSize: "1.5cqw", marginTop: "0.4cqw", fontWeight: 700, color: "#475569" }}>m = 500 кг · h₀ = {num(H0, 0)} м</div>
      </Card>
      <Card t={t} from={CH.energyB} to={CH.energyC} place={{ right: "2.2cqw", top: "32cqh" }}>
        <Formula note="үйкеліссіз">Eₚ + Eₖ = const</Formula>
      </Card>
      <Card t={t} from={CH.energyC} to={CH.outro} place={{ right: "2.2cqw", top: "14cqh" }}>
        <Formula note="Q — жылу">Eₚ + Eₖ + Q = const</Formula>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson05: LessonScene = {
  moduleId: 5,
  script: S,
  cameraFollow: anchor,
  camera: [
    // intro: orbit the coaster at the station (relative to [60,0,0])
    { t: 0, ...K([-80, 14, 40], [-60, 11, 0]) },
    { t: 6.9, ...K([-60, 10, 38], [-45, 9, 0]) },
    // work: the sled
    { t: 7.05, ...K([2.2, 1.6, 8.4], [1.0, 0.9, 0]) },
    { t: 12.9, ...K([2.2, 1.6, 8.4], [1.0, 0.9, 0]) },
    { t: 13.05, ...K([3.2, 1.9, 9.5], [1.6, 0.9, 0]) },
    { t: 19.9, ...K([3.2, 1.9, 9.5], [1.6, 0.9, 0]) },
    // power: the hoists
    { t: 20.05, ...K([HOIST_X, 4.6, 20], [HOIST_X, 4.0, 0]) },
    { t: 30.9, ...K([HOIST_X, 4.6, 20], [HOIST_X, 4.0, 0]) },
    // energy: ride-along side view, relative to the car's x
    { t: 31.05, ...K([-3, 4, 25], [3, 3, 0]) },
    { t: 57.9, ...K([-3, 4, 25], [3, 3, 0]) },
    // outro: pull back (relative to [60,0,0])
    { t: 58.05, ...K([20, 11, 52], [48, 7, 0]) },
    { t: 66, ...K([-10, 14, 58], [50, 7, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#6ea8ee", horizon: "#e6f0fb" },
  light: {
    offset: [16, 26, 14],
    extent: 28,
    follow: (t) => (t < CH.workA ? [30, 0, 0] : t < CH.power ? [sledX(t) + 3, 0, SNOW_Z] : t < CH.energy ? [HOIST_X, 0, 0] : [camX(t), 0, 0]),
  },
  fog: { color: "#e3eefb", near: 90, far: 420 },
};

