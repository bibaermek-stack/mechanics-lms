"use client";

// Module 5 — Жұмыс және энергия.
// The dynamics track is jacked up into a ramp; the Smart Cart is released from
// a chosen height and a photogate on the ramp times it on the way down. Potential
// energy, kinetic energy and the heat lost to friction are shown as live bars
// so that "energy is conserved, but not always as mechanical energy" is visible.

import { useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PASCO } from "../core/pascoCatalog";
import { PascoModel } from "../core/PascoModel";
import { SimDriver, SimStage } from "../core/SimStage";
import { useSimEngine, type SimEngine } from "../core/useSimEngine";
import { COLORS, G, SimLayout } from "../core/SimLayout";
import { LiveChart } from "../core/LiveChart";
import { BarMeter, Panel, PlayBar, Readout, Slider, fmt } from "../core/ui";
import { Tag } from "../core/primitives";
import {
  BENCH_H,
  GATE_LIFT,
  Incline,
  LabBench,
  PhotogateMount,
  TRACK_H,
  TRACK_L,
} from "../lab/equipment";

const S_MIN = 0.14; // cart centre cannot pass the lower end stop
const S_MAX = TRACK_L - 0.14;

interface S {
  s: number; // position measured along the ramp from its lower end
  v: number; // positive = moving up the ramp
  heat: number;
  /**
   * Kinetic energy taken by the end stop when the cart runs into it. Without
   * this the "Толық E" line falls off a cliff at the end of every run — the
   * energy is simply deleted — and the scene ends up demonstrating the
   * opposite of the law it is about.
   */
  absorbed: number;
  path: number;
  stopped: boolean;
}

export function Sim05Energy() {
  const [angleDeg, setAngleDeg] = useState(18);
  const [mass, setMass] = useState(0.5);
  const [mu, setMu] = useState(0.04);
  const [s0, setS0] = useState(0.95);

  const theta = (angleDeg * Math.PI) / 180;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);

  const engine = useSimEngine<S>({
    init: () => ({ s: s0, v: 0, heat: 0, absorbed: 0, path: 0, stopped: false }),
    step: (st, h) => {
      if (st.stopped) return;
      const gravAlong = -G * sinT; // always pulls toward the foot of the ramp
      const fricMag = mu * G * cosT;
      let a: number;
      if (Math.abs(st.v) < 1e-4) {
        // Static case: does gravity beat static friction?
        a = G * sinT > fricMag ? gravAlong + fricMag : 0;
      } else {
        a = gravAlong - Math.sign(st.v) * fricMag;
      }
      const vNext = st.v + a * h;
      // Friction can stop the cart but never reverse it on its own.
      st.v = Math.abs(st.v) > 1e-4 && Math.sign(vNext) !== Math.sign(st.v) && G * sinT <= fricMag ? 0 : vNext;
      const ds = st.v * h;
      st.s += ds;
      st.path += Math.abs(ds);
      st.heat += mu * mass * G * cosT * Math.abs(ds);
      if (st.s <= S_MIN) {
        st.s = S_MIN;
        // The bumper takes whatever kinetic energy is left, so the books still
        // balance once the cart has stopped.
        st.absorbed += 0.5 * mass * st.v * st.v;
        st.v = 0;
        st.stopped = true;
      }
      if (st.s >= S_MAX) {
        st.s = S_MAX;
        st.absorbed += 0.5 * mass * st.v * st.v;
        st.v = 0;
      }
    },
    read: (st) => {
      const height = (st.s - S_MIN) * sinT;
      const ep = mass * G * height;
      const ek = 0.5 * mass * st.v * st.v;
      return {
        s: st.s,
        v: st.v,
        h: height,
        Ep: ep,
        Ek: ek,
        Q: st.heat,
        W: st.absorbed,
        E: ep + ek + st.heat + st.absorbed,
        path: st.path,
      };
    },
    resetKey: [angleDeg, mass, mu, s0],
    duration: 20,
    // The cart is at the foot of the ramp in about eight tenths of a second,
    // so the scene opens at half speed rather than already finished.
    initialSpeed: 0.5,
  });

  const r = engine.readings;
  const h0 = (s0 - S_MIN) * sinT;
  const e0 = mass * G * h0;
  const willSlide = G * sinT > mu * G * cosT;

  return (
    <SimLayout
      goal="Көлбеу жазықтықтан босатылған арбаның потенциалдық энергиясының кинетикалық энергияға айналуын бақылап, үйкеліс жұмысының энергияны қалай «жоғалтатынын» өлшеу."
      formulas={["Eₚ = mgh", "Eₖ = mv²/2", "A_үйк = μmg·cosθ·s", "Eₚ + Eₖ + Q = const"]}
      pasco={[PASCO.smartCart, PASCO.smartGate]}
      built={["көтергіш тіреуі бар көлбеу рельс", "биіктік сызғышы", "энергия диаграммасы"]}
      stage={
        <SimStage camera={[0.9, 1.35, 1.3]} target={[0.6, BENCH_H + 0.12, 0]} extent={2}>
          <SimDriver engine={engine} />
          <Scene engine={engine} theta={theta} mass={mass} />
        </SimStage>
      }
      controls={
        <>
          <Panel title="Параметрлер">
            <div className="space-y-3">
              <PlayBar engine={engine} />
              <Slider label="Көлбеу бұрышы θ" unit="°" value={angleDeg} min={5} max={35} step={1} decimals={0} onChange={setAngleDeg} />
              <Slider label="Арба массасы m" unit="кг" value={mass} min={0.25} max={1.2} step={0.01} onChange={setMass} />
              <Slider label="Үйкеліс коэффициенті μ" value={mu} min={0} max={0.5} step={0.005} decimals={3} onChange={setMu} />
              <Slider label="Бастапқы орын s₀" unit="м" value={s0} min={0.3} max={S_MAX} step={0.01} onChange={setS0} />
            </div>
          </Panel>
          <Panel title="Энергия балансы">
            <BarMeter
              max={Math.max(e0, 1e-4)}
              items={[
                { label: "Eₚ — потенциалдық", value: r.Ep ?? 0, color: "#8b5cf6" },
                { label: "Eₖ — кинетикалық", value: r.Ek ?? 0, color: "#10b981" },
                { label: "Q — үйкеліс жылуы", value: r.Q ?? 0, color: "#ef4444" },
                { label: "Толық энергия", value: r.E ?? 0, color: "#3366ff" },
              ]}
            />
            <p className="mt-2 text-[10px] text-slate-500">
              Бастапқы толық энергия E₀ = mgh₀ = {fmt(e0, 3)} Дж
            </p>
          </Panel>
        </>
      }
      data={
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Өлшеу нәтижелері">
            <Readout
              items={[
                { label: "Уақыт t", value: fmt(engine.timeRef.current, 2), unit: "с" },
                { label: "Биіктік h", value: fmt(r.h, 3), unit: "м", tone: "brand" },
                { label: "Жылдамдық v", value: fmt(Math.abs(r.v), 3), unit: "м/с", tone: "emerald" },
                { label: "Eₚ", value: fmt(r.Ep, 4), unit: "Дж" },
                { label: "Eₖ", value: fmt(r.Ek, 4), unit: "Дж" },
                { label: "Q (жылу)", value: fmt(r.Q, 4), unit: "Дж", tone: "rose" },
                { label: "Тірекке берілді", value: fmt(r.W, 4), unit: "Дж", tone: "slate" },
                { label: "Толық E", value: fmt(r.E, 4), unit: "Дж", tone: "amber" },
                {
                  label: "Идеал v = √(2gh₀)",
                  value: fmt(Math.sqrt(2 * G * Math.max(h0 - r.h, 0)), 3),
                  unit: "м/с",
                },
              ]}
            />
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs font-semibold ${
                willSlide
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
              }`}
            >
              {willSlide
                ? `tg θ = ${fmt(Math.tan(theta), 3)} > μ = ${fmt(mu, 3)} — арба сырғанайды.`
                : `tg θ = ${fmt(Math.tan(theta), 3)} ≤ μ = ${fmt(mu, 3)} — арба орнында тұрып қалады.`}
            </p>
          </Panel>
          <Panel title="Энергия — уақыт">
            <LiveChart
              series={engine.series}
              lines={[
                { key: "Ep", label: "Eₚ", color: COLORS.e1 },
                { key: "Ek", label: "Eₖ", color: COLORS.v },
                { key: "Q", label: "Q", color: COLORS.f },
                { key: "W", label: "Тірек", color: COLORS.e2 },
                { key: "E", label: "Толық E", color: COLORS.x },
              ]}
              yLabel="E, Дж"
              height={160}
            />
          </Panel>
        </div>
      }
      tasks={[
        "μ = 0 кезінде арба төменгі нүктеде қандай жылдамдыққа жетеді? Оны v = √(2gh₀) формуласымен салыстыр.",
        "μ-ді 0,15-ке қой. Толық механикалық энергия (Eₚ + Eₖ) неге кемиді, ал Eₚ + Eₖ + Q неге тұрақты қалады?",
        "Арба төменгі тірекке соғылғанда кинетикалық энергия қайда кетті? «Тірекке берілді» бағанын бақыла — «Толық E» сызығы неге түзу қалады?",
        "Бұрышты өзгертіп, арба қозғалмай тұрып қалатын шартты тап. Ол tg θ ≤ μ шартына сәйкес келе ме?",
      ]}
    />
  );
}

function Scene({ engine, theta, mass }: { engine: SimEngine<S>; theta: number; mass: number }) {
  const cart = useRef<THREE.Group>(null!);

  useFrame(() => {
    const s = engine.stateRef.current;
    if (cart.current) cart.current.position.x = s.s;
  });

  return (
    <group>
      <LabBench to={TRACK_L + 0.06} />
      <Incline angle={theta}>
        <group ref={cart} position={[0.9, TRACK_H, 0]}>
          <PascoModel spec={PASCO.smartCart} />
          <Tag position={[0, 0.13, 0]} tone="brand">
            m = {mass.toFixed(2)} кг
          </Tag>
        </group>
        {/* The photogate is bolted to the ramp itself, so it stays square to
            the track at any angle and the cart runs straight through it. */}
        <PhotogateMount x={0.45} y={TRACK_H - 0.032} />
        <group position={[0.45, TRACK_H - 0.032 + GATE_LIFT, 0]}>
          <PascoModel spec={PASCO.smartGate} />
        </group>
        <Tag position={[0.45, 0.2, 0]} tone="brand">
          Smart Gate
        </Tag>
      </Incline>
      <Tag position={[TRACK_L + 0.02, BENCH_H + 0.2, 0]} tone="amber">
        θ = {((theta * 180) / Math.PI).toFixed(0)}°
      </Tag>
    </group>
  );
}
