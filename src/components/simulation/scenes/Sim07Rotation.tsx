"use client";

// Module 7 — Айналмалы қозғалыс.
// A flywheel on a bearing stand is spun up by a mass falling over a pulley at
// the bench edge. Three bodies of the *same* mass and radius — a solid disc, a
// thin ring and a cross of rods — give three different moments of inertia, so
// τ = Iα can be tested by changing I alone. A Smart Gate straddles the path of
// an index flag and is cut once per revolution, which is how ω is measured.

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
import { Segment, SegmentHandle, Tag } from "../core/primitives";
import {
  BENCH_H,
  LabBench,
  MassHanger,
  PulleyHandle,
  SuperPulley,
} from "../lab/equipment";
import { Flywheel, FlywheelHandle, FlywheelKind, FlywheelStand } from "../lab/apparatus";

const CX = 0.45; // axle position
const AXLE_Y = BENCH_H + 0.3;
const BODY_Z = 0.1;
const FLAG_OUT = 0.05;
const PULLEY_X = 1.0;
const PULLEY_R = 0.025;
/** Height of the scanned gate and of its clear opening, at its catalogue size. */
/**
 * Bearing friction, modelled as a constant *torque* rather than a constant
 * angular deceleration: a light wheel then slows quickly and a heavy one keeps
 * going, which is what really happens. It only acts once the string is slack,
 * so the driven phase stays the textbook ideal shown in the formula panel.
 */
const FRICTION_TORQUE = 4e-3; // Н·м

/** Moment of inertia of each body, for the same mass M and radius R. */
const SHAPES: Record<FlywheelKind, { label: string; factor: number; formula: string }> = {
  cross: { label: "Айқас өзек", factor: 1 / 3, formula: "I = ⅓MR²" },
  disc: { label: "Тұтас диск", factor: 1 / 2, formula: "I = ½MR²" },
  ring: { label: "Жұқа сақина", factor: 1, formula: "I = MR²" },
};

const DRUMS: Record<string, number> = { "10 мм": 0.01, "20 мм": 0.02, "30 мм": 0.03 };

interface S {
  theta: number;
  omega: number;
  drop: number;
  landed: boolean;
}

export function Sim07Rotation() {
  const [kind, setKind] = useState<FlywheelKind>("disc");
  const [mass, setMass] = useState(0.6); // flywheel mass
  const [radius, setRadius] = useState(0.1);
  const [mHang, setMHang] = useState(0.05);
  const [drum, setDrum] = useState<keyof typeof DRUMS>("20 мм");

  const Rd = DRUMS[drum];
  const I = SHAPES[kind].factor * mass * radius * radius;
  // Falling mass and flywheel are coupled through the string: a = mg/(m + I/R²).
  // Bearing friction acts the whole time, not only after the weight lands:
  //   mg − T = ma,  T·Rd − τ_fr = Iα,  a = αRd
  //   ⇒ α = (mg·Rd − τ_fr) / (I + m·Rd²)
  // Leaving τ_fr out of the driven phase and then applying it afterwards made
  // τ = Iα disagree with itself between the two halves of the same run.
  const alpha = Math.max((mHang * G * Rd - FRICTION_TORQUE) / (I + mHang * Rd * Rd), 0);
  const aLin = alpha * Rd;
  const tension = mHang * (G - aLin);
  const torque = tension * Rd;

  // The weight starts just under the drum and falls to the floor.
  const ropeTopY = AXLE_Y + Rd;
  const dropMax = Math.min(ropeTopY - 0.12, 0.8);

  const engine = useSimEngine<S>({
    init: () => ({ theta: 0, omega: 0, drop: 0, landed: false }),
    step: (s, h) => {
      if (!s.landed) {
        s.omega += alpha * h;
        s.drop += s.omega * Rd * h;
        if (s.drop >= dropMax) {
          s.drop = dropMax;
          s.landed = true;
        }
      } else {
        // The string has gone slack: only bearing friction is left.
        s.omega = Math.max(0, s.omega - (FRICTION_TORQUE / I) * h);
      }
      s.theta += s.omega * h;
    },
    read: (s) => ({
      theta: s.theta,
      omega: s.omega,
      alpha: s.landed ? (s.omega > 0 ? -FRICTION_TORQUE / I : 0) : alpha,
      landed: s.landed ? 1 : 0,
      turns: s.theta / (2 * Math.PI),
      vRim: s.omega * radius,
      T: s.omega > 0.05 ? (2 * Math.PI) / s.omega : 0,
      Ek: 0.5 * I * s.omega * s.omega,
      drop: s.drop,
    }),
    stopWhen: (s) => s.landed,
    resetKey: [kind, mass, radius, mHang, drum],
    duration: 30,
  });

  const d = engine.readings;
  const phase = !d.landed ? "drive" : (d.omega ?? 0) > 0.01 ? "coast" : "stopped";

  return (
    <SimLayout
      goal="Инерция моментінің дене пішініне, массасына және радиусына тәуелділігін зерттеу; айналмалы қозғалыс үшін Ньютон заңының аналогын (τ = Iα) тексеру."
      formulas={[
        "I = kMR²",
        "a = mg/(m + I/R²)",
        "α = a/R",
        "τ = T·R = Iα",
        "Eₖ = Iω²/2",
      ]}
      pasco={[PASCO.rotarySensor]}
      built={[
        "мойынтіректі штатив",
        "ауыспалы маховик (диск / сақина / айқас өзек)",
        "жетек барабаны мен жіп",
        "шетжақ шкиві, жүк ілгіші",
      ]}
      stage={
        <SimStage camera={[1.25, 1.5, 1.0]} target={[CX + 0.15, BENCH_H + 0.14, 0.05]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} kind={kind} radius={radius} Rd={Rd} ropeTopY={ropeTopY} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Айналатын дене">
            <div className="space-y-3">
              <Segmented<FlywheelKind>
                value={kind}
                onChange={setKind}
                options={(Object.keys(SHAPES) as FlywheelKind[]).map((k) => ({
                  value: k,
                  label: SHAPES[k].label,
                }))}
              />
              <PlayBar engine={engine} />
              <Slider label="Дене массасы M" unit="кг" value={mass} min={0.2} max={1.5} step={0.05} onChange={setMass} />
              <Slider
                label="Дене радиусы R"
                unit="м"
                value={radius}
                min={0.06}
                max={0.14}
                step={0.005}
                decimals={3}
                onChange={setRadius}
                hint="I ~ R² — радиус ең күшті әсер ететін шама"
              />
              <Slider label="Ілінген жүк m" unit="кг" value={mHang} min={0.01} max={0.25} step={0.005} decimals={3} onChange={setMHang} />
              <Segmented
                label="Барабан радиусы R_б"
                value={drum as string}
                onChange={(v) => setDrum(v as keyof typeof DRUMS)}
                options={Object.keys(DRUMS).map((k) => ({ value: k, label: k }))}
              />
            </div>
          </Panel>
          <Panel title="Теориялық есеп">
            <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
              <p>{SHAPES[kind].formula}</p>
              <p className="font-bold text-brand-600 dark:text-brand-300">
                I = {(I * 1000).toFixed(3)}·10⁻³ кг·м²
              </p>
              <p>T = {fmt(tension, 3)} Н</p>
              <p>τ = T·R_б = {fmt(torque * 1000, 2)}·10⁻³ Н·м</p>
              <p>α = τ/I = {fmt(alpha, 2)} рад/с²</p>
              <p>a = {fmt(aLin, 3)} м/с² (жүктің үдеуі)</p>
            </div>
            <p className="mt-2 rounded-lg bg-brand-50 px-2 py-1 text-[11px] text-brand-700 dark:bg-brand-900/30 dark:text-brand-200">
              Бірдей M мен R: айқас өзек {(1 / 3).toFixed(2)}MR² · диск 0,50MR² · сақина 1,00MR²
            </p>
            <p
              className={`mt-2 rounded-lg px-2 py-1 text-[11px] font-semibold ${
                alpha === 0
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  : phase === "drive"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : phase === "coast"
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  : "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
              }`}
            >
              {alpha === 0
                ? `Жүктің моменті m·g·R_б = ${fmt(mHang * G * Rd * 1000, 2)}·10⁻³ Н·м мойынтірек үйкелісінен (${fmt(
                    FRICTION_TORQUE * 1000,
                    2
                  )}·10⁻³ Н·м) кіші — маховик орнынан қозғалмайды. Жүкті ауырлат немесе барабанды үлкейт.`
                : phase === "drive"
                ? "Жүк түсіп жатыр — момент тұрақты, α тұрақты. Өлшеу осы кезеңде жүреді."
                : phase === "coast"
                ? "Жүк жерге жетті, жіп босады — өлшеу аяқталды, симуляция кідірді. «Бастау» бассаң, маховиктің инерциямен қалай баяулайтынын көресің."
                : "Маховик тоқтады."}
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Rotary Motion Sensor өлшемдері">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(engine.timeRef.current, 2), unit: "с" },
                { label: "Бұрыш θ", value: fmt(d.theta, 2), unit: "рад", tone: "brand" },
                { label: "Айналым саны", value: fmt(d.turns, 2) },
                { label: "ω", value: fmt(d.omega, 3), unit: "рад/с", tone: "emerald" },
                { label: "α", value: fmt(d.alpha, 3), unit: "рад/с²", tone: "amber" },
                { label: "Период T", value: fmt(d.T, 3), unit: "с" },
                { label: "Жиек жылдамдығы ωR", value: fmt(d.vRim, 3), unit: "м/с" },
                { label: "Айналу энергиясы", value: fmt(d.Ek, 4), unit: "Дж", tone: "rose" },
              ]}
            />
          </Panel>
          <Panel title="ω(t) және θ(t)">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "omega", label: "ω, рад/с", color: COLORS.v },
                { key: "theta", label: "θ, рад", color: COLORS.x },
              ]}
              yLabel="ω · θ"
              height={160}
            />
          </Panel>
        </div>
      }
      tasks={[
        "M мен R-ді өзгертпей, дискіні сақинаға ауыстыр. I неше есе өсті? α неше есе кемиді — дәл сонша ма?",
        "Радиусты 0,07-ден 0,14 м-ге дейін екі есе арттыр. I неше есе өсті? Бұл I ~ R² тәуелділігіне сай ма?",
        "Барабан радиусын 10 мм-ден 30 мм-ге ауыстыр. Момент τ = T·R_б өсті, бірақ α неге дәл үш есе өспеді? (α = a/R_б екенін еске ал.)",
      ]}
    />
  );
}

/** Rod stand that holds the edge pulley up over the bench. */
function PulleyPost({ x, z, top }: { x: number; z: number; top: number }) {
  const h = top - BENCH_H;
  return (
    <group position={[x, BENCH_H, z]}>
      <mesh position={[0, 0.01, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.11, 0.02, 0.11]} />
        <meshStandardMaterial color="#334155" roughness={0.7} />
      </mesh>
      <mesh position={[0, h / 2, 0]} castShadow>
        <cylinderGeometry args={[0.007, 0.007, Math.max(h, 0.02), 14]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0.015, h, 0]} castShadow>
        <boxGeometry args={[0.04, 0.022, 0.022]} />
        <meshStandardMaterial color="#475569" roughness={0.55} metalness={0.4} />
      </mesh>
    </group>
  );
}

function Scene({
  engine,
  kind,
  radius,
  Rd,
  ropeTopY,
}: {
  engine: SimEngine<S>;
  kind: FlywheelKind;
  radius: number;
  Rd: number;
  ropeTopY: number;
}) {
  const wheel = useRef<FlywheelHandle>(null);
  const pulley = useRef<PulleyHandle>(null);
  const hanger = useRef<THREE.Group>(null!);
  const ropeAcross = useRef<SegmentHandle>(null);
  const ropeDown = useRef<SegmentHandle>(null);
  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());
  const lastTheta = useRef(0);

  // The gate is turned upside down so its opening faces the descending flag;
  // the other way round its crossbar sits in the flag's path.

  useFrame(() => {
    const s = engine.stateRef.current;
    wheel.current?.setAngle(-s.theta);
    pulley.current?.spin((s.theta - lastTheta.current) * Rd / PULLEY_R);
    lastTheta.current = s.theta;

    const y = ropeTopY - 0.05 - s.drop;
    if (hanger.current) hanger.current.position.y = y;

    a.current.set(CX, ropeTopY, BODY_Z - 0.03);
    b.current.set(PULLEY_X, ropeTopY, BODY_Z - 0.03);
    ropeAcross.current?.set(a.current, b.current);
    a.current.set(PULLEY_X + PULLEY_R, ropeTopY, BODY_Z - 0.03);
    b.current.set(PULLEY_X + PULLEY_R, y + 0.02, BODY_Z - 0.03);
    ropeDown.current?.set(a.current, b.current);
  });

  return (
    <group>
      <LabBench from={0.02} to={0.98} depth={0.62} />

      <FlywheelStand x={CX} baseY={BENCH_H} axleY={AXLE_Y} />
      <Flywheel
        ref={wheel}
        position={[CX, AXLE_Y, BODY_Z]}
        kind={kind}
        radius={radius}
        drumRadius={Rd}
        flagOut={FLAG_OUT}
      />
      <Tag position={[CX, AXLE_Y + radius + 0.05, BODY_Z]} tone="slate">
        {SHAPES[kind].label}
      </Tag>

      {/* The Rotary Motion Sensor rides on the axle itself. A photogate would
          only see the index flag once per turn; the sensor reads the shaft
          continuously, which is what makes α measurable rather than inferred. */}
      <group position={[CX, AXLE_Y, BODY_Z - 0.09]} rotation={[0, Math.PI / 2, 0]}>
        <PascoModel spec={PASCO.rotarySensor} />
      </group>
      <Tag position={[CX - 0.17, AXLE_Y + 0.05, BODY_Z - 0.09]} tone="brand">
        Rotary Motion Sensor · θ, ω, α
      </Tag>

      {/* drive string over the edge pulley to the falling mass */}
      <Segment ref={ropeAcross} color="#f1f5f9" radius={0.0013} />
      <Segment ref={ropeDown} color="#f1f5f9" radius={0.0013} />
      <PulleyPost x={PULLEY_X - 0.03} z={BODY_Z - 0.03} top={ropeTopY - PULLEY_R - 0.05} />
      <SuperPulley ref={pulley} position={[PULLEY_X, ropeTopY - PULLEY_R, BODY_Z - 0.03]} radius={PULLEY_R} />
      <group ref={hanger} position={[PULLEY_X + PULLEY_R, ropeTopY - 0.05, BODY_Z - 0.03]}>
        <MassHanger discs={3} />
      </group>
      <Tag position={[PULLEY_X + 0.09, ropeTopY - 0.02, BODY_Z - 0.03]} tone="amber">
        m · g
      </Tag>
    </group>
  );
}
