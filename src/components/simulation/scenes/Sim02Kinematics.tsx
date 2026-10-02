"use client";

// Module 2 — Кинематика.
// The Wireless Motion Sensor pings the Smart Cart while it runs with a chosen
// v₀ and a. The three classic graphs (x–t, v–t, a–t) are drawn live from the
// sensor samples, so the student can read acceleration off a slope.

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PASCO } from "../core/pascoCatalog";
import { PascoModel } from "../core/PascoModel";
import { SimDriver, SimStage } from "../core/SimStage";
import { useSimEngine, type SimEngine } from "../core/useSimEngine";
import { COLORS, SimLayout } from "../core/SimLayout";
import { LiveChart } from "../core/LiveChart";
import { Panel, PlayBar, Readout, Segmented, Slider, fmt } from "../core/ui";
import { Tag } from "../core/primitives";
import { BENCH_H, DynamicsTrack, LabBench, TRACK_H, TRACK_L } from "../lab/equipment";

const X_MIN = 0.13;
const X_MAX = TRACK_L - 0.13;
const CART_Y = BENCH_H + TRACK_H;

interface S {
  x: number;
  v: number;
  a: number;
  path: number;
  stopped: boolean;
}

type Mode = "uniform" | "accel";

export function Sim02Kinematics() {
  const [mode, setMode] = useState<Mode>("accel");
  const [x0, setX0] = useState(0.15);
  const [v0, setV0] = useState(0.25);
  const [accel, setAccel] = useState(0.35);

  const a0 = mode === "uniform" ? 0 : accel;

  const engine = useSimEngine<S>({
    init: () => ({ x: x0, v: v0, a: a0, path: 0, stopped: false }),
    step: (s, h) => {
      if (s.stopped) return;
      s.a = a0;
      // Exact for constant acceleration. The usual v-then-x update drifts by
      // a·h·t/2 — over half a millimetre by the far end — which the theory
      // panel beside it, printing x to the millimetre, made visible.
      const dx = s.v * h + 0.5 * s.a * h * h;
      s.v += s.a * h;
      s.x += dx;
      s.path += Math.abs(dx);
      if (s.x <= X_MIN || s.x >= X_MAX) {
        s.x = Math.min(Math.max(s.x, X_MIN), X_MAX);
        s.v = 0;
        s.a = 0;
        s.stopped = true; // the end stop absorbs the cart
      }
    },
    read: (s) => ({ x: s.x, v: s.v, a: s.a, path: s.path, stopped: s.stopped ? 1 : 0 }),
    resetKey: [x0, v0, a0, mode],
    duration: 24,
    // Once the end stop has the cart the run is over; the clock running on to
    // 24 s left the theory panel extrapolating a cart a metre past the track.
    stopWhen: (s) => s.stopped,
  });

  const r = engine.readings;
  const t = engine.timeRef.current;

  return (
    <SimLayout
      goal="Бірқалыпты және бірқалыпты үдемелі қозғалысты Motion Sensor арқылы «өлшеп», x–t, v–t, a–t графиктерінің физикалық мағынасын ашу."
      formulas={["v = v₀ + a·t", "x = x₀ + v₀t + at²/2", "a = Δv/Δt", "v–t графигінің көлбеуі = a"]}
      pasco={[PASCO.smartCart, PASCO.motionSensor]}
      built={["1,2 м динамикалық рельс", "ультрадыбыс импульсінің толқындары", "өлшеу сызғышы"]}
      stage={
        <SimStage camera={[0.7, 1.3, 1.2]} target={[0.6, BENCH_H + 0.05, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Басқару">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Segmented<Mode>
                label="Қозғалыс түрі"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "uniform", label: "Бірқалыпты" },
                  { value: "accel", label: "Бірқалыпты үдемелі" },
                ]}
              />
              <Slider label="Бастапқы координата x₀" unit="м" value={x0} min={0.13} max={1.0} step={0.01} onChange={setX0} />
              <Slider label="Бастапқы жылдамдық v₀" unit="м/с" value={v0} min={-0.8} max={0.8} step={0.01} onChange={setV0} />
              {mode === "accel" && (
                <Slider
                  label="Үдеу a"
                  unit="м/с²"
                  value={accel}
                  min={-1.5}
                  max={1.5}
                  step={0.05}
                  onChange={setAccel}
                  hint="Теріс мән — тежелу (үдеу жылдамдыққа қарсы)"
                />
              )}
            </div>
          </Panel>
          <Panel title="Теориялық болжам">
            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <p className="font-mono">v(t) = {fmt(v0, 2)} + {fmt(a0, 2)}·t</p>
              <p className="font-mono">
                x(t) = {fmt(x0, 2)} + {fmt(v0, 2)}·t + {fmt(a0 / 2, 3)}·t²
              </p>
              <p className="pt-1">
                t = {fmt(t, 1)} с кезінде теория: v = {fmt(v0 + a0 * t, 3)} м/с, x ={" "}
                {fmt(x0 + v0 * t + (a0 * t * t) / 2, 3)} м
              </p>
              {r.stopped === 1 && (
                <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Арба рельстің шетіндегі тірекке жетіп тоқтады. Формулалар тек тірекке
                  дейінгі қозғалысты сипаттайды — одан кейін арбаға тіректің күші әсер етеді.
                </p>
              )}
            </div>
          </Panel>
        </>
      }
      data={
        <div className="space-y-4">
          <Panel title="Motion Sensor көрсеткіштері">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(t, 2), unit: "с" },
                { label: "Координата x", value: fmt(r.x, 3), unit: "м", tone: "brand" },
                { label: "Жылдамдық v", value: fmt(r.v, 3), unit: "м/с", tone: "emerald" },
                { label: "Үдеу a", value: fmt(r.a, 3), unit: "м/с²", tone: "amber" },
                { label: "Жүрілген жол", value: fmt(r.path, 3), unit: "м" },
                { label: "Орын ауыстыру", value: fmt(r.x - x0, 3), unit: "м" },
                { label: "Орташа жылдамдық", value: fmt(t > 0 ? (r.x - x0) / t : 0, 3), unit: "м/с" },
                { label: "Күй", value: r.stopped === 1 ? "тірекке жетті" : "қозғалыста" },
              ]}
            />
          </Panel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel>
              <LiveChart series={engine.series} lines={[{ key: "x", label: "x(t)", color: COLORS.x }]} yLabel="x, м" />
            </Panel>
            <Panel>
              <LiveChart
                series={engine.series}
                lines={[{ key: "v", label: "v(t)", color: COLORS.v }]}
                yLabel="v, м/с"
                symmetric
              />
            </Panel>
            <Panel>
              <LiveChart
                series={engine.series}
                lines={[{ key: "a", label: "a(t)", color: COLORS.a }]}
                yLabel="a, м/с²"
                symmetric
              />
            </Panel>
          </div>
        </div>
      }
      tasks={[
        "«Бірқалыпты» режимде a–t графигі неге нөлге тең сызық? v–t графигі қандай пішінде?",
        "a = 0,35 м/с² етіп қой да, v–t графигінің көлбеуін өлшеп көр: ол үдеуге тең бе?",
        "v₀ мен a-ны қарама-қарсы таңбамен қой (мысалы v₀ = 0,6; a = −0,5). Арба қашан тоқтап, кері бағытта қозғала бастайды? Мұны x–t графигінен қалай көруге болады?",
      ]}
    />
  );
}

/** Where the sensor's transducer face is, and the cart's half-length. */
const SENSOR_FACE = -0.035;
const CART_HALF = 0.105;

function Scene({ engine }: { engine: SimEngine<S> }) {
  const cart = useRef<THREE.Group>(null!);
  const ping = useRef<THREE.Mesh>(null!);
  const travel = useRef(0);

  useFrame((_, dt) => {
    const s = engine.stateRef.current;
    if (cart.current) cart.current.position.x = s.x;

    // An ultrasonic ping leaves the transducer and spreads toward the cart: a
    // cone with its apex on the sensor, stretching along the track until it
    // reaches the cart's rear face, then starting again. It used to be a fixed
    // metre-long sliver squashed flat, pointing the wrong way and reaching half
    // a metre behind the sensor.
    if (ping.current) {
      const reach = Math.max(s.x - CART_HALF - SENSOR_FACE, 0.02);
      // Clamped: a slow frame, or a tab coming back from the background, hands
      // over a delta of a second or more and the ping would restart every frame.
      travel.current += Math.min(dt, 1 / 30) * 1.2;
      if (travel.current > reach) travel.current = 0.01;
      const L = travel.current;
      const radius = 0.012 + L * 0.13; // the beam opens at about 7°
      const m = ping.current;
      m.scale.set(radius, L, radius);
      m.position.x = SENSOR_FACE + L / 2;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.32 * (1 - L / reach);
    }
  });

  return (
    <group>
      <LabBench />
      <DynamicsTrack />

      <group position={[-0.075, BENCH_H, 0]} rotation={[0, Math.PI / 2, 0]}>
        <PascoModel spec={PASCO.motionSensor} />
      </group>
      <Tag position={[-0.075, BENCH_H + 0.14, 0]} tone="brand">
        PS-3219 · ультрадыбыс
      </Tag>

      {/* Unit cone, apex at local +y; turned so +y points back at the sensor
          and scaled every frame to the current length and width of the ping. */}
      <mesh ref={ping} position={[SENSOR_FACE, CART_Y + 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[1, 1, 24, 1, true]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <group ref={cart} position={[0.15, CART_Y, 0]}>
        <PascoModel spec={PASCO.smartCart} />
      </group>
    </group>
  );
}
