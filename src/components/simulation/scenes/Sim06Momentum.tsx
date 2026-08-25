"use client";

// Module 6 — Импульс.
// Two Smart Carts collide between two Smart Gates. The restitution slider goes
// from a perfectly inelastic collision (carts stick together) to a perfectly
// elastic one, and the gates report the velocities before and after so that
// momentum conservation can be checked against kinetic-energy loss.

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PASCO } from "../core/pascoCatalog";
import { PascoModel } from "../core/PascoModel";
import { SimDriver, SimStage } from "../core/SimStage";
import { useSimEngine, type SimEngine } from "../core/useSimEngine";
import { COLORS, SimLayout } from "../core/SimLayout";
import { LiveChart } from "../core/LiveChart";
import { BarMeter, Panel, PlayBar, Readout, Slider, fmt } from "../core/ui";
import { Tag } from "../core/primitives";
import {
  BENCH_H,
  Bumper,
  DynamicsTrack,
  GATE_LIFT,
  LabBench,
  PhotogateMount,
  TRACK_H,
  TRACK_L,
} from "../lab/equipment";

const CART_Y = BENCH_H + TRACK_H;
/** Matches the scanned cart's on-screen length. */
const CART_L = 0.21;
/** Centre-to-centre distance at which the bumpers touch. */
const CONTACT = CART_L + 0.02;
const X_MIN = 0.14;
const X_MAX = TRACK_L - 0.14;
const GATE_1 = 0.34;
const GATE_2 = 0.86;

interface S {
  x1: number;
  v1: number;
  x2: number;
  v2: number;
  hit: boolean;
  /** Velocities latched as each cart crosses its gate. */
  g1: number;
  g2: number;
  g1b: number;
  g2b: number;
  /**
   * Total momentum and kinetic energy the instant the collision was resolved.
   *
   * These are latched rather than read live because an end stop is an outside
   * force: once a cart has bounced off one, the live totals no longer describe
   * the collision, and a student reading them concludes that momentum is not
   * conserved when the simulation has in fact conserved it exactly.
   */
  pAfter: number;
  ekAfter: number;
}

export function Sim06Momentum() {
  const [m1, setM1] = useState(0.5);
  const [m2, setM2] = useState(0.5);
  const [v1, setV1] = useState(0.5);
  const [v2, setV2] = useState(-0.2);
  const [e, setE] = useState(1);

  const engine = useSimEngine<S>({
    init: () => ({
      x1: 0.2,
      v1,
      x2: 1.0,
      v2,
      hit: false,
      g1: 0,
      g2: 0,
      g1b: 0,
      g2b: 0,
      pAfter: m1 * v1 + m2 * v2,
      ekAfter: 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2,
    }),
    step: (s, h) => {
      const p1 = s.x1;
      const p2 = s.x2;
      s.x1 += s.v1 * h;
      s.x2 += s.v2 * h;

      // Gate crossings: latch the velocity the first time each gate is passed.
      if (!s.hit) {
        if ((p1 - GATE_1) * (s.x1 - GATE_1) <= 0) s.g1b = s.v1;
        if ((p2 - GATE_2) * (s.x2 - GATE_2) <= 0) s.g2b = s.v2;
      } else {
        if ((p1 - GATE_1) * (s.x1 - GATE_1) <= 0) s.g1 = s.v1;
        if ((p2 - GATE_2) * (s.x2 - GATE_2) <= 0) s.g2 = s.v2;
      }

      // Collision. Resolved whenever the carts overlap and are closing, so a
      // cart that rebounds off an end stop can hit its neighbour again instead
      // of sliding through it. `hit` only records that the first, reported
      // collision has happened.
      const gap = s.x2 - s.x1 - CONTACT;
      if (gap <= 0 && s.v1 > s.v2) {
        const M = m1 + m2;
        const u1 = s.v1;
        const u2 = s.v2;
        s.v1 = ((m1 - e * m2) * u1 + (1 + e) * m2 * u2) / M;
        s.v2 = ((m2 - e * m1) * u2 + (1 + e) * m1 * u1) / M;
        if (!s.hit) {
          s.pAfter = m1 * s.v1 + m2 * s.v2;
          s.ekAfter = 0.5 * m1 * s.v1 * s.v1 + 0.5 * m2 * s.v2 * s.v2;
        }
        s.hit = true;
        // Separate them so they do not re-trigger on the following step.
        const overlap = -gap;
        s.x1 -= overlap / 2 + 1e-4;
        s.x2 += overlap / 2 + 1e-4;
      }
      if (s.hit && e === 0) {
        // Perfectly inelastic: the carts stay coupled from here on.
        s.v2 = s.v1;
        s.x2 = s.x1 + CONTACT;
      }

      // The end stops absorb rather than rebound. A bouncing cart re-enters the
      // measurement with momentum an outside force has changed, which is not
      // what this experiment is about.
      if (s.x1 <= X_MIN) {
        s.x1 = X_MIN;
        s.v1 = 0;
      }
      if (s.x2 >= X_MAX) {
        s.x2 = X_MAX;
        s.v2 = 0;
      }
    },
    read: (s) => ({
      x1: s.x1,
      x2: s.x2,
      v1: s.v1,
      v2: s.v2,
      p: m1 * s.v1 + m2 * s.v2,
      Ek: 0.5 * m1 * s.v1 * s.v1 + 0.5 * m2 * s.v2 * s.v2,
      pAfter: s.pAfter,
      ekAfter: s.ekAfter,
      hit: s.hit ? 1 : 0,
    }),
    resetKey: [m1, m2, v1, v2, e],
    duration: 20,
  });

  const r = engine.readings;
  const pBefore = m1 * v1 + m2 * v2;
  const ekBefore = 0.5 * m1 * v1 * v1 + 0.5 * m2 * v2 * v2;
  const kind = e === 0 ? "Абсолют серпімсіз" : e === 1 ? "Абсолют серпімді" : "Жартылай серпімді";

  return (
    <SimLayout
      goal="Соқтығысу кезінде импульстің сақталатынын, ал кинетикалық энергияның тек серпімді соққыда ғана сақталатынын өлшеп көрсету."
      formulas={[
        "p = mv",
        "m₁u₁ + m₂u₂ = m₁v₁ + m₂v₂",
        "e = (v₂ − v₁)/(u₁ − u₂)",
        "Eₖ = mv²/2",
      ]}
      pasco={[PASCO.smartCart, PASCO.smartGate]}
      built={["динамикалық рельс", "магнитті/жабысқақ бампер", "импульс диаграммасы"]}
      stage={
        <SimStage camera={[0.65, 1.25, 1.35]} target={[0.6, BENCH_H + 0.05, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} m1={m1} m2={m2} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Параметрлер">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Slider label="1-арба массасы m₁" unit="кг" value={m1} min={0.25} max={1.5} step={0.05} onChange={setM1} />
              <Slider label="2-арба массасы m₂" unit="кг" value={m2} min={0.25} max={1.5} step={0.05} onChange={setM2} />
              <Slider label="Бастапқы жылдамдық u₁" unit="м/с" value={v1} min={0} max={1} step={0.05} onChange={setV1} />
              <Slider label="Бастапқы жылдамдық u₂" unit="м/с" value={v2} min={-1} max={0} step={0.05} onChange={setV2} />
              <Slider
                label="Қалпына келу коэффициенті e"
                value={e}
                min={0}
                max={1}
                step={0.1}
                decimals={1}
                onChange={setE}
                hint={`${kind} соққы`}
              />
            </div>
          </Panel>
          <Panel title="Соққыға дейін / кейін">
            <BarMeter
              unit=""
              max={Math.max(Math.abs(pBefore), ekBefore, 1e-4)}
              items={[
                { label: "p дейін, кг·м/с", value: Math.abs(pBefore), color: "#3366ff" },
                { label: "p кейін, кг·м/с", value: Math.abs(r.pAfter ?? 0), color: "#60a5fa" },
                { label: "Eₖ дейін, Дж", value: ekBefore, color: "#10b981" },
                { label: "Eₖ кейін, Дж", value: r.ekAfter ?? 0, color: "#34d399" },
              ]}
            />
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Smart Gate өлшемдері">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(engine.timeRef.current, 2), unit: "с" },
                { label: "v₁ ағымдағы", value: fmt(r.v1, 3), unit: "м/с", tone: "brand" },
                { label: "v₂ ағымдағы", value: fmt(r.v2, 3), unit: "м/с", tone: "emerald" },
                { label: "p дейін", value: fmt(pBefore, 4), unit: "кг·м/с" },
                { label: "p кейін", value: fmt(r.pAfter, 4), unit: "кг·м/с", tone: "amber" },
                { label: "Δp", value: fmt((r.pAfter ?? pBefore) - pBefore, 5), unit: "кг·м/с" },
                { label: "Eₖ кейін", value: fmt(r.ekAfter, 4), unit: "Дж" },
                {
                  label: "Энергия жоғалуы",
                  value: fmt(ekBefore - (r.ekAfter ?? ekBefore), 4),
                  unit: "Дж",
                  tone: "rose",
                },
              ]}
            />
          </Panel>
          <Panel title="Жылдамдықтар мен импульс">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "v1", label: "v₁", color: COLORS.x },
                { key: "v2", label: "v₂", color: COLORS.v },
                { key: "p", label: "p жалпы", color: COLORS.a },
              ]}
              yLabel="v, м/с · p, кг·м/с"
              symmetric
            />
          </Panel>
        </div>
      }
      tasks={[
        "e = 1 етіп қой және m₁ = m₂ ал. Соққыдан кейін арбалар жылдамдықтарымен «алмасатынын» көрсеткіштен тексер.",
        "e = 0 болғанда арбалар бірге қозғалады. Импульс сақталды ма? Кинетикалық энергия ше? Айырманы санмен көрсет.",
        "m₂-ні m₁-ден 3 есе ауыр қылып, u₂ = 0 ал. Жеңіл арба соққыдан кейін қай бағытта қозғалады? Неге?",
      ]}
    />
  );
}

function Scene({ engine, m1, m2 }: { engine: SimEngine<S>; m1: number; m2: number }) {
  const cart1 = useRef<THREE.Group>(null!);
  const cart2 = useRef<THREE.Group>(null!);
  const flash1 = useRef<THREE.Mesh>(null!);
  const flash2 = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const s = engine.stateRef.current;
    if (cart1.current) cart1.current.position.x = s.x1;
    if (cart2.current) cart2.current.position.x = s.x2;
    // The gate LEDs light while a cart is inside the beam.
    const inside = (x: number, gate: number) => Math.abs(x - gate) < CART_L / 2;
    if (flash1.current) {
      const m = flash1.current.material as THREE.MeshBasicMaterial;
      m.opacity = inside(s.x1, GATE_1) || inside(s.x2, GATE_1) ? 0.85 : 0.2;
    }
    if (flash2.current) {
      const m = flash2.current.material as THREE.MeshBasicMaterial;
      m.opacity = inside(s.x1, GATE_2) || inside(s.x2, GATE_2) ? 0.85 : 0.2;
    }
  });

  return (
    <group>
      <LabBench />
      <DynamicsTrack />

      {[GATE_1, GATE_2].map((g, i) => (
        <group key={g}>
          <PhotogateMount x={g} />
          <group position={[g, BENCH_H + GATE_LIFT, 0]}>
            <PascoModel spec={PASCO.smartGate} />
            <mesh ref={i === 0 ? flash1 : flash2} position={[0, 0.035, 0]}>
              <boxGeometry args={[0.004, 0.004, 0.11]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.25} />
            </mesh>
            <Tag position={[0, 0.15, 0]} tone="brand">
              Gate {i + 1}
            </Tag>
          </group>
        </group>
      ))}

      <group ref={cart1} position={[0.2, CART_Y, 0]}>
        <PascoModel spec={PASCO.smartCart} />
        <Bumper position={[CART_L / 2, 0.035, 0]} facing={1} />
        <Tag position={[0, 0.12, 0]} tone="brand">
          m₁ = {m1.toFixed(2)} кг
        </Tag>
      </group>
      <group ref={cart2} position={[1.0, CART_Y, 0]}>
        <PascoModel spec={PASCO.smartCart} rotation={[0, Math.PI, 0]} />
        <Bumper position={[-CART_L / 2, 0.035, 0]} facing={-1} color="#059669" />
        <Tag position={[0, 0.12, 0]} tone="emerald">
          m₂ = {m2.toFixed(2)} кг
        </Tag>
      </group>
    </group>
  );
}
