"use client";

// Lesson 2 — Kinematics. One saloon car drives through the whole lesson:
// uniform motion past numbered posts, a standing start with a=2 m/s² while its
// graphs draw themselves, then the same run again with the distance laid on the
// tarmac, free fall from a 46 m tower, and a closing review of the three graphs.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Plot, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, clamp, seg, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { Car, CAR, CarGhost, type CarHandle } from "../objects/Car";
import { Arrow, Ground, Ribbon } from "../objects/common";
import { C, Q } from "../objects/materials";
import { DistancePosts, ROAD_Y, Road } from "../objects/Road";
import { TOWER_H, Tower } from "../objects/Tower";

const S = LESSON_SCRIPTS[2];
const at = (id: string) => chapterById(S, id);

// ---- physics ---------------------------------------------------------------
const G = 9.8;
const V_U = 15; // uniform speed, m/s
const A = 2; // acceleration of the standing starts, m/s²
const LANE_Z = 2;
const X0 = 300; // the start line
const TOWER_X = 1000;
const BALL_DROP_AT = [57.5, 64.6]; // release instants of the two drops
const T_FALL_A = Math.sqrt((2 * (TOWER_H + 0.1)) / G);

const CUT_ACCEL = at("accelA").from; // 21
const CUT_PATH = at("pathA").from; // 40
const CUT_FALL = at("fallA").from; // 55
const CUT_SUM = at("sumA").from; // 73

/** x of a car that starts from rest at τ=0 with acceleration A for tauMax s, then cruises. */
function run(tau: number, tauMax = Infinity) {
  if (tau <= 0) return 0;
  if (tau <= tauMax) return 0.5 * A * tau * tau;
  return 0.5 * A * tauMax * tauMax + A * tauMax * (tau - tauMax);
}

function carX(t: number): number {
  if (t < CUT_ACCEL) return V_U * (t - at("uniformA").from);
  if (t < CUT_PATH) return X0 + run(t - 23);
  if (t < CUT_FALL) return X0 + run(t - 42, 10);
  if (t < CUT_SUM) return X0;
  return X0 + run(t - 74, 12);
}
function carV(t: number): number {
  const d = 1e-3;
  return (carX(t + d) - carX(t - d)) / (2 * d);
}

const accelerating = (t: number) =>
  (t >= 23 && t < CUT_PATH) || (t >= 42 && t < 52) || (t >= 74 && t < 86);

const anchor = (t: number): Vec3 => (t >= CUT_FALL && t < CUT_SUM ? [TOWER_X, 0, 0] : [carX(t), 0, 0]);

// ---- falling balls -----------------------------------------------------------
const BALL_X = [TOWER_X + 3.6, TOWER_X + 6.0];
const R_STEEL = 0.9;
const R_FOAM = 1.4;
const R_SINGLE = 1.0;
const tauOf = (t: number, drop: number) => Math.max(0, t - BALL_DROP_AT[drop]);
const fallY = (tau: number, r: number) => Math.max(r, TOWER_H + 0.6 + r - 0.5 * G * tau * tau);

// ---- scene ----------------------------------------------------------------
function Ghost({ x }: { x: number }) {
  return (
    <group position={[x, ROAD_Y, LANE_Z]}>
      <CarGhost />
    </group>
  );
}

function World() {
  const car = useRef<THREE.Group>(null!);
  const carH = useRef<CarHandle>(null!);
  const ghosts = useRef<THREE.Group>(null!);
  const steel = useRef<THREE.Mesh>(null!);
  const foam = useRef<THREE.Mesh>(null!);
  const single = useRef<THREE.Mesh>(null!);
  const strobe = useRef<THREE.Group>(null!);

  useStudioFrame((t) => {
    const x = carX(t);
    car.current.position.set(x, ROAD_Y, LANE_Z);
    carH.current.setRoll(x / CAR.wheelR);

    // Stroboscopic ghosts, one per second of the uniform run.
    const u0 = at("uniformA").from;
    ghosts.current.children.forEach((g, i) => {
      g.visible = t < CUT_ACCEL && t >= u0 + i + 0.4;
    });

    // Galileo's demonstration: two unequal balls released together.
    const tau = tauOf(t, 0);
    steel.current.position.set(BALL_X[0], fallY(tau, R_STEEL), 0);
    foam.current.position.set(BALL_X[1], fallY(tau, R_FOAM), 0);

    steel.current.visible = foam.current.visible = t >= CUT_FALL && t < 63.5;
    single.current.visible = t >= 63.8 && t < CUT_SUM;

    // One ball, strobed every half second.
    const tau2 = tauOf(t, 1);
    single.current.position.set(BALL_X[0] + 0.9, fallY(tau2, R_SINGLE), 0);
    strobe.current.children.forEach((g, k) => {
      const tk = 0.5 * (k + 1);
      g.visible = t >= BALL_DROP_AT[1] && tau2 >= tk;
      g.position.set(BALL_X[0] + 0.9, fallY(tk, R_SINGLE), 0);
    });
  });

  return (
    <>
      <Ground size={3200} x={500} />
      <Road x0={-140} x1={660} />
      <DistancePosts from={0} step={15} count={16} z={-4.9} />
      {/* start line for the standing starts */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={i} position={[X0 - 0.5, ROAD_Y + 0.006, -3.8 + i * 0.4 + 0.2]} receiveShadow>
          <boxGeometry args={[0.8, 0.008, 0.4]} />
          <meshStandardMaterial color={i % 2 ? "#f8fafc" : "#111827"} />
        </mesh>
      ))}
      <DistancePosts from={X0} step={50} count={7} z={-4.9} origin={0} />

      <group ref={car}>
        <Car ref={carH} />
      </group>
      <group ref={ghosts}>
        {Array.from({ length: 14 }, (_, i) => (
          <Ghost key={i} x={V_U * i} />
        ))}
      </group>

      {/* v and a vectors riding on the car */}
      <Arrow
        color={Q.velocity}
        radius={0.07}
        get={(t) => {
          if (t >= CUT_FALL && t < CUT_SUM) return null;
          return { origin: [carX(t), 2.15, LANE_Z], dir: [1, 0, 0], len: carV(t) * 0.18 };
        }}
      />
      <LiveTag
        tone="green"
        get={(t) => (t >= CUT_FALL && t < CUT_SUM ? null : { pos: [carX(t) + carV(t) * 0.18 + 0.2, 2.2, LANE_Z] })}
      >
        v
      </LiveTag>
      <Arrow
        color={Q.acceleration}
        radius={0.07}
        get={(t) => (accelerating(t) ? { origin: [carX(t), 2.85, LANE_Z], dir: [1, 0, 0], len: A * 0.9 } : null)}
      />
      <LiveTag tone="amber" get={(t) => (accelerating(t) ? { pos: [carX(t) + A * 0.9 + 0.2, 2.9, LANE_Z] } : null)}>
        a
      </LiveTag>
      <Ribbon
        points={Array.from({ length: 201 }, (_, i) => [X0 + i * 0.5, LANE_Z] as [number, number])}
        width={0.55}
        y={ROAD_Y + 0.02}
        color="#f59e0b"
        progress={(t) => (t >= CUT_PATH && t < CUT_FALL ? clamp(run(t - 42, 10) / 100) : 0)}
      />

      {/* free fall */}
      <group position={[TOWER_X, 0, 0]}>
        <Tower showScale={1} />
      </group>
      <mesh ref={steel} castShadow>
        <sphereGeometry args={[R_STEEL, 40, 28]} />
        <meshStandardMaterial color="#59616f" metalness={0.9} roughness={0.22} />
      </mesh>
      <mesh ref={foam} castShadow>
        <sphereGeometry args={[R_FOAM, 40, 28]} />
        <meshStandardMaterial color="#fde68a" roughness={0.75} />
      </mesh>
      <mesh ref={single} castShadow>
        <sphereGeometry args={[R_SINGLE, 40, 28]} />
        <meshStandardMaterial color={C.paintRed} metalness={0.3} roughness={0.3} />
      </mesh>
      <group ref={strobe}>
        {Array.from({ length: 6 }, (_, k) => (
          <mesh key={k}>
            <sphereGeometry args={[R_SINGLE, 24, 16]} />
            <meshBasicMaterial color={C.paintRed} transparent opacity={0.3} depthWrite={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* velocity tags beside the strobe images at whole seconds */}
      <FallTags />
    </>
  );
}

function FallTags() {
  return (
    <>
      {[1, 2, 3].map((sec) => (
        <LiveTag
          key={sec}
          tone="green"
          get={(t) =>
            t >= BALL_DROP_AT[1] + sec && t < CUT_SUM
              ? { pos: [TOWER_X + 20, fallY(sec, R_SINGLE) - 0.4, 0], opacity: seg(t, BALL_DROP_AT[1] + sec, BALL_DROP_AT[1] + sec + 0.3) }
              : null
          }
        >
          {sec} с · {num(G * sec, 1)} м/с
        </LiveTag>
      ))}
    </>
  );
}

// ---- overlay ---------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const uA = at("uniformA");
  const tU = Math.max(0, t - uA.from);
  const tA = Math.max(0, t - 23);
  const tP = Math.max(0, t - 42);
  const tS = Math.max(0, t - 74);
  const tf = (drop: number) => Math.min(Math.max(0, t - BALL_DROP_AT[drop]), T_FALL_A);
  const x = carX(t);

  return (
    <>
      <Dip t={t} at={CUT_ACCEL} />
      <Dip t={t} at={CUT_PATH} />
      <Dip t={t} at={CUT_FALL} />
      <Dip t={t} at={CUT_SUM} />

      {/* uniform motion */}
      <Card t={t} from={uA.from} to={CUT_ACCEL} place={{ right: "2.2cqw", top: "3.4cqh" }} title="Секундомер">
        <Row label="t" value={num(tU, 1)} unit="с" />
        <Row label="x" value={num(Math.max(0, x), 0)} unit="м" color={Q.velocity} />
        <Row label="v" value="15" unit="м/с" color={Q.velocity} />
      </Card>
      <Card t={t} from={at("uniformB").from} to={CUT_ACCEL} place={{ left: "2.2cqw", top: "17cqh" }} title="x–t графигі" width="27.4cqw">
        <Plot
          lines={[{ fn: (s) => V_U * s, color: Q.velocity }]}
          x1={14}
          y1={210}
          xTicks={7}
          yTicks={3}
          cursor={tU}
          xLabel="t, с"
          yLabel="x, м"
          w={24}
          h={12.5}
        />
      </Card>
      <Card t={t} from={at("uniformB").from} to={CUT_ACCEL} place={{ right: "2.2cqw", top: "24cqh" }}>
        <Formula note="x₀ = 0">x = x₀ + v·t</Formula>
      </Card>

      {/* standing start */}
      <Card t={t} from={CUT_ACCEL + 0.5} to={CUT_PATH} place={{ right: "2.2cqw", top: "3.4cqh" }} title="Тахометр">
        <Row label="t" value={num(tA, 1)} unit="с" />
        <Row label="v" value={num(carV(t), 1)} unit="м/с" color={Q.velocity} />
        <Row label="a" value={tA > 0 ? "2,0" : "0,0"} unit="м/с²" color={Q.acceleration} />
      </Card>
      <Card t={t} from={at("accelA").from + 2} to={CUT_PATH} place={{ left: "2.2cqw", top: "17cqh" }} title="v–t графигі" width="27.4cqw">
        <Plot
          lines={[{ fn: (s) => A * s, color: Q.velocity }]}
          x1={16}
          y1={32}
          xTicks={4}
          yTicks={4}
          cursor={tA}
          xLabel="t, с"
          yLabel="v, м/с"
          w={24}
          h={12.5}
        />
      </Card>
      <Card t={t} from={at("accelA").from + 2} to={at("accelB").from} place={{ right: "2.2cqw", top: "24cqh" }}>
        <Formula note="үдеу">a = (v − v₀) / t</Formula>
      </Card>
      <Card t={t} from={at("accelB").from} to={CUT_PATH} place={{ right: "2.2cqw", top: "24cqh" }}>
        <Formula note="v₀ = 0">v = v₀ + a·t</Formula>
      </Card>

      {/* area under v–t */}
      <Card t={t} from={CUT_PATH + 0.5} to={CUT_FALL} place={{ right: "2.2cqw", top: "3.4cqh" }} title="Секундомер">
        <Row label="t" value={num(Math.min(tP, 10), 1)} unit="с" />
        <Row label="v" value={num(carV(t) > 20 ? 20 : carV(t), 1)} unit="м/с" color={Q.velocity} />
        <Row label="s" value={num(run(tP, 10), 1)} unit="м" color="#f59e0b" />
      </Card>
      <Card t={t} from={CUT_PATH + 0.5} to={CUT_FALL} place={{ left: "2.2cqw", top: "17cqh" }} title="Аудан = жол" width="27.4cqw">
        <Plot
          lines={[{ fn: (s) => A * s, color: Q.velocity, area: true }]}
          x1={12}
          y1={24}
          xTicks={6}
          yTicks={4}
          cursor={Math.min(tP, 10)}
          xLabel="t, с"
          yLabel="v, м/с"
          w={24}
          h={12.5}
        />
      </Card>
      <Card t={t} from={at("pathB").from} to={CUT_FALL} place={{ right: "2.2cqw", top: "24cqh" }}>
        <Formula note="v₀ = 0">s = v₀t + at²/2</Formula>
        <div style={{ fontSize: "1.6cqw", marginTop: "0.5cqw", color: "#334155", fontWeight: 600 }}>
          s = ½ · 2 · 10² = <b style={{ color: "#b45309" }}>100 м</b>
        </div>
      </Card>

      {/* free fall */}
      <Card t={t} from={CUT_FALL + 0.5} to={CUT_SUM} place={{ right: "2.2cqw", top: "3.4cqh" }} title="Еркін түсу">
        {t < at("fallB").from ? (
          <>
            <Row label="t" value={num(tf(0), 2)} unit="с" />
            <Row label="g" value="9,8" unit="м/с²" color={Q.acceleration} />
          </>
        ) : (
          <>
            <Row label="t" value={num(tf(1), 2)} unit="с" />
            <Row label="v = gt" value={num(G * tf(1), 1)} unit="м/с" color={Q.velocity} />
            <Row label="h = gt²/2" value={num(0.5 * G * tf(1) ** 2, 1)} unit="м" color="#f59e0b" />
          </>
        )}
      </Card>
      <Card t={t} from={at("fallA").from + 1} to={at("fallB").from} place={{ left: "2.2cqw", top: "17cqh" }}>
        <div className="st-card-title">Галилей тәжірибесі</div>
        <div style={{ fontSize: "1.6cqw", lineHeight: 1.5, fontWeight: 600, color: "#334155" }}>
          <span style={{ color: "#475569" }}>● болат шар</span>
          <br />
          <span style={{ color: "#b45309" }}>● жеңіл көбік шар</span>
          <br />
          екеуі бірге жерге тиеді
        </div>
      </Card>
      <Card t={t} from={at("fallB").from} to={CUT_SUM} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula note="g ≈ 9,8 м/с²">v = g·t</Formula>
        <Formula>h = g·t² / 2</Formula>
      </Card>

      {/* review */}
      {[
        { id: "x", title: "x–t", fn: (s: number) => 0.5 * A * s * s, y1: 150, yl: "x, м", color: "#f59e0b", left: "2.2cqw" },
        { id: "v", title: "v–t", fn: (s: number) => A * s, y1: 24, yl: "v, м/с", color: Q.velocity, left: "27.6cqw" },
        { id: "a", title: "a–t", fn: () => A, y1: 4, yl: "a, м/с²", color: Q.acceleration, left: "53cqw" },
      ].map((g) => (
        <Card key={g.id} t={t} from={CUT_SUM + 0.6} to={at("sumB").to} place={{ left: g.left, top: "17cqh" }} title={g.title} width="22.2cqw">
          <Plot lines={[{ fn: g.fn, color: g.color }]} x1={12} y1={g.y1} xTicks={4} yTicks={g.id === "a" ? 2 : 3} cursor={Math.min(Math.max(0, tS - 1), 12)} xLabel="t, с" yLabel={g.yl} w={19.6} h={11} />
        </Card>
      ))}
    </>
  );
}

const keys = (rel: Vec3, tgt: Vec3) => ({ pos: rel, target: tgt });

export const lesson02: LessonScene = {
  moduleId: 2,
  script: S,
  cameraFollow: anchor,
  camera: [
    // intro: glide alongside the car
    { t: 0, ...keys([-5, 1.7, 10.5], [0.5, 0.9, 2]) },
    { t: 7, ...keys([5, 2.1, 10], [0, 1.0, 2]) },
    // uniform motion: wider and higher, so the posts read; car in the left third
    { t: 7.5, ...keys([1, 2.6, 12.5], [1.6, 1.0, 1]) },
    { t: 21, ...keys([2, 3.0, 13], [2.6, 1.0, 1]) },
    // standing start: cut to the start line, low and close
    { t: 21.05, ...keys([-7, 1.5, 9], [1, 0.9, 2]) },
    { t: 29, ...keys([-3, 2.2, 11], [4, 1.1, 1]) },
    { t: 39.9, ...keys([-2, 2.6, 13], [5, 1.1, 1]) },
    // replay from above, ribbon behind the car
    { t: 40.05, ...keys([9, 10, 12], [-3, 0.5, 2]) },
    { t: 54.9, ...keys([13, 11, 14], [-6, 0.5, 2]) },
    // free-fall tower: wide, balls released at the top, a slow push-in
    { t: 55.05, ...keys([-2, 14, 104], [6, 19, 0]) },
    { t: 64, ...keys([2, 14, 100], [8, 19, 0]) },
    { t: 72.9, ...keys([4, 14, 94], [9, 19, 0]) },
    // review: the car pulls away while the three graphs draw
    { t: 73.05, ...keys([-4, 1.2, 12], [4, 2.4, 2]) },
    { t: 89, ...keys([7, 1.8, 11], [1, 2.0, 2]) },
  ],
  World,
  Overlay,
  sky: { top: "#6ea8ee", horizon: "#e6f0fb" },
  light: { offset: [14, 22, 12], extent: 22, follow: (t) => anchor(t) },
  fog: { color: "#e3eefb", near: 90, far: 430 },
};
