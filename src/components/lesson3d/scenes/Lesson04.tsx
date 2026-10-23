"use client";

// Lesson 4 — Newton's three laws. Inertia with a coin, a card and a glass;
// F = ma with two scanned PASCO carts on dynamics tracks; action and reaction
// with two skaters pushing off from each other.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Plot, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, lerp, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { PascoModel } from "@/components/simulation/core/PascoModel";
import { PASCO } from "@/components/simulation/core/pascoCatalog";
import { BENCH_H, DynamicsTrack, LabBench, TRACK_H, TRACK_L } from "@/components/simulation/lab/equipment";
import { Arrow, Ground, Paving } from "../objects/common";
import { Figure, type FigureHandle } from "../objects/Figure";
import { Q } from "../objects/materials";

const S = LESSON_SCRIPTS[4];
const at = (id: string) => chapterById(S, id);
const G = 9.8;

const CH = {
  first: at("firstA").from,
  second: at("secondA").from,
  secondB: at("secondB").from,
  third: at("thirdA").from,
  thirdB: at("thirdB").from,
  sum: at("sum").from,
};

// ---- places -----------------------------------------------------------------
const LAB_X = 30;
const RINK_X = 110;
const TABLE_TOP = 0.76;

// ---- law 1: the coin and the card ------------------------------------------
const FLICK = 15; // quick run
const REPLAY = 17.4; // slow-motion replay starts here
const SLOW = 0.12;
const GLASS_H = 0.12;
const GLASS_R = 0.046;
const COIN_R = 0.016;
const CARD_Y = TABLE_TOP + GLASS_H + 0.001;
const T_CLEAR = 0.03; // card has slid clear of the coin
const T_LAND = T_CLEAR + Math.sqrt((2 * (GLASS_H - 0.004)) / G);

/** Seconds of "action time" at film time t, and whether the replay is slowed. */
function flickClock(t: number): { tau: number; slow: boolean } {
  if (t < FLICK) return { tau: 0, slow: false };
  if (t < 16.9) return { tau: t - FLICK, slow: false };
  if (t < REPLAY) return { tau: 0, slow: false };
  return { tau: (t - REPLAY) * SLOW, slow: true };
}
const cardX = (tau: number) => 3.2 * tau;
const cardY = (tau: number) => (tau < 0.06 ? CARD_Y : Math.max(TABLE_TOP + 0.002, CARD_Y - 0.5 * G * (tau - 0.06) ** 2));
const coinY = (tau: number) => (tau < T_CLEAR ? CARD_Y + 0.0015 : Math.max(TABLE_TOP + 0.0015, CARD_Y + 0.0015 - 0.5 * G * (tau - T_CLEAR) ** 2));

// ---- law 2: two carts -------------------------------------------------------
const A_CART = { m: 0.5, z: -0.13 };
const B_CART = { m: 1.0, z: 0.13 };
const RUN1 = 32;
const RUN2 = 37;
const RESET = 36;
const X_START = 0.14;
const TRAVEL = 0.95;

interface Run {
  F1: number;
  F2: number;
  t0: number;
}
function cartRun(t: number): Run {
  return t < RESET ? { F1: 0.5, F2: 0.5, t0: RUN1 } : { F1: 0.5, F2: 1.0, t0: RUN2 };
}
function cartPos(t: number, m: number, F: number, t0: number) {
  const a = F / m;
  const tau = Math.max(0, t - t0);
  const s = Math.min(TRAVEL, 0.5 * a * tau * tau);
  const tStop = Math.sqrt((2 * TRAVEL) / a);
  const v = tau < tStop ? a * tau : 0;
  return { x: X_START + s, v, a, tau };
}

// ---- law 3: skaters ---------------------------------------------------------
const M1 = 60;
const M2 = 40;
const F_PUSH = 60;
const PUSH_T = 0.4;
const T_PUSH = 50.5;
const x1 = (t: number) => {
  const tau = Math.max(0, t - T_PUSH);
  const a = F_PUSH / M1;
  return tau <= PUSH_T ? -0.55 - 0.5 * a * tau * tau : -0.55 - 0.5 * a * PUSH_T ** 2 - a * PUSH_T * (tau - PUSH_T);
};
const x2 = (t: number) => {
  const tau = Math.max(0, t - T_PUSH);
  const a = F_PUSH / M2;
  return tau <= PUSH_T ? 0.55 + 0.5 * a * tau * tau : 0.55 + 0.5 * a * PUSH_T ** 2 + a * PUSH_T * (tau - PUSH_T);
};
const v1 = (t: number) => -(F_PUSH / M1) * Math.min(PUSH_T, Math.max(0, t - T_PUSH));
const v2 = (t: number) => (F_PUSH / M2) * Math.min(PUSH_T, Math.max(0, t - T_PUSH));

const anchor = (t: number): Vec3 => (t >= CH.third ? [RINK_X + (x1(t) + x2(t)) / 2, 0, 0] : [0, 0, 0]);

// ---- world ------------------------------------------------------------------
function Kitchen() {
  const card = useRef<THREE.Mesh>(null!);
  const coin = useRef<THREE.Mesh>(null!);
  useStudioFrame((t) => {
    const { tau } = flickClock(t);
    card.current.position.set(cardX(tau), cardY(tau), 0);
    card.current.rotation.z = tau < 0.06 ? 0 : -Math.min(1.2, (tau - 0.06) * 6);
    coin.current.position.set(0, coinY(tau), 0);
  });
  return (
    <group>
      <Paving x={0} z={0} w={12} d={10} color="#f1e6d0" />
      <mesh position={[0, 1.5, -2.2]} receiveShadow>
        <boxGeometry args={[12, 3, 0.2]} />
        <meshStandardMaterial color="#efe9de" roughness={0.95} />
      </mesh>
      {/* table */}
      <mesh position={[0, TABLE_TOP - 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.04, 0.9]} />
        <meshStandardMaterial color="#b98a55" roughness={0.6} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.68, (TABLE_TOP - 0.04) / 2, sz * 0.38]} castShadow>
            <boxGeometry args={[0.06, TABLE_TOP - 0.04, 0.06]} />
            <meshStandardMaterial color="#8d6638" roughness={0.7} />
          </mesh>
        ))
      )}
      {/* the glass */}
      <mesh position={[0, TABLE_TOP + GLASS_H / 2, 0]}>
        <cylinderGeometry args={[GLASS_R, GLASS_R * 0.88, GLASS_H, 40, 1, true]} />
        <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.28} roughness={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, TABLE_TOP + 0.002, 0]}>
        <cylinderGeometry args={[GLASS_R * 0.88, GLASS_R * 0.88, 0.004, 40]} />
        <meshPhysicalMaterial color="#cfe8ff" transparent opacity={0.45} roughness={0.05} />
      </mesh>
      {/* card (flicked away) and coin */}
      <mesh ref={card} position={[0, CARD_Y, 0]} castShadow>
        <boxGeometry args={[0.13, 0.0015, 0.085]} />
        <meshStandardMaterial color="#fbf7ee" roughness={0.8} />
      </mesh>
      <mesh ref={coin} position={[0, CARD_Y + 0.0015, 0]} castShadow>
        <cylinderGeometry args={[COIN_R, COIN_R, 0.002, 28]} />
        <meshStandardMaterial color="#d9a521" metalness={0.9} roughness={0.28} />
      </mesh>
      {/* labels */}
      <LiveTag tone="amber" get={(t) => (t >= 9 && t < CH.second ? { pos: [0, CARD_Y + 0.05, 0], opacity: seg(t, 9, 10) } : null)}>
        теңге
      </LiveTag>
      <LiveTag tone="brand" get={(t) => (t >= 10.5 && t < CH.second ? { pos: [-0.075, CARD_Y - 0.015, 0.035], opacity: seg(t, 10.5, 11.5) } : null)}>
        карта
      </LiveTag>
      <LiveTag tone="green" get={(t) => (t >= 12 && t < CH.second ? { pos: [0.065, TABLE_TOP + 0.04, 0.03], opacity: seg(t, 12, 13) } : null)}>
        стақан
      </LiveTag>
    </group>
  );
}

function Lab() {
  const cartA = useRef<THREE.Group>(null!);
  const cartB = useRef<THREE.Group>(null!);
  const CART_Y = BENCH_H + TRACK_H;
  useStudioFrame((t) => {
    const r = cartRun(t);
    const a = cartPos(t, A_CART.m, r.F1, r.t0);
    const b = cartPos(t, B_CART.m, r.F2, r.t0);
    cartA.current.position.set(a.x, CART_Y, A_CART.z);
    cartB.current.position.set(b.x, CART_Y, B_CART.z);
  });
  const blocks = (n: number) =>
    Array.from({ length: n }, (_, i) => (
      <mesh key={i} position={[0, 0.076 + i * 0.026, 0]} castShadow>
        <boxGeometry args={[0.085, 0.025, 0.06]} />
        <meshStandardMaterial color="#b8a15a" metalness={0.75} roughness={0.35} />
      </mesh>
    ));
  return (
    <group position={[LAB_X, 0, 0]}>
      <Paving x={0.5} z={0} w={26} d={16} y={0.0} />
      <mesh position={[0.5, 2.4, -4]} receiveShadow>
        <boxGeometry args={[26, 4.8, 0.2]} />
        <meshStandardMaterial color="#e8edf5" roughness={0.95} />
      </mesh>
      <LabBench from={-0.25} to={TRACK_L + 0.1} depth={0.7} />
      <DynamicsTrack z={A_CART.z} />
      <DynamicsTrack z={B_CART.z} />
      <group ref={cartA}>
        <PascoModel spec={PASCO.smartCart} />
        {blocks(1)}
      </group>
      <group ref={cartB}>
        <PascoModel spec={PASCO.smartCart} />
        {blocks(2)}
      </group>
      {/* the pulling forces */}
      {[A_CART, B_CART].map((c, i) => (
        <Arrow
          key={i}
          color={Q.force}
          radius={0.004}
          get={(t) => {
            if (t < CH.second + 3 || t >= CH.third) return null;
            const r = cartRun(t);
            const F = i === 0 ? r.F1 : r.F2;
            const p = cartPos(t, c.m, F, r.t0);
            return { origin: [p.x + 0.115, BENCH_H + TRACK_H + 0.06, c.z], dir: [1, 0, 0], len: 0.2 * F * smooth(seg(t, CH.second + 3, CH.second + 4)) };
          }}
        />
      ))}
      {[A_CART, B_CART].map((c, i) => (
        <group key={`tags${i}`}>
          <LiveTag
            tone="brand"
            text={() => `m = ${num(c.m, 1)} кг`}
            get={(t) => {
              if (t < CH.second + 1.5 || t >= CH.third) return null;
              const r = cartRun(t);
              const p = cartPos(t, c.m, i === 0 ? r.F1 : r.F2, r.t0);
              return { pos: [p.x, BENCH_H + TRACK_H + 0.17, c.z], opacity: seg(t, CH.second + 1.5, CH.second + 2.5) };
            }}
          >
            m
          </LiveTag>
          <LiveTag
            tone="red"
            text={(t) => `F = ${num(i === 0 ? cartRun(t).F1 : cartRun(t).F2, 1)} Н`}
            get={(t) => {
              if (t < CH.second + 3 || t >= CH.third) return null;
              const r = cartRun(t);
              const F = i === 0 ? r.F1 : r.F2;
              const p = cartPos(t, c.m, F, r.t0);
              return { pos: [p.x + 0.115 + 0.2 * F + 0.08, BENCH_H + TRACK_H + 0.08, c.z], opacity: seg(t, CH.second + 3, CH.second + 4) };
            }}
          >
            F
          </LiveTag>
        </group>
      ))}
    </group>
  );
}

function Rink() {
  const s1 = useRef<THREE.Group>(null!);
  const s2 = useRef<THREE.Group>(null!);
  const f1 = useRef<FigureHandle>(null!);
  const f2 = useRef<FigureHandle>(null!);
  useStudioFrame((t) => {
    s1.current.position.set(RINK_X + x1(t), 0.035, 0);
    s2.current.position.set(RINK_X + x2(t), 0.035, 0);
    // arms out and touching until the push, then they drop and the skaters glide
    const ease = smooth(seg(t, T_PUSH + 0.35, T_PUSH + 1.4));
    const arms = lerp(1.38, 0.15, ease);
    const elbow = lerp(0.35, 0.1, ease);
    const lean = lerp(0.06, 0.0, ease);
    f1.current?.setPose({ armL: arms, armR: arms, elbowL: elbow, elbowR: elbow, lean, legL: 0.03, legR: -0.03 });
    f2.current?.setPose({ armL: arms, armR: arms, elbowL: elbow, elbowR: elbow, lean, legL: 0.03, legR: -0.03 });
  });
  return (
    <group>
      {/* ice, boards and a centre line */}
      <mesh position={[RINK_X, 0.015, 0]} receiveShadow>
        <boxGeometry args={[70, 0.03, 36]} />
        <meshStandardMaterial color="#e3f3ff" roughness={0.12} metalness={0.12} />
      </mesh>
      <mesh position={[RINK_X, 0.032, 0]} receiveShadow>
        <boxGeometry args={[0.3, 0.004, 36]} />
        <meshStandardMaterial color="#d62839" roughness={0.5} />
      </mesh>
      <mesh position={[RINK_X, 0.033, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.3, 4.5, 64]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.5} />
      </mesh>
      <mesh position={[RINK_X, 0.6, -18]} castShadow receiveShadow>
        <boxGeometry args={[70, 1.2, 0.3]} />
        <meshStandardMaterial color="#f4f6fa" roughness={0.6} />
      </mesh>
      <mesh position={[RINK_X, 0.15, -17.84]}>
        <boxGeometry args={[70, 0.3, 0.04]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.6} />
      </mesh>
      {/* stands behind the boards */}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh key={i} position={[RINK_X, 1.4 + i * 0.9, -20 - i * 1.4]} receiveShadow castShadow>
          <boxGeometry args={[70, 0.8, 1.4]} />
          <meshStandardMaterial color={i % 2 ? "#6f8fd6" : "#5b7bc4"} roughness={0.9} />
        </mesh>
      ))}

      <group ref={s1}>
        <Figure ref={f1} skates shirt="#e11d48" pants="#1f2937" hair="#3b2a20" />
      </group>
      <group ref={s2} rotation={[0, Math.PI, 0]}>
        <Figure ref={f2} skates shirt="#2563eb" pants="#1f2937" hair="#d4a24a" />
      </group>

      {/* contact forces: equal and opposite */}
      <Arrow color={Q.force} radius={0.045} get={(t) => (t >= T_PUSH && t < T_PUSH + 2.2 ? { origin: [RINK_X + x2(t) - 0.55 + 0.02, 1.15, 0.25], dir: [1, 0, 0], len: 1.0 * smooth(seg(t, T_PUSH, T_PUSH + 0.15)) * (1 - smooth(seg(t, T_PUSH + 1.7, T_PUSH + 2.2))) } : null)} />
      <Arrow color={Q.acceleration} radius={0.045} get={(t) => (t >= T_PUSH && t < T_PUSH + 2.2 ? { origin: [RINK_X + x1(t) + 0.55 - 0.02, 1.15, 0.25], dir: [-1, 0, 0], len: 1.0 * smooth(seg(t, T_PUSH, T_PUSH + 0.15)) * (1 - smooth(seg(t, T_PUSH + 1.7, T_PUSH + 2.2))) } : null)} />
      <LiveTag tone="red" get={(t) => (t >= T_PUSH + 0.1 && t < T_PUSH + 2.2 ? { pos: [RINK_X + x2(t) + 0.25, 1.55, 0.25], opacity: 1 - smooth(seg(t, T_PUSH + 1.7, T_PUSH + 2.2)) } : null)}>
        F₂₁ = 60 Н
      </LiveTag>
      <LiveTag tone="amber" get={(t) => (t >= T_PUSH + 0.1 && t < T_PUSH + 2.2 ? { pos: [RINK_X + x1(t) - 0.25, 1.55, 0.25], opacity: 1 - smooth(seg(t, T_PUSH + 1.7, T_PUSH + 2.2)) } : null)}>
        F₁₂ = 60 Н
      </LiveTag>
      {/* velocities after the push */}
      <Arrow color={Q.velocity} radius={0.04} get={(t) => (t >= T_PUSH + 1 ? { origin: [RINK_X + x1(t), 2.05, 0], dir: [-1, 0, 0], len: 2.2 * Math.abs(v1(t)) } : null)} />
      <Arrow color={Q.velocity} radius={0.04} get={(t) => (t >= T_PUSH + 1 ? { origin: [RINK_X + x2(t), 2.05, 0], dir: [1, 0, 0], len: 2.2 * Math.abs(v2(t)) } : null)} />
      <LiveTag tone="brand" get={(t) => (t >= CH.third + 1 ? { pos: [RINK_X + x1(t), 2.35, 0], opacity: seg(t, CH.third + 1, CH.third + 2) } : null)}>
        m₁ = 60 кг
      </LiveTag>
      <LiveTag tone="brand" get={(t) => (t >= CH.third + 1 ? { pos: [RINK_X + x2(t), 2.35, 0], opacity: seg(t, CH.third + 1, CH.third + 2) } : null)}>
        m₂ = 40 кг
      </LiveTag>
    </group>
  );
}

function World() {
  return (
    <>
      <Ground size={600} x={30} />
      <Kitchen />
      <Lab />
      <Rink />
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const r = cartRun(t);
  const A = cartPos(t, A_CART.m, r.F1, r.t0);
  const B = cartPos(t, B_CART.m, r.F2, r.t0);
  const runT = Math.max(0, t - r.t0);
  const pushed = t > T_PUSH + PUSH_T;
  const slow = flickClock(t).slow && t >= CH.first && t < CH.second;
  return (
    <>
      <Dip t={t} at={CH.second} />
      <Dip t={t} at={RESET} />
      <Dip t={t} at={CH.third} />
      <Dip t={t} at={16.95} width={0.5} />

      {/* law 1 */}
      <Card t={t} from={CH.first + 1} to={CH.second} place={{ right: "2.2cqw", top: "14cqh" }} title="І заң · инерция">
        <Formula note="егер F = 0">v = const</Formula>
      </Card>
      {slow && (
        <div style={{ position: "absolute", left: "2.2cqw", top: "17cqh", padding: "0.6cqw 1.2cqw", borderRadius: "99cqw", background: "#f59e0b", color: "#1c1917", fontWeight: 800, fontSize: "1.5cqw" }}>
          БАЯУ КӨРСЕТУ × 0,12
        </div>
      )}

      {/* law 2 */}
      <Card t={t} from={CH.second + 0.5} to={CH.third} place={{ right: "2.2cqw", top: "14cqh" }} title="ІІ заң · F = ma">
        <Formula note="үдеу">a = F / m</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="арба 1: a = F/m" value={num(A.a, 1)} unit="м/с²" color={Q.acceleration} />
          <Row label="арба 2: a = F/m" value={num(B.a, 1)} unit="м/с²" color={Q.acceleration} />
        </div>
      </Card>
      <Card t={t} from={CH.secondB + 1} to={CH.third} place={{ left: "2.2cqw", top: "17cqh" }} title="v–t графигі" width="28cqw">
        <Plot
          lines={[
            { fn: (s) => s * A.a, color: Q.velocity, until: Math.sqrt((2 * TRAVEL) / A.a) },
            { fn: (s) => s * B.a, color: "#0ea5e9", until: Math.sqrt((2 * TRAVEL) / B.a) },
          ]}
          x1={2}
          y1={2}
          xTicks={4}
          yTicks={4}
          cursor={Math.min(runT, 2)}
          xLabel="t, с"
          yLabel="v, м/с"
          w={25}
          h={13}
        />
      </Card>

      {/* law 3 */}
      <Card t={t} from={CH.third + 0.5} to={CH.thirdB} place={{ right: "2.2cqw", top: "14cqh" }} title="ІІІ заң">
        <Formula note="әсер = −кері әсер">F₁₂ = −F₂₁</Formula>
      </Card>
      <Card t={t} from={T_PUSH + 1.5} to={CH.sum} place={{ right: "2.2cqw", top: "14cqh" }} title="Итергеннен кейін">
        <Row label="m₁ · v₁" value={`60 · ${num(Math.abs(v1(t)), 1)}`} unit="" color={Q.momentum} />
        <Row label="m₂ · v₂" value={`40 · ${num(Math.abs(v2(t)), 1)}`} unit="" color={Q.momentum} />
        <div style={{ fontSize: "1.9cqw", fontWeight: 800, color: "#0f1a45", marginTop: "0.4cqw" }}>{pushed ? "24 кг·м/с = 24 кг·м/с" : ""}</div>
      </Card>

      {/* summary */}
      <Card t={t} from={CH.sum + 0.5} to={68} place={{ left: "2.2cqw", top: "17cqh" }} title="Ньютон заңдары">
        <div style={{ fontSize: "1.9cqw", lineHeight: 1.7, fontWeight: 800, color: "#0f172a" }}>
          <div>1 · F = 0 ⇒ v = const</div>
          <div>2 · a = F / m</div>
          <div>3 · F₁₂ = −F₂₁</div>
        </div>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson04: LessonScene = {
  moduleId: 4,
  script: S,
  cameraFollow: anchor,
  camera: [
    // intro and law 1: close on the table
    { t: 0, ...K([-0.8, 1.15, 1.5], [0.0, 0.84, 0]) },
    { t: 6.9, ...K([0.2, 0.98, 0.62], [0.0, 0.83, 0]) },
    { t: 7.1, ...K([0.16, 0.95, 0.5], [0.0, 0.82, 0]) },
    { t: 20.9, ...K([0.15, 0.94, 0.48], [0.0, 0.82, 0]) },
    // law 2: the carts, from the front and above
    { t: 21.05, ...K([LAB_X + 0.56, 1.2, 1.3], [LAB_X + 0.56, 0.74, 0]) },
    { t: 39.9, ...K([LAB_X + 0.56, 1.2, 1.25], [LAB_X + 0.58, 0.74, 0]) },
    // law 3: the ice (relative to the skaters' midpoint)
    { t: 40.05, ...K([0, 1.7, 6.0], [0, 1.0, 0]) },
    { t: 50, ...K([0, 1.7, 6.0], [0, 1.0, 0]) },
    { t: 59.9, ...K([0, 2.6, 13.5], [0, 1.0, 0]) },
    { t: 68, ...K([3, 3.2, 15], [0, 1.0, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#7fb2f0", horizon: "#e8f1fb" },
  light: {
    offset: [5, 10, 7],
    extent: 9,
    follow: (t) => (t < CH.second ? [0, 0.8, 0] : t < CH.third ? [LAB_X + 0.6, 0.8, 0] : [RINK_X + (x1(t) + x2(t)) / 2, 0, 0]),
  },
  fog: { color: "#e6eef9", near: 70, far: 280 },
};

