"use client";

// Lesson 8 — Oscillations. A longcase clock's seconds pendulum for amplitude,
// period and frequency; two pendulums of different length; two bobs of different
// mass; and a spring pendulum whose position is drawn as it goes.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Plot, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { Arrow, Ground, Paving } from "../objects/common";
import { Q } from "../objects/materials";
import { CoilSpring, MassWeight, RetortStand, type SpringHandle } from "../objects/Mech";
import { CLOCK, LongcaseClock, PendulumFrame, SimplePendulum, type ClockHandle, type PendulumHandle } from "../objects/Oscillators";

const S = LESSON_SCRIPTS[8];
const at = (id: string) => chapterById(S, id);
const G = 9.8;

const CH = {
  terms: at("terms").from,
  clock: at("clock").from,
  lengths: at("lengths").from,
  mass: at("mass").from,
  springA: at("springA").from,
  springB: at("springB").from,
  outro: at("outro").from,
};

const RIG_X = 30;
const MASS_X = 45;
const SPRING_X = 62;

const period = (l: number) => 2 * Math.PI * Math.sqrt(l / G);

// ---- the clock's pendulum ---------------------------------------------------
const TH_CLOCK = 0.1;
const T_CLOCK = period(CLOCK.seconds);
const clockAngle = (t: number) => TH_CLOCK * Math.cos(((2 * Math.PI) / T_CLOCK) * (t - CH.terms));
/** Bob displacement in cm. */
const clockX = (t: number) => 100 * CLOCK.seconds * Math.sin(clockAngle(t));
const X_AMP = 100 * CLOCK.seconds * Math.sin(TH_CLOCK);

// ---- two lengths --------------------------------------------------------------
const TH_RIG = 0.12;
const T_REL = CH.lengths + 1.2;
const L_LONG = 1.0;
const L_SHORT = 0.25;
const swing = (t: number, t0: number, T: number, th: number) => (t < t0 ? th : th * Math.cos(((2 * Math.PI) / T) * (t - t0)));

// ---- two masses -------------------------------------------------------------
const L_MASS = 0.6;
const T_MASS = period(L_MASS);
const T_REL_M = CH.mass + 1.0;

// ---- spring -----------------------------------------------------------------
const K_SP = 50;
const M_SP = 0.5;
const W_SP = Math.sqrt(K_SP / M_SP);
const T_SP = (2 * Math.PI) / W_SP;
const A_SP = 0.07;
const SP_L0 = 0.25;
const T_REL_S = CH.springA + 1;
const ARM_Y = 1.31;
const EQ = (M_SP * G) / K_SP;
const spX = (t: number) => (t < T_REL_S ? A_SP : A_SP * Math.cos(W_SP * (t - T_REL_S)));

const anchor = (): Vec3 => [0, 0, 0];

// ---- world ------------------------------------------------------------------
function World() {
  const clock = useRef<ClockHandle>(null!);
  const pLong = useRef<PendulumHandle>(null!);
  const pShort = useRef<PendulumHandle>(null!);
  const mLight = useRef<PendulumHandle>(null!);
  const mHeavy = useRef<PendulumHandle>(null!);
  const spring = useRef<SpringHandle>(null!);
  const bob = useRef<THREE.Group>(null!);

  useStudioFrame((t) => {
    clock.current.set(clockAngle(t), t);
    pLong.current.setAngle(swing(t, T_REL, period(L_LONG), TH_RIG));
    pShort.current.setAngle(swing(t, T_REL, period(L_SHORT), TH_RIG));
    mLight.current.setAngle(swing(t, T_REL_M, T_MASS, TH_RIG));
    mHeavy.current.setAngle(swing(t, T_REL_M, T_MASS, TH_RIG));
    const len = SP_L0 + EQ + spX(t);
    spring.current.setLength(len);
    bob.current.position.set(SPRING_X + 0.27, ARM_Y - len - 0.012, 0);
  });

  return (
    <>
      <Ground size={400} x={30} />
      <Paving x={30} z={0} w={110} d={14} />
      {/* wall behind the apparatus */}
      <mesh position={[30, 2.4, -0.4]} receiveShadow>
        <boxGeometry args={[110, 4.8, 0.1]} />
        <meshStandardMaterial color="#e6ebf3" roughness={0.95} />
      </mesh>
      <mesh position={[30, 0.1, -0.34]}>
        <boxGeometry args={[110, 0.2, 0.04]} />
        <meshStandardMaterial color="#9aa6b8" roughness={0.8} />
      </mesh>

      {/* ---- clock ---- */}
      <group position={[0, 0.0, 0]}>
        <LongcaseClock ref={clock} />
      </group>
      <Arrow color={Q.force} radius={0.008} get={(t) => (t >= CH.terms + 2 && t < CH.lengths ? { origin: [0, 0.57, 0.17], dir: [1, 0, 0], len: (X_AMP / 100) * smooth(seg(t, CH.terms + 2, CH.terms + 2.8)) } : null)} />
      <LiveTag tone="red" get={(t) => (t >= CH.terms + 2.4 && t < CH.lengths ? { pos: [X_AMP / 200, 0.84, 0.17], opacity: seg(t, CH.terms + 2.4, CH.terms + 3.2) } : null)}>
        A = 10 см
      </LiveTag>
      <LiveTag
        tone="brand"
        text={(t) => `x = ${num(clockX(t), 1)} см`}
        get={(t) => (t >= CH.terms + 4 && t < CH.lengths ? { pos: [(clockX(t) / 100), CLOCK.pivotY - CLOCK.seconds - 0.14, 0.17], opacity: seg(t, CH.terms + 4, CH.terms + 5) } : null)}
      >
        x
      </LiveTag>

      {/* ---- two lengths ---- */}
      <group position={[RIG_X, 0, 0]}>
        <PendulumFrame top={2.05} width={1.6} />
        <group position={[-0.3, 2.025, 0]}>
          <SimplePendulum ref={pLong} length={L_LONG} bobR={0.07} color="#2f6df6" />
        </group>
        <group position={[0.3, 2.025, 0]}>
          <SimplePendulum ref={pShort} length={L_SHORT} bobR={0.07} color="#f97316" />
        </group>
        <LiveTag tone="brand" get={(t) => (t >= CH.lengths + 0.4 && t < CH.mass ? { pos: [-0.3, 2.2, 0], opacity: seg(t, CH.lengths + 0.4, CH.lengths + 1.2) } : null)}>
          l₁ = 1 м
        </LiveTag>
        <LiveTag tone="amber" get={(t) => (t >= CH.lengths + 0.4 && t < CH.mass ? { pos: [0.3, 2.2, 0], opacity: seg(t, CH.lengths + 0.4, CH.lengths + 1.2) } : null)}>
          l₂ = 0,25 м
        </LiveTag>
      </group>

      {/* ---- two masses ---- */}
      <group position={[MASS_X, 0, 0]}>
        <PendulumFrame top={1.65} width={1.4} />
        <group position={[-0.35, 1.625, 0]}>
          <SimplePendulum ref={mLight} length={L_MASS} bobR={0.04} color="#d9b36b" />
        </group>
        <group position={[0.35, 1.625, 0]}>
          <SimplePendulum ref={mHeavy} length={L_MASS} bobR={0.075} color="#aab4c3" metal />
        </group>
        <LiveTag tone="brand" get={(t) => (t >= CH.mass + 0.3 && t < CH.springA ? { pos: [-0.35, 1.8, 0], opacity: seg(t, CH.mass + 0.3, CH.mass + 1.1) } : null)}>
          m = 0,5 кг
        </LiveTag>
        <LiveTag tone="red" get={(t) => (t >= CH.mass + 0.3 && t < CH.springA ? { pos: [0.35, 1.8, 0], opacity: seg(t, CH.mass + 0.3, CH.mass + 1.1) } : null)}>
          m = 2 кг
        </LiveTag>
      </group>

      {/* ---- spring ---- */}
      <group position={[SPRING_X, 0.02, 0]}>
        <RetortStand />
      </group>
      <group position={[SPRING_X + 0.27, ARM_Y, 0]}>
        <CoilSpring ref={spring} natural={SP_L0} radius={0.026} turns={16} wire={0.0035} />
      </group>
      <group ref={bob}>
        <MassWeight kg={M_SP} />
      </group>
      <Arrow color={Q.force} radius={0.006} get={(t) => (t >= CH.springA + 0.5 && t < CH.outro ? { origin: [SPRING_X + 0.27 + 0.1, ARM_Y - SP_L0 - EQ - 0.0, 0], dir: [0, -1, 0], len: 0.0001 } : null)} />
      <LiveTag tone="green" text={(t) => `x = ${num(spX(t) * 100, 1)} см`} get={(t) => (t >= CH.springA + 1 && t < CH.outro ? { pos: [SPRING_X + 0.27 + 0.16, ARM_Y - SP_L0 - EQ - spX(t) - 0.02, 0], opacity: seg(t, CH.springA + 1, CH.springA + 2) } : null)}>
        x
      </LiveTag>
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const tr = Math.max(0, t - T_REL);
  const trm = Math.max(0, t - T_REL_M);
  const ts = Math.max(0, t - T_REL_S);
  // A scope-style sweep: the trace runs across a 2,5 s window, then starts again.
  const x0 = Math.floor(ts / 2.5) * 2.5;
  return (
    <>
      <Dip t={t} at={CH.lengths} />
      <Dip t={t} at={CH.mass} />
      <Dip t={t} at={CH.springA} />
      <Dip t={t} at={CH.outro} />

      <Card t={t} from={CH.terms + 0.5} to={CH.clock} place={{ right: "2.2cqw", top: "14cqh" }} title="Тербеліс шамалары">
        <Row label="амплитуда A" value="10" unit="см" color={Q.force} />
        <Row label="период T" value="2" unit="с" color={Q.velocity} />
        <Row label="жиілік f = 1/T" value="0,5" unit="Гц" color={Q.acceleration} />
      </Card>
      <Card t={t} from={CH.terms + 1} to={CH.clock} place={{ left: "2.2cqw", top: "17cqh" }} title="x(t) графигі" width="28cqw">
        <Plot
          lines={[{ fn: (s) => X_AMP * Math.cos(((2 * Math.PI) / T_CLOCK) * s), color: Q.force }]}
          x1={6}
          y0={-12}
          y1={12}
          xTicks={6}
          yTicks={4}
          cursor={Math.max(0, t - CH.terms)}
          xLabel="t, с"
          yLabel="x, см"
          w={25}
          h={13}
        />
      </Card>

      <Card t={t} from={CH.clock + 0.5} to={CH.lengths} place={{ right: "2.2cqw", top: "14cqh" }} title="Математикалық маятник" width="34cqw">
        <Formula note="g = 9,8 м/с²">T = 2π√(l / g)</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="l" value="0,994" unit="м" />
          <Row label="T" value={num(T_CLOCK, 2)} unit="с" color={Q.velocity} />
        </div>
      </Card>

      <Card t={t} from={CH.lengths + 0.6} to={CH.mass} place={{ right: "2.2cqw", top: "14cqh" }} title="Ұзындық және период" width="32cqw">
        <Row label="l₁ = 1 м · T₁" value={num(period(L_LONG), 2)} unit="с" color="#2f6df6" />
        <Row label="l₂ = 0,25 м · T₂" value={num(period(L_SHORT), 2)} unit="с" color="#f97316" />
        <Row label="тербеліс саны N₁" value={String(Math.floor(tr / period(L_LONG)))} unit="" color="#2f6df6" />
        <Row label="тербеліс саны N₂" value={String(Math.floor(tr / period(L_SHORT)))} unit="" color="#f97316" />
      </Card>
      <Card t={t} from={CH.lengths + 5} to={CH.mass} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula small>T ∝ √l  ⇒  l ÷ 4 → T ÷ 2</Formula>
      </Card>

      <Card t={t} from={CH.mass + 0.6} to={CH.springA} place={{ right: "2.2cqw", top: "14cqh" }} title="Масса және период" width="32cqw">
        <Row label="m = 0,5 кг · T" value={num(T_MASS, 2)} unit="с" color="#d9a74a" />
        <Row label="m = 2 кг · T" value={num(T_MASS, 2)} unit="с" color="#7b8aa0" />
        <Row label="тербеліс саны" value={String(Math.floor(trm / T_MASS))} unit="" />
      </Card>
      <Card t={t} from={CH.mass + 4} to={CH.springA} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula small>T  m-ге тәуелді емес</Formula>
      </Card>

      <Card t={t} from={CH.springA + 0.5} to={CH.springB} place={{ right: "2.2cqw", top: "14cqh" }} title="Серіппелі маятник" width="34cqw">
        <Formula note="m = 0,5 кг, k = 50 Н/м">T = 2π√(m / k)</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="T" value={num(T_SP, 2)} unit="с" color={Q.velocity} />
        </div>
      </Card>
      <Card t={t} from={CH.springB} to={CH.outro} place={{ right: "2.2cqw", top: "14cqh" }} title="Гармоникалық тербеліс" width="34cqw">
        <Formula note="ω = 2π/T = 10 рад/с">x = A·cos ωt</Formula>
      </Card>
      <Card t={t} from={CH.springA + 1.5} to={CH.outro} place={{ left: "2.2cqw", top: "17cqh" }} title="x(t), см" width="30cqw">
        <Plot
          lines={[{ fn: (s) => 100 * spX(T_REL_S + s), color: Q.velocity }]}
          x0={x0}
          x1={x0 + 2.5}
          y0={-8}
          y1={8}
          xTicks={5}
          yTicks={4}
          cursor={ts}
          xLabel="t, с"
          yLabel="x, см"
          w={27}
          h={13}
        />
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson08: LessonScene = {
  moduleId: 8,
  script: S,
  cameraFollow: anchor,
  camera: [
    // the whole clock, then in on the pendulum
    { t: 0, ...K([-1.4, 1.3, 5.6], [0, 1.1, 0]) },
    { t: 6.9, ...K([0.5, 1.25, 4.6], [0, 1.1, 0]) },
    { t: 8, ...K([0.05, 1.02, 2.7], [0, 1.02, 0]) },
    { t: 25.9, ...K([0.05, 1.02, 2.6], [0, 1.02, 0]) },
    // length rig
    { t: 26.05, ...K([RIG_X + 0.05, 1.5, 3.1], [RIG_X, 1.3, 0]) },
    { t: 37.9, ...K([RIG_X + 0.05, 1.5, 3.1], [RIG_X, 1.3, 0]) },
    // mass rig
    { t: 38.05, ...K([MASS_X + 0.05, 1.3, 2.9], [MASS_X, 1.1, 0]) },
    { t: 46.9, ...K([MASS_X + 0.05, 1.3, 2.9], [MASS_X, 1.1, 0]) },
    // spring
    { t: 47.05, ...K([SPRING_X + 0.33, 0.95, 1.85], [SPRING_X + 0.3, 0.88, 0]) },
    { t: 63.9, ...K([SPRING_X + 0.33, 0.95, 1.85], [SPRING_X + 0.3, 0.88, 0]) },
    // back at the clock
    { t: 64.05, ...K([-1.0, 1.3, 4.4], [0, 1.1, 0]) },
    { t: 72, ...K([0.9, 1.3, 4.8], [0, 1.1, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#7fb2f0", horizon: "#e8f1fb" },
  light: {
    offset: [3, 7, 6],
    extent: 5,
    follow: (t) => (t < CH.lengths ? [0, 1.1, 0] : t < CH.mass ? [RIG_X, 1.2, 0] : t < CH.springA ? [MASS_X, 1.1, 0] : t < CH.outro ? [SPRING_X + 0.3, 0.9, 0] : [0, 1.1, 0]),
  },
  fog: { color: "#e6eef9", near: 70, far: 300 },
};

