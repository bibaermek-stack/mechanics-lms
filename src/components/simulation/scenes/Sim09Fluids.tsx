"use client";

// Module 9 — Сұйықтар механикасы.
// A block hangs from a spring scale on a stand above a tank, and the scale reads
// its apparent weight. The liquid level rises by exactly the displaced volume,
// and the buoyant force, apparent weight and hydrostatic pressure follow from
// that — either driven by hand with a slider, or by releasing the block and
// letting it find its own floating depth.

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
import { ArrowHandle, Segment, SegmentHandle, Tag, VectorArrow } from "../core/primitives";
import { LabBench, RodStand, BENCH_H } from "../lab/equipment";
import { LiquidHandle, Tank } from "../lab/apparatus";
import { SpringScale, SpringScaleHandle } from "../lab/instruments";

const TANK_X = 0.45;
const TANK_HW = 0.09; // inner half-width
const TANK_HD = 0.07; // inner half-depth
const TANK_H = 0.24;
const TANK_AREA = TANK_HW * 2 * TANK_HD * 2;
const LEVEL_0 = 0.15; // liquid depth with nothing submerged
const STAND_X = 0.16;
const ARM_Y = BENCH_H + 0.62;
const SENSOR_Y = ARM_Y - 0.09;

const LIQUIDS: Record<string, { rho: number; color: string }> = {
  Су: { rho: 1000, color: "#38bdf8" },
  Спирт: { rho: 789, color: "#a5b4fc" },
  "Өсімдік майы": { rho: 920, color: "#fbbf24" },
  Глицерин: { rho: 1260, color: "#86efac" },
};

const SOLIDS: Record<string, number> = {
  Пенопласт: 60,
  Ағаш: 700,
  Мұз: 917,
  Алюминий: 2700,
  Болат: 7850,
};

type Mode = "manual" | "release";

interface S {
  /** y of the block's bottom face, relative to the tank floor. */
  yb: number;
  v: number;
  rest: boolean;
}

export function Sim09Fluids() {
  // Opens on "release" rather than "manual": in manual mode the block starts
  // above the surface with every reading at zero and nothing happening until a
  // slider is touched, which is a poor first impression of Archimedes' law.
  const [mode, setMode] = useState<Mode>("release");
  const [liquid, setLiquid] = useState<keyof typeof LIQUIDS>("Су");
  const [solid, setSolid] = useState<keyof typeof SOLIDS>("Ағаш");
  const [side, setSide] = useState(0.05); // cube edge
  const [handY, setHandY] = useState(0.09); // manual bottom height above tank floor

  const rhoL = LIQUIDS[liquid].rho;
  const rhoS = SOLIDS[solid];
  const volume = side ** 3;
  const massBlock = rhoS * volume;
  const weight = massBlock * G;

  /**
   * Liquid rises as the block goes in, which in turn changes how much of the
   * block is under the surface. Three fixed-point passes converge to well
   * under a millimetre.
   */
  const solveSubmersion = (yBottom: number) => {
    let level = LEVEL_0;
    let depth = 0;
    for (let i = 0; i < 4; i++) {
      depth = Math.min(Math.max(level - yBottom, 0), side);
      const vSub = depth * side * side;
      level = LEVEL_0 + vSub / (TANK_AREA - side * side * (depth > 0 ? 1 : 0));
    }
    const vSub = depth * side * side;
    return { level, depth, vSub, buoy: rhoL * G * vSub };
  };

  const engine = useSimEngine<S>({
    init: () => ({ yb: mode === "manual" ? handY : 0.2, v: 0, rest: false }),
    step: (s, h) => {
      if (mode === "manual") {
        // Follow the slider smoothly rather than teleporting.
        s.yb += (handY - s.yb) * Math.min(1, h * 8);
        s.v = 0;
        return;
      }
      const { buoy } = solveSubmersion(s.yb);
      // Gravity, buoyancy and a viscous drag scaled to the block's own mass, so
      // a floating body actually settles at its equilibrium depth instead of
      // bobbing for ever.
      const drag = -(buoy > 0 ? 6 : 0.4) * massBlock * s.v;
      const a = (buoy - weight + drag) / massBlock;
      s.v += a * h;
      s.yb += s.v * h;
      if (s.yb <= 0) {
        s.yb = 0;
        s.v = Math.max(0, s.v); // resting on the tank floor
      }
      if (s.yb > TANK_H) {
        s.yb = TANK_H;
        s.v = Math.min(0, s.v);
      }
    },
    read: (s) => {
      const { level, depth, vSub, buoy } = solveSubmersion(s.yb);
      return {
        yb: s.yb,
        depth,
        level,
        buoy,
        apparent: Math.max(weight - buoy, 0),
        vSub: vSub * 1e6, // cm³
        pressure: rhoL * G * Math.max(level - s.yb, 0),
      };
    },
    // handY deliberately stays out of the reset key: the step eases the block
    // toward it, so dragging the slider moves the block instead of restarting
    // the run and wiping the chart.
    resetKey: [mode, liquid, solid, side],
    duration: 0,
  });

  const d = engine.readings;
  const floats = rhoS < rhoL;
  const floatDepth = floats ? (side * rhoS) / rhoL : side;

  return (
    <SimLayout
      goal="Архимед күшінің ығыстырылған сұйық көлеміне тәуелділігін өлшеу, дененің қалқу немесе бату шартын тығыздықтар арқылы түсіндіру."
      formulas={[
        "F_A = ρ_с·g·V_бат",
        "P = ρgh",
        "Салмақ_көрінетін = mg − F_A",
        "Қалқу шарты: ρ_дене < ρ_сұйық",
      ]}
      pasco={[]}
      built={["мөлдір ыдыс және сұйық", "штатив пен көлденең тірек", "серіппелі динамометр", "куб тәрізді дене"]}
      stage={
        <SimStage camera={[0.55, 1.35, 0.85]} target={[TANK_X, BENCH_H + 0.18, 0]} extent={1.6}>
          <SimDriver engine={engine} />
          <Scene
            engine={engine}
            side={side}
            liquidColor={LIQUIDS[liquid].color}
            solidName={solid}
            weight={weight}
          />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Параметрлер">
            <div className="space-y-3">
              <Segmented<Mode>
                label="Режим"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "manual", label: "Қолмен батыру" },
                  { value: "release", label: "Еркін жіберу" },
                ]}
              />
              {mode === "release" && <PlayBar engine={engine} />}
              <Segmented
                label="Сұйық"
                value={liquid as string}
                onChange={(v) => setLiquid(v as keyof typeof LIQUIDS)}
                options={Object.keys(LIQUIDS).map((k) => ({ value: k, label: k }))}
              />
              <Segmented
                label="Дене материалы"
                value={solid as string}
                onChange={(v) => setSolid(v as keyof typeof SOLIDS)}
                options={Object.keys(SOLIDS).map((k) => ({ value: k, label: k }))}
              />
              <Slider label="Куб қыры a" unit="м" value={side} min={0.025} max={0.08} step={0.005} decimals={3} onChange={setSide} />
              {mode === "manual" && (
                <Slider
                  label="Дененің төменгі қырының биіктігі"
                  unit="м"
                  value={handY}
                  min={0}
                  max={0.22}
                  step={0.005}
                  decimals={3}
                  onChange={setHandY}
                  hint="Сұйық деңгейінен төмен түсір — Архимед күші өседі"
                />
              )}
            </div>
          </Panel>
          <Panel title="Болжам">
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-mono">
                ρ_дене = {rhoS} кг/м³ · ρ_сұйық = {rhoL} кг/м³
              </p>
              <p
                className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  floats
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                }`}
              >
                {floats
                  ? `ρ_дене < ρ_сұйық — дене қалқиды, батқан бөлігі ${(floatDepth * 100).toFixed(1)} см (${((rhoS / rhoL) * 100).toFixed(0)}%).`
                  : "ρ_дене ≥ ρ_сұйық — дене түбіне батады."}
              </p>
              <p className="font-mono">m = ρV = {fmt(massBlock, 4)} кг</p>
              <p className="font-mono">mg = {fmt(weight, 4)} Н</p>
            </div>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Өлшемдер">
            <Readout
              items={[
                { label: "Батқан тереңдік", value: fmt(d.depth * 100, 2), unit: "см", tone: "brand" },
                { label: "V_батқан", value: fmt(d.vSub, 1), unit: "см³" },
                { label: "Архимед күші F_A", value: fmt(d.buoy, 4), unit: "Н", tone: "emerald" },
                { label: "Ауырлық mg", value: fmt(weight, 4), unit: "Н", tone: "rose" },
                { label: "Көрінетін салмақ", value: fmt(d.apparent, 4), unit: "Н", tone: "amber" },
                { label: "Сұйық деңгейі", value: fmt(d.level * 100, 2), unit: "см" },
                { label: "Қысым P = ρgh", value: fmt(d.pressure, 1), unit: "Па" },
                { label: "Динамометр көрсеткіші", value: fmt(d.apparent, 4), unit: "Н", tone: "amber" },
              ]}
            />
          </Panel>
          <Panel title="Тереңдік пен Архимед күші">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "depth", label: "батқан тереңдік, м", color: COLORS.x },
                { key: "buoy", label: "F_A, Н", color: COLORS.v },
              ]}
              yLabel="h, м · F, Н"
              height={160}
            />
          </Panel>
        </div>
      }
      tasks={[
        "Денені баяу батырып, F_A мен батқан тереңдіктің графигін бақыла. Дене толық батқаннан кейін F_A неге өспей қалады?",
        "Ағашты суға және спиртке салып көр. Қай сұйықта тереңірек батады және неге?",
        "Куб қырын екі есе арттырғанда Архимед күші неше есе өседі? (V ~ a³ екенін ескер.)",
      ]}
    />
  );
}

function Scene({
  engine,
  side,
  liquidColor,
  solidName,
  weight,
}: {
  engine: SimEngine<S>;
  side: number;
  liquidColor: string;
  solidName: string;
  weight: number;
}) {
  const block = useRef<THREE.Mesh>(null!);
  const scale = useRef<SpringScaleHandle>(null);
  const liquid = useRef<LiquidHandle>(null);
  const rope = useRef<SegmentHandle>(null);
  const arrowB = useRef<ArrowHandle>(null);
  const arrowW = useRef<ArrowHandle>(null);
  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());

  /**
   * Longest force arrow, in metres. The forces in this scene run from about a
   * tenth of a newton (a small foam cube) to forty (a large steel one), so a
   * fixed metres-per-newton scale cannot serve both: at 0,35 m/N the weight of
   * an ordinary wooden block was drawn a quarter of a metre long and ran down
   * through the tank floor and the bench. Both arrows are scaled together
   * instead, so their ratio — which is what the experiment is about — stays
   * readable while neither leaves the space above the bench.
   */
  const ARROW_MAX = 0.11;

  useFrame(() => {
    const s = engine.stateRef.current;
    const r = engine.readings;
    const yCentre = BENCH_H + s.yb + side / 2;
    if (block.current) block.current.position.set(TANK_X, yCentre, 0);
    liquid.current?.setLevel(r.level ?? 0.15);

    // The string hangs from the cross-arm itself, not from thin air below it.
    // Pointer runs from zero to the block's dry weight.
    scale.current?.setFraction(weight > 1e-9 ? (r.apparent ?? weight) / weight : 0);

    a.current.set(TANK_X, SENSOR_Y - 0.09, 0);
    b.current.set(TANK_X, yCentre + side / 2, 0);
    rope.current?.set(a.current, b.current);

    // Room between the block's centre and the bench top, so the downward arrow
    // stops short of the worktop however heavy the block is.
    const room = Math.max(yCentre - BENCH_H - 0.008, 0.015);
    const maxF = Math.max(weight, r.buoy ?? 0, 1e-6);
    const arrowScale = Math.min(ARROW_MAX, room) / maxF;

    a.current.set(TANK_X + side * 0.7, yCentre, 0);
    arrowB.current?.set(a.current, b.current.set(0, 1, 0), (r.buoy ?? 0) * arrowScale);
    a.current.set(TANK_X - side * 0.7, yCentre, 0);
    arrowW.current?.set(a.current, b.current.set(0, -1, 0), weight * arrowScale);
  });

  return (
    <group>
      <LabBench from={0.02} to={0.72} depth={0.45} />
      <RodStand position={[STAND_X, BENCH_H, 0]} height={0.62} armLength={TANK_X - STAND_X + 0.01} />

      {/* Spring scale hanging from the cross-arm: its reading is the apparent
          weight, which is what the whole experiment is about. */}
      <SpringScale ref={scale} position={[TANK_X, SENSOR_Y, 0]} />
      <Tag position={[TANK_X + 0.11, SENSOR_Y, 0]} tone="amber">
        динамометр
      </Tag>

      <Tank
        ref={liquid}
        position={[TANK_X, BENCH_H, 0]}
        size={[TANK_HW, TANK_HD, TANK_H]}
        liquidColor={liquidColor}
        initialLevel={LEVEL_0}
      />

      <Segment ref={rope} color="#e2e8f0" radius={0.0011} />

      <mesh ref={block} position={[TANK_X, BENCH_H + 0.2, 0]} castShadow>
        <boxGeometry args={[side, side, side]} />
        <meshStandardMaterial color="#b45309" roughness={0.65} metalness={0.15} />
      </mesh>
      <Tag position={[TANK_X - 0.13, BENCH_H + 0.29, 0]} tone="amber">
        {solidName}
      </Tag>

      <VectorArrow ref={arrowB} color="#22c55e" radius={0.004} />
      <VectorArrow ref={arrowW} color="#ef4444" radius={0.004} />
    </group>
  );
}
