"use client";

// Зертханалық жұмыс 4 — Үйкеліс коэффициентін анықтау.
//
// The real procedure: pull the cart with the force sensor, increasing the pull
// slowly, and watch the reading. It climbs while nothing moves — that is static
// friction matching the pull exactly — peaks at the instant the cart breaks
// free, and then drops, because kinetic friction is smaller. Both coefficients
// are read straight off that one curve.
//
// The moment the cart moves, the pull is held at whatever it had reached. That
// is what a hand does: you stop pulling harder the instant it gives. Modelling
// it any other way (a pull that keeps ramping) buries the kinetic plateau under
// a growing acceleration and the graph stops teaching anything.

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
import { BENCH_H, DynamicsTrack, LabBench, TRACK_H, TRACK_L } from "../lab/equipment";

const CART_Y = BENCH_H + TRACK_H;
const X_START = 0.12;
/** The cart's centre when its nose meets the far end stop. */
const X_END = TRACK_L - 0.105;

/**
 * Coefficients are the textbook ranges for these pairings. μ_s > μ_k in every
 * row, which is the point the experiment exists to show.
 */
type SurfaceKey = "track" | "wood" | "felt" | "rubber";

const SURFACES: Record<SurfaceKey, { label: string; ms: number; mk: number; color: string }> = {
  track: { label: "Алюминий рельс", ms: 0.09, mk: 0.06, color: "#94a3b8" },
  wood: { label: "Ағаш тақтай", ms: 0.35, mk: 0.27, color: "#b98b5e" },
  felt: { label: "Фетр", ms: 0.48, mk: 0.34, color: "#7c8ba1" },
  rubber: { label: "Резеңке", ms: 0.78, mk: 0.62, color: "#3f4756" },
};

interface S {
  /** Applied pull, N. Ramps until breakaway, then held. */
  F: number;
  /** Friction force actually acting, N. */
  f: number;
  x: number;
  v: number;
  a: number;
  sliding: boolean;
  /** Pull at the instant it broke free — the static peak. */
  peak: number;
}

export function Sim11Friction() {
  const [surface, setSurface] = useState<SurfaceKey>("wood");
  const [extra, setExtra] = useState(0); // added mass on the cart, kg
  const [rate, setRate] = useState(0.6); // pull ramp, N/s

  const CART_M = 0.25; // PASCO Smart Cart, ME-1240
  const m = CART_M + extra;
  const N = m * G;
  const { ms, mk } = SURFACES[surface];
  const fStaticMax = ms * N;
  const fKinetic = mk * N;

  const engine = useSimEngine<S>({
    init: () => ({ F: 0, f: 0, x: X_START, v: 0, a: 0, sliding: false, peak: 0 }),
    step: (s, h) => {
      if (!s.sliding) {
        // Static: friction matches the pull exactly, so nothing moves…
        s.F += rate * h;
        s.f = Math.min(s.F, fStaticMax);
        s.a = 0;
        s.v = 0;
        // …until the pull exceeds what the surface can hold.
        if (s.F > fStaticMax) {
          s.sliding = true;
          s.peak = s.F;
        }
        return;
      }

      // Sliding: the pull is held at the breakaway value and friction drops to
      // its kinetic value, so the cart accelerates by the difference.
      s.f = fKinetic;
      s.a = (s.F - s.f) / m;
      s.v += s.a * h;
      s.x += s.v * h;

      if (s.x >= X_END) {
        s.x = X_END;
        s.v = 0;
        s.a = 0;
      }
    },
    read: (s) => ({ F: s.F, f: s.f, v: s.v, a: s.a, x: s.x }),
    resetKey: [surface, extra, rate],
    duration: 25,
    stopWhen: (s) => s.x >= X_END,
  });

  const r = engine.readings;
  const st = engine.stateRef.current;

  // What the student would compute from the readings, not from the constants.
  const measuredMs = st.peak > 0 ? st.peak / N : null;
  const measuredMk = st.sliding ? (st.F - m * r.a) / N : null;

  return (
    <SimLayout
      goal="Тартушы күшті баяу арттырып, Smart Cart-тың кірістірілген күш датчигінің көрсеткішін бақыла. Қисықтың шыңынан тыныштық үйкелісін, одан кейінгі деңгейінен сырғанау үйкелісін тап."
      formulas={["F_үйк ≤ μₛN (тыныштықта)", "F_үйк = μₖN (сырғанағанда)", "N = mg", "μ = F_үйк / N"]}
      pasco={[PASCO.smartCart]}
      built={["динамикалық рельс", "ауыстырмалы бет төсемдері", "тарту жібі", "күш векторлары"]}
      stage={
        <SimStage camera={[0.75, 1.15, 1.3]} target={[0.55, BENCH_H, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} surface={surface} extra={extra} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Параметрлер">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Segmented
                label="Жанасу беті"
                value={surface}
                options={(Object.keys(SURFACES) as SurfaceKey[]).map((k) => ({
                  value: k,
                  label: SURFACES[k].label,
                }))}
                onChange={setSurface}
              />
              <Slider
                label="Қосымша жүк"
                unit="кг"
                value={extra}
                min={0}
                max={0.5}
                step={0.05}
                onChange={setExtra}
                hint="Массаны арттырсаң N де, үйкеліс күші де өседі — ал μ өзгере ме?"
              />
              <Slider
                label="Тартуды арттыру жылдамдығы"
                unit="Н/с"
                value={rate}
                min={0.2}
                max={2}
                step={0.1}
                decimals={1}
                onChange={setRate}
              />
            </div>
          </Panel>
          <Panel title="Күй">
            <p
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                st.sliding
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              }`}
            >
              {st.sliding
                ? `Арба сырғанауда. Тарту ${fmt(st.F, 3)} Н деңгейінде ұсталды, үйкеліс ${fmt(fKinetic, 3)} Н-ге дейін төмендеді.`
                : `Тыныштықта. Үйкеліс тартуға тең (${fmt(r.f, 3)} Н) және μₛN = ${fmt(fStaticMax, 3)} Н-ден аспайды.`}
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Өлшенген шамалар">
            <Readout
              items={[
                { label: "Тартушы күш F", value: fmt(r.F, 3), unit: "Н", tone: "brand" },
                { label: "Үйкеліс күші", value: fmt(r.f, 3), unit: "Н", tone: "rose" },
                { label: "Тірек реакциясы N", value: fmt(N, 3), unit: "Н" },
                { label: "Масса m", value: fmt(m, 2), unit: "кг" },
                { label: "Үдеу a", value: fmt(r.a, 3), unit: "м/с²", tone: "amber" },
                { label: "Жылдамдық v", value: fmt(r.v, 3), unit: "м/с", tone: "emerald" },
                {
                  label: "Өлшенген μₛ",
                  value: measuredMs === null ? "—" : fmt(measuredMs, 3),
                  tone: "brand",
                },
                {
                  label: "Өлшенген μₖ",
                  value: measuredMk === null ? "—" : fmt(measuredMk, 3),
                  tone: "emerald",
                },
              ]}
            />
          </Panel>
          <Panel title="Күш пен жылдамдық">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "F", label: "F(t) — тарту", color: COLORS.x },
                { key: "f", label: "F_үйк(t)", color: COLORS.f },
                { key: "v", label: "v(t)", color: COLORS.v },
              ]}
              yLabel="F, Н · v, м/с"
            />
          </Panel>
        </div>
      }
      tasks={[
        "Қисықтың шыңын тап: дәл сол сәтте арба орнынан қозғалды. μₛ = F_шың / N есепте де, кестедегі мәнмен салыстыр.",
        "Қосымша жүкті 0-ден 0,5 кг-ға дейін өсір. F_шың өзгерді ме? μₛ өзгерді ме? Неге екеуі бірдей әрекет етпейді?",
        "Төрт бетті кезекпен сынап, μₛ мен μₖ-ны кестеге жаз. Қай бетте айырма ең үлкен?",
        "Тартуды арттыру жылдамдығын өзгерт. Шың мәні өзгере ме? Бұл μₛ-тың қандай қасиетін көрсетеді?",
      ]}
    />
  );
}

function Scene({
  engine,
  surface,
  extra,
}: {
  engine: SimEngine<S>;
  surface: SurfaceKey;
  extra: number;
}) {
  const cart = useRef<THREE.Group>(null!);
  const rope = useRef<SegmentHandle>(null);
  const arrowF = useRef<ArrowHandle>(null);
  const arrowFric = useRef<ArrowHandle>(null);
  const arrowN = useRef<ArrowHandle>(null);
  const arrowW = useRef<ArrowHandle>(null);

  const a = useRef(new THREE.Vector3());
  const b = useRef(new THREE.Vector3());

  // 5 N reads as 10 cm on screen.
  const S_F = 0.02;
  const pad = SURFACES[surface];

  useFrame(() => {
    const s = engine.stateRef.current;
    if (cart.current) cart.current.position.x = s.x;

    // The pull is a horizontal line from the cart's hook out past the track end.
    a.current.set(s.x + 0.1, CART_Y + 0.03, 0);
    b.current.set(TRACK_L + 0.08, CART_Y + 0.03, 0);
    rope.current?.set(a.current, b.current);

    const cx = s.x;
    const cy = CART_Y + 0.05;

    a.current.set(cx, cy, 0);
    arrowF.current?.set(a.current, b.current.set(1, 0, 0), s.F * S_F);
    a.current.set(cx, cy, 0);
    arrowFric.current?.set(a.current, b.current.set(-1, 0, 0), s.f * S_F);
    a.current.set(cx, cy + 0.02, 0);
    arrowN.current?.set(a.current, b.current.set(0, 1, 0), 0.06);
    a.current.set(cx, cy - 0.03, 0);
    arrowW.current?.set(a.current, b.current.set(0, -1, 0), 0.06);
  });

  return (
    <group>
      <LabBench to={TRACK_L + 0.02} />
      <DynamicsTrack />

      {/* The interchangeable surface pad the cart runs on. Colour is the only
          cue that the run just changed — the geometry is identical. */}
      <mesh position={[TRACK_L / 2, CART_Y + 0.0015, 0]} receiveShadow>
        <boxGeometry args={[TRACK_L - 0.04, 0.003, 0.075]} />
        <meshStandardMaterial color={pad.color} roughness={0.9} metalness={0.05} />
      </mesh>
      <Tag position={[TRACK_L / 2, BENCH_H - 0.07, 0]} tone="slate">
        {pad.label}
      </Tag>

      <Segment ref={rope} color="#f1f5f9" radius={0.0012} />

      <group ref={cart} position={[X_START, CART_Y, 0]}>
        <PascoModel spec={PASCO.smartCart} />
        {extra > 0 && (
          <mesh position={[0, 0.055, 0]} castShadow>
            <boxGeometry args={[0.08, 0.02 + extra * 0.06, 0.05]} />
            <meshStandardMaterial color="#64748b" roughness={0.6} metalness={0.3} />
          </mesh>
        )}
        <Tag position={[0, 0.15, 0]} tone="brand">
          Smart Cart · күш датчигі
        </Tag>
      </group>

      <VectorArrow ref={arrowF} color="#22c55e" radius={0.0045} />
      <VectorArrow ref={arrowFric} color="#ef4444" radius={0.0045} />
      <VectorArrow ref={arrowN} color="#0ea5e9" radius={0.0045} />
      <VectorArrow ref={arrowW} color="#8b5cf6" radius={0.0045} />
    </group>
  );
}
