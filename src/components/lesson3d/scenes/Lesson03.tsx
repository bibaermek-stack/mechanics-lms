"use client";

// Lesson 3 — Dynamics. Weight on spring balances, a crate dragged until it
// breaks loose (static versus sliding friction), Hooke's law on a coil spring,
// and a person on a bathroom scale riding a lift.

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Plot, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { Segment, type SegmentHandle } from "@/components/simulation/core/primitives";
import { Arrow, Ground, Paving, Tree } from "../objects/common";
import { Crate } from "../objects/Props";
import { Figure } from "../objects/Figure";
import { Q } from "../objects/materials";
import {
  CAB,
  CoilSpring,
  HangingRuler,
  LiftCabin,
  LiftShaft,
  MassWeight,
  PlatformScale,
  RetortStand,
  SpringBalance,
  type BalanceHandle,
  type SpringHandle,
  weightHeight,
} from "../objects/Mech";
import { facadeTexture } from "../objects/textures";

const S = LESSON_SCRIPTS[3];
const at = (id: string) => chapterById(S, id);
const G = 9.8;

// ---- geometry of the places -------------------------------------------------
const ARM_Y = 1.29; // height of every stand's arm
const STAND_A = -0.8;
const STAND_B = 0.7;
const ARM_DX = 0.27; // arm end, relative to the stand's x
const STAND_C = -5;
const LIFT_X = 60;
const LIFT_FLOOR0 = 0.1;

const CH = {
  grav: at("gravA").from,
  gravB: at("gravB").from,
  fric: at("fricA").from,
  fricB: at("fricB").from,
  hooke: at("hookeA").from,
  hookeB: at("hookeB").from,
  lift: at("elevA").from,
  liftB: at("elevB").from,
  liftC: at("elevC").from,
  liftD: at("elevD").from,
  liftE: at("elevE").from,
  outro: at("outro").from,
};

// ---- the lift's motion: a smooth acceleration profile, integrated once -----
const MAN = 70;
const A_LIFT = 0.8;
const DT = 0.001;
const T_MAX = 100;

function win(t: number, t0: number, t1: number, w = 0.7) {
  return smooth((t - t0 + w / 2) / w) - smooth((t - t1 + w / 2) / w);
}
const liftA = (t: number) => A_LIFT * win(t, CH.liftB, CH.liftC) - A_LIFT * win(t, CH.liftD, CH.liftE);

const liftTable = (() => {
  const n = Math.round(T_MAX / DT) + 1;
  const y = new Float32Array(n);
  const v = new Float32Array(n);
  let yy = 0;
  let vv = 0;
  for (let i = 0; i < n; i++) {
    y[i] = yy;
    v[i] = vv;
    vv += liftA(i * DT) * DT;
    yy += vv * DT;
  }
  return { y, v };
})();
const idx = (t: number) => Math.min(liftTable.y.length - 1, Math.max(0, Math.round(t / DT)));
const liftY = (t: number) => liftTable.y[idx(t)];
const liftV = (t: number) => liftTable.v[idx(t)];
const freeFall = (t: number) => t >= CH.liftE && t < CH.outro;
const scaleReading = (t: number) => (freeFall(t) ? 0 : MAN * (G + liftA(t)));

// ---- the dragged crate: F(t) from a winch, then Newton's second law ---------
const M_CRATE = 10;
const MU_S = 0.5;
const MU_K = 0.35;
const F_STATIC = MU_S * M_CRATE * G; // 49 N
const F_SLIDE = MU_K * M_CRATE * G; // 34.3 N
const T_PULL0 = CH.fric + 1;
const T_BREAK = T_PULL0 + 7;
const pullForce = (t: number) => {
  const tau = t - T_PULL0;
  if (tau <= 0) return 0;
  if (tau <= 7) return (F_STATIC / 7) * tau;
  const d = tau - 7;
  return d < 0.6 ? F_STATIC - ((F_STATIC - F_SLIDE) / 0.6) * d : F_SLIDE;
};
const fricTable = (() => {
  const n = Math.round(T_MAX / DT) + 1;
  const s = new Float32Array(n);
  let ss = 0;
  let vv = 0;
  for (let i = 0; i < n; i++) {
    s[i] = ss;
    const t = i * DT;
    if (t >= T_BREAK) vv += ((pullForce(t) - F_SLIDE) / M_CRATE) * DT;
    ss += vv * DT;
  }
  return s;
})();
const crateShift = (t: number) => fricTable[idx(t)];
/** Friction force on the crate: it matches the pull until breakaway, then settles at μk·N. */
const frictionForce = (t: number) => (t < T_BREAK ? pullForce(t) : F_SLIDE);

const CRATE0_X = 9.5;
const WINCH_X = 3.2;
const FZ = 0; // everything on z = 0
const BAL_Y = 0.45;
const ROPE = 0.25;
const crateX = (t: number) => CRATE0_X - crateShift(t);

// ---- hanging masses ---------------------------------------------------------
interface Hang {
  kg: number;
  from: number;
  to: number;
  stand: "A" | "B";
}
const HANGS: Hang[] = [
  { kg: 1, from: 9, to: 14.4, stand: "A" },
  { kg: 2, from: 14.4, to: 17.4, stand: "A" },
  { kg: 10, from: 17.4, to: 24, stand: "B" },
];
const settle = (tau: number) => (tau <= 0 ? 0 : 1 - Math.exp(-4.2 * tau) * Math.cos(15 * tau));

// Balance A has a 20 N range, B 100 N.
const RANGE = { A: 20, B: 100 };
const TRAVEL = 0.12;

const K_SPRING = 200;
const SPRING_L0 = 0.2;
const HOOKE: { kg: number; from: number; to: number }[] = [
  { kg: 0.5, from: 38, to: 42.5 },
  { kg: 1.0, from: 42.5, to: 46 },
  { kg: 1.5, from: 46, to: 50 },
];
const hookeExt = (t: number) => {
  let prev = 0;
  for (const h of HOOKE) {
    const eq = (h.kg * G) / K_SPRING;
    if (t < h.to) return t < h.from ? prev : prev + (eq - prev) * settle(t - h.from);
    prev = eq;
  }
  return prev;
};
const hookeMass = (t: number) => HOOKE.find((h) => t >= h.from && t < h.to)?.kg ?? 0;

// ---- anchors ----------------------------------------------------------------
const inLift = (t: number) => t >= CH.lift && t < CH.outro;
const anchor = (t: number): Vec3 => (inLift(t) ? [LIFT_X, liftY(t), 0] : [0, 0, 0]);
const lightAt = (t: number): Vec3 =>
  inLift(t) ? [LIFT_X, liftY(t) + 1, 0] : t < CH.fric ? [0, 0.8, 0] : t < CH.hooke ? [6.5, 0.4, 0] : t < CH.lift ? [-4.8, 0.8, 0] : [2, 0.8, 0];

// ---- world ------------------------------------------------------------------
function Rope({ a, b }: { a: (t: number) => Vec3; b: (t: number) => Vec3 }) {
  const h = useRef<SegmentHandle>(null);
  const va = useMemo(() => new THREE.Vector3(), []);
  const vb = useMemo(() => new THREE.Vector3(), []);
  useStudioFrame((t) => h.current?.set(va.set(...a(t)), vb.set(...b(t))));
  return <Segment ref={h} color="#6b5a43" radius={0.007} />;
}

function Winch() {
  return (
    <group position={[WINCH_X - 0.1, 0, FZ]}>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.04, 0.5]} />
        <meshStandardMaterial color="#1b202b" metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[-0.1, 0.28, 0]} castShadow>
        <boxGeometry args={[0.36, 0.48, 0.34]} />
        <meshStandardMaterial color="#1f47e6" metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh position={[0.17, BAL_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, 0.3, 24]} />
        <meshStandardMaterial color="#c9d1dc" metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[-0.1, 0.55, 0]}>
        <boxGeometry args={[0.1, 0.04, 0.2]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function Hall() {
  return (
    <>
      <Paving x={0} z={0} w={44} d={22} />
      {/* back wall with a skirting board */}
      <mesh position={[0, 2.4, -5]} receiveShadow>
        <boxGeometry args={[44, 4.8, 0.2]} />
        <meshStandardMaterial color="#e8edf5" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.12, -4.88]}>
        <boxGeometry args={[44, 0.24, 0.04]} />
        <meshStandardMaterial color="#9aa6b8" roughness={0.8} />
      </mesh>
    </>
  );
}

function World() {
  const balA = useRef<BalanceHandle>(null!);
  const balB = useRef<BalanceHandle>(null!);
  const balF = useRef<BalanceHandle>(null!);
  const coil = useRef<SpringHandle>(null!);
  const weights = useRef<(THREE.Group | null)[]>([]);
  const hookeW = useRef<(THREE.Group | null)[]>([]);
  const crate = useRef<THREE.Group>(null!);
  const balFG = useRef<THREE.Group>(null!);
  const cab = useRef<THREE.Group>(null!);
  const rider = useRef<THREE.Group>(null!);

  /** Reading of hanging mass `h` at time t as a fraction of its balance's range. */
  const frac = (h: Hang, t: number) => ((h.kg * G) / RANGE[h.stand]) * settle(t - h.from);

  useStudioFrame((t) => {
    // --- hanging masses on the two balances
    const fa = HANGS.filter((h) => h.stand === "A").reduce((m, h) => (t >= h.from && t < h.to ? frac(h, t) : m), 0);
    const fb = HANGS.filter((h) => h.stand === "B").reduce((m, h) => (t >= h.from && t < h.to ? frac(h, t) : m), 0);
    balA.current.setReading(fa);
    balB.current.setReading(fb);
    HANGS.forEach((h, i) => {
      const g = weights.current[i];
      if (!g) return;
      const on = t >= h.from && t < h.to;
      g.visible = on;
      if (on) {
        const x = (h.stand === "A" ? STAND_A : STAND_B) + ARM_DX;
        g.position.set(x, ARM_Y - 0.39 - frac(h, t) * TRAVEL, 0);
      }
    });

    // --- dragged crate and its balance
    const cx = crateX(t);
    crate.current.position.set(cx, 0.02, FZ);
    const f = pullForce(t) / 60;
    balF.current.setReading(f);
    const hookX = cx - 0.3 - ROPE;
    balFG.current.position.set(hookX - 0.39 - f * TRAVEL, BAL_Y, FZ);

    // --- coil spring with Hooke masses
    const ext = hookeExt(t);
    coil.current.setLength(SPRING_L0 + ext);
    HOOKE.forEach((h, i) => {
      const g = hookeW.current[i];
      if (!g) return;
      g.visible = t >= h.from && t < h.to;
      g.position.set(STAND_C + ARM_DX, ARM_Y - SPRING_L0 - ext - 0.012, 0);
    });

    // --- lift
    cab.current.position.set(LIFT_X, LIFT_FLOOR0 + liftY(t) - 0.1, 0);
    // In free fall the rider's feet lift off the scale.
    rider.current.position.y = 0.055 + 0.16 * smooth(seg(t, CH.liftE + 0.8, CH.liftE + 2.4)) * (1 - smooth(seg(t, CH.outro - 0.6, CH.outro)));
  });

  return (
    <>
      <Ground size={400} x={20} />
      <Hall />

      {/* gravity stations */}
      {[STAND_A, STAND_B].map((x, i) => (
        <group key={x} position={[x, 0.02, 0]}>
          <RetortStand />
          <group position={[ARM_DX, ARM_Y, 0]}>
            <SpringBalance ref={i === 0 ? balA : balB} travel={TRAVEL} />
          </group>
        </group>
      ))}
      {HANGS.map((h, i) => (
        <group key={i} ref={(g) => { weights.current[i] = g; }} visible={false}>
          <MassWeight kg={h.kg} />
        </group>
      ))}
      {HANGS.map((h, i) => (
        <group key={`arrows${i}`}>
          <Arrow
            color={Q.weight}
            radius={0.012}
            get={(t) => {
              if (!(t >= h.from + 0.8 && t < h.to)) return null;
              const x = (h.stand === "A" ? STAND_A : STAND_B) + ARM_DX;
              const fr = frac(h, t);
              const y = ARM_Y - 0.39 - fr * TRAVEL - weightHeight(h.kg) / 2;
              const len = 0.12 + h.kg * G * 0.0032 * smooth(seg(t, h.from + 0.8, h.from + 1.5));
              return { origin: [x + 0.16, y, 0.02], dir: [0, -1, 0], len };
            }}
          />
          <LiveTag
            tone="brand"
            text={() => `${h.kg === 1 ? "1" : h.kg} кг`}
            get={(t) => (t >= h.from + 0.4 && t < h.to ? { pos: [(h.stand === "A" ? STAND_A : STAND_B) + ARM_DX + 0.14, ARM_Y - 0.39 - 0.12 * frac(h, t) - weightHeight(h.kg) - 0.04, 0.02], opacity: seg(t, h.from + 0.4, h.from + 1) } : null)}
          >
            {h.kg} кг
          </LiveTag>
          <LiveTag
            tone="red"
            text={(t) => `F = ${num(h.kg * G * Math.min(1, settle(t - h.from)), 1)} Н`}
            get={(t) => (t >= h.from + 0.8 && t < h.to ? { pos: [(h.stand === "A" ? STAND_A : STAND_B) + ARM_DX + 0.35, ARM_Y - 0.15, 0.02], opacity: seg(t, h.from + 0.8, h.from + 1.4) } : null)}
          >
            F
          </LiveTag>
        </group>
      ))}

      {/* friction station */}
      <Winch />
      <group ref={crate}>
        <Crate size={0.6} />
      </group>
      <group ref={balFG} rotation={[0, 0, Math.PI / 2]}>
        <SpringBalance ref={balF} travel={TRAVEL} />
      </group>
      <Rope a={(t) => [WINCH_X + 0.07 + 0.1, BAL_Y + 0.07, FZ]} b={(t) => [crateX(t) - 0.3 - ROPE - 0.39 - (pullForce(t) / 60) * TRAVEL - 0.0, BAL_Y, FZ]} />
      <Rope a={(t) => [crateX(t) - 0.3 - ROPE, BAL_Y, FZ]} b={(t) => [crateX(t) - 0.3, BAL_Y, FZ]} />
      <Arrow color={Q.force} radius={0.025} get={(t) => (t >= CH.fric + 1 && t < CH.hooke ? { origin: [crateX(t) - 0.3, 0.62, 0.34], dir: [-1, 0, 0], len: 0.2 + pullForce(t) * 0.018 } : null)} />
      <Arrow color={Q.friction} radius={0.025} get={(t) => (t >= CH.fric + 1 && t < CH.hooke ? { origin: [crateX(t) + 0.3, 0.62, 0.34], dir: [1, 0, 0], len: 0.2 + frictionForce(t) * 0.018 } : null)} />
      <LiveTag tone="red" get={(t) => (t >= CH.fric + 2 && t < CH.hooke ? { pos: [crateX(t) - 0.3 - ROPE - 0.5 - (pullForce(t) / 60) * TRAVEL, 0.95, 0.3], opacity: seg(t, CH.fric + 2, CH.fric + 3) } : null)} text={(t) => `F = ${num(pullForce(t), 1)} Н`}>
        F
      </LiveTag>
      <LiveTag tone="amber" get={(t) => (t >= CH.fric + 2 && t < CH.hooke ? { pos: [crateX(t) + 0.55, 0.95, 0.3], opacity: seg(t, CH.fric + 2, CH.fric + 3) } : null)} text={(t) => `Fүйк = ${num(frictionForce(t), 1)} Н`}>
        Fүйк
      </LiveTag>

      {/* Hooke station */}
      <group position={[STAND_C, 0.02, 0]}>
        <RetortStand />
      </group>
      <group position={[STAND_C + ARM_DX, ARM_Y, 0]}>
        <CoilSpring ref={coil} natural={SPRING_L0} />
        <group position={[0.07, 0, 0.0]}>
          <HangingRuler length={0.36} />
        </group>
        {/* natural-length mark */}
        <mesh position={[0.07, -SPRING_L0, 0.005]}>
          <boxGeometry args={[0.045, 0.002, 0.002]} />
          <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={0.4} />
        </mesh>
      </group>
      {HOOKE.map((h, i) => (
        <group key={i} ref={(g) => { hookeW.current[i] = g; }} visible={false}>
          <MassWeight kg={h.kg} />
        </group>
      ))}
      <LiveTag
        tone="green"
        text={(t) => `Δx = ${num(hookeExt(t) * 100, 1)} см`}
        get={(t) => (t >= HOOKE[0].from + 0.6 && t < CH.lift ? { pos: [STAND_C + ARM_DX + 0.2, ARM_Y - SPRING_L0 - hookeExt(t) - 0.02, 0.02], opacity: seg(t, HOOKE[0].from + 0.6, HOOKE[0].from + 1.4) } : null)}
      >
        Δx
      </LiveTag>

      {/* ---- the lift ---- */}
      <Paving x={LIFT_X} z={4} w={34} d={18} />
      <mesh position={[LIFT_X, 23, -4.6]} castShadow receiveShadow>
        <boxGeometry args={[18, 46, 1]} />
        <meshStandardMaterial color="#ffffff" map={facadeTexture(18 / 4, 46 / 4)} roughness={0.85} />
      </mesh>
      <group position={[LIFT_X, 0, 0]}>
        <LiftShaft height={44} />
      </group>
      <group ref={cab}>
        <LiftCabin>
          <group position={[0, 0.1, 0.1]}>
            <PlatformScale />
            <group ref={rider} position={[0, 0.055, 0]}>
              <Figure shirt="#2f6df6" pants="#1f2937" pose={{ armL: 0.03, armR: 0.03 }} />
            </group>
          </group>
        </LiftCabin>
      </group>
      <Arrow color={Q.acceleration} radius={0.06} get={(t) => (inLift(t) && Math.abs(liftA(t)) > 0.05 ? { origin: [LIFT_X + 1.3, LIFT_FLOOR0 + liftY(t) + 1.4, 0.8], dir: [0, Math.sign(liftA(t)), 0], len: Math.abs(liftA(t)) * 1.6 } : null)} />
      <Arrow color={Q.velocity} radius={0.06} get={(t) => (inLift(t) && Math.abs(liftV(t)) > 0.1 ? { origin: [LIFT_X - 1.3, LIFT_FLOOR0 + liftY(t) + 1.4, 0.8], dir: [0, 1, 0], len: liftV(t) * 0.5 } : null)} />
      <LiveTag
        tone="brand"
        text={(t) => `P = ${num(scaleReading(t), 0)} Н`}
        get={(t) => (inLift(t) ? { pos: [LIFT_X + 0.62, LIFT_FLOOR0 + liftY(t) + 0.35, 0.95], opacity: seg(t, CH.lift + 0.5, CH.lift + 1.2) } : null)}
      >
        P
      </LiveTag>
      {[-12, -7, 7, 12].map((x, i) => (
        <Tree key={x} position={[LIFT_X + x * 1.8, 0, 9 + (i % 2) * 2]} scale={1.2} tone={i} />
      ))}
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const tf = Math.max(0, t - T_PULL0);
  return (
    <>
      <Dip t={t} at={CH.lift} />
      <Dip t={t} at={CH.outro} />

      {/* gravity */}
      <Card t={t} from={CH.grav + 1} to={CH.fric} place={{ right: "2.2cqw", top: "14cqh" }} title="Ауырлық күші">
        <Formula note="g = 9,8 м/с²">F = m·g</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="1 кг" value="9,8" unit="Н" color={Q.weight} />
          {t > 14.9 && <Row label="2 кг" value="19,6" unit="Н" color={Q.weight} />}
          {t > 18 && <Row label="10 кг" value="98" unit="Н" color={Q.weight} />}
        </div>
      </Card>

      {/* friction */}
      <Card t={t} from={CH.fric + 0.5} to={CH.hooke} place={{ left: "2.2cqw", top: "17cqh" }} title="Тартқыш күш F(t)" width="28cqw">
        <Plot
          lines={[{ fn: (s) => pullForce(T_PULL0 + s), color: Q.force }]}
          x1={14}
          y1={60}
          xTicks={7}
          yTicks={3}
          cursor={tf}
          xLabel="t, с"
          yLabel="F, Н"
          w={25}
          h={14}
          guides={[
            [F_STATIC, "49 Н · тыныштық үйкелісінің шегі"],
            [F_SLIDE, "34,3 Н · сырғанау үйкелісі", "below"],
          ]}
        />
      </Card>
      <Card t={t} from={CH.fric + 1} to={CH.hooke} place={{ right: "2.2cqw", top: "14cqh" }} title="Жүк m = 10 кг">
        <Row label="N = mg" value="98" unit="Н" color={Q.normal} />
        <Row label="μ тыныштық" value="0,5" unit="" />
        <Row label="μ сырғанау" value="0,35" unit="" />
      </Card>

      {/* Hooke */}
      <Card t={t} from={CH.hooke + 0.5} to={CH.lift} place={{ right: "2.2cqw", top: "14cqh" }} title="Гук заңы">
        <Formula note="k = 200 Н/м">F = k·Δx</Formula>
        <div style={{ marginTop: "0.5cqw" }}>
          <Row label="жүк" value={num(hookeMass(t), 1)} unit="кг" />
          <Row label="F = mg" value={num(hookeMass(t) * G, 1)} unit="Н" color={Q.force} />
          <Row label="Δx = F/k" value={num(hookeExt(t) * 100, 1)} unit="см" color="#16a34a" />
        </div>
      </Card>

      {/* lift */}
      <Card t={t} from={CH.lift + 0.5} to={CH.liftE} place={{ right: "2.2cqw", top: "14cqh" }} title="Лифттегі таразы" width="27cqw">
        <Row label="P" value={num(scaleReading(t), 0)} unit="Н" color={Q.weight} />
        <Row label="a" value={num(liftA(t), 1)} unit="м/с²" color={Q.acceleration} />
        <Row label="v" value={num(liftV(t), 1)} unit="м/с" color={Q.velocity} />
      </Card>
      <Card t={t} from={CH.lift + 1} to={CH.liftB} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula note="a = 0">P = m·g</Formula>
      </Card>
      <Card t={t} from={CH.liftB} to={CH.liftC} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula note="a ↑">P = m(g + a)</Formula>
      </Card>
      <Card t={t} from={CH.liftC} to={CH.liftD} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula note="a = 0">P = m·g</Formula>
      </Card>
      <Card t={t} from={CH.liftD} to={CH.liftE} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula note="a ↓">P = m(g − a)</Formula>
      </Card>
      <Card t={t} from={CH.liftE} to={CH.outro} place={{ right: "2.2cqw", top: "14cqh" }} title="Еркін құлау">
        <Row label="a" value="9,8" unit="м/с²" color={Q.acceleration} />
        <Row label="P = m(g − g)" value="0" unit="Н" color={Q.weight} />
        <div style={{ fontSize: "2.1cqw", fontWeight: 800, color: "#1f47e6", marginTop: "0.5cqw" }}>АУЫРСЫЗДЫҚ</div>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson03: LessonScene = {
  moduleId: 3,
  script: S,
  cameraFollow: anchor,
  camera: [
    // intro: the hall
    { t: 0, ...K([-3.5, 2.3, 9], [2.5, 0.9, 0]) },
    { t: 7.9, ...K([2, 1.9, 6.4], [3.2, 0.8, 0]) },
    // gravity stands: first the 20 N balance, then across to the 100 N one
    { t: 8.05, ...K([-0.45, 1.0, 1.55], [-0.5, 0.86, 0]) },
    { t: 14, ...K([-0.45, 1.0, 1.55], [-0.5, 0.86, 0]) },
    { t: 17.2, ...K([0.5, 1.0, 1.75], [0.45, 0.82, 0]) },
    { t: 19.9, ...K([0.5, 1.0, 1.75], [0.45, 0.82, 0]) },
    // friction
    { t: 20.05, ...K([7.2, 1.3, 5.4], [7.2, 0.45, 0]) },
    { t: 36.9, ...K([6.2, 1.3, 5.0], [6.2, 0.45, 0]) },
    // Hooke
    { t: 37.05, ...K([-4.9, 0.95, 1.7], [-4.75, 0.82, 0]) },
    { t: 48.9, ...K([-4.9, 0.92, 1.6], [-4.75, 0.78, 0]) },
    // lift (relative to the cabin)
    { t: 49.05, ...K([0.4, 1.6, 7.6], [0, 1.25, 0]) },
    { t: 62, ...K([0.3, 1.6, 7.6], [0, 1.3, 0]) },
    { t: 75.9, ...K([3.8, 2.0, 7.0], [0, 1.25, 0]) },
    // outro: back in the hall
    { t: 76.05, ...K([-2, 2.2, 9.5], [2, 0.9, 0]) },
    { t: 84, ...K([2.5, 2.6, 8.5], [1.5, 0.8, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#7fb2f0", horizon: "#e8f1fb" },
  light: { offset: [6, 12, 9], extent: 11, follow: lightAt },
  fog: { color: "#e6eef9", near: 60, far: 260 },
};

