"use client";

// Module 3 — Динамика.
// Classic Atwood-on-a-track: the Smart Cart is pulled by a hanging mass over a
// super pulley. Friction is adjustable, and every force acting on the cart is
// drawn as a vector, so Newton's second law is read off the scene.

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PASCO } from "../core/pascoCatalog";
import { PascoModel } from "../core/PascoModel";
import { SimDriver, SimStage } from "../core/SimStage";
import { useSimEngine, type SimEngine } from "../core/useSimEngine";
import { COLORS, G, SimLayout } from "../core/SimLayout";
import { LiveChart } from "../core/LiveChart";
import { Panel, PlayBar, Readout, Slider, Toggle, fmt } from "../core/ui";
import { ArrowHandle, Segment, SegmentHandle, Tag, VectorArrow } from "../core/primitives";
import {
  BENCH_H,
  DynamicsTrack,
  GATE_LIFT,
  LabBench,
  MassHanger,
  PhotogateMount,
  BenchClamp,
  PulleyHandle,
  SuperPulley,
  TRACK_H,
  TRACK_L,
} from "../lab/equipment";

const X_START = 0.15;
const CART_Y = BENCH_H + TRACK_H;
const PULLEY_X = TRACK_L + 0.06;
/** Outer face of the bench top — where the pulley's clamp bites. */
const BENCH_EDGE = TRACK_L + 0.02;
const PULLEY_Y = CART_Y + 0.055;
const PULLEY_R = 0.025;
const HANGER_Y0 = PULLEY_Y - 0.18;
/** Height of the hanger below its own origin, down to the lowest disc. */
const HANGER_DROP = 0.08;
/** How far the hanging mass can fall before its lowest disc meets the floor. */
const FLOOR_DROP = HANGER_Y0 - HANGER_DROP;
/** Where the cart is when the weight lands and the string goes slack. */
const X_LAND = X_START + FLOOR_DROP;
/** The cart's centre when its nose meets the far end stop. */
const X_MAX = TRACK_L - 0.105;

interface S {
  x: number;
  v: number;
  a: number;
  /** The hanging mass is on the floor: the string is slack from here on. */
  landed: boolean;
  /** The cart has come to rest — at the end stop, or through friction. */
  stopped: boolean;
}

export function Sim03Dynamics() {
  const [m1, setM1] = useState(0.5); // cart
  const [m2, setM2] = useState(0.05); // hanging mass
  const [mu, setMu] = useState(0.05);
  const [showVectors, setShowVectors] = useState(true);

  // Newton's second law for the two-body system.
  const drive = m2 * G;
  const fricMax = mu * m1 * G;
  const aTheory = drive > fricMax ? (drive - fricMax) / (m1 + m2) : 0;
  const tension = m2 * (G - aTheory);
  const normal = m1 * G;

  const engine = useSimEngine<S>({
    init: () => ({ x: X_START, v: 0, a: aTheory, landed: false, stopped: aTheory === 0 }),
    step: (s, h) => {
      if (s.stopped) {
        s.a = 0;
        return;
      }

      if (!s.landed) {
        // Phase 1 — the weight is falling and the string is taut, so the cart
        // and the weight accelerate together.
        s.a = aTheory;
        s.v += s.a * h;
        s.x += s.v * h;
        if (s.x >= X_LAND) {
          s.x = X_LAND;
          s.landed = true;
        }
      } else {
        // Phase 2 — the weight is on the floor and the string is slack. The
        // cart does not stop dead here: it carries on, slowing under friction
        // alone, until it runs out of speed or reaches the end stop. Ending the
        // run at the landing left the cart stranded two thirds of the way down
        // a track it never finished.
        const decel = mu * G;
        s.a = s.v > 0 ? -decel : 0;
        s.v = Math.max(0, s.v - decel * h);
        s.x += s.v * h;
        if (s.v <= 0) {
          s.a = 0;
          s.stopped = true;
        }
      }

      if (s.x >= X_MAX) {
        s.x = X_MAX;
        s.v = 0;
        s.a = 0;
        s.stopped = true;
      }
    },
    read: (s) => ({
      x: s.x,
      v: s.v,
      a: s.a,
      // A slack string carries nothing. While the system is held still by
      // friction instead, the string is taut and carries the full weight —
      // which `tension` already gives, since a = 0 there.
      T: aTheory === 0 ? tension : s.landed ? 0 : tension,
      // Kinetic while the cart is running, static and matching the pull while
      // friction is what is holding the system still, nothing once at rest.
      fric:
        aTheory === 0
          ? Math.min(drive, fricMax)
          : s.v > 1e-6 || !s.landed
            ? fricMax
            : 0,
    }),
    resetKey: [m1, m2, mu],
    duration: 20,
    stopWhen: (s) => s.stopped,
  });

  const r = engine.readings;
  const stuck = aTheory === 0;

  return (
    <SimLayout
      goal="Ньютонның екінші заңын нақты өлшеммен тексеру: ілінген жүктің массасы мен үйкелісті өзгертіп, жүйенің үдеуін болжау және «өлшеу»."
      formulas={[
        "a = (m₂g − μm₁g)/(m₁+m₂)",
        "T = m₂(g − a)",
        "F_үйкеліс = μN",
        "N = m₁g",
      ]}
      pasco={[PASCO.smartCart, PASCO.smartGate]}
      built={["динамикалық рельс", "super pulley қысқышы", "жүк ілгіші мен дискілер", "күш векторлары"]}
      stage={
        <SimStage camera={[0.85, 1.25, 1.35]} target={[0.65, BENCH_H - 0.02, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} showVectors={showVectors} m1={m1} m2={m2} mu={mu} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Параметрлер">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Slider label="Арба массасы m₁" unit="кг" value={m1} min={0.25} max={1.2} step={0.01} onChange={setM1} />
              <Slider label="Ілінген жүк m₂" unit="кг" value={m2} min={0.005} max={0.3} step={0.005} decimals={3} onChange={setM2} />
              <Slider
                label="Үйкеліс коэффициенті μ"
                value={mu}
                min={0}
                max={0.4}
                step={0.005}
                decimals={3}
                onChange={setMu}
                hint="μ = 0 — идеал рельс; μ үлкен болса жүйе орнынан қозғалмайды"
              />
              <Toggle label="Күш векторларын көрсету" checked={showVectors} onChange={setShowVectors} />
            </div>
          </Panel>
          <Panel title="Талдау">
            <p
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                stuck
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              }`}
            >
              {stuck
                ? `m₂g = ${fmt(drive, 3)} Н ≤ μm₁g = ${fmt(fricMax, 3)} Н — жүйе тыныштықта қалады.`
                : `m₂g = ${fmt(drive, 3)} Н > μm₁g = ${fmt(fricMax, 3)} Н — жүйе үдей қозғалады.`}
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Есептелген шамалар">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(engine.timeRef.current, 2), unit: "с" },
                { label: "Үдеу a", value: fmt(r.a, 3), unit: "м/с²", tone: "amber" },
                { label: "Жіп керілуі T", value: fmt(r.T, 3), unit: "Н", tone: "brand" },
                { label: "Үйкеліс күші", value: fmt(r.fric, 3), unit: "Н", tone: "rose" },
                { label: "Тірек реакциясы N", value: fmt(normal, 3), unit: "Н" },
                { label: "Ауырлық m₁g", value: fmt(m1 * G, 3), unit: "Н" },
                { label: "Жылдамдық v", value: fmt(r.v, 3), unit: "м/с", tone: "emerald" },
                { label: "Координата x", value: fmt(r.x, 3), unit: "м" },
              ]}
            />
          </Panel>
          <Panel title="Жылдамдық пен координата">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "v", label: "v(t)", color: COLORS.v },
                { key: "x", label: "x(t)", color: COLORS.x },
              ]}
              yLabel="v, м/с · x, м"
            />
          </Panel>
        </div>
      }
      tasks={[
        "μ = 0 кезінде m₂-ні екі есе арттыр. Үдеу де дәл екі есе өсті ме? Неге жоқ — формулада m₂ қай жерде тұр?",
        "μ-ді біртіндеп өсіріп, жүйе қозғалуын тоқтататын шекті мәнді тап. Ол μ = m₂/m₁ қатынасына сәйкес келе ме?",
        "T < m₂g екенін көрсеткіштен тексер. Неге жіптің керілуі жүктің салмағынан кіші?",
      ]}
    />
  );
}

function Scene({
  engine,
  showVectors,
  m1,
  m2,
  mu,
}: {
  engine: SimEngine<S>;
  showVectors: boolean;
  m1: number;
  m2: number;
  mu: number;
}) {
  const cart = useRef<THREE.Group>(null!);
  const hanger = useRef<THREE.Group>(null!);
  const pulley = useRef<PulleyHandle>(null);
  const ropeTop = useRef<SegmentHandle>(null);
  const ropeDown = useRef<SegmentHandle>(null);
  const arrowT = useRef<ArrowHandle>(null);
  const arrowF = useRef<ArrowHandle>(null);
  const arrowW = useRef<ArrowHandle>(null);
  const arrowN = useRef<ArrowHandle>(null);

  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());
  const lastX = useRef(X_START);

  // Vector lengths are scaled so a 5 N force is 10 cm long on screen.
  const S_F = 0.02;

  useFrame(() => {
    const s = engine.stateRef.current;
    if (cart.current) cart.current.position.x = s.x;

    // The weight rests on the floor once it gets there, however much further
    // the cart runs.
    const drop = Math.min(s.x - X_START, FLOOR_DROP);
    if (hanger.current) hanger.current.position.y = HANGER_Y0 - drop;

    // Nothing runs over the pulley once the string is slack.
    if (!s.landed) pulley.current?.spin((s.x - lastX.current) / PULLEY_R);
    lastX.current = s.x;

    // rope: cart hook → pulley rim → hanger. After the landing the cart side
    // has slack in it, so it hangs off the bottom of the sheave instead of
    // running taut over the top.
    a.current.set(s.x + 0.1, CART_Y + 0.03, 0);
    b.current.set(PULLEY_X - PULLEY_R, s.landed ? PULLEY_Y - PULLEY_R : PULLEY_Y, 0);
    ropeTop.current?.set(a.current, b.current);
    a.current.set(PULLEY_X + PULLEY_R, PULLEY_Y, 0);
    b.current.set(PULLEY_X + PULLEY_R, HANGER_Y0 - drop + 0.02, 0);
    ropeDown.current?.set(a.current, b.current);

    if (!showVectors) {
      [arrowT, arrowF, arrowW, arrowN].forEach((ref) => ref.current?.set(a.current, b.current, 0));
      return;
    }

    const drive = m2 * G;
    const fricMax = mu * m1 * G;
    const aTh = drive > fricMax ? (drive - fricMax) / (m1 + m2) : 0;
    const T = m2 * (G - aTh);
    const fric = Math.min(drive, fricMax);

    const cx = s.x;
    const cy = CART_Y + 0.05;

    a.current.set(cx, cy, 0);
    arrowT.current?.set(a.current, b.current.set(1, 0, 0), T * S_F);
    a.current.set(cx, cy, 0);
    arrowF.current?.set(a.current, b.current.set(-1, 0, 0), fric * S_F);
    a.current.set(cx, cy - 0.03, 0);
    arrowW.current?.set(a.current, b.current.set(0, -1, 0), m1 * G * S_F * 0.35);
    a.current.set(cx, cy + 0.02, 0);
    arrowN.current?.set(a.current, b.current.set(0, 1, 0), m1 * G * S_F * 0.35);
  });

  return (
    <group>
      <LabBench to={BENCH_EDGE} />
      <DynamicsTrack />

      <PhotogateMount x={0.5} />
      <group position={[0.5, BENCH_H + GATE_LIFT, 0]}>
        <PascoModel spec={PASCO.smartGate} />
      </group>
      <Tag position={[0.5, BENCH_H + 0.2, 0]} tone="brand">
        Smart Gate
      </Tag>

      {/* The pulley hangs past the edge so the weight can fall clear of the
          worktop, which means it has to be clamped to that edge. */}
      <BenchClamp x={BENCH_EDGE} reach={PULLEY_X - BENCH_EDGE} />
      <SuperPulley ref={pulley} position={[PULLEY_X, PULLEY_Y, 0]} radius={PULLEY_R} />
      <Tag position={[PULLEY_X + 0.05, PULLEY_Y + 0.06, 0]} tone="slate">
        Super Pulley
      </Tag>

      <Segment ref={ropeTop} color="#f1f5f9" radius={0.0012} />
      <Segment ref={ropeDown} color="#f1f5f9" radius={0.0012} />

      <group ref={hanger} position={[PULLEY_X + PULLEY_R, HANGER_Y0, 0]}>
        <MassHanger discs={Math.max(1, Math.round(m2 / 0.05))} />
        <Tag position={[0.09, -0.03, 0]} tone="amber">
          m₂ = {m2.toFixed(3)} кг
        </Tag>
      </group>

      <group ref={cart} position={[X_START, CART_Y, 0]}>
        <PascoModel spec={PASCO.smartCart} />
        <Tag position={[0, 0.12, 0]} tone="brand">
          m₁ = {m1.toFixed(2)} кг
        </Tag>
      </group>

      {showVectors && (
        <>
          <VectorArrow ref={arrowT} color="#22c55e" radius={0.0045} />
          <VectorArrow ref={arrowF} color="#ef4444" radius={0.0045} />
          <VectorArrow ref={arrowW} color="#8b5cf6" radius={0.0045} />
          <VectorArrow ref={arrowN} color="#0ea5e9" radius={0.0045} />
        </>
      )}
    </group>
  );
}
