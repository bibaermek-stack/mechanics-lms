"use client";

// Зертханалық жұмыс 9 — Айналмалы қозғалысты зерттеу.
//
// The Rotary Motion Sensor with a mass hanging from its three-step pulley. The
// weight falls, the string unwinds, the disc turns — and the sensor reports θ,
// ω and α directly, which is precisely the trio of graphs the work asks for.
//
// The point of the experiment is that the three curves are derivatives of one
// another: θ is a parabola, ω a straight line, α a constant. Choosing the
// pulley step changes the torque arm and so the slope of ω(t) without touching
// anything else — the cleanest way to see α ∝ r.

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
import { BENCH_H, LabBench, MassHanger, RodStand } from "../lab/equipment";

const SENSOR_X = 0.3;
const SENSOR_Y = BENCH_H + 0.42;

/** The three grooves of the PASCO three-step pulley, in metres. */
type Step = "small" | "mid" | "large";
const STEP_R: Record<Step, { r: number; label: string }> = {
  small: { r: 0.0125, label: "Кіші (12,5 мм)" },
  mid: { r: 0.019, label: "Орта (19 мм)" },
  large: { r: 0.0248, label: "Үлкен (24,8 мм)" },
};

/**
 * Moment of inertia of the shaft plus the standard PASCO aluminium disc
 * accessory, kg·m².
 *
 * The bare shaft alone is about 4,6·10⁻⁶, which is *smaller* than the mr² of
 * the hanging mass — so the weight essentially free-falls, the string unwinds
 * in a third of a second and there is nothing to watch or measure. The real
 * lab mounts the disc for exactly this reason, and so does this scene.
 */
const I_SENSOR = 9.4e-4;

interface S {
  theta: number;
  omega: number;
  alpha: number;
  /** How much string has unwound, metres. */
  drop: number;
  running: boolean;
}

export function Sim13RotaryKinematics() {
  const [step, setStep] = useState<Step>("mid");
  const [hangMass, setHangMass] = useState(0.05);
  const [extraI, setExtraI] = useState(0); // an added disc, ×10⁻⁵ kg·m²

  const r = STEP_R[step].r;
  const I = I_SENSOR + extraI * 1e-4;
  const m = hangMass;

  // Hanging mass and disc share one constraint, a = αr:
  //   mg − T = ma,  T·r = Iα  ⇒  α = mgr / (I + mr²)
  const alphaTheory = (m * G * r) / (I + m * r * r);
  const tension = m * (G - alphaTheory * r);

  /** The string is 0.5 m long; the run ends when it has all unwound. */
  const MAX_DROP = 0.5;

  const engine = useSimEngine<S>({
    init: () => ({ theta: 0, omega: 0, alpha: alphaTheory, drop: 0, running: true }),
    step: (s, h) => {
      if (!s.running) return;
      s.alpha = alphaTheory;
      s.omega += s.alpha * h;
      s.theta += s.omega * h;
      s.drop = s.theta * r;
      if (s.drop >= MAX_DROP) {
        s.drop = MAX_DROP;
        s.alpha = 0;
        s.running = false;
      }
    },
    read: (s) => ({ theta: s.theta, omega: s.omega, alpha: s.alpha }),
    resetKey: [step, hangMass, extraI],
    duration: 12,
    stopWhen: (s) => !s.running,
  });

  const rd = engine.readings;
  const t = engine.timeRef.current;
  // What the student reads off the graphs, rather than the constant above.
  const alphaFromSlope = t > 0.2 ? rd.omega / t : null;

  return (
    <SimLayout
      goal="Rotary Motion Sensor көмегімен айналмалы қозғалыстың үш шамасын бір мезгілде тіркеу: бұрыштық орын ауыстыру θ, бұрыштық жылдамдық ω және бұрыштық үдеу α. Үш графиктің бір-бірінің туындысы екенін көрсету."
      formulas={["α = mgr / (I + mr²)", "ω = αt", "θ = αt²/2", "a = αr", "T = m(g − αr)"]}
      pasco={[PASCO.rotarySensor]}
      built={["штатив", "үш сатылы шкив", "алюминий диск", "жүк ілгіші", "жіп"]}
      stage={
        <SimStage camera={[0.62, 1.25, 0.95]} target={[SENSOR_X, BENCH_H + 0.25, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} radius={r} hangMass={hangMass} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Параметрлер">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Segmented
                label="Шкив сатысы (иін r)"
                value={step}
                options={(Object.keys(STEP_R) as Step[]).map((k) => ({
                  value: k,
                  label: STEP_R[k].label,
                }))}
                onChange={setStep}
              />
              <Slider
                label="Ілінген жүк m"
                unit="кг"
                value={hangMass}
                min={0.01}
                max={0.2}
                step={0.005}
                decimals={3}
                onChange={setHangMass}
              />
              <Slider
                label="Қосымша инерция моменті"
                unit="×10⁻⁴ кг·м²"
                value={extraI}
                min={0}
                max={12}
                step={0.5}
                decimals={1}
                onChange={setExtraI}
                hint="Білікке диск қосу — I өседі, α кемиді"
              />
            </div>
          </Panel>
          <Panel title="Теориялық мәндер">
            <p className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-200">
              α = mgr/(I + mr²) = {fmt(alphaTheory, 2)} рад/с² · a = αr ={" "}
              {fmt(alphaTheory * r, 3)} м/с² · T = {fmt(tension, 3)} Н
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Датчик көрсеткіштері">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(t, 2), unit: "с" },
                { label: "Бұрыш θ", value: fmt(rd.theta, 2), unit: "рад", tone: "brand" },
                { label: "θ (айналым)", value: fmt(rd.theta / (2 * Math.PI), 2), unit: "айн" },
                { label: "Бұрыштық жылдамдық ω", value: fmt(rd.omega, 2), unit: "рад/с", tone: "emerald" },
                { label: "Бұрыштық үдеу α", value: fmt(rd.alpha, 2), unit: "рад/с²", tone: "amber" },
                {
                  label: "ω/t көлбеуінен α",
                  value: alphaFromSlope === null ? "—" : fmt(alphaFromSlope, 2),
                  unit: "рад/с²",
                },
                { label: "Сызықтық жылдамдық v = ωr", value: fmt(rd.omega * r, 3), unit: "м/с" },
                { label: "Инерция моменті I", value: fmt(I * 1e4, 2), unit: "×10⁻⁴ кг·м²" },
              ]}
            />
          </Panel>
          <Panel title="θ–t, ω–t, α–t">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "theta", label: "θ(t), рад", color: COLORS.x },
                { key: "omega", label: "ω(t), рад/с", color: COLORS.v },
                { key: "alpha", label: "α(t), рад/с²", color: COLORS.a },
              ]}
              yLabel="θ · ω · α"
            />
          </Panel>
        </div>
      }
      tasks={[
        "Үш қисықты салыстыр: θ(t) — парабола, ω(t) — түзу, α(t) — тұрақты. Неге дәл солай? Қайсысы қайсысының туындысы?",
        "Шкив сатысын кішіден үлкенге ауыстыр. α қалай өзгерді? Формуладағы r екі жерде тұр — қайсысы басым?",
        "Жүкті екі есе арттыр. α да екі есе өсті ме? Егер жоқ болса, mr² мүшесінің рөлі неде?",
        "Қосымша инерция моментін макс мәнге қой да, ω(t) көлбеуін өлшеп, I-ды формуладан кері есепте.",
      ]}
    />
  );
}

function Scene({
  engine,
  radius,
  hangMass,
}: {
  engine: SimEngine<S>;
  radius: number;
  hangMass: number;
}) {
  const disc = useRef<THREE.Group>(null!);
  const hanger = useRef<THREE.Group>(null!);
  const string = useRef<SegmentHandle>(null);
  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());

  const HANGER_Y0 = SENSOR_Y - 0.1;

  useFrame(() => {
    const s = engine.stateRef.current;
    // The scan itself turns — the shaft is the thing being measured.
    if (disc.current) disc.current.rotation.z = -s.theta;
    if (hanger.current) hanger.current.position.y = HANGER_Y0 - s.drop;

    a.current.set(SENSOR_X + radius, SENSOR_Y, 0);
    b.current.set(SENSOR_X + radius, HANGER_Y0 - s.drop + 0.02, 0);
    string.current?.set(a.current, b.current);
  });

  return (
    <group>
      <LabBench to={0.75} />
      <RodStand position={[SENSOR_X - 0.13, BENCH_H, 0]} height={SENSOR_Y - BENCH_H + 0.1} />

      <group ref={disc} position={[SENSOR_X, SENSOR_Y, 0]}>
        <PascoModel spec={PASCO.rotarySensor} />
      </group>
      <Tag position={[SENSOR_X, SENSOR_Y + 0.13, 0]} tone="brand">
        Rotary Motion Sensor
      </Tag>

      {/* The pulley groove the string actually leaves from, so the torque arm
          is something you can see rather than only read. */}
      <mesh position={[SENSOR_X, SENSOR_Y, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.0014, 8, 40]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} metalness={0.3} />
      </mesh>
      <Tag position={[SENSOR_X - 0.09, SENSOR_Y - 0.03, 0]} tone="amber">
        r = {(radius * 1000).toFixed(1)} мм
      </Tag>

      <Segment ref={string} color="#f1f5f9" radius={0.0011} />

      <group ref={hanger} position={[SENSOR_X + radius, HANGER_Y0, 0]}>
        <MassHanger discs={Math.max(1, Math.round(hangMass / 0.05))} />
        <Tag position={[0.09, -0.02, 0]} tone="emerald">
          m = {hangMass.toFixed(3)} кг
        </Tag>
      </group>
    </group>
  );
}
