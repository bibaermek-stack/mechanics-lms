"use client";

// Lesson 7 — Rotation. A Ferris wheel for period, ω, v = ωR and a = ω²R; a
// carousel for the radius dependence; and a disc racing a ring down a ramp for
// moment of inertia.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { Arrow, Ground, Paving, Tree } from "../objects/common";
import { Q } from "../objects/materials";
import { Carousel, CAROUSEL, FerrisWheel, HORSE_THETA, RollingDisc, RollingRing, WHEEL } from "../objects/Rotation";

const S = LESSON_SCRIPTS[7];
const at = (id: string) => chapterById(S, id);
const G = 9.8;

const CH = {
  period: at("period").from,
  omega: at("omega").from,
  accel: at("accel").from,
  radius: at("radius").from,
  inertia: at("inertia").from,
  race: at("race").from,
  outro: at("outro").from,
};

const CAR_X = 90;
const RAMP_X = 170;

// ---- Ferris wheel -----------------------------------------------------------
const T_WHEEL = 20;
const OMEGA = (2 * Math.PI) / T_WHEEL;
const V_RIM = OMEGA * WHEEL.R;
const A_RIM = OMEGA * OMEGA * WHEEL.R;
const SPEED_UP = 4;
/** Simulated seconds on the wheel: sped up ×4 during the "period" chapter only. */
const simT = (t: number) => (t < CH.period ? t : t < CH.omega ? CH.period + SPEED_UP * (t - CH.period) : CH.period + SPEED_UP * (CH.omega - CH.period) + (t - CH.omega));
const phi = (t: number) => OMEGA * simT(t);

// ---- carousel ---------------------------------------------------------------
const T_CAR = 8;
const OMEGA_C = (2 * Math.PI) / T_CAR;
const psi = (t: number) => OMEGA_C * t;
const HORSE_R = [2, 4];

// ---- ramp -------------------------------------------------------------------
const ALPHA = (20 * Math.PI) / 180;
const L_RAMP = 10;
const R_BODY = 0.4;
const A_DISC = ((G * Math.sin(ALPHA)) / 1.5);
const A_RING = ((G * Math.sin(ALPHA)) / 2);
const T_RELEASE = CH.race + 1;
const sOf = (t: number, a: number) => Math.min(L_RAMP, 0.5 * a * Math.max(0, t - T_RELEASE) ** 2);
const T_DISC = Math.sqrt((2 * L_RAMP) / A_DISC);
const T_RING = Math.sqrt((2 * L_RAMP) / A_RING);
const RAMP_A: [number, number] = [-4.7, L_RAMP * Math.sin(ALPHA)];
const bodyPos = (s: number): [number, number] => [RAMP_A[0] + s * Math.cos(ALPHA) + R_BODY * Math.sin(ALPHA), RAMP_A[1] - s * Math.sin(ALPHA) + R_BODY * Math.cos(ALPHA)];

const avgS = (t: number) => (sOf(t, A_DISC) + sOf(t, A_RING)) / 2;
/** On the ramp the camera rides along with the two bodies. */
const anchor = (t: number): Vec3 => {
  if (t < CH.inertia || t >= CH.outro) return [0, 0, 0];
  const [x, y] = bodyPos(avgS(t));
  return [RAMP_X + x, y, 0];
};

// ---- helpers ----------------------------------------------------------------
function AngleArc() {
  const mesh = useRef<THREE.Mesh>(null!);
  useStudioFrame((t) => {
    const a = ((phi(t) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    mesh.current.geometry.dispose();
    mesh.current.geometry = new THREE.RingGeometry(3.2, 3.6, 64, 1, 0, Math.max(0.02, a));
    mesh.current.visible = t >= CH.omega && t < CH.radius;
  });
  return (
    <mesh ref={mesh} position={[0, WHEEL.hubY, 1.6]}>
      <ringGeometry args={[3.2, 3.6, 8, 1, 0, 1]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const rimPoint = (t: number): Vec3 => [WHEEL.R * Math.cos(phi(t)), WHEEL.hubY + WHEEL.R * Math.sin(phi(t)), 1.6];

function World() {
  const disc = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Group>(null!);
  const radiusLine = useRef<THREE.Mesh>(null!);

  useStudioFrame((t) => {
    const sD = sOf(t, A_DISC);
    const sR = sOf(t, A_RING);
    const [dx, dy] = bodyPos(sD);
    const [rx, ry] = bodyPos(sR);
    disc.current.position.set(dx, dy, -1.1);
    disc.current.rotation.z = -sD / R_BODY;
    ring.current.position.set(rx, ry, 1.1);
    ring.current.rotation.z = -sR / R_BODY;

    // radius line from the hub to the highlighted gondola attach point
    const p = rimPoint(t);
    const ang = phi(t);
    radiusLine.current.visible = t >= CH.omega && t < CH.radius;
    radiusLine.current.position.set((p[0]) / 2, (WHEEL.hubY + p[1]) / 2, 1.6);
    radiusLine.current.rotation.z = ang + Math.PI / 2;
  });

  const tilt = -ALPHA;
  return (
    <>
      <Ground size={1200} x={80} />

      {/* ---- Ferris wheel ---- */}
      <Paving x={0} z={8} w={60} d={26} />
      <FerrisWheel phi={phi} highlight={0} />
      <mesh ref={radiusLine}>
        <boxGeometry args={[0.12, WHEEL.R, 0.1]} />
        <meshBasicMaterial color="#111827" toneMapped={false} />
      </mesh>
      <mesh position={[WHEEL.R / 2, WHEEL.hubY, 1.6]}>
        <boxGeometry args={[WHEEL.R, 0.1, 0.06]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.0} toneMapped={false} />
      </mesh>
      <AngleArc />
      <Arrow color={Q.velocity} radius={0.2} get={(t) => (t >= CH.omega + 3 && t < CH.radius ? { origin: rimPoint(t), dir: [-Math.sin(phi(t)), Math.cos(phi(t)), 0], len: 1.2 * V_RIM * smooth(seg(t, CH.omega + 3, CH.omega + 4)) } : null)} />
      <Arrow color={Q.acceleration} radius={0.2} get={(t) => (t >= CH.accel + 1 && t < CH.radius ? { origin: rimPoint(t), dir: [-Math.cos(phi(t)), -Math.sin(phi(t)), 0], len: 3 * A_RIM * smooth(seg(t, CH.accel + 1, CH.accel + 2)) } : null)} />
      <LiveTag tone="green" get={(t) => (t >= CH.omega + 3.4 && t < CH.radius ? { pos: [rimPoint(t)[0] + -Math.sin(phi(t)) * 1.2 * V_RIM + 0.3, rimPoint(t)[1] + Math.cos(phi(t)) * 1.2 * V_RIM + 0.4, 1.6], opacity: seg(t, CH.omega + 3.4, CH.omega + 4.2) } : null)}>
        v
      </LiveTag>
      <LiveTag tone="amber" get={(t) => (t >= CH.accel + 1.4 && t < CH.radius ? { pos: [rimPoint(t)[0] - Math.cos(phi(t)) * 3 * A_RIM * 0.9, rimPoint(t)[1] - Math.sin(phi(t)) * 3 * A_RIM * 0.9 + 0.4, 1.6], opacity: seg(t, CH.accel + 1.4, CH.accel + 2.2) } : null)}>
        a
      </LiveTag>
      <LiveTag tone="brand" get={(t) => (t >= CH.omega + 1 && t < CH.radius ? { pos: [WHEEL.R * 0.45 * Math.cos(phi(t)), WHEEL.hubY + WHEEL.R * 0.45 * Math.sin(phi(t)) + 0.6, 1.6], opacity: seg(t, CH.omega + 1, CH.omega + 2) } : null)}>
        R = 12 м
      </LiveTag>
      {[-26, -18, 18, 26, -36, 36].map((x, i) => (
        <Tree key={x} position={[x, 0, 14 + (i % 2) * 3]} scale={1.5} tone={i} />
      ))}

      {/* ---- carousel ---- */}
      <group position={[CAR_X, 0, 0]}>
        <Paving x={0} z={0} w={30} d={26} />
        <Carousel psi={psi} />
        {HORSE_R.map((r, i) => (
          <group key={r}>
            <Arrow
              color={Q.velocity}
              radius={0.09}
              get={(t) => {
                if (t < CH.radius + 2 || t >= CH.inertia) return null;
                const a = HORSE_THETA[i] + psi(t);
                const w = smooth(seg(t, CH.radius + 2, CH.radius + 3));
                return { origin: [r * Math.cos(a), 2.9, -r * Math.sin(a)], dir: [-Math.sin(a), 0, -Math.cos(a)], len: 1.5 * OMEGA_C * r * w };
              }}
            />
            <Arrow
              color={Q.acceleration}
              radius={0.09}
              get={(t) => {
                if (t < CH.radius + 4.5 || t >= CH.inertia) return null;
                const a = HORSE_THETA[i] + psi(t);
                const w = smooth(seg(t, CH.radius + 4.5, CH.radius + 5.5));
                return { origin: [r * Math.cos(a), 2.9, -r * Math.sin(a)], dir: [-Math.cos(a), 0, Math.sin(a)], len: 1.2 * OMEGA_C * OMEGA_C * r * w };
              }}
            />
            <LiveTag
              tone={i ? "red" : "brand"}
              get={(t) => {
                if (t < CH.radius + 1 || t >= CH.inertia) return null;
                const a = HORSE_THETA[i] + psi(t);
                return { pos: [r * Math.cos(a), 4.2, -r * Math.sin(a)], opacity: seg(t, CH.radius + 1, CH.radius + 2) };
              }}
            >
              R = {r} м
            </LiveTag>
          </group>
        ))}
        {[-14, -8, 9, 15].map((x, i) => (
          <Tree key={x} position={[x, 0, -11 - (i % 2) * 2]} scale={1.4} tone={i} />
        ))}
      </group>

      {/* ---- ramp with a disc and a ring ---- */}
      <group position={[RAMP_X, 0, 0]}>
        <Paving x={0} z={0} w={34} d={20} />
        <mesh position={[(RAMP_A[0] + RAMP_A[0] + (L_RAMP * Math.cos(ALPHA))) / 2 + 0.1 * Math.sin(ALPHA), (RAMP_A[1] + RAMP_A[1] - L_RAMP * Math.sin(ALPHA)) / 2 - 0.1 * Math.cos(ALPHA), 0]} rotation={[0, 0, tilt]} castShadow receiveShadow>
          <boxGeometry args={[L_RAMP, 0.2, 4.2]} />
          <meshStandardMaterial color="#c9a46a" roughness={0.6} />
        </mesh>
        {/* lane lines */}
        {[-1.1, 1.1].map((z) => (
          <mesh key={z} position={[(RAMP_A[0] + RAMP_A[0] + L_RAMP * Math.cos(ALPHA)) / 2 + 0.01 * Math.sin(ALPHA), (RAMP_A[1] + RAMP_A[1] - L_RAMP * Math.sin(ALPHA)) / 2 + 0.005, z]} rotation={[0, 0, tilt]}>
            <boxGeometry args={[L_RAMP, 0.01, 0.05]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        ))}
        {/* support frame */}
        {[RAMP_A[0] + 0.5, RAMP_A[0] + 5].map((x) => {
          // Stop short of the underside of the board, or the post shows through its surface.
          const h = RAMP_A[1] - (x - RAMP_A[0]) * Math.tan(ALPHA) - 0.3;
          return h < 0.2 ? null : (
            <mesh key={x} position={[x, h / 2, 0]} castShadow>
              <boxGeometry args={[0.3, h, 3.2]} />
              <meshStandardMaterial color="#8d97a6" roughness={0.7} />
            </mesh>
          );
        })}
        {/* the finishing cushion */}
        <mesh position={[RAMP_A[0] + L_RAMP * Math.cos(ALPHA) + 0.2, 0.3, 0]} castShadow>
          <boxGeometry args={[0.4, 0.6, 3.6]} />
          <meshStandardMaterial color="#374151" roughness={0.8} />
        </mesh>
        <group ref={disc}>
          <RollingDisc r={R_BODY} />
        </group>
        <group ref={ring}>
          <RollingRing r={R_BODY} />
        </group>
        <LiveTag tone="brand" get={(t) => (t >= CH.inertia + 0.4 && t < CH.outro ? { pos: [bodyPos(sOf(t, A_DISC))[0], bodyPos(sOf(t, A_DISC))[1] + 0.95, -1.1], opacity: seg(t, CH.inertia + 0.4, CH.inertia + 1.2) } : null)}>
          диск · I = ½mR²
        </LiveTag>
        <LiveTag tone="red" get={(t) => (t >= CH.inertia + 0.4 && t < CH.outro ? { pos: [bodyPos(sOf(t, A_RING))[0] - 0.4, bodyPos(sOf(t, A_RING))[1] + 0.6, 1.1], opacity: seg(t, CH.inertia + 0.4, CH.inertia + 1.2) } : null)}>
          сақина · I = mR²
        </LiveTag>
        {[-12, -6, 8, 13].map((x, i) => (
          <Tree key={x} position={[x, 0, -9 - (i % 2)]} scale={1.3} tone={i} />
        ))}
      </group>
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const revs = simT(t) / T_WHEEL;
  const sD = sOf(t, A_DISC);
  const sR = sOf(t, A_RING);
  const a = ((phi(t) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return (
    <>
      <Dip t={t} at={CH.radius} />
      <Dip t={t} at={CH.inertia} />
      <Dip t={t} at={CH.outro} />

      <Card t={t} from={CH.period + 0.5} to={CH.omega} place={{ right: "2.2cqw", top: "14cqh" }} title="Период және жиілік">
        <Formula note="T = 20 с">f = 1 / T</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="t (нақты)" value={num(simT(t) - CH.period, 0)} unit="с" />
          <Row label="айналым" value={num(revs - CH.period / T_WHEEL, 1)} unit="" color={Q.velocity} />
          <Row label="f = 1/T" value="0,05" unit="Гц" color={Q.acceleration} />
        </div>
      </Card>
      {t >= CH.period + 0.4 && t < CH.omega && (
        <div style={{ position: "absolute", left: "2.2cqw", top: "17cqh", padding: "0.6cqw 1.3cqw", borderRadius: "99cqw", background: "#f59e0b", color: "#1c1917", fontWeight: 800, fontSize: "1.6cqw" }}>
          ЖЫЛДАМДАТЫЛҒАН × 4
        </div>
      )}

      <Card t={t} from={CH.omega + 0.5} to={CH.radius} place={{ right: "2.2cqw", top: "14cqh" }} title="Бұрыштық жылдамдық">
        <Formula note="рад/с">ω = φ / t = 2π / T</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="φ" value={`${num((a * 180) / Math.PI, 0)}°`} unit="" color="#f59e0b" />
          <Row label="ω" value="0,31" unit="рад/с" color={Q.momentum} />
          {t > CH.omega + 3.5 && <Row label="v = ωR" value={num(V_RIM, 1)} unit="м/с" color={Q.velocity} />}
        </div>
      </Card>
      <Card t={t} from={CH.accel + 0.5} to={CH.radius} place={{ right: "2.2cqw", top: "47cqh" }} title="Центрге тартқыш үдеу">
        <Formula note="м/с²">a = v² / R = ω²R</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="a" value={num(A_RIM, 2)} unit="м/с²" color={Q.acceleration} />
        </div>
      </Card>

      <Card t={t} from={CH.radius + 0.5} to={CH.inertia} place={{ right: "2.2cqw", top: "14cqh" }} title="ω = 0,79 рад/с — екеуінде бірдей" width="34cqw">
        <Row label="R = 2 м: v" value={num(OMEGA_C * 2, 2)} unit="м/с" color={Q.velocity} />
        <Row label="R = 2 м: a" value={num(OMEGA_C * OMEGA_C * 2, 2)} unit="м/с²" color={Q.acceleration} />
        <Row label="R = 4 м: v" value={num(OMEGA_C * 4, 2)} unit="м/с" color={Q.velocity} />
        <Row label="R = 4 м: a" value={num(OMEGA_C * OMEGA_C * 4, 2)} unit="м/с²" color={Q.acceleration} />
      </Card>

      <Card t={t} from={CH.inertia + 0.5} to={CH.race} place={{ right: "2.2cqw", top: "14cqh" }} title="Инерция моменті" width="34cqw">
        <Row label="m = 2 кг, R = 0,4 м" value="" unit="" />
        <Row label="I (сақина) = mR²" value="0,32" unit="кг·м²" color="#ef4444" />
        <Row label="I (диск) = ½mR²" value="0,16" unit="кг·м²" color="#2563eb" />
      </Card>
      <Card t={t} from={CH.race + 0.5} to={CH.outro} place={{ right: "2.2cqw", top: "14cqh" }} title="Көлбеу жазықтық 20°" width="34cqw">
        <Row label="a (диск)" value={num(A_DISC, 2)} unit="м/с²" color="#2563eb" />
        <Row label="a (сақина)" value={num(A_RING, 2)} unit="м/с²" color="#ef4444" />
        {sD >= L_RAMP && <Row label="t (диск)" value={num(T_DISC, 2)} unit="с" color="#2563eb" />}
        {sR >= L_RAMP && <Row label="t (сақина)" value={num(T_RING, 2)} unit="с" color="#ef4444" />}
      </Card>
      <Card t={t} from={CH.race + 4} to={CH.outro} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula small>a = g·sinα / (1 + I/mR²)</Formula>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson07: LessonScene = {
  moduleId: 7,
  script: S,
  cameraFollow: anchor,
  camera: [
    // Ferris wheel
    { t: 0, ...K([-28, 7, 40], [0, 13, 0]) },
    { t: 6.9, ...K([-6, 9, 54], [0, 13.5, 0]) },
    { t: 7.1, ...K([0, 11.5, 56], [0, 13.5, 0]) },
    { t: 33.9, ...K([2, 11.5, 54], [0, 13.5, 0]) },
    // carousel
    { t: 34.05, ...K([CAR_X - 2, 12, 11], [CAR_X, 1.2, 0]) },
    { t: 43.9, ...K([CAR_X + 3, 12.5, 10], [CAR_X, 1.2, 0]) },
    // ramp: from the uphill end, so the board's surface and both lanes stay in view
    { t: 44.05, ...K([-3.4, 3.0, 8.4], [1.6, -0.2, 0]) },
    { t: 55.9, ...K([-3.4, 3.0, 8.4], [1.6, -0.2, 0]) },
    { t: 56.1, ...K([-3.2, 3.2, 9.6], [1.8, -0.5, 0]) },
    { t: 67.9, ...K([-3.2, 3.2, 9.6], [1.8, -0.5, 0]) },
    // outro: back at the wheel
    { t: 68.05, ...K([-20, 8, 46], [0, 13, 0]) },
    { t: 76, ...K([14, 11, 56], [0, 13.5, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#6ea8ee", horizon: "#e6f0fb" },
  light: {
    offset: [14, 24, 14],
    extent: 22,
    follow: (t) => (t < CH.radius ? [0, 6, 0] : t < CH.inertia ? [CAR_X, 1, 0] : t < CH.outro ? [RAMP_X + bodyPos(avgS(t))[0], 0.5, 0] : [0, 6, 0]),
  },
  fog: { color: "#e3eefb", near: 90, far: 420 },
};

