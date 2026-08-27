"use client";

// Module 4 — Ньютон заңдары.
// One scene, three experiments picked with a switch:
//   1-заң  — a cart glides; friction can be turned on and off.
//   2-заң  — a fan accessory pushes with a chosen force: a = F/m.
//   3-заң  — two carts push apart through their magnetic bumpers, so the
//            forces are equal and opposite and the total momentum stays zero.

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PASCO } from "../core/pascoCatalog";
import { PascoModel } from "../core/PascoModel";
import { SimDriver, SimStage } from "../core/SimStage";
import { useSimEngine, type SimEngine } from "../core/useSimEngine";
import { COLORS, G, SimLayout } from "../core/SimLayout";
import { LiveChart } from "../core/LiveChart";
import { Panel, PlayBar, Readout, Segmented, Slider, Toggle, fmt } from "../core/ui";
import { ArrowHandle, Tag, VectorArrow } from "../core/primitives";
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
const X_MIN = 0.14;
const X_MAX = TRACK_L - 0.14;
/** Matches the scanned cart's on-screen length, so bumpers meet where they look like they meet. */
const CART_L = 0.21;
/** Centre-to-centre distance at which the two bumpers just touch. */
const CONTACT = CART_L + 0.02;
/** Bumper stiffness — high enough that contact is short but resolvable. */
const K_BUMPER = 900;
/** How far the bumpers start compressed in the third-law experiment. */
const PRELOAD = 0.012;

type Law = "first" | "second" | "third";

interface S {
  x1: number;
  v1: number;
  x2: number;
  v2: number;
  f: number; // contact force magnitude (third law) or applied force
}

export function Sim04NewtonLaws() {
  const [law, setLaw] = useState<Law>("second");
  const [m1, setM1] = useState(0.5);
  const [m2, setM2] = useState(0.75);
  const [force, setForce] = useState(0.4);
  const [friction, setFriction] = useState(false);
  const [showVectors, setShowVectors] = useState(true);

  const mu = friction ? 0.12 : 0;

  const engine = useSimEngine<S>({
    init: () =>
      law === "third"
        ? // The carts start pressed together with their bumpers compressed —
          // release is what launches them apart.
          { x1: 0.6 - CONTACT / 2, v1: 0, x2: 0.6 + CONTACT / 2 - PRELOAD, v2: 0, f: 0 }
        : { x1: law === "first" ? X_MIN : 0.2, v1: law === "first" ? 0.45 : 0, x2: 0, v2: 0, f: 0 },
    step: (s, h) => {
      if (law === "third") {
        // The bumpers behave as a stiff spring while they overlap.
        const gap = s.x2 - s.x1 - CONTACT;
        const f = gap < 0 ? -K_BUMPER * gap : 0;
        s.f = f;
        s.v1 += (-f / m1) * h;
        s.v2 += (f / m2) * h;
        s.x1 += s.v1 * h;
        s.x2 += s.v2 * h;
        if (s.x1 <= X_MIN) {
          s.x1 = X_MIN;
          s.v1 = 0;
        }
        if (s.x2 >= X_MAX) {
          s.x2 = X_MAX;
          s.v2 = 0;
        }
        return;
      }

      const applied = law === "second" ? force : 0;
      const fricMax = mu * m1 * G;
      let net: number;
      if (Math.abs(s.v1) > 1e-4) {
        // Moving: kinetic friction opposes the motion.
        net = applied - fricMax * Math.sign(s.v1);
      } else if (Math.abs(applied) <= fricMax) {
        // At rest and the pull cannot break it loose: static friction matches
        // the pull exactly and nothing moves.
        net = 0;
      } else {
        // Breaking away from rest. Friction still acts on this first step —
        // dropping it here reported a net force μm₁g too large at the very
        // moment the student is reading F = ma off the screen.
        net = applied - fricMax * Math.sign(applied);
      }
      s.f = net;
      const a = net / m1;
      const vNext = s.v1 + a * h;
      // Friction brings the cart to rest, it never reverses it.
      s.v1 = Math.abs(s.v1) > 1e-4 && Math.sign(vNext) !== Math.sign(s.v1) && applied === 0 ? 0 : vNext;
      s.x1 += s.v1 * h;
      if (s.x1 <= X_MIN) {
        s.x1 = X_MIN;
        s.v1 = Math.abs(s.v1) * 0.4;
      }
      if (s.x1 >= X_MAX) {
        s.x1 = X_MAX;
        s.v1 = -Math.abs(s.v1) * 0.4;
      }
    },
    read: (s) => ({
      x1: s.x1,
      v1: s.v1,
      x2: s.x2,
      v2: s.v2,
      f: s.f,
      p1: m1 * s.v1,
      p2: law === "third" ? m2 * s.v2 : 0,
      pTotal: m1 * s.v1 + (law === "third" ? m2 * s.v2 : 0),
      a1: law === "third" ? -s.f / m1 : s.f / m1,
      a2: law === "third" ? s.f / m2 : 0,
    }),
    resetKey: [law, m1, m2, force, friction],
    duration: 25,
  });

  const r = engine.readings;

  const fricMax = mu * m1 * G;
  const appliedNow = law === "second" ? force : 0;
  // What friction is actually doing right now, rather than the most it could
  // do: at rest it only matches the pull, and it never exceeds μN.
  const fricNow =
    Math.abs(r.v1 ?? 0) > 1e-4 ? fricMax : Math.min(Math.abs(appliedNow), fricMax);
  /** The pull is too small to break the cart loose from rest. */
  const heldStill = mu > 0 && Math.abs(r.v1 ?? 0) <= 1e-4 && Math.abs(appliedNow) <= fricMax;

  const readouts =
    law === "third"
      ? [
          { label: "Уақыт t", value: fmt(engine.timeRef.current, 2), unit: "с" },
          { label: "F₁ (2→1)", value: fmt(-r.f, 3), unit: "Н", tone: "rose" as const },
          { label: "F₂ (1→2)", value: fmt(r.f, 3), unit: "Н", tone: "emerald" as const },
          { label: "F₁ + F₂", value: fmt(0, 3), unit: "Н", tone: "brand" as const },
          { label: "v₁", value: fmt(r.v1, 3), unit: "м/с" },
          { label: "v₂", value: fmt(r.v2, 3), unit: "м/с" },
          { label: "p₁ + p₂", value: fmt(r.pTotal, 4), unit: "кг·м/с", tone: "brand" as const },
          { label: "|v₁|/|v₂|", value: fmt(Math.abs(r.v2) > 1e-6 ? Math.abs(r.v1 / r.v2) : 0, 2) },
        ]
      : [
          { label: "Уақыт t", value: fmt(engine.timeRef.current, 2), unit: "с" },
          { label: "Тең әсерлі күш F", value: fmt(r.f, 3), unit: "Н", tone: "rose" as const },
          { label: "Үдеу a = F/m", value: fmt(r.a1, 3), unit: "м/с²", tone: "amber" as const },
          { label: "Жылдамдық v", value: fmt(r.v1, 3), unit: "м/с", tone: "emerald" as const },
          { label: "Координата x", value: fmt(r.x1, 3), unit: "м", tone: "brand" as const },
          { label: "Импульс p", value: fmt(r.p1, 3), unit: "кг·м/с" },
          { label: "Үйкеліс күші", value: fmt(fricNow, 3), unit: "Н" },
          { label: "μ", value: fmt(mu, 2) },
        ];

  return (
    <SimLayout
      goal="Ньютонның үш заңын бір рельсте кезекпен тексеру: инерция, F = ma байланысы және әсер мен кері әсердің теңдігі."
      formulas={["ΣF = 0 ⇒ v = const", "a = F/m", "F₁₂ = −F₂₁", "m₁v₁ + m₂v₂ = 0"]}
      pasco={[PASCO.smartCart, PASCO.smartGate]}
      built={["динамикалық рельс", "магниттік бампер", "күш векторлары"]}
      stage={
        <SimStage camera={[0.7, 1.3, 1.3]} target={[0.6, BENCH_H + 0.05, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} law={law} showVectors={showVectors} m1={m1} m2={m2} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Тәжірибе">
            <div className="space-y-3">
              <Segmented<Law>
                value={law}
                onChange={setLaw}
                options={[
                  { value: "first", label: "1-заң" },
                  { value: "second", label: "2-заң" },
                  { value: "third", label: "3-заң" },
                ]}
              />
              <PlayBar engine={engine} />
              <Slider label="Арба массасы m₁" unit="кг" value={m1} min={0.25} max={1.5} step={0.01} onChange={setM1} />
              {law === "third" && (
                <Slider label="Екінші арба m₂" unit="кг" value={m2} min={0.25} max={1.5} step={0.01} onChange={setM2} />
              )}
              {law === "second" && (
                <Slider label="Түсірілген күш F" unit="Н" value={force} min={-1.5} max={1.5} step={0.05} onChange={setForce} />
              )}
              {law !== "third" && (
                <Toggle label="Үйкелісті қосу (μ = 0,12)" checked={friction} onChange={setFriction} />
              )}
              <Toggle label="Күш векторлары" checked={showVectors} onChange={setShowVectors} />
            </div>
          </Panel>
          <Panel title="Не байқау керек">
            <p
              className={
                heldStill && law === "second"
                  ? "rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800 dark:bg-amber-900/25 dark:text-amber-200"
                  : "text-xs leading-relaxed text-slate-600 dark:text-slate-300"
              }
            >
              {law === "first" &&
                "Үйкеліс өшірулі кезде арбаға ешбір тең әсерлі күш әсер етпейді — ол бірқалыпты қозғала береді. Үйкелісті қоссаң, қозғалыс тоқтайды: демек денені тоқтататын — «табиғи» қасиет емес, күш."}
              {law === "second" &&
                (heldStill
                  ? `Тарту күші ${fmt(force, 2)} Н тыныштық үйкелісінің шегінен (μm₁g = ${fmt(
                      fricMax,
                      2
                    )} Н) аспайды — арба орнынан қозғалмайды. Күшті арттыр немесе үйкелісті өшір.`
                  : "Күшті екі есе арттыр — үдеу де екі есе артады. Массаны екі есе арттыр — үдеу екі есе кемиді. a графигінің көлбеуін бақыла.")}
              {law === "third" &&
                "Бамперлер жанасқан сәтте екі арбаға шамасы тең, бағыты қарама-қарсы күштер әсер етеді. Жалпы импульс нөл күйінде қалады, ал жеңіл арба жылдамырақ ұшып кетеді."}
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Өлшемдер">
            <Readout items={readouts} />
          </Panel>
          <Panel title={law === "third" ? "Жылдамдықтар мен импульс" : "Жылдамдық пен күш"}>
            <LiveChart
              series={engine.series}
              lines={
                law === "third"
                  ? [
                      { key: "v1", label: "v₁", color: COLORS.v },
                      { key: "v2", label: "v₂", color: COLORS.x },
                      { key: "pTotal", label: "p₁+p₂", color: COLORS.f },
                    ]
                  : [
                      { key: "v1", label: "v(t)", color: COLORS.v },
                      { key: "f", label: "F(t)", color: COLORS.f },
                    ]
              }
              yLabel={law === "third" ? "v, м/с · p, кг·м/с" : "v, м/с · F, Н"}
              symmetric
            />
          </Panel>
        </div>
      }
      tasks={[
        "1-заң режимінде үйкелісті қосып-өшіріп көр. Аристотель «қозғалыс үшін күш керек» деген еді — бұл тәжірибе оны қалай теріске шығарады?",
        "2-заң режимінде F-ті тұрақты қалдырып, массаны 0,25-тен 1,5 кг-ға дейін өзгерт. a мен m арасындағы байланыс қандай (тура ма, кері ме)?",
        "3-заң режимінде m₂-ні m₁-ден үш есе ауыр қыл. Күштер тең болса, жылдамдықтар неге тең болмады? p₁ + p₂ мәнін тексер.",
      ]}
    />
  );
}

function Scene({
  engine,
  law,
  showVectors,
  m1,
  m2,
}: {
  engine: SimEngine<S>;
  law: Law;
  showVectors: boolean;
  m1: number;
  m2: number;
}) {
  const cart1 = useRef<THREE.Group>(null!);
  const cart2 = useRef<THREE.Group>(null!);
  const arrow1 = useRef<ArrowHandle>(null);
  const arrow2 = useRef<ArrowHandle>(null);
  const o = useRef(new THREE.Vector3());
  const d = useRef(new THREE.Vector3());

  const S_F = 0.05;

  useFrame(() => {
    const s = engine.stateRef.current;
    if (cart1.current) cart1.current.position.x = s.x1;
    if (cart2.current) cart2.current.position.x = s.x2;

    if (!showVectors) {
      arrow1.current?.set(o.current, d.current, 0);
      arrow2.current?.set(o.current, d.current, 0);
      return;
    }

    if (law === "third") {
      o.current.set(s.x1 - 0.04, CART_Y + 0.05, 0);
      arrow1.current?.set(o.current, d.current.set(-1, 0, 0), Math.abs(s.f) * S_F);
      o.current.set(s.x2 + 0.04, CART_Y + 0.05, 0);
      arrow2.current?.set(o.current, d.current.set(1, 0, 0), Math.abs(s.f) * S_F);
    } else {
      o.current.set(s.x1, CART_Y + 0.05, 0);
      arrow1.current?.set(o.current, d.current.set(Math.sign(s.f) || 1, 0, 0), Math.abs(s.f) * S_F * 3);
      arrow2.current?.set(o.current, d.current, 0);
    }
  });

  return (
    <group>
      <LabBench />
      <DynamicsTrack />

      {/* The gate straddles the track on its bracket, so the cart runs through
          the opening rather than into the crossbar. In the third-law run it
          would sit exactly where the carts separate, so it is moved aside. */}
      <PhotogateMount x={law === "third" ? 0.24 : 0.6} />
      <group position={[law === "third" ? 0.24 : 0.6, BENCH_H + GATE_LIFT, 0]}>
        <PascoModel spec={PASCO.smartGate} />
      </group>

      <group ref={cart1} position={[0.2, CART_Y, 0]}>
        <PascoModel spec={PASCO.smartCart} />
        <Tag position={[0, 0.12, 0]} tone="brand">
          m₁ = {m1.toFixed(2)} кг
        </Tag>
        {law === "third" && <Bumper position={[CART_L / 2, 0.035, 0]} facing={1} />}
      </group>

      {law === "third" && (
        <group ref={cart2} position={[0.75, CART_Y, 0]}>
          <PascoModel spec={PASCO.smartCart} rotation={[0, Math.PI, 0]} />
          <Tag position={[0, 0.12, 0]} tone="emerald">
            m₂ = {m2.toFixed(2)} кг
          </Tag>
          <Bumper position={[-CART_L / 2, 0.035, 0]} facing={-1} color="#059669" />
        </group>
      )}

      {showVectors && (
        <>
          <VectorArrow ref={arrow1} color="#ef4444" radius={0.005} />
          <VectorArrow ref={arrow2} color="#22c55e" radius={0.005} />
        </>
      )}
    </group>
  );
}
