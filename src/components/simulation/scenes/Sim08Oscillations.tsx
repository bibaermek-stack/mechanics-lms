"use client";

// Module 8 — Тербелістер.
// Two oscillators share one screen:
//   Серіппелі — Smart Cart on a spring, timed by a gate at equilibrium.
//   Математикалық — a pendulum dropping through an upturned gate.
// Both are integrated from the real equations of motion (the pendulum keeps the
// sin θ term), and the measured period is compared with the textbook formula so
// the small-angle approximation can be tested rather than trusted.

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PASCO } from "../core/pascoCatalog";
import { PascoModel } from "../core/PascoModel";
import { SimDriver, SimStage } from "../core/SimStage";
import { useSimEngine, type SimEngine } from "../core/useSimEngine";
import { COLORS, G, SimLayout } from "../core/SimLayout";
import { LiveChart } from "../core/LiveChart";
import { Panel, PlayBar, Readout, Segmented, Slider, fmt } from "../core/ui";
import { Tag } from "../core/primitives";
import {
  BENCH_H,
  DynamicsTrack,
  GATE_LIFT,
  LabBench,
  PhotogateMount,
  RodStand,
  Spring,
  SpringHandle,
  TRACK_H,
} from "../lab/equipment";
import { Pendulum, RotaryHandle, SwingGuide } from "../lab/apparatus";

const CART_Y = BENCH_H + TRACK_H;
const ANCHOR_X = 0.06;
const X_EQ = 0.55; // cart position where the spring is relaxed
const STAND_X = 0.45;
const PIVOT_Y = BENCH_H + 0.62;

type Mode = "spring" | "pendulum";

/**
 * Arithmetic–geometric mean. The exact period of a pendulum released from θ₀
 * is T₀ / AGM(1, cos(θ₀/2)) — Gauss's form of the complete elliptic integral —
 * and it converges to machine precision in five or six iterations.
 */
function agm(a: number, b: number): number {
  for (let i = 0; i < 12 && Math.abs(a - b) > 1e-15; i++) {
    const m = (a + b) / 2;
    b = Math.sqrt(a * b);
    a = m;
  }
  return a;
}

interface S {
  q: number; // displacement (m) or angle (rad)
  qd: number;
}

export function Sim08Oscillations() {
  const [mode, setMode] = useState<Mode>("spring");
  const [k, setK] = useState(6);
  const [mass, setMass] = useState(0.5);
  const [amp, setAmp] = useState(0.12);
  const [damping, setDamping] = useState(0.05);
  const [len, setLen] = useState(0.4);
  const [theta0, setTheta0] = useState(20);

  const th0 = (theta0 * Math.PI) / 180;

  const tTheorySpring = 2 * Math.PI * Math.sqrt(mass / k);
  const tTheoryPend = 2 * Math.PI * Math.sqrt(len / G);
  // First-order large-amplitude correction, so the student can see why the
  // simple formula drifts at big angles…
  const tPendCorrected = tTheoryPend * (1 + (th0 * th0) / 16);
  // …and the exact value, which the simulation — integrating sin θ itself —
  // reproduces. The first-order formula alone is a full percent short at 75°,
  // so offering it as "the corrected period" made an exact simulation look
  // wrong.
  const tPendExact = tTheoryPend / agm(1, Math.cos(th0 / 2));

  const engine = useSimEngine<S>({
    init: () => ({ q: mode === "spring" ? amp : th0, qd: 0 }),
    step: (s, h) => {
      // Semi-implicit Euler — energy-stable for oscillators at this step size.
      const acc =
        mode === "spring"
          ? (-k * s.q - damping * s.qd) / mass
          : -(G / len) * Math.sin(s.q) - damping * s.qd;
      s.qd += acc * h;
      s.q += s.qd * h;
    },
    read: (s, t) => {
      const disp = mode === "spring" ? s.q : (s.q * 180) / Math.PI;
      return {
        q: disp,
        v: mode === "spring" ? s.qd : (s.qd * 180) / Math.PI,
        x: mode === "spring" ? X_EQ + s.q : 0,
        Ek: mode === "spring" ? 0.5 * mass * s.qd * s.qd : 0.5 * mass * (len * s.qd) ** 2,
        Ep:
          mode === "spring"
            ? 0.5 * k * s.q * s.q
            : mass * G * len * (1 - Math.cos(s.q)),
        t,
      };
    },
    resetKey: [mode, k, mass, amp, damping, len, theta0],
    duration: 30,
  });

  const d = engine.readings;
  const tTheory = mode === "spring" ? tTheorySpring : tTheoryPend;
  const measured = measurePeriod(engine);

  return (
    <SimLayout
      goal="Гармоникалық тербелістің периодын өлшеп, оны формуламен салыстыру; периодтың амплитудаға тәуелді (немесе тәуелсіз) екенін тексеру."
      formulas={[
        "T = 2π√(m/k)",
        "T = 2π√(L/g)",
        "f = 1/T",
        "x(t) = A·cos(ωt)",
        "T ≈ T₀(1 + θ₀²/16)",
        "T_дәл = T₀ / AGM(1, cos θ₀/2)",
      ]}
      pasco={mode === "spring" ? [PASCO.smartCart, PASCO.smartGate] : [PASCO.smartGate]}
      built={
        mode === "spring"
          ? ["динамикалық рельс", "спиральды серіппе", "бекіткіш"]
          : ["штатив пен ілу нүктесі", "математикалық маятник", "тербеліс доғасы", "қақпа тұғыры"]
      }
      stage={
        <SimStage
          camera={mode === "spring" ? [0.6, 1.25, 1.2] : [0.75, 1.2, 0.9]}
          target={mode === "spring" ? [0.55, BENCH_H + 0.05, 0] : [STAND_X, BENCH_H + 0.3, 0]}
          extent={2}
        >
          <SimDriver engine={engine} />
          {mode === "spring" ? (
            <SpringScene engine={engine} mass={mass} />
          ) : (
            <PendulumScene engine={engine} len={len} theta0={th0} />
          )}
        </SimStage>
      }
      controls={
        <>
          <Panel title="Тербеліс түрі">
            <div className="space-y-3">
              <Segmented<Mode>
                value={mode}
                onChange={setMode}
                options={[
                  { value: "spring", label: "Серіппелі" },
                  { value: "pendulum", label: "Математикалық" },
                ]}
              />
              <PlayBar engine={engine} />
              {mode === "spring" ? (
                <>
                  <Slider label="Қатаңдық k" unit="Н/м" value={k} min={1} max={30} step={0.5} decimals={1} onChange={setK} />
                  <Slider label="Масса m" unit="кг" value={mass} min={0.2} max={1.5} step={0.05} onChange={setMass} />
                  <Slider label="Амплитуда A" unit="м" value={amp} min={0.02} max={0.25} step={0.01} onChange={setAmp} />
                </>
              ) : (
                <>
                  <Slider label="Жіп ұзындығы L" unit="м" value={len} min={0.15} max={0.52} step={0.01} onChange={setLen} />
                  <Slider label="Бастапқы бұрыш θ₀" unit="°" value={theta0} min={3} max={75} step={1} decimals={0} onChange={setTheta0} />
                </>
              )}
              <Slider
                label="Сөну коэффициенті b"
                value={damping}
                min={0}
                max={1.2}
                step={0.02}
                onChange={setDamping}
                hint="b = 0 — сөнбейтін гармоникалық тербеліс"
              />
            </div>
          </Panel>
          <Panel title="Период">
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-mono">
                T_теория = {fmt(tTheory, 3)} с{mode === "pendulum" && " (кіші бұрыш)"}
              </p>
              {mode === "pendulum" && (
                <>
                  <p className="font-mono">T₀(1 + θ₀²/16) = {fmt(tPendCorrected, 3)} с</p>
                  <p className="font-mono">T_дәл = {fmt(tPendExact, 3)} с</p>
                </>
              )}
              <p className="font-mono">T_өлшенген = {measured > 0 ? `${fmt(measured, 3)} с` : "—"}</p>
              <p className="font-mono">f = {measured > 0 ? fmt(1 / measured, 3) : "—"} Гц</p>
              {mode === "pendulum" && theta0 > 25 && (
                <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  θ₀ үлкен — sin θ ≈ θ жуықтауы бұзылады, өлшенген период формуладан үлкен болады.
                </p>
              )}
            </div>
          </Panel>
        </>
      }
      data={
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Сенсор көрсеткіштері">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(engine.timeRef.current, 2), unit: "с" },
                {
                  label: mode === "spring" ? "Ауытқу x" : "Бұрыш θ",
                  value: fmt(d.q, 3),
                  unit: mode === "spring" ? "м" : "°",
                  tone: "brand",
                },
                {
                  label: mode === "spring" ? "Жылдамдық v" : "ω",
                  value: fmt(d.v, 3),
                  unit: mode === "spring" ? "м/с" : "°/с",
                  tone: "emerald",
                },
                { label: "T_теория", value: fmt(tTheory, 3), unit: "с" },
                { label: "T_өлшенген", value: measured > 0 ? fmt(measured, 3) : "—", unit: "с", tone: "amber" },
                { label: "Жиілік f", value: measured > 0 ? fmt(1 / measured, 3) : "—", unit: "Гц" },
                { label: "Eₖ", value: fmt(d.Ek, 4), unit: "Дж" },
                { label: "Eₚ", value: fmt(d.Ep, 4), unit: "Дж" },
              ]}
            />
          </Panel>
          <Panel title={mode === "spring" ? "x(t) және v(t)" : "θ(t) және ω(t)"}>
            <LiveChart
              series={engine.series}
              lines={[
                { key: "q", label: mode === "spring" ? "x" : "θ", color: COLORS.x },
                { key: "v", label: mode === "spring" ? "v" : "ω", color: COLORS.v },
              ]}
              yLabel={mode === "spring" ? "x, м · v, м/с" : "θ, ° · ω, °/с"}
              symmetric
              window={12}
              height={160}
            />
          </Panel>
        </div>
      }
      tasks={[
        "Серіппелі маятникте амплитуданы екі есе арттыр. Период өзгерді ме? Неге?",
        "m-ді 4 есе арттырғанда период неше есе өседі? Формуладағы түбір мұны қалай түсіндіреді?",
        "Математикалық маятникте θ₀ = 5° және θ₀ = 70° үшін өлшенген периодтарды салыстыр. T = 2π√(L/g) формуласы қай жағдайда дәл жұмыс істейді?",
      ]}
    />
  );
}

/** Measures the period from the sampled series, by upward zero crossings. */
function measurePeriod(engine: SimEngine<S>): number {
  const series = engine.series;
  if (series.length < 8) return 0;
  const crossings: number[] = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1].q;
    const b = series[i].q;
    if (a < 0 && b >= 0) {
      // linear interpolation of the zero crossing time
      const f = -a / (b - a);
      crossings.push(series[i - 1].t + f * (series[i].t - series[i - 1].t));
    }
  }
  if (crossings.length < 2) return 0;
  const spans: number[] = [];
  for (let i = 1; i < crossings.length; i++) spans.push(crossings[i] - crossings[i - 1]);
  const last = spans.slice(-4);
  return last.reduce((s, v) => s + v, 0) / last.length;
}

function SpringScene({ engine, mass }: { engine: SimEngine<S>; mass: number }) {
  const cart = useRef<THREE.Group>(null!);
  const spring = useRef<SpringHandle>(null);

  useFrame(() => {
    const s = engine.stateRef.current;
    const x = X_EQ + s.q;
    if (cart.current) cart.current.position.x = x;
    spring.current?.set(ANCHOR_X, Math.max(x - 0.125 - ANCHOR_X, 0.02));
  });

  return (
    <group>
      <LabBench />
      <DynamicsTrack />
      {/* spring anchor bracket */}
      <mesh position={[ANCHOR_X - 0.012, CART_Y + 0.035, 0]} castShadow>
        <boxGeometry args={[0.018, 0.07, 0.06]} />
        <meshStandardMaterial color="#1e5aa8" roughness={0.5} />
      </mesh>
      <Spring ref={spring} y={CART_Y + 0.045} />
      {/* Gate at the equilibrium point: the cart cuts the beam twice per
          period, which is exactly how the period is timed in the lab. */}
      <PhotogateMount x={X_EQ} />
      <group position={[X_EQ, BENCH_H + GATE_LIFT, 0]}>
        <PascoModel spec={PASCO.smartGate} />
      </group>
      <Tag position={[X_EQ, BENCH_H + 0.21, 0]} tone="brand">
        Smart Gate · период
      </Tag>
      <group ref={cart} position={[X_EQ, CART_Y, 0]}>
        <PascoModel spec={PASCO.smartCart} />
        <Tag position={[0, 0.12, 0]} tone="brand">
          m = {mass.toFixed(2)} кг
        </Tag>
      </group>
      {/* equilibrium marker */}
      <mesh position={[X_EQ, CART_Y + 0.001, -0.06]}>
        <boxGeometry args={[0.002, 0.03, 0.002]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function PendulumScene({
  engine,
  len,
  theta0,
}: {
  engine: SimEngine<S>;
  len: number;
  theta0: number;
}) {
  const pend = useRef<RotaryHandle>(null);
  useFrame(() => {
    pend.current?.setAngle(engine.stateRef.current.q);
  });

  // The photogate is turned upside down so its opening faces up: the bob drops
  // into the gap at the bottom of the swing while the string passes freely
  // between the arms. Mounted the other way round its crossbar fouls the string.
  const bobY = PIVOT_Y - len;
  const GATE_H = 0.0867; // full height of the scanned gate at its set size
  const GATE_GAP = 0.0578; // clear opening, measured off the scan
  const gateTop = bobY + GATE_GAP / 2;
  const pillarH = Math.max(gateTop - GATE_H - BENCH_H, 0.02);

  return (
    <group>
      <LabBench from={0.05} to={0.95} depth={0.5} />
      <RodStand position={[STAND_X, BENCH_H, -0.07]} height={0.62} armLength={0.1} />

      {/* pivot clamp at the top of the string */}
      <mesh position={[STAND_X, PIVOT_Y, 0.02]} castShadow>
        <boxGeometry args={[0.03, 0.026, 0.07]} />
        <meshStandardMaterial color="#334155" roughness={0.6} metalness={0.35} />
      </mesh>
      <Tag position={[STAND_X - 0.09, PIVOT_Y + 0.05, 0]} tone="slate">
        ілу нүктесі
      </Tag>

      <SwingGuide position={[STAND_X, PIVOT_Y, 0.05]} length={len} maxAngle={theta0} />
      <Pendulum ref={pend} position={[STAND_X, PIVOT_Y, 0.05]} length={len} />

      <PhotogateMount x={STAND_X} lift={pillarH} spread={0.05} />
      <group position={[STAND_X, BENCH_H + pillarH + GATE_H, 0.05]} rotation={[0, 0, Math.PI]}>
        <PascoModel spec={PASCO.smartGate} />
      </group>
      <Tag position={[STAND_X + 0.14, bobY, 0.05]} tone="brand">
        Smart Gate · период
      </Tag>
    </group>
  );
}
