"use client";

// Зертханалық жұмыс 8 — Еркін түсу үдеуін анықтау.
//
// Two photogates, a known separation, and a ball of known diameter. Each gate
// reports how long the ball took to cross it, which gives the speed at that
// height; g follows from v₂² − v₁² = 2gd.
//
// Deliberately *not* "drop height → time → g". That version hides the whole
// difficulty: it needs the release instant, which is exactly what a hand cannot
// give you, and it is why the real lab uses gates at all. Here the release
// height only decides how fast the ball is already moving when it arrives, and
// g comes out of the difference between two measurements — which is the method
// the table's "фотоқақпа арқылы алынған уақытты өңдеу" describes.

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
import { Tag } from "../core/primitives";
import { BENCH_H, LabBench, RodStand } from "../lab/equipment";

/** Height of the lower gate above the bench. */
const GATE2_Y = BENCH_H + 0.12;
const STAND_X = 0.35;

interface S {
  y: number;
  v: number;
  /** Simulated time, needed to timestamp the beam crossings. */
  t: number;
  /** Transit time through each gate, seconds. 0 = not yet measured. */
  dt1: number;
  dt2: number;
  /** Absolute time the ball first broke each beam. −1 = not yet. */
  tIn1: number;
  tIn2: number;
  done1: boolean;
  done2: boolean;
  landed: boolean;
}

/**
 * The instant, inside one step, at which the falling ball passed `threshold`.
 *
 * Counting whole steps instead — which is what this scene used to do — pins
 * every transit time to a multiple of the 2 ms integration step. The lower gate
 * is only open for about 8,8 ms, so a 2 ms rounding is a 25 % error in v₂, and
 * g comes out near 13,5 m/s² instead of 9,8. Interpolating between the two
 * positions either side of the beam removes that quantisation entirely.
 */
function crossingTime(tStart: number, h: number, yFrom: number, yTo: number, threshold: number) {
  const travelled = yFrom - yTo;
  if (travelled <= 0) return tStart;
  return tStart + h * ((yFrom - threshold) / travelled);
}

export function Sim12FreeFall() {
  const [h, setH] = useState(0.25); // release height above gate 1
  const [d, setD] = useState(0.35); // gate separation
  const [D, setD_] = useState(0.03); // ball diameter
  const [drag, setDrag] = useState(false);

  const gate1Y = GATE2_Y + d;
  const startY = gate1Y + h;

  // Light plastic ball: the drag term is small but not invisible, which is the
  // point of the toggle.
  const mass = 0.012;
  const k = drag ? 0.0016 : 0; // quadratic drag coefficient, N·s²/m²

  const engine = useSimEngine<S>({
    init: () => ({
      y: startY,
      v: 0,
      t: 0,
      dt1: 0,
      dt2: 0,
      tIn1: -1,
      tIn2: -1,
      done1: false,
      done2: false,
      landed: false,
    }),
    step: (s, hStep) => {
      if (s.landed) return;

      const yPrev = s.y;
      // v is downward-positive, so drag opposes it with the same sign rule.
      const aNow = G - (k * s.v * s.v) / mass;
      s.v += aNow * hStep;
      s.y -= s.v * hStep;

      // The beam is broken from the moment the bottom of the ball reaches it
      // until its top clears it — a transit of exactly one ball diameter.
      const time = (threshold: number) => crossingTime(s.t, hStep, yPrev, s.y, threshold);
      const measure = (beamY: number, tIn: number) => {
        const enter = beamY + D / 2;
        const exit = beamY - D / 2;
        let start = tIn;
        if (start < 0 && yPrev > enter && s.y <= enter) start = time(enter);
        if (start >= 0 && yPrev > exit && s.y <= exit) {
          return { tIn: start, dt: time(exit) - start };
        }
        return { tIn: start, dt: 0 };
      };

      if (!s.done1) {
        const m = measure(gate1Y, s.tIn1);
        s.tIn1 = m.tIn;
        if (m.dt > 0) {
          s.dt1 = m.dt;
          s.done1 = true;
        }
      }
      if (!s.done2) {
        const m = measure(GATE2_Y, s.tIn2);
        s.tIn2 = m.tIn;
        if (m.dt > 0) {
          s.dt2 = m.dt;
          s.done2 = true;
        }
      }

      s.t += hStep;

      if (s.y - D / 2 <= BENCH_H) {
        s.y = BENCH_H + D / 2;
        s.v = 0;
        s.landed = true;
      }
    },
    read: (s) => ({ y: s.y, v: s.v }),
    resetKey: [h, d, D, drag],
    duration: 6,
    // The whole fall lasts about four tenths of a second; at 1× there is
    // nothing to watch, so the scene opens slowed right down.
    initialSpeed: 0.25,
    stopWhen: (s) => s.landed,
  });

  const s = engine.stateRef.current;
  const r = engine.readings;

  // Everything below is computed the way the student would, from the two
  // measured transit times — never from G.
  const v1 = s.dt1 > 0 ? D / s.dt1 : null;
  const v2 = s.dt2 > 0 ? D / s.dt2 : null;
  const gMeasured = v1 !== null && v2 !== null ? (v2 * v2 - v1 * v1) / (2 * d) : null;
  const errorPct = gMeasured !== null ? ((gMeasured - G) / G) * 100 : null;

  return (
    <SimLayout
      goal="Екі фотоқақпа арқылы шардың екі нүктедегі жылдамдығын өлшеп, еркін түсу үдеуін есепте. Ауа кедергісін қосып, өлшеу қатесі қалай пайда болатынын көр."
      formulas={["v = D / Δt", "v₂² − v₁² = 2gd", "g = (v₂² − v₁²) / 2d", "F_кедергі = kv²"]}
      pasco={[PASCO.smartGate]}
      built={["штатив", "екі фотоқақпа деңгейі", "түсетін шар", "уақыт өлшегіш"]}
      stage={
        <SimStage camera={[0.7, 1.35, 1.1]} target={[STAND_X, BENCH_H + 0.35, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} gate1Y={gate1Y} startY={startY} ballD={D} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Параметрлер">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Slider
                label="Босату биіктігі (1-қақпадан жоғары)"
                unit="м"
                value={h}
                min={0.05}
                max={0.6}
                step={0.01}
                onChange={setH}
              />
              <Slider
                label="Қақпалар арасы d"
                unit="м"
                value={d}
                min={0.15}
                max={0.6}
                step={0.01}
                onChange={setD}
              />
              <Slider
                label="Шар диаметрі D"
                unit="м"
                value={D}
                min={0.015}
                max={0.05}
                step={0.005}
                decimals={3}
                onChange={setD_}
                hint="Δt тікелей осыған тәуелді: кіші шар — қысқа уақыт — үлкен салыстырмалы қате"
              />
              <Toggle label="Ауа кедергісін ескеру" checked={drag} onChange={setDrag} />
            </div>
          </Panel>
          <Panel title="Нәтиже">
            <p
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                gMeasured === null
                  ? "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300"
                  : Math.abs(errorPct ?? 0) < 2
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              }`}
            >
              {gMeasured === null
                ? "Шарды жіберіп, екі қақпадан да өткізіңіз."
                : `g = ${fmt(gMeasured, 3)} м/с² · нақты мәннен ауытқу ${fmt(errorPct ?? 0, 2)}%`}
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Өлшенген шамалар">
            <Readout
              items={[
                { label: "Δt₁ (1-қақпа)", value: s.dt1 > 0 ? fmt(s.dt1 * 1000, 2) : "—", unit: "мс" },
                { label: "Δt₂ (2-қақпа)", value: s.dt2 > 0 ? fmt(s.dt2 * 1000, 2) : "—", unit: "мс" },
                { label: "v₁ = D/Δt₁", value: v1 === null ? "—" : fmt(v1, 3), unit: "м/с", tone: "brand" },
                { label: "v₂ = D/Δt₂", value: v2 === null ? "—" : fmt(v2, 3), unit: "м/с", tone: "emerald" },
                { label: "Қақпалар арасы d", value: fmt(d, 3), unit: "м" },
                {
                  label: "Есептелген g",
                  value: gMeasured === null ? "—" : fmt(gMeasured, 3),
                  unit: "м/с²",
                  tone: "amber",
                },
                { label: "Ағымдағы биіктік", value: fmt(r.y - BENCH_H, 3), unit: "м" },
                { label: "Ағымдағы жылдамдық", value: fmt(r.v, 3), unit: "м/с" },
              ]}
            />
          </Panel>
          <Panel title="Түсу графигі">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "y", label: "y(t)", color: COLORS.x },
                { key: "v", label: "v(t)", color: COLORS.v },
              ]}
              yLabel="y, м · v, м/с"
            />
          </Panel>
        </div>
      }
      tasks={[
        "Ауа кедергісі өшірулі кезде тәжірибені жүргіз. Есептелген g неше пайызға ауытқыды? Неге нөл емес?",
        "Шар диаметрін ең кішісіне қой. Қате өсті ме? Δt қысқарғанда өлшеу дәлдігі неге нашарлайды?",
        "Қақпалар арасын d = 0,15 м-ден 0,6 м-ге дейін өзгертіп көр. Қай жағдайда нәтиже тұрақтырақ?",
        "Ауа кедергісін қос. g кемиді ме, өсе ме? Формуладағы қай шама шын мәнінде өзгерді?",
      ]}
    />
  );
}

function Scene({
  engine,
  gate1Y,
  startY,
  ballD,
}: {
  engine: SimEngine<S>;
  gate1Y: number;
  startY: number;
  ballD: number;
}) {
  const ball = useRef<THREE.Group>(null!);

  useFrame(() => {
    const s = engine.stateRef.current;
    if (ball.current) ball.current.position.y = s.y;
  });

  return (
    <group>
      <LabBench to={0.9} />
      <RodStand position={[STAND_X - 0.16, BENCH_H, 0]} height={startY - BENCH_H + 0.12} />

      {/* Two gates at the measured separation. The scan is the same device
          twice — that is how the bench is actually set up. */}
      {[gate1Y, GATE2_Y].map((y, i) => (
        <group key={i} position={[STAND_X, y, 0]}>
          <PascoModel spec={PASCO.smartGate} />
          <Tag position={[0.12, 0.02, 0]} tone={i === 0 ? "brand" : "emerald"}>
            {i === 0 ? "1-қақпа" : "2-қақпа"}
          </Tag>
          {/* The beam itself, so "breaking it" is visible rather than implied. */}
          <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.0008, 0.0008, 0.1, 6]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      ))}

      <group ref={ball} position={[STAND_X, startY, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[ballD / 2, 24, 16]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.35} metalness={0.1} />
        </mesh>
      </group>

      <Tag position={[STAND_X - 0.02, startY + 0.06, 0]} tone="slate">
        Босату нүктесі
      </Tag>
    </group>
  );
}
