"use client";

// Lesson 6 — Momentum. p = mv on a pool table, Newton's cradle (elastic
// collisions), two scanned PASCO carts that stick together (inelastic), and an
// oblique pool collision where the momentum vectors add back up.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { PascoModel } from "@/components/simulation/core/PascoModel";
import { PASCO } from "@/components/simulation/core/pascoCatalog";
import { BENCH_H, DynamicsTrack, LabBench, TRACK_H, TRACK_L } from "@/components/simulation/lab/equipment";
import { Arrow, Ground, Paving } from "../objects/common";
import { Q } from "../objects/materials";
import { Ball, BALL_R, CLOTH_Y, Cue, CRADLE, NewtonCradle, PoolTable, type BallHandle, type CradleHandle } from "../objects/Toys";

const S = LESSON_SCRIPTS[6];
const at = (id: string) => chapterById(S, id);

const CH = {
  vector: at("vector").from,
  cradle: at("cradleA").from,
  cradleB: at("cradleB").from,
  inel: at("inelA").from,
  inelB: at("inelB").from,
  law: at("law").from,
  outro: at("outro").from,
};

const LAB_X = 30;
const DESK_X = 60;
const BALL_Y = CLOTH_Y + BALL_R;
const M_BALL = 0.17;

// ---- chapter 1: the cue strikes a ball --------------------------------------
const V1 = 0.35;
const T_HIT = 1.3;
const ball1X = (t: number) => (t < T_HIT ? -0.9 : -0.9 + V1 * (t - T_HIT));
const cueTip = (t: number) => {
  const x0 = -0.9 - BALL_R;
  if (t < 0.7) return x0 - 0.3;
  if (t < T_HIT) return x0 - 0.3 * (1 - smooth(seg(t, 0.7, T_HIT)));
  return x0 + 0.05 * smooth(seg(t, T_HIT, T_HIT + 0.25));
};

// ---- chapter 2: two balls, same speed, different mass ------------------------
const V2 = 0.3;
const T2 = CH.vector + 0.4;
const ball2X = (t: number) => -1.0 + V2 * Math.max(0, t - T2);

// ---- chapters 3–4: Newton's cradle ------------------------------------------
const A_CRADLE = (38 * Math.PI) / 180;
const T_CR = 0.9;
function cradleAngles(t: number): number[] {
  const out = [0, 0, 0, 0, 0];
  const k = t < CH.cradleB ? 1 : 2;
  const t0 = k === 1 ? CH.cradle + 1 : CH.cradleB + 1;
  if (t < t0) {
    for (let i = 0; i < k; i++) out[i] = -A_CRADLE;
    return out;
  }
  const w = (2 * Math.PI) / T_CR;
  const tau = t - t0;
  const phase = tau % T_CR;
  if (phase < T_CR / 4 || phase >= (3 * T_CR) / 4) {
    const left = -A_CRADLE * Math.cos(w * tau);
    for (let i = 0; i < k; i++) out[i] = left;
  } else {
    const right = A_CRADLE * Math.sin(w * (tau - T_CR / 4));
    for (let i = 5 - k; i < 5; i++) out[i] = right;
  }
  return out;
}

// ---- chapters 5–6: sticking carts -------------------------------------------
const M_CART = 0.5;
const V_A = 0.4;
const T_RUN = CH.inel + 1.2;
const XB0 = 0.58;
const CART_LEN = 0.21;
const X_A0 = 0.14;
const T_CONTACT = T_RUN + (XB0 - CART_LEN - X_A0) / V_A;
function carts(t: number) {
  if (t < T_CONTACT) {
    const xa = X_A0 + V_A * Math.max(0, t - T_RUN);
    return { xa, xb: XB0, va: t < T_RUN ? 0 : V_A, vb: 0, stuck: false };
  }
  const v = V_A / 2;
  const xb = Math.min(1.0, XB0 + v * (t - T_CONTACT));
  const moving = XB0 + v * (t - T_CONTACT) < 1.0;
  return { xa: xb - CART_LEN, xb, va: moving ? v : 0, vb: moving ? v : 0, stuck: true };
}

// ---- chapter 7: oblique pool collision ---------------------------------------
const PHI = Math.PI / 6;
const V0 = 0.8;
const T_START = CH.law + 1.2;
const C_CONTACT: [number, number] = [-2 * BALL_R * Math.cos(PHI), -2 * BALL_R * Math.sin(PHI)];
const T_COLL = T_START + (C_CONTACT[0] - -0.9) / V0;
const VT = V0 * Math.cos(PHI); // target speed
const VC = V0 * Math.sin(PHI); // cue speed
const TAU0 = 1.2;
const slide = (dt: number) => TAU0 * (1 - Math.exp(-dt / TAU0));
const dirT: [number, number] = [Math.cos(PHI), Math.sin(PHI)];
const dirC: [number, number] = [Math.sin(PHI), -Math.cos(PHI)];
function poolBalls(t: number) {
  if (t < T_COLL) {
    return { cue: [t < T_START ? -0.9 : -0.9 + V0 * (t - T_START), C_CONTACT[1]], target: [0, 0], cueRoll: 0, tRoll: 0 };
  }
  const s = slide(t - T_COLL);
  return {
    cue: [C_CONTACT[0] + dirC[0] * VC * s, C_CONTACT[1] + dirC[1] * VC * s],
    target: [dirT[0] * VT * s, dirT[1] * VT * s],
    cueRoll: 0,
    tRoll: 0,
  };
}

const anchor = (): Vec3 => [0, 0, 0];

// ---- world ------------------------------------------------------------------
function PoolRoom() {
  const b1 = useRef<THREE.Group>(null!);
  const b1H = useRef<BallHandle>(null!);
  const bw = useRef<THREE.Group>(null!);
  const bwH = useRef<BallHandle>(null!);
  const bh = useRef<THREE.Group>(null!);
  const bhH = useRef<BallHandle>(null!);
  const cue = useRef<THREE.Group>(null!);
  const cueB = useRef<THREE.Group>(null!);
  const cueBH = useRef<BallHandle>(null!);
  const tgt = useRef<THREE.Group>(null!);
  const tgtH = useRef<BallHandle>(null!);

  useStudioFrame((t) => {
    // chapter 1
    const x1 = ball1X(t);
    b1.current.position.set(x1, BALL_Y, 0);
    b1H.current.setRoll((x1 + 0.9) / BALL_R);
    b1.current.visible = t < CH.vector;
    cue.current.position.set(cueTip(t), BALL_Y + 0.0, 0);
    cue.current.visible = t < CH.vector;

    // chapter 2
    const x2 = ball2X(t);
    bw.current.position.set(x2, BALL_Y, 0.2);
    bh.current.position.set(x2, BALL_Y, -0.2);
    bwH.current.setRoll((x2 + 1) / BALL_R);
    bhH.current.setRoll((x2 + 1) / BALL_R);
    const two = t >= CH.vector && t < CH.cradle;
    bw.current.visible = bh.current.visible = two;

    // chapter 7
    const p = poolBalls(t);
    cueB.current.position.set(p.cue[0], BALL_Y, p.cue[1]);
    tgt.current.position.set(p.target[0], BALL_Y, p.target[1]);
    cueBH.current.setRoll(p.cue[0] / BALL_R);
    tgtH.current.setRoll(p.target[0] / BALL_R);
    const pool = t >= CH.law;
    cueB.current.visible = tgt.current.visible = pool;
  });

  return (
    <group>
      <PoolTable />
      <group ref={b1}>
        <Ball ref={b1H} color="#f4f1e8" />
      </group>
      <group ref={cue}>
        <Cue />
      </group>
      <group ref={bw}>
        <Ball ref={bwH} color="#f4f1e8" />
      </group>
      <group ref={bh}>
        <Ball ref={bhH} color="#2f3a4c" metal />
      </group>
      <group ref={cueB}>
        <Ball ref={cueBH} color="#f4f1e8" />
      </group>
      <group ref={tgt}>
        <Ball ref={tgtH} color="#d32f2f" stripe />
      </group>

      {/* ch 1 and 2: momentum vectors */}
      <Arrow
        color={Q.momentum}
        radius={0.012}
        get={(t) => (t >= 2 && t < CH.vector ? { origin: [ball1X(t), BALL_Y + 0.07, 0], dir: [1, 0, 0], len: 8 * M_BALL * V1 * smooth(seg(t, 2, 2.8)) } : null)}
      />
      <Arrow color={Q.velocity} radius={0.008} get={(t) => (t >= CH.vector + 1.2 && t < CH.cradle ? { origin: [ball2X(t), BALL_Y + 0.12, 0.2], dir: [1, 0, 0], len: 1.4 * V2 * smooth(seg(t, CH.vector + 1.2, CH.vector + 1.8)) } : null)} />
      <Arrow color={Q.velocity} radius={0.008} get={(t) => (t >= CH.vector + 1.2 && t < CH.cradle ? { origin: [ball2X(t), BALL_Y + 0.12, -0.2], dir: [1, 0, 0], len: 1.4 * V2 * smooth(seg(t, CH.vector + 1.2, CH.vector + 1.8)) } : null)} />
      <Arrow color={Q.momentum} radius={0.012} get={(t) => (t >= CH.vector + 2.2 && t < CH.cradle ? { origin: [ball2X(t), BALL_Y + 0.07, 0.2], dir: [1, 0, 0], len: 8 * M_BALL * V2 * smooth(seg(t, CH.vector + 2.2, CH.vector + 3)) } : null)} />
      <Arrow color={Q.momentum} radius={0.012} get={(t) => (t >= CH.vector + 2.2 && t < CH.cradle ? { origin: [ball2X(t), BALL_Y + 0.07, -0.2], dir: [1, 0, 0], len: 8 * 2 * M_BALL * V2 * smooth(seg(t, CH.vector + 2.2, CH.vector + 3)) } : null)} />
      <LiveTag tone="brand" get={(t) => (t >= CH.vector + 0.6 && t < CH.cradle ? { pos: [ball2X(t) - 0.2, BALL_Y + 0.02, 0.2], opacity: seg(t, CH.vector + 0.6, CH.vector + 1.4) } : null)}>
        m = 0,17 кг
      </LiveTag>
      <LiveTag tone="brand" get={(t) => (t >= CH.vector + 0.6 && t < CH.cradle ? { pos: [ball2X(t) - 0.2, BALL_Y + 0.02, -0.2], opacity: seg(t, CH.vector + 0.6, CH.vector + 1.4) } : null)}>
        m = 0,34 кг
      </LiveTag>
      <LiveTag tone="green" text={() => "v = 0,35 м/с"} get={(t) => (t >= 2.8 && t < CH.vector ? { pos: [ball1X(t), BALL_Y + 0.3, 0], opacity: seg(t, 2.8, 3.6) } : null)}>
        v
      </LiveTag>

      {/* ch 7: the oblique collision */}
      <Arrow
        color={Q.momentum}
        radius={0.012}
        get={(t) => {
          if (t < T_START || t >= T_COLL + 2.6) return null;
          const p = poolBalls(t);
          const origin: [number, number, number] = t < T_COLL ? [p.cue[0], BALL_Y + 0.07, p.cue[1]] : [C_CONTACT[0], BALL_Y + 0.05, C_CONTACT[1]];
          return { origin, dir: [1, 0, 0], len: 6 * M_BALL * V0 };
        }}
      />
      <Arrow color={Q.momentum} radius={0.012} get={(t) => (t >= T_COLL + 0.05 && t < T_COLL + 9 ? { origin: [0, BALL_Y + 0.08, 0], dir: [dirT[0], 0, dirT[1]], len: 6 * M_BALL * VT } : null)} />
      <Arrow
        color="#0ea5e9"
        radius={0.012}
        get={(t) => (t >= T_COLL + 1.2 && t < T_COLL + 9 ? { origin: [6 * M_BALL * VT * dirT[0], BALL_Y + 0.08, 6 * M_BALL * VT * dirT[1]], dir: [dirC[0], 0, dirC[1]], len: 6 * M_BALL * VC * smooth(seg(t, T_COLL + 1.2, T_COLL + 1.8)) } : null)}
      />
      <Arrow color="#111827" radius={0.007} get={(t) => (t >= T_COLL + 2.2 && t < T_COLL + 9 ? { origin: [0, BALL_Y + 0.13, 0], dir: [1, 0, 0], len: 6 * M_BALL * V0 * smooth(seg(t, T_COLL + 2.2, T_COLL + 3)) } : null)} />
      <LiveTag tone="brand" get={(t) => (t >= T_START + 0.3 && t < T_COLL ? { pos: [poolBalls(t).cue[0], BALL_Y + 0.2, C_CONTACT[1]], opacity: seg(t, T_START + 0.3, T_START + 1) } : null)}>
        p₀
      </LiveTag>
      <LiveTag tone="brand" get={(t) => (t >= T_COLL + 0.6 && t < T_COLL + 9 ? { pos: [6 * M_BALL * VT * dirT[0] + 0.05, BALL_Y + 0.18, 6 * M_BALL * VT * dirT[1] * 0.5], opacity: seg(t, T_COLL + 0.6, T_COLL + 1.2) } : null)}>
        p₂′
      </LiveTag>
      <LiveTag tone="amber" get={(t) => (t >= T_COLL + 1.6 && t < T_COLL + 9 ? { pos: [6 * M_BALL * VT * dirT[0] + 0.3, BALL_Y + 0.18, 6 * M_BALL * VT * dirT[1] - 0.18], opacity: seg(t, T_COLL + 1.6, T_COLL + 2.2) } : null)}>
        p₁′
      </LiveTag>
      <LiveTag tone="red" get={(t) => (t >= T_COLL + 2.8 && t < T_COLL + 9 ? { pos: [0.5 * 6 * M_BALL * V0, BALL_Y + 0.2, -0.17], opacity: seg(t, T_COLL + 2.8, T_COLL + 3.4) } : null)}>
        p₁′ + p₂′ = p₀
      </LiveTag>
    </group>
  );
}

function Cradle() {
  const h = useRef<CradleHandle>(null!);
  useStudioFrame((t) => h.current.setAngles(cradleAngles(t)));
  return (
    <group position={[DESK_X, 0.76, 0]}>
      <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.04, 0.8]} />
        <meshStandardMaterial color="#b98a55" roughness={0.6} />
      </mesh>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.64, -0.38, sz * 0.34]} castShadow>
            <boxGeometry args={[0.06, 0.74, 0.06]} />
            <meshStandardMaterial color="#8d6638" roughness={0.7} />
          </mesh>
        ))
      )}
      <NewtonCradle ref={h} />
      <LiveTag tone="amber" get={(t) => (t >= CH.cradle + 0.2 && t < CH.cradle + 1 ? { pos: [-4 * CRADLE.r - Math.sin(A_CRADLE) * CRADLE.L, CRADLE.top - Math.cos(A_CRADLE) * CRADLE.L + 0.05, 0], opacity: seg(t, CH.cradle + 0.2, CH.cradle + 0.6) } : null)}>
        көтерілген шар
      </LiveTag>
    </group>
  );
}

function Lab() {
  const a = useRef<THREE.Group>(null!);
  const b = useRef<THREE.Group>(null!);
  const CART_Y = BENCH_H + TRACK_H;
  useStudioFrame((t) => {
    const c = carts(t);
    a.current.position.set(c.xa, CART_Y, 0);
    b.current.position.set(c.xb, CART_Y, 0);
  });
  const block = (
    <mesh position={[0, 0.076, 0]} castShadow>
      <boxGeometry args={[0.085, 0.025, 0.06]} />
      <meshStandardMaterial color="#b8a15a" metalness={0.75} roughness={0.35} />
    </mesh>
  );
  return (
    <group position={[LAB_X, 0, 0]}>
      <Paving x={0.5} z={0} w={26} d={16} y={0} />
      <mesh position={[0.5, 2.4, -4]} receiveShadow>
        <boxGeometry args={[26, 4.8, 0.2]} />
        <meshStandardMaterial color="#e8edf5" roughness={0.95} />
      </mesh>
      <LabBench from={-0.25} to={TRACK_L + 0.1} depth={0.5} />
      <DynamicsTrack />
      <group ref={a}>
        <PascoModel spec={PASCO.smartCart} />
        {block}
        {/* velcro pad on the front */}
        <mesh position={[0.108, 0.035, 0]}>
          <boxGeometry args={[0.012, 0.03, 0.05]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>
      </group>
      <group ref={b}>
        <PascoModel spec={PASCO.smartCart} />
        {block}
        <mesh position={[-0.108, 0.035, 0]}>
          <boxGeometry args={[0.012, 0.03, 0.05]} />
          <meshStandardMaterial color="#2563eb" />
        </mesh>
      </group>
      <Arrow color={Q.momentum} radius={0.004} get={(t) => (t >= CH.inel + 0.6 && t < CH.law ? { origin: [carts(t).xa, CART_Y + 0.14, 0], dir: [1, 0, 0], len: carts(t).va > 0 ? 0.8 * M_CART * carts(t).va * 2.2 : 0 } : null)} />
      <Arrow color={Q.momentum} radius={0.004} get={(t) => (t >= CH.inel + 0.6 && t < CH.law ? { origin: [carts(t).xb, CART_Y + 0.14, 0], dir: [1, 0, 0], len: carts(t).vb > 0 ? 0.8 * M_CART * carts(t).vb * 2.2 : 0 } : null)} />
      <LiveTag tone="brand" get={(t) => (t >= CH.inel + 0.4 && t < CH.law ? { pos: [carts(t).xa, CART_Y + 0.26, 0], opacity: seg(t, CH.inel + 0.4, CH.inel + 1) * (carts(t).stuck ? 0 : 1) } : null)}>
        m₁ = 0,5 кг
      </LiveTag>
      <LiveTag tone="brand" get={(t) => (t >= CH.inel + 0.4 && t < CH.law ? { pos: [carts(t).xb, CART_Y + 0.26, 0], opacity: seg(t, CH.inel + 0.4, CH.inel + 1) * (carts(t).stuck ? 0 : 1) } : null)}>
        m₂ = 0,5 кг
      </LiveTag>
      <LiveTag tone="amber" get={(t) => (t >= T_CONTACT && t < CH.law ? { pos: [(carts(t).xa + carts(t).xb) / 2, CART_Y + 0.26, 0], opacity: seg(t, T_CONTACT, T_CONTACT + 0.6) } : null)}>
        m = 1,0 кг
      </LiveTag>
    </group>
  );
}

function World() {
  return (
    <>
      <Ground size={600} x={30} />
      {/* pool hall */}
      <Paving x={0} z={0} w={14} d={10} color="#e8dcc6" />
      <mesh position={[0, 1.6, -3.6]} receiveShadow>
        <boxGeometry args={[14, 3.2, 0.2]} />
        <meshStandardMaterial color="#6e7f95" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.2, 0.55, 0.22, 28, 1, true]} />
        <meshStandardMaterial color="#1f6b4a" side={THREE.DoubleSide} roughness={0.5} />
      </mesh>
      <PoolRoom />
      <Lab />
      {/* the desk's room */}
      <Paving x={DESK_X} z={0} w={14} d={10} />
      <mesh position={[DESK_X, 2.4, -3.6]} receiveShadow>
        <boxGeometry args={[14, 4.8, 0.2]} />
        <meshStandardMaterial color="#dfe6f1" roughness={0.95} />
      </mesh>
      <Cradle />
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const c = carts(t);
  const pBefore = M_CART * V_A;
  const afterNow = t > T_CONTACT;
  const pPool = M_BALL * V0;
  return (
    <>
      <Dip t={t} at={CH.vector} width={0.6} />
      <Dip t={t} at={CH.cradle} />
      <Dip t={t} at={CH.cradleB} />
      <Dip t={t} at={CH.inel} />
      <Dip t={t} at={CH.law} />

      <Card t={t} from={0.8} to={CH.vector} place={{ right: "2.2cqw", top: "14cqh" }} title="Импульс">
        <Formula note="кг·м/с">p = m · v</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="m" value="0,17" unit="кг" />
          <Row label="v" value={num(t > T_HIT ? V1 : 0, 2)} unit="м/с" color={Q.velocity} />
          <Row label="p = mv" value={num(M_BALL * (t > T_HIT ? V1 : 0), 3)} unit="кг·м/с" color={Q.momentum} />
        </div>
      </Card>
      <Card t={t} from={CH.vector + 2} to={CH.cradle} place={{ right: "2.2cqw", top: "14cqh" }} title="Бірдей жылдамдық">
        <Row label="p₁ = 0,17 · 0,3" value="0,051" unit="кг·м/с" color={Q.momentum} />
        <Row label="p₂ = 0,34 · 0,3" value="0,102" unit="кг·м/с" color={Q.momentum} />
      </Card>

      <Card t={t} from={CH.cradle + 1} to={CH.inel} place={{ right: "2.2cqw", top: "14cqh" }} title="Серпімді соққы">
        <Formula note="сақталады">p, Eₖ = const</Formula>
        <div style={{ marginTop: "0.4cqw", fontSize: "1.55cqw", fontWeight: 700, color: "#334155" }}>
          {t < CH.cradleB ? "1 шар → 1 шар" : "2 шар → 2 шар"}
        </div>
      </Card>

      <Card t={t} from={CH.inel + 0.5} to={CH.inelB} place={{ right: "2.2cqw", top: "14cqh" }} title="Серпімсіз соққы">
        <Formula note="жабысады">m₁v = (m₁+m₂)v′</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="v" value={num(c.va || (afterNow ? 0 : 0), 2)} unit="м/с" color={Q.velocity} />
        </div>
      </Card>
      <Card t={t} from={CH.inelB} to={CH.law} place={{ right: "2.2cqw", top: "14cqh" }} title="Соққыға дейін → кейін" width="30cqw">
        <Row label="p" value={`${num(pBefore, 1)} → ${num(pBefore, 1)}`} unit="кг·м/с" color={Q.momentum} />
        <Row label="Eₖ" value="0,04 → 0,02" unit="Дж" color={Q.force} />
        <div style={{ marginTop: "0.4cqw", fontSize: "1.55cqw", fontWeight: 800, color: "#b91c1c" }}>энергияның 50 %-ы жылуға кетті</div>
      </Card>

      <Card t={t} from={CH.law + 0.5} to={CH.outro} place={{ right: "2.2cqw", top: "14cqh" }} title="Импульстің сақталу заңы" width="38cqw">
        <Formula small>m₁v₁ + m₂v₂ = m₁v₁′ + m₂v₂′</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="p₀" value={num(pPool, 3)} unit="кг·м/с" color={Q.momentum} />
          {t > T_COLL + 2.4 && <Row label="p₁′ + p₂′ (вектор)" value={num(pPool, 3)} unit="кг·м/с" color="#111827" />}
        </div>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson06: LessonScene = {
  moduleId: 6,
  script: S,
  cameraFollow: anchor,
  camera: [
    // pool hall: ball, cue and two balls
    { t: 0, ...K([-1.7, 1.9, 1.9], [-0.4, CLOTH_Y, 0]) },
    { t: 6.9, ...K([-0.4, 2.1, 2.0], [0.1, CLOTH_Y, 0]) },
    { t: 7.1, ...K([-0.3, 2.2, 1.8], [-0.1, CLOTH_Y, 0]) },
    { t: 13.9, ...K([0.3, 2.2, 1.9], [0.1, CLOTH_Y, 0]) },
    // Newton's cradle, close
    { t: 14.05, ...K([DESK_X - 0.05, 1.0, 0.95], [DESK_X, 0.88, 0]) },
    { t: 30.9, ...K([DESK_X + 0.0, 1.0, 0.9], [DESK_X, 0.88, 0]) },
    // carts
    { t: 31.05, ...K([LAB_X + 0.56, 1.15, 1.2], [LAB_X + 0.56, 0.76, 0]) },
    { t: 48.9, ...K([LAB_X + 0.58, 1.15, 1.15], [LAB_X + 0.58, 0.76, 0]) },
    // oblique collision, overhead
    { t: 49.05, ...K([0.0, 2.7, 1.2], [0.0, CLOTH_Y, 0.0]) },
    { t: 60.9, ...K([0.2, 2.6, 1.3], [0.1, CLOTH_Y, 0.0]) },
    { t: 69, ...K([1.4, 1.7, 2.4], [0.1, CLOTH_Y, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#7fb2f0", horizon: "#e8f1fb" },
  light: {
    offset: [3, 8, 4],
    extent: 6,
    follow: (t) => (t < CH.cradle ? [0, 0.8, 0] : t < CH.inel ? [DESK_X, 0.8, 0] : t < CH.law ? [LAB_X + 0.6, 0.8, 0] : [0, 0.8, 0]),
  },
  fog: { color: "#e6eef9", near: 80, far: 300 },
};

