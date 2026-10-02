"use client";

// Module 1 — Механикаға кіріспе.
// A Smart Cart runs along the track while a Wireless Motion Sensor watches it.
// The student switches the frame of reference (bench vs cart) and swaps the
// cart for a point mass, so "the same motion, different coordinates" and
// "path vs displacement" become visible rather than verbal.

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PASCO } from "../core/pascoCatalog";
import { PascoModel } from "../core/PascoModel";
import { SimDriver, SimStage } from "../core/SimStage";
import { useSimEngine, type SimEngine } from "../core/useSimEngine";
import { COLORS, SimLayout } from "../core/SimLayout";
import { LiveChart } from "../core/LiveChart";
import { Panel, PlayBar, Readout, Segmented, Slider, Toggle, fmt } from "../core/ui";
import { Tag, Trail, TrailHandle } from "../core/primitives";
import { BENCH_H, DynamicsTrack, LabBench, TRACK_H, TRACK_L } from "../lab/equipment";

const X_MIN = 0.13;
const X_MAX = TRACK_L - 0.13;
const CART_Y = BENCH_H + TRACK_H;

interface S {
  x: number;
  v: number;
  path: number;
}

type Frame = "bench" | "cart";

export function Sim01Intro() {
  const [speed, setSpeed] = useState(0.35);
  const [frame, setFrame] = useState<Frame>("bench");
  const [pointMass, setPointMass] = useState(false);
  const [showTrail, setShowTrail] = useState(true);

  const engine = useSimEngine<S>({
    init: () => ({ x: X_MIN, v: speed, path: 0 }),
    step: (s, h) => {
      s.x += s.v * h;
      s.path += Math.abs(s.v) * h;
      if (s.x <= X_MIN) {
        s.x = X_MIN;
        s.v = Math.abs(s.v);
      }
      if (s.x >= X_MAX) {
        s.x = X_MAX;
        s.v = -Math.abs(s.v);
      }
      // Keep responding to the speed slider while running.
      s.v = Math.sign(s.v) * speed;
    },
    read: (s) => ({
      x: s.x,
      xCart: 0,
      v: s.v,
      path: s.path,
      disp: s.x - X_MIN,
    }),
    resetKey: [],
  });

  const r = engine.readings;

  return (
    <SimLayout
      goal="Бір қозғалысты әртүрлі санақ жүйесінде сипаттап, «жол» мен «орын ауыстыру» ұғымдарының айырмашылығын көру, сондай-ақ денені материалдық нүкте моделімен алмастыруды үйрену."
      formulas={["x = x₀ + v·t", "жол s ≥ |орын ауыстыру Δx|", "Материалдық нүкте: өлшемі ескерілмейді"]}
      pasco={[PASCO.smartCart, PASCO.motionSensor]}
      built={["1,2 м динамикалық рельс", "зертханалық үстел", "координат осі", "траектория ізі"]}
      stage={
        <SimStage camera={[0.75, 1.35, 1.25]} target={[0.6, BENCH_H + 0.05, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene
            engine={engine}
            frame={frame}
            pointMass={pointMass}
            showTrail={showTrail}
            epoch={engine.epoch}
          />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Басқару">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Slider
                label="Арба жылдамдығы v"
                unit="м/с"
                value={speed}
                min={0.05}
                max={0.8}
                step={0.01}
                onChange={setSpeed}
              />
              <Segmented<Frame>
                label="Санақ жүйесі"
                value={frame}
                onChange={setFrame}
                options={[
                  { value: "bench", label: "Үстел (жер)" },
                  { value: "cart", label: "Арба" },
                ]}
              />
              <Toggle label="Материалдық нүкте моделі" checked={pointMass} onChange={setPointMass} />
              <Toggle label="Траекторияны көрсету" checked={showTrail} onChange={setShowTrail} />
            </div>
          </Panel>
          <Panel title="Түсіндірме">
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {frame === "bench"
                ? "Үстел санақ жүйесінде арба қозғалады, рельс пен сенсор тыныштықта."
                : "Арба санақ жүйесінде арба тыныштықта тұрғандай көрінеді — енді рельс пен сенсор кері бағытта жылжиды. Қозғалыс — салыстырмалы ұғым."}
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Сенсор көрсеткіштері">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(engine.timeRef.current, 1), unit: "с" },
                { label: "x (үстел)", value: fmt(r.x, 3), unit: "м", tone: "brand" },
                { label: "x (арба)", value: fmt(0, 3), unit: "м" },
                { label: "v (үстел)", value: fmt(r.v, 3), unit: "м/с", tone: "emerald" },
                { label: "v (арба)", value: fmt(0, 3), unit: "м/с" },
                { label: "Жол s", value: fmt(r.path, 3), unit: "м", tone: "amber" },
                { label: "Орын ауыстыру Δx", value: fmt(r.disp, 3), unit: "м", tone: "rose" },
                { label: "s − |Δx|", value: fmt(r.path - Math.abs(r.disp), 3), unit: "м" },
              ]}
            />
          </Panel>
          <Panel title="Координата графигі">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "x", label: "x — үстел жүйесі", color: COLORS.x },
                { key: "xCart", label: "x — арба жүйесі", color: COLORS.f },
              ]}
              yLabel="x, м"
              window={20}
            />
          </Panel>
        </div>
      }
      tasks={[
        "Санақ жүйесін ауыстырып көр: арба жүйесінде арбаның координатасы неге әрқашан нөлге тең?",
        "Арбаны рельстің бір шетінен екінші шетіне апарып қайтар. Жол мен орын ауыстырудың мәндері неге әртүрлі болды?",
        "Материалдық нүкте моделін қосып көр. Қандай есептерде бұл модель жарамды, ал қандай жағдайда арбаның нақты өлшемі маңызды болады?",
      ]}
    />
  );
}

function Scene({
  engine,
  frame,
  pointMass,
  showTrail,
  epoch,
}: {
  engine: SimEngine<S>;
  frame: Frame;
  pointMass: boolean;
  showTrail: boolean;
  epoch: number;
}) {
  const world = useRef<THREE.Group>(null!);
  const cart = useRef<THREE.Group>(null!);
  const origin = useRef<THREE.Group>(null!);
  const trail = useRef<TrailHandle>(null);
  const tmp = useRef(new THREE.Vector3());
  const lastEpoch = useRef(epoch);

  useFrame(() => {
    const s = engine.stateRef.current;
    if (cart.current) cart.current.position.x = s.x;
    // In the cart frame everything is shifted so the cart appears to stand
    // still while the track and the sensor slide past.
    if (world.current) world.current.position.x = frame === "cart" ? 0.6 - s.x : 0;
    // The origin of the chosen frame. In the cart frame it rides on the cart —
    // that is what "the cart's coordinate is always zero" means. It used to sit
    // at a fixed point on the bench and slide away with everything else.
    if (origin.current) origin.current.position.x = frame === "cart" ? s.x : 0;

    if (lastEpoch.current !== epoch) {
      lastEpoch.current = epoch;
      trail.current?.clear();
    }
    if (showTrail && trail.current) {
      tmp.current.set(s.x, CART_Y + 0.085, 0.07);
      trail.current.push(tmp.current);
    }
  });

  return (
    <group>
      <group ref={world}>
        <LabBench />
        <DynamicsTrack />

        {/* Motion sensor watching the cart from the zero mark */}
        <group position={[-0.075, BENCH_H, 0]} rotation={[0, Math.PI / 2, 0]}>
          <PascoModel spec={PASCO.motionSensor} />
        </group>
        <Tag position={[-0.075, BENCH_H + 0.13, 0]} tone="brand">
          Motion Sensor · x = 0
        </Tag>

        {/* Origin marker of the chosen frame */}
        <group ref={origin} position={[0, BENCH_H + 0.001, -0.075]}>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.003, 0.1, 0.003]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0.05, 0.001, 0]}>
            <boxGeometry args={[0.1, 0.003, 0.003]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
        </group>

        <group ref={cart} position={[X_MIN, CART_Y, 0]}>
          {pointMass ? (
            <>
              <mesh position={[0, 0.05, 0]} castShadow>
                <sphereGeometry args={[0.018, 24, 18]} />
                <meshStandardMaterial color="#ef4444" roughness={0.4} />
              </mesh>
              <Tag position={[0, 0.11, 0]} tone="rose">
                материалдық нүкте m
              </Tag>
            </>
          ) : (
            <>
              <PascoModel spec={PASCO.smartCart} />
              <Tag position={[0, 0.11, 0]} tone="slate">
                Smart Cart
              </Tag>
            </>
          )}
        </group>

        {showTrail && <Trail ref={trail} color="#f59e0b" max={400} />}
      </group>
    </group>
  );
}
