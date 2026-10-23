"use client";

// Lesson 9 — Fluid mechanics. Bricks sinking into foam (pressure = F/S), a
// hydraulic jack (Pascal), an aluminium block lowered into water on a spring
// balance (Archimedes), and a container ship that sinks deeper as it is loaded.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, clamp, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { Arrow, Ground, Paving } from "../objects/common";
import { Q } from "../objects/materials";
import { RetortStand, SpringBalance, type BalanceHandle } from "../objects/Mech";
import {
  BRICK,
  Brick,
  ContainerStack,
  FoamSlab,
  GlassTank,
  HydraulicJack,
  JACK,
  SHIP,
  ShipHull,
  ShipTank,
  TANK,
  hullArea,
  type JackHandle,
} from "../objects/Fluids";

const S = LESSON_SCRIPTS[9];
const at = (id: string) => chapterById(S, id);
const G = 9.8;
const RHO = 1000;

const CH = {
  pressure: at("pressure").from,
  pascal: at("pascalA").from,
  pascalB: at("pascalB").from,
  arch: at("archA").from,
  archB: at("archB").from,
  float: at("floatA").from,
  floatB: at("floatB").from,
  outro: at("outro").from,
};

const JACK_X = 24;
const ARCH_X = 48;
const SHIP_X = 120;
const SHIP_Y = 9.8; // the test tank stands on the ground; its water surface is this high
const TABLE_Y = 0.74;
const FOAM_Y = TABLE_Y + 0.28; // top of the foam blocks, which stand on the table

// ---- bricks -----------------------------------------------------------------
const M_BRICK = 2;
const K_FOAM = 20000; // Pa of pressure per metre of sinking
interface BrickSetup {
  x: number;
  area: number;
  h: number;
  rot: [number, number, number];
  t0: number;
}
const BRICKS: BrickSetup[] = [
  { x: -0.62, area: BRICK.a * BRICK.c, h: BRICK.b, rot: [0, 0, 0], t0: 8.0 },
  { x: 0, area: BRICK.a * BRICK.b, h: BRICK.c, rot: [Math.PI / 2, 0, 0], t0: 10.5 },
  { x: 0.62, area: BRICK.b * BRICK.c, h: BRICK.a, rot: [0, 0, Math.PI / 2], t0: 13.0 },
];
const pressureOf = (b: BrickSetup) => (M_BRICK * G) / b.area;
const sinkDepth = (b: BrickSetup, t: number) => (pressureOf(b) / K_FOAM) * smooth(seg(t, b.t0 + 0.55, b.t0 + 1.7));
const brickY = (b: BrickSetup, t: number) => {
  const drop = 0.35 * (1 - smooth(seg(t, b.t0 - 0.2, b.t0 + 0.55)));
  return b.h / 2 - sinkDepth(b, t) + drop;
};

// ---- hydraulic jack -----------------------------------------------------------
const S1 = Math.PI * JACK.r1 ** 2;
const S2 = Math.PI * JACK.r2 ** 2;
const RATIO = S2 / S1; // 4
const STROKE = 0.2;
const F1 = 100;
const stroke = (t: number) => smooth(seg(t, 28, 31.5)) - smooth(seg(t, 34, 36.5));
const jackY = (t: number) => {
  const d1 = STROKE * stroke(t);
  return { y1: JACK.y0 - d1, y2: JACK.y0 + d1 / RATIO, d1, d2: d1 / RATIO };
};

// ---- Archimedes ---------------------------------------------------------------
const BLOCK = 0.1;
const M_BLOCK = 2.7;
const W_BLOCK = M_BLOCK * G; // 26.46 N
const RANGE = 50;
const TRAVEL = 0.12;
const ARM_Y = 1.31;
const TANK_Y0 = 0.45;
const TANK_RISE = 0.21;
const tankY = (t: number) => TANK_Y0 + TANK_RISE * smooth(seg(t, 39, 46));
const waterY = (t: number) => tankY(t) + 0.012 + TANK.water;
/** Solve the coupled system: reading → hook height → block bottom → submerged depth → reading. */
function archState(t: number) {
  let f = W_BLOCK / RANGE;
  let h = 0;
  for (let i = 0; i < 12; i++) {
    const hook = ARM_Y - 0.39 - f * TRAVEL;
    const bottom = hook - 0.05 - BLOCK;
    h = clamp(waterY(t) - bottom, 0, BLOCK);
    f = (W_BLOCK - RHO * G * BLOCK * BLOCK * h) / RANGE;
  }
  const hook = ARM_Y - 0.39 - f * TRAVEL;
  return { f, h, hook, bottom: hook - 0.05 - BLOCK, reading: f * RANGE, buoy: RHO * G * BLOCK * BLOCK * h };
}

// ---- ship ---------------------------------------------------------------------
const M_HULL = 2_000_000; // kg
const M_LOAD = 150_000;
interface Load {
  t: number;
  x: number;
  level: number;
}
const LOADS: Load[] = [
  { t: 60, x: -12, level: 0 },
  { t: 63, x: 8, level: 0 },
  { t: 68, x: -12, level: 1 },
  { t: 71, x: 8, level: 1 },
  { t: 74, x: -12, level: 2 },
];
const loaded = (t: number) => LOADS.reduce((n, l) => n + smooth(seg(t, l.t + 0.9, l.t + 1.4)), 0);
const shipMass = (t: number) => M_HULL + M_LOAD * loaded(t);
const draft = (t: number) => {
  const base = shipMass(t) / (RHO * hullArea());
  // a small heave as each load settles
  const wob = LOADS.reduce((a, l) => {
    const tau = t - (l.t + 1.1);
    return tau > 0 ? a + 0.07 * Math.exp(-1.6 * tau) * Math.sin(5 * tau) : a;
  }, 0);
  return base + wob;
};

// ---- anchors ----------------------------------------------------------------
const anchor = (): Vec3 => [0, 0, 0];
const lightAt = (t: number): Vec3 => (t < CH.pascal ? [0, 0.9, 0] : t < CH.arch ? [JACK_X, 1.2, 0] : t < CH.float ? [ARCH_X + 0.2, 0.9, 0] : [SHIP_X, 3, 0]);

// ---- world ------------------------------------------------------------------
function World() {
  const bricks = useRef<(THREE.Group | null)[]>([]);
  const dents = useRef<(THREE.Mesh | null)[]>([]);
  const jack = useRef<JackHandle>(null!);
  const smallLoad = useRef<THREE.Group>(null!);
  const bigLoad = useRef<THREE.Group>(null!);
  const bal = useRef<BalanceHandle>(null!);
  const tank = useRef<THREE.Group>(null!);
  const block = useRef<THREE.Group>(null!);
  const ship = useRef<THREE.Group>(null!);
  const cargo = useRef<(THREE.Group | null)[]>([]);

  useStudioFrame((t) => {
    BRICKS.forEach((b, i) => {
      const g = bricks.current[i];
      if (g) {
        g.position.set(b.x, FOAM_Y + brickY(b, t), 0);
        g.visible = t >= b.t0 - 0.25 && t < CH.pascal;
      }
      const d = dents.current[i];
      if (d) d.visible = t > b.t0 + 0.6;
    });

    const j = jackY(t);
    jack.current.set(j.y1, j.y2);
    smallLoad.current.position.y = j.y1 + 0.43;
    bigLoad.current.position.y = j.y2 + 0.43;

    const a = archState(t);
    bal.current.setReading(a.f);
    tank.current.position.y = tankY(t);
    block.current.position.y = a.bottom;

    ship.current.position.set(0, -draft(t), 0);
    LOADS.forEach((l, i) => {
      const g = cargo.current[i];
      if (!g) return;
      g.visible = t >= l.t;
      const fall = 1 - smooth(seg(t, l.t, l.t + 1.0));
      g.position.set(l.x, SHIP.H + 0.06 + l.level * 2.5 + 14 * fall, 0);
    });
  });

  const armX = ARCH_X + 0.27;
  return (
    <>
      <Ground size={600} x={60} />
      <Paving x={30} z={0} w={80} d={14} />
      <mesh position={[30, 2.4, -0.6]} receiveShadow>
        <boxGeometry args={[80, 4.8, 0.1]} />
        <meshStandardMaterial color="#e6ebf3" roughness={0.95} />
      </mesh>

      {/* ---- bricks on foam ---- */}
      <group>
        <mesh position={[0, TABLE_Y - 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.04, 0.9]} />
          <meshStandardMaterial color="#b98a55" roughness={0.6} />
        </mesh>
        {[-1.1, 1.1].flatMap((x) =>
          [-0.38, 0.38].map((z) => (
            <mesh key={`${x}${z}`} position={[x, (TABLE_Y - 0.04) / 2, z]} castShadow>
              <boxGeometry args={[0.06, TABLE_Y - 0.04, 0.06]} />
              <meshStandardMaterial color="#8d6638" roughness={0.7} />
            </mesh>
          ))
        )}
        {BRICKS.map((b, i) => (
          <group key={i}>
            <group position={[b.x, FOAM_Y, 0]}>
              <FoamSlab />
            </group>
            <mesh ref={(m) => { dents.current[i] = m; }} position={[b.x, FOAM_Y + 0.0015, 0]} visible={false}>
              <boxGeometry args={[(b.rot[0] === 0 && b.rot[2] === 0 ? BRICK.a : b.rot[2] ? BRICK.b : BRICK.a) + 0.012, 0.003, (b.rot[0] ? BRICK.b : BRICK.c) + 0.012]} />
              <meshStandardMaterial color="#b9871f" roughness={1} />
            </mesh>
            <group ref={(g) => { bricks.current[i] = g; }} rotation={b.rot as [number, number, number]}>
              <Brick />
            </group>
            <LiveTag
              tone={i === 2 ? "red" : i === 1 ? "amber" : "brand"}
              get={(t) => (t >= b.t0 + 1.4 && t < CH.pascal ? { pos: [b.x, FOAM_Y + 0.22, 0.0], opacity: seg(t, b.t0 + 1.4, b.t0 + 2.2) } : null)}
              text={() => `S = ${num(b.area * 10000, 0)} см² · P = ${num(pressureOf(b), 0)} Па`}
            >
              P
            </LiveTag>
          </group>
        ))}
      </group>

      {/* ---- hydraulic jack ---- */}
      <group position={[JACK_X, 0, 0]}>
        <group position={[0, 0.74, 0]}>
          <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.04, 0.8]} />
            <meshStandardMaterial color="#b98a55" roughness={0.6} />
          </mesh>
          {[-0.7, 0.7].flatMap((x) =>
            [-0.3, 0.3].map((z) => (
              <mesh key={`${x}${z}`} position={[x, -0.37, z]} castShadow>
                <boxGeometry args={[0.06, 0.7, 0.06]} />
                <meshStandardMaterial color="#8d6638" roughness={0.7} />
              </mesh>
            ))
          )}
          <HydraulicJack ref={jack} />
          <group ref={smallLoad} position={[-JACK.gap / 2, JACK.y0 + 0.43, 0]}>
            <mesh position={[0, 0.07, 0]} castShadow>
              <boxGeometry args={[0.1, 0.12, 0.1]} />
              <meshStandardMaterial color="#c8a24a" metalness={0.7} roughness={0.35} />
            </mesh>
          </group>
          <group ref={bigLoad} position={[JACK.gap / 2, JACK.y0 + 0.43, 0]}>
            <mesh position={[0, 0.2, 0]} castShadow>
              <boxGeometry args={[0.18, 0.38, 0.18]} />
              <meshStandardMaterial color="#8b95a5" metalness={0.8} roughness={0.35} />
            </mesh>
          </group>
          {/* forces: F₁ pushes the small piston down, F₂ lifts the big load */}
          <Arrow color={Q.force} radius={0.008} get={(t) => (t >= CH.pascal + 1 && t < CH.arch ? { origin: [-JACK.gap / 2, JACK.y0 + 0.43 - jackY(t).d1 + 0.5, 0], dir: [0, -1, 0], len: 0.22 * smooth(seg(t, CH.pascal + 1, CH.pascal + 2)) } : null)} />
          <Arrow color={Q.normal} radius={0.008} get={(t) => (t >= CH.pascal + 2.5 && t < CH.arch ? { origin: [JACK.gap / 2, JACK.y0 + 0.43 + jackY(t).d2 + 0.42, 0], dir: [0, 1, 0], len: 0.88 * smooth(seg(t, CH.pascal + 2.5, CH.pascal + 3.5)) } : null)} />
          <LiveTag tone="red" get={(t) => (t >= CH.pascal + 1.2 && t < CH.arch ? { pos: [-JACK.gap / 2 + 0.2, JACK.y0 + 0.55 - jackY(t).d1, 0], opacity: seg(t, CH.pascal + 1.2, CH.pascal + 2) } : null)}>
            F₁ = 100 Н
          </LiveTag>
          <LiveTag tone="brand" get={(t) => (t >= CH.pascal + 2.7 && t < CH.arch ? { pos: [JACK.gap / 2 + 0.25, JACK.y0 + 0.95 + jackY(t).d2, 0], opacity: seg(t, CH.pascal + 2.7, CH.pascal + 3.5) } : null)}>
            F₂ = 400 Н
          </LiveTag>
        </group>
      </group>

      {/* ---- Archimedes ---- */}
      <group position={[ARCH_X, 0.02, 0]}>
        <RetortStand />
      </group>
      <group position={[armX, ARM_Y, 0]}>
        <SpringBalance ref={bal} travel={TRAVEL} />
      </group>
      <group ref={block} position={[armX, 0.7, 0]}>
        <mesh position={[0, BLOCK / 2, 0]} castShadow>
          <boxGeometry args={[BLOCK, BLOCK, BLOCK]} />
          <meshStandardMaterial color="#aab4c3" metalness={0.85} roughness={0.3} />
        </mesh>
        <mesh position={[0, BLOCK + 0.027, 0]}>
          <cylinderGeometry args={[0.002, 0.002, 0.056, 6]} />
          <meshStandardMaterial color="#e5e7eb" />
        </mesh>
      </group>
      <group ref={tank} position={[armX, TANK_Y0, 0]}>
        <GlassTank />
        {/* lab jack under the tank */}
        <mesh position={[0, -0.016, 0]} castShadow>
          <boxGeometry args={[0.4, 0.03, 0.4]} />
          <meshStandardMaterial color="#1f47e6" roughness={0.5} />
        </mesh>
        <mesh position={[0, -(TANK_Y0 + 0.02) / 2 - 0.03, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, TANK_Y0 + 0.02, 16]} />
          <meshStandardMaterial color="#c9d1dc" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>
      <mesh position={[armX, 0.03, 0]} receiveShadow castShadow>
        <boxGeometry args={[0.5, 0.04, 0.5]} />
        <meshStandardMaterial color="#1b202b" metalness={0.5} roughness={0.55} />
      </mesh>
      <Arrow color={Q.weight} radius={0.006} get={(t) => (t >= CH.arch + 0.5 && t < CH.float ? { origin: [armX + 0.1, archState(t).bottom + BLOCK / 2, 0.03], dir: [0, -1, 0], len: 0.01 * W_BLOCK } : null)} />
      <Arrow color={Q.normal} radius={0.006} get={(t) => (t >= CH.arch + 0.5 && t < CH.float && archState(t).buoy > 0.2 ? { origin: [armX + 0.1, archState(t).bottom + BLOCK / 2, 0.03], dir: [0, 1, 0], len: 0.01 * archState(t).buoy } : null)} />
      <LiveTag tone="brand" text={(t) => `динамометр: ${num(archState(t).reading, 1)} Н`} get={(t) => (t >= CH.arch + 0.3 && t < CH.float ? { pos: [armX + 0.05, ARM_Y - 0.37, 0.0], opacity: seg(t, CH.arch + 0.3, CH.arch + 1.2) } : null)}>
        F
      </LiveTag>
      <LiveTag tone="red" text={(t) => `Fₐ = ${num(archState(t).buoy, 1)} Н`} get={(t) => (t >= CH.arch + 1 && t < CH.float ? { pos: [armX - 0.2, archState(t).bottom + 0.0, 0.0], opacity: seg(t, CH.arch + 1, CH.arch + 1.8) } : null)}>
        F
      </LiveTag>

      {/* ---- the ship in its test tank ---- */}
      <group position={[SHIP_X, SHIP_Y, 0]}>
        <ShipTank />
        <group ref={ship}>
          <ShipHull>
            {LOADS.map((l, i) => (
              <group key={i} ref={(g) => { cargo.current[i] = g; }} visible={false}>
                <ContainerStack index={i} />
              </group>
            ))}
          </ShipHull>
        </group>
        <LiveTag
          tone="brand"
          text={(t) => `d = ${num(draft(t), 2)} м`}
          get={(t) => (t >= CH.float + 0.5 && t < CH.outro ? { pos: [SHIP.L / 2 + 5, 0.4, 0], opacity: seg(t, CH.float + 0.5, CH.float + 1.5) } : null)}
        >
          d
        </LiveTag>
        <Arrow color={Q.normal} radius={0.35} get={(t) => (t >= CH.float + 1 && t < CH.outro ? { origin: [12, -draft(t) + 0.5, SHIP.B / 2 + 0.5], dir: [0, 1, 0], len: 5 + (shipMass(t) - M_HULL) / 150_000 * 0.9 } : null)} />
        <Arrow color={Q.weight} radius={0.35} get={(t) => (t >= CH.float + 1 && t < CH.outro ? { origin: [-12, SHIP.H * 0.5, SHIP.B / 2 + 0.5], dir: [0, -1, 0], len: 5 + (shipMass(t) - M_HULL) / 150_000 * 0.9 } : null)} />
        <LiveTag tone="green" get={(t) => (t >= CH.float + 1.4 && t < CH.outro ? { pos: [12, 4.5 + (shipMass(t) - M_HULL) / 150_000 * 0.9 - draft(t), SHIP.B / 2 + 0.5], opacity: seg(t, CH.float + 1.4, CH.float + 2.2) } : null)}>
          Fₐ
        </LiveTag>
        <LiveTag tone="amber" get={(t) => (t >= CH.float + 1.4 && t < CH.outro ? { pos: [-12, SHIP.H * 0.5 - 6 - (shipMass(t) - M_HULL) / 150_000 * 0.9, SHIP.B / 2 + 0.5], opacity: seg(t, CH.float + 1.4, CH.float + 2.2) } : null)}>
          mg
        </LiveTag>
      </group>
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const j = jackY(t);
  const a = archState(t);
  const m = shipMass(t) / 1000; // tonnes
  const V = shipMass(t) / RHO; // m³
  return (
    <>
      <Dip t={t} at={CH.pascal} />
      <Dip t={t} at={CH.arch} />
      <Dip t={t} at={CH.float} />

      <Card t={t} from={0.8} to={CH.pascal} place={{ right: "2.2cqw", top: "14cqh" }} title="Қысым">
        <Formula note="Па = Н/м²">P = F / S</Formula>
        {t > CH.pressure + 0.5 && (
          <div style={{ marginTop: "0.4cqw" }}>
            <Row label="F = mg (2 кг)" value="19,6" unit="Н" color={Q.weight} />
          </div>
        )}
      </Card>

      <Card t={t} from={CH.pascal + 0.5} to={CH.arch} place={{ right: "2.2cqw", top: "14cqh" }} title="Паскаль заңы" width="34cqw">
        <Formula small>F₁/S₁ = F₂/S₂</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="S₂ / S₁" value="4" unit="" />
          <Row label="P = F₁/S₁" value={num(F1 / S1 / 1000, 1)} unit="кПа" color={Q.momentum} />
          <Row label="F₂ = F₁·S₂/S₁" value="400" unit="Н" color={Q.normal} />
        </div>
      </Card>
      <Card t={t} from={CH.pascalB + 2.5} to={CH.arch} place={{ left: "2.2cqw", top: "17cqh" }} title="Жұмыс сақталады" width="30cqw">
        <Row label="d₁" value={num(j.d1 * 100, 0)} unit="см" color={Q.force} />
        <Row label="d₂ = d₁/4" value={num(j.d2 * 100, 1)} unit="см" color={Q.normal} />
        <Row label="A₁ = F₁d₁" value={num(F1 * j.d1, 0)} unit="Дж" color={Q.force} />
        <Row label="A₂ = F₂d₂" value={num(4 * F1 * j.d2, 0)} unit="Дж" color={Q.normal} />
      </Card>

      <Card t={t} from={CH.arch + 0.5} to={CH.float} place={{ right: "2.2cqw", top: "14cqh" }} title="Архимед күші" width="32cqw">
        <Formula note="ρ = 1000 кг/м³">Fₐ = ρ·g·V</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="V (батқан)" value={num(a.h * BLOCK * BLOCK * 1000, 2)} unit="л" />
          <Row label="Fₐ" value={num(a.buoy, 1)} unit="Н" color={Q.normal} />
          <Row label="динамометр = mg − Fₐ" value={num(a.reading, 1)} unit="Н" color={Q.weight} />
        </div>
      </Card>

      <Card t={t} from={CH.float + 0.5} to={CH.outro} place={{ right: "2.2cqw", top: "14cqh" }} title="Кеменің қалқуы" width="34cqw">
        <Formula note="қалқу шарты">mg = ρ·g·V</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="m (кеме + жүк)" value={num(m, 0)} unit="т" color={Q.weight} />
          <Row label="V (батқан)" value={num(V, 0)} unit="м³" color={Q.normal} />
          <Row label="d (тереңдік)" value={num(draft(t), 2)} unit="м" color="#0ea5e9" />
        </div>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson09: LessonScene = {
  moduleId: 9,
  script: S,
  cameraFollow: anchor,
  camera: [
    // bricks
    { t: 0, ...K([-1.2, 1.7, 2.4], [0, 1.0, 0]) },
    { t: 6.9, ...K([0.0, 1.5, 2.0], [0, 1.1, 0]) },
    { t: 7.1, ...K([0.0, 1.35, 1.8], [0, 1.12, 0]) },
    { t: 16.9, ...K([0.0, 1.35, 1.75], [0, 1.12, 0]) },
    // jack
    { t: 17.05, ...K([JACK_X + 0.05, 1.55, 3.0], [JACK_X, 1.45, 0]) },
    { t: 36.9, ...K([JACK_X + 0.05, 1.6, 2.9], [JACK_X, 1.45, 0]) },
    // Archimedes
    { t: 37.05, ...K([ARCH_X + 0.36, 1.0, 1.95], [ARCH_X + 0.29, 0.8, 0]) },
    { t: 56.9, ...K([ARCH_X + 0.36, 1.0, 1.95], [ARCH_X + 0.29, 0.8, 0]) },
    // ship
    { t: 57.05, ...K([SHIP_X - 8, SHIP_Y + 4, 56], [SHIP_X, SHIP_Y + 1.5, 0]) },
    { t: 76.9, ...K([SHIP_X + 6, SHIP_Y + 5, 54], [SHIP_X, SHIP_Y + 2, 0]) },
    { t: 77.05, ...K([SHIP_X + 20, SHIP_Y + 8, 62], [SHIP_X, SHIP_Y + 2, 0]) },
    { t: 85, ...K([SHIP_X - 18, SHIP_Y + 7, 60], [SHIP_X, SHIP_Y + 2, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#7fb2f0", horizon: "#e8f1fb" },
  light: { offset: [6, 14, 10], extent: 5, extentAt: (t) => (t < CH.float ? 5 : 48), follow: (t) => (t < CH.float ? lightAt(t) : [SHIP_X, SHIP_Y, 0]) },
  fog: { color: "#e6eef9", near: 120, far: 420 },
};
