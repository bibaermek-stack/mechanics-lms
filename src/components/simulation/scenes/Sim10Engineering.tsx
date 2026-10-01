"use client";

// Module 10 — Инженерлік механика.
// A model bridge: a simply supported beam with the Smart Cart driving across it
// as a moving load, and a dial indicator reading the deflection at midspan. The
// beam really bends according to the Euler–Bernoulli solution for a point load,
// and the reactions, bending moment, stress and safety factor update live.

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
import { Tag } from "../core/primitives";
import { LabBench, BENCH_H } from "../lab/equipment";
import { Beam, BeamHandle, BeamSupports } from "../lab/apparatus";
import { DialIndicator, DialIndicatorHandle } from "../lab/instruments";

const SPAN = 0.9;
const BEAM_Y = BENCH_H + 0.14;
/** How far the beam is allowed to sag on screen, whatever the real deflection. */
const VISUAL_SAG = 0.035;

/**
 * Real deflections range from microns (thick steel) to metres (a thin wooden
 * strip past its elastic limit), so a fixed multiplier either shows nothing or
 * drives the beam through the bench. Instead the exaggeration is chosen per
 * configuration from the worst case — a load at midspan — and stays constant
 * for the whole run so the animation reads consistently.
 */
function exaggerationFor(P: number, E: number, I: number): number {
  const deltaMid = (P * SPAN ** 3) / (48 * E * I);
  if (!(deltaMid > 0)) return 1;
  return Math.min(20000, Math.max(1, VISUAL_SAG / deltaMid));
}

const MATERIALS: Record<string, { E: number; sy: number; rho: number; color: string }> = {
  Болат: { E: 200e9, sy: 250e6, rho: 7850, color: "#94a3b8" },
  Алюминий: { E: 70e9, sy: 95e6, rho: 2700, color: "#cbd5e1" },
  Ағаш: { E: 11e9, sy: 40e6, rho: 600, color: "#b45309" },
  Бетон: { E: 30e9, sy: 3e6, rho: 2400, color: "#a8a29e" },
};

interface S {
  a: number; // load position measured from the left support
  dir: number;
}

export function Sim10Engineering() {
  const [material, setMaterial] = useState<keyof typeof MATERIALS>("Болат");
  const [heightMm, setHeightMm] = useState(6);
  const [widthMm, setWidthMm] = useState(25);
  const [loadKg, setLoadKg] = useState(1.5);
  const [autoDrive, setAutoDrive] = useState(true);
  const [manualA, setManualA] = useState(0.45);

  const mat = MATERIALS[material];
  const h = heightMm / 1000;
  const bw = widthMm / 1000;
  const I = (bw * h ** 3) / 12; // second moment of area
  const P = loadKg * G;
  const exaggeration = exaggerationFor(P, mat.E, I);

  const engine = useSimEngine<S>({
    init: () => ({ a: autoDrive ? 0.05 : manualA, dir: 1 }),
    step: (s, dt) => {
      if (!autoDrive) {
        s.a += (manualA - s.a) * Math.min(1, dt * 6);
        return;
      }
      s.a += s.dir * 0.16 * dt;
      if (s.a > SPAN - 0.05) {
        s.a = SPAN - 0.05;
        s.dir = -1;
      }
      if (s.a < 0.05) {
        s.a = 0.05;
        s.dir = 1;
      }
    },
    read: (s) => {
      const a = s.a;
      const bb = SPAN - a;
      const R1 = (P * bb) / SPAN;
      const R2 = (P * a) / SPAN;
      const mMax = (P * a * bb) / SPAN;
      const sigma = (mMax * (h / 2)) / I;
      // Deflection under the load itself.
      const delta = (P * a * a * bb * bb) / (3 * mat.E * I * SPAN);
      return {
        a,
        R1,
        R2,
        M: mMax,
        sigma: sigma / 1e6, // MPa
        delta: delta * 1000, // mm
        n: sigma > 1 ? mat.sy / sigma : 999,
      };
    },
    resetKey: [autoDrive, material, heightMm, widthMm, loadKg, autoDrive ? 0 : manualA],
  });

  const d = engine.readings;
  const unsafe = (d.n ?? 999) < 1.5;

  return (
    <SimLayout
      goal="Көпір арқалығын жүріп өтетін жүктің кернеу мен иілуге әсерін зерттеу; қима биіктігі мен материалдың беріктік қорына ықпалын бағалау."
      formulas={[
        "R₁ = P·b/L, R₂ = P·a/L",
        "M_max = P·a·b/L",
        "I = bh³/12",
        "σ = M·(h/2)/I",
        "δ = P·a²b²/(3EIL)",
        "n = σ_ағу/σ",
      ]}
      pasco={[PASCO.smartCart]}
      built={["екі тіректі арқалық (көпір)", "топсалы және роликті тірек", "индикатор-сағат", "иілу эпюрасы"]}
      stage={
        <SimStage camera={[0.55, 1.2, 1.0]} target={[SPAN / 2, BENCH_H + 0.12, 0]} extent={1.6}>
          <SimDriver engine={engine} />
          <Scene
            engine={engine}
            material={material}
            h={h}
            bw={bw}
            I={I}
            P={P}
            E={mat.E}
            exaggeration={exaggeration}
          />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Конструкция">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Segmented
                label="Материал"
                value={material as string}
                onChange={(v) => setMaterial(v as keyof typeof MATERIALS)}
                options={Object.keys(MATERIALS).map((k) => ({ value: k, label: k }))}
              />
              <Slider label="Қима биіктігі h" unit="мм" value={heightMm} min={2} max={20} step={0.5} decimals={1} onChange={setHeightMm} hint="I ~ h³ — биіктік беріктікке ең күшті әсер етеді" />
              <Slider label="Қима ені b" unit="мм" value={widthMm} min={8} max={60} step={1} decimals={0} onChange={setWidthMm} />
              <Slider label="Жүк массасы" unit="кг" value={loadKg} min={0.2} max={12} step={0.1} decimals={1} onChange={setLoadKg} />
              <Toggle label="Жүк автоматты жүріп өтсін" checked={autoDrive} onChange={setAutoDrive} />
              {!autoDrive && (
                <Slider label="Жүктің орны a" unit="м" value={manualA} min={0.05} max={SPAN - 0.05} step={0.01} onChange={setManualA} />
              )}
            </div>
          </Panel>
          <Panel title="Беріктік бағасы">
            <p
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                unsafe
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              }`}
            >
              {unsafe
                ? `Қауіпті: беріктік қоры n = ${fmt(d.n ?? 0, 2)} < 1,5. Қиманы биіктет немесе жүкті азайт.`
                : `Қауіпсіз: n = ${fmt(Math.min(d.n ?? 0, 99), 2)} ≥ 1,5.`}
            </p>
            <div className="mt-2 space-y-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
              <p>E = {(mat.E / 1e9).toFixed(0)} ГПа · σ_ағу = {(mat.sy / 1e6).toFixed(0)} МПа</p>
              <p>I = {(I * 1e12).toFixed(1)} мм⁴</p>
            </div>
          </Panel>
        </>
      }
      data={
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Есептік шамалар">
            <Readout
              items={[
                { label: "Жүктің орны a", value: fmt(d.a, 3), unit: "м", tone: "brand" },
                { label: "Реакция R₁", value: fmt(d.R1, 2), unit: "Н" },
                { label: "Реакция R₂", value: fmt(d.R2, 2), unit: "Н" },
                { label: "R₁ + R₂", value: fmt((d.R1 ?? 0) + (d.R2 ?? 0), 2), unit: "Н" },
                { label: "Иілу моменті M", value: fmt(d.M, 3), unit: "Н·м", tone: "amber" },
                { label: "Кернеу σ", value: fmt(d.sigma, 2), unit: "МПа", tone: unsafe ? "rose" : "emerald" },
                { label: "Иілу δ", value: fmt(d.delta, 3), unit: "мм" },
                { label: "Беріктік қоры n", value: fmt(Math.min(d.n ?? 0, 99), 2), tone: unsafe ? "rose" : "emerald" },
              ]}
            />
          </Panel>
          <Panel title="Момент пен иілудің жүк орнына тәуелділігі">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "M", label: "M, Н·м", color: COLORS.a },
                { key: "delta", label: "δ, мм", color: COLORS.x },
                { key: "sigma", label: "σ, МПа", color: COLORS.f },
              ]}
              yLabel="M · δ · σ"
              height={160}
            />
          </Panel>
        </div>
      }
      tasks={[
        "Жүк арқалықтың дәл ортасына келгенде M пен δ ең үлкен бола ма? Графиктен тексер де, M = Pab/L формуласымен түсіндір.",
        "h-ты 6 мм-ден 12 мм-ге дейін екі есе арттыр. Кернеу неше есе кемиді? (I ~ h³, ал σ ~ M·h/2/I екенін ескер.)",
        "Бір өлшемдегі болат пен ағаш арқалықты салыстыр: қайсысы қаттырақ (δ кіші), қайсысының беріктік қоры жоғары?",
      ]}
    />
  );
}

function Scene({
  engine,
  material,
  h,
  bw,
  I,
  P,
  E,
  exaggeration,
}: {
  engine: SimEngine<S>;
  material: keyof typeof MATERIALS;
  h: number;
  bw: number;
  I: number;
  P: number;
  E: number;
  exaggeration: number;
}) {
  const beam = useRef<BeamHandle>(null);
  const cart = useRef<THREE.Group>(null!);
  const dial = useRef<DialIndicatorHandle>(null);
  const color = MATERIALS[material].color;

  useFrame(() => {
    const a = engine.stateRef.current.a;
    const bb = SPAN - a;
    // Euler–Bernoulli deflection of a simply supported beam under a point load,
    // scaled for visibility and hard-capped so an over-loaded beam bows
    // dramatically instead of sinking through the bench.
    const cap = VISUAL_SAG * 1.6;
    const y = (x: number) => {
      const d =
        x <= a
          ? (P * bb * x * (SPAN * SPAN - bb * bb - x * x)) / (6 * SPAN * E * I)
          : (P * a * (SPAN - x) * (2 * SPAN * x - x * x - a * a)) / (6 * SPAN * E * I);
      return -Math.min(d * exaggeration, cap);
    };
    beam.current?.deflect(y);
    // The indicator reads the true deflection at midspan — computed directly,
    // not recovered from the drawn curve. The drawn curve is capped so an
    // overloaded beam does not sink through the bench, and dividing the capped
    // value back out made the dial under-read exactly when the beam was in
    // trouble.
    const mid = SPAN / 2;
    const trueMid =
      mid <= a
        ? (P * bb * mid * (SPAN * SPAN - bb * bb - mid * mid)) / (6 * SPAN * E * I)
        : (P * a * (SPAN - mid) * (2 * SPAN * mid - mid * mid - a * a)) / (6 * SPAN * E * I);
    dial.current?.setReading(trueMid * 1000);
    if (cart.current) cart.current.position.set(a, BEAM_Y + h / 2 + y(a), 0);
  });

  return (
    <group>
      <LabBench from={-0.22} to={SPAN + 0.14} depth={0.42} />
      <BeamSupports span={SPAN} y={BEAM_Y} width={Math.max(bw, 0.02)} baseY={BENCH_H} />
      <Beam ref={beam} span={SPAN} height={h} width={Math.max(bw, 0.02)} y={BEAM_Y} color={color} />

      <group ref={cart} position={[0.1, BEAM_Y + 0.02, 0]}>
        <PascoModel spec={PASCO.smartCart} />
      </group>

      {/* Dial indicator under midspan — the instrument an engineer actually
          uses to read a beam's deflection. */}
      <DialIndicator ref={dial} position={[SPAN / 2, BENCH_H, -0.13]} standHeight={BEAM_Y - BENCH_H - 0.05} />
      <Tag position={[SPAN / 2, BEAM_Y - 0.06, -0.13]} tone="amber">
        индикатор · иілу
      </Tag>
      <Tag position={[0, BEAM_Y - 0.1, 0]} tone="slate">
        топсалы тірек
      </Tag>
      <Tag position={[SPAN, BEAM_Y - 0.1, 0]} tone="slate">
        роликті тірек
      </Tag>
      <Tag position={[SPAN / 2, BEAM_Y + 0.16, 0]} tone="amber">
        аралық L = {SPAN.toFixed(2)} м · иілу ×{Math.round(exaggeration)}
      </Tag>
    </group>
  );
}
