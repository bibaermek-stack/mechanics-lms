"use client";

// Lesson 10 — Engineering mechanics. A Warren truss bridge whose member forces
// are solved from statics as a truck drives over it; a tensile test of a steel
// specimen (σ, ε, Hooke's law, yield, fracture); and a steel I-beam loaded in
// the middle.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Plot, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, clamp, lerp, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { deflection, MEMBERS, SPAN, solveTruss } from "@/lib/studio/truss";
import { Arrow, Ground, Paving, Tree } from "../objects/common";
import { Q } from "../objects/materials";
import { Deck, Specimen, SPEC, TrussBridge, Truck, useIBeamGeometry } from "../objects/Structures";

const S = LESSON_SCRIPTS[10];
const at = (id: string) => chapterById(S, id);

const CH = {
  forces: at("forces").from,
  truck: at("truck").from,
  stress: at("stress").from,
  hooke: at("hooke").from,
  yield: at("yield").from,
  beam: at("beam").from,
  safety: at("safety").from,
};

const TEST_X = 100;
const BEAM_X = 150;

// ---- bridge -------------------------------------------------------------------
const P_TRUCK = 196; // kN: a 20 t truck
const MID_DEFL = 0.12; // m, real deflection with the load at mid-span
const EXAG = 8;
const T_TRUCK0 = CH.truck;
const T_TRUCK1 = CH.stress - 0.5;
const V_TRUCK = (SPAN + 12) / (T_TRUCK1 - T_TRUCK0);
/** Truck centre along the deck. Before and after the truck scene it parks mid-span. */
const truckX = (t: number) => {
  if (t < CH.forces) return -14 - 0 * t + 14 * smooth(seg(t, 2, 7)); // rolls onto the approach during the intro
  if (t < CH.truck) return 12;
  if (t < CH.stress) return -6 + V_TRUCK * (t - T_TRUCK0);
  return 12;
};
const bridgeAt = (t: number) => {
  const x = truckX(t);
  const sol = solveTruss(P_TRUCK, x);
  return { sol, x };
};

// ---- tensile test -------------------------------------------------------------
const E_MPA = 210000;
const SIG_Y = 235;
const EPS_Y = SIG_Y / E_MPA;
const AREA = Math.PI * SPEC.rGauge ** 2; // m²
const T_ELASTIC0 = CH.hooke + 0.5;
const T_ELASTIC1 = CH.hooke + 8.5;
const T_YIELD1 = CH.yield + 1.2;
const T_HARD1 = CH.yield + 5.8;
const T_NECK1 = CH.yield + 8.2;
const T_FRACTURE = T_NECK1;
const EPS_F = 0.28;
const epsAt = (t: number) => {
  if (t < T_ELASTIC0) return 0;
  if (t < T_ELASTIC1) return EPS_Y * ((t - T_ELASTIC0) / (T_ELASTIC1 - T_ELASTIC0));
  if (t < CH.yield + 0.2) return EPS_Y;
  if (t < T_YIELD1) return lerp(EPS_Y, 0.02, (t - CH.yield - 0.2) / (T_YIELD1 - CH.yield - 0.2));
  if (t < T_HARD1) return lerp(0.02, 0.18, (t - T_YIELD1) / (T_HARD1 - T_YIELD1));
  if (t < T_NECK1) return lerp(0.18, EPS_F, (t - T_HARD1) / (T_NECK1 - T_HARD1));
  return EPS_F;
};
/** Engineering stress (MPa) of a mild steel at strain ε. */
const sigma = (e: number) => {
  if (e < EPS_Y) return E_MPA * e;
  if (e < 0.02) return SIG_Y + ((e - EPS_Y) / (0.02 - EPS_Y)) * 5;
  if (e < 0.18) {
    const u = (e - 0.02) / 0.16;
    return 240 + 160 * (1 - (1 - u) * (1 - u));
  }
  const u = (e - 0.18) / (EPS_F - 0.18);
  return 400 - 70 * u * u;
};
const sigmaT = (t: number) => (t >= T_FRACTURE + 0.05 ? 0 : sigma(epsAt(t)));
const neckAt = (t: number) => smooth(seg(t, T_HARD1, T_NECK1));
const brokenAt = (t: number) => (t >= T_FRACTURE ? 0.5 + 0.5 * smooth(seg(t, T_FRACTURE, T_FRACTURE + 0.8)) : 0);

// ---- beam -------------------------------------------------------------------
const L_BEAM = 4;
const EI = 210e9 * 8.356e-5;
const W_COUNT = 5;
const W_T = [CH.beam + 1.4, CH.beam + 3.4, CH.beam + 5.4, CH.beam + 7.4, CH.beam + 9.4];
const loadN = (t: number) => W_T.reduce((n, tw) => n + smooth(seg(t, tw + 0.6, tw + 1.1)), 0); // number of tonnes on
const P_N = (t: number) => loadN(t) * 9800; // newtons
const BEAM_EXAG = 60;
const beamDefl = (x: number, t: number) => BEAM_EXAG * ((P_N(t) * L_BEAM ** 3) / (48 * EI)) * (x <= L_BEAM / 2 ? (x / L_BEAM) * (3 - 4 * (x / L_BEAM) ** 2) : ((L_BEAM - x) / L_BEAM) * (3 - 4 * ((L_BEAM - x) / L_BEAM) ** 2));
const BEAM_Y = 0.9;
const M_MAX = (t: number) => (P_N(t) * L_BEAM) / 4; // N·m
const SIG_BEAM = (t: number) => ((M_MAX(t) * 0.15) / 8.356e-5) / 1e6; // MPa

const anchor = (): Vec3 => [0, 0, 0];

// ---- world ------------------------------------------------------------------
function BeamRig() {
  const segN = 40;
  const geom = useIBeamGeometry(L_BEAM / segN + 0.004);
  const segs = useRef<(THREE.Mesh | null)[]>([]);
  const weights = useRef<(THREE.Mesh | null)[]>([]);
  useStudioFrame((t) => {
    for (let i = 0; i < segN; i++) {
      const m = segs.current[i];
      if (!m) continue;
      const x0 = (i * L_BEAM) / segN;
      const x1 = ((i + 1) * L_BEAM) / segN;
      const y0 = BEAM_Y - beamDefl(x0, t);
      const y1 = BEAM_Y - beamDefl(x1, t);
      m.position.set(BEAM_X + (x0 + x1) / 2 - L_BEAM / 2, (y0 + y1) / 2, 0);
      m.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    }
    const yc = BEAM_Y - beamDefl(L_BEAM / 2, t) + 0.15;
    W_T.forEach((tw, k) => {
      const w = weights.current[k];
      if (!w) return;
      w.visible = t >= tw;
      const fall = 1 - smooth(seg(t, tw, tw + 0.7));
      w.position.set(BEAM_X, yc + 0.14 + k * 0.28 + 2.2 * fall, 0);
    });
  });
  return (
    <group>
      {Array.from({ length: segN }, (_, i) => (
        <mesh key={i} ref={(m) => { segs.current[i] = m; }} geometry={geom} castShadow>
          <meshStandardMaterial color="#6b86a8" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <group key={s} position={[BEAM_X + s * (L_BEAM / 2), 0, 0]}>
          <mesh position={[0, 0.34, 0]} castShadow>
            <boxGeometry args={[0.3, 0.68, 0.5]} />
            <meshStandardMaterial color="#9aa5b6" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.7, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <boxGeometry args={[0.12, 0.12, 0.3]} />
            <meshStandardMaterial color="#c9d1dc" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: W_COUNT }, (_, k) => (
        <mesh key={k} ref={(m) => { weights.current[k] = m; }} castShadow visible={false}>
          <boxGeometry args={[0.36, 0.26, 0.36]} />
          <meshStandardMaterial color={k % 2 ? "#7b8aa0" : "#8b95a5"} metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function TestMachine() {
  const cross = useRef<THREE.Group>(null!);
  const y0 = 0.27; // top of the lower grip
  useStudioFrame((t) => {
    const e = epsAt(t);
    const br = brokenAt(t) > 0.5 ? 0.05 * smooth((brokenAt(t) - 0.5) * 2) : 0;
    // the crosshead rides with the top of the specimen
    cross.current.position.y = y0 + 2 * SPEC.end + SPEC.gauge * (1 + e) + br;
  });
  return (
    <group position={[TEST_X, 0, 0]}>
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 0.12, 0.4]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
      </mesh>
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.62, 0]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 1.0, 20]} />
          <meshStandardMaterial color="#d6dce6" metalness={0.95} roughness={0.2} />
        </mesh>
      ))}
      <mesh position={[0, 1.14, 0]} castShadow>
        <boxGeometry args={[0.7, 0.1, 0.3]} />
        <meshStandardMaterial color="#1f47e6" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* lower grip */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.12, 0.15, 0.12]} />
        <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.4} />
      </mesh>
      <group position={[0, y0, 0]}>
        <Specimen strain={epsAt} neck={neckAt} broken={brokenAt} />
      </group>
      {/* moving crosshead with its grip */}
      <group ref={cross}>
        <mesh position={[0, 0.07, 0]} castShadow>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.17, 0]} castShadow>
          <boxGeometry args={[0.68, 0.08, 0.28]} />
          <meshStandardMaterial color="#1f47e6" metalness={0.4} roughness={0.5} />
        </mesh>
      </group>
      <LiveTag
        tone="red"
        text={(t) => `F = ${num(sigmaT(t) * AREA * 1000, 1)} кН`}
        get={(t) => (t >= CH.stress + 0.6 && t < CH.beam ? { pos: [0.3, 0.42, 0.0], opacity: seg(t, CH.stress + 0.6, CH.stress + 1.4) } : null)}
      >
        F
      </LiveTag>
      <LiveTag
        tone="brand"
        text={(t) => `Δl = ${num(epsAt(t) * SPEC.gauge * 1000, t < CH.yield ? 2 : 1)} мм`}
        get={(t) => (t >= CH.hooke + 0.8 && t < CH.beam ? { pos: [-0.3, 0.42, 0.0], opacity: seg(t, CH.hooke + 0.8, CH.hooke + 1.6) } : null)}
      >
        Δl
      </LiveTag>
    </group>
  );
}

function World() {
  const truck = useRef<THREE.Group>(null!);
  useStudioFrame((t) => {
    truck.current.position.set(truckX(t), 0.36, 0);
    // follow the deck's deflection
    const d = deflection(clamp(truckX(t), 0, SPAN), truckX(t), MID_DEFL) * EXAG;
    truck.current.position.y -= d;
    truck.current.visible = t < CH.stress || t >= CH.safety;
  });
  const defl = (t: number) => (x: number) => deflection(x, truckX(t), MID_DEFL) * EXAG;
  const trussGet = (t: number) => {
    const s = bridgeAt(t);
    return { force: s.sol.force, defl: defl(t) };
  };

  return (
    <>
      <Ground size={900} x={60} />

      {/* ---- bridge over a river ---- */}
      <mesh position={[SPAN / 2, -5.6, 0]} receiveShadow>
        <boxGeometry args={[SPAN + 4, 0.2, 60]} />
        <meshStandardMaterial color="#3b8fcc" roughness={0.25} metalness={0.1} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s < 0 ? -22 : SPAN + 22, -3.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[44, 5.2, 60]} />
            <meshStandardMaterial color="#7a8a63" roughness={0.95} />
          </mesh>
          <mesh position={[s < 0 ? -22 : SPAN + 22, 0.1, 0]} receiveShadow>
            <boxGeometry args={[44, 0.4, 7.6]} />
            <meshStandardMaterial color="#4a5160" roughness={0.9} />
          </mesh>
          <mesh position={[s < 0 ? -0.5 : SPAN + 0.5, -2.6, 0]} castShadow>
            <boxGeometry args={[2, 5.2, 8.6]} />
            <meshStandardMaterial color="#aab2bf" roughness={0.85} />
          </mesh>
        </group>
      ))}
      <TrussBridge z={3.6} get={trussGet} />
      <TrussBridge z={-3.6} get={trussGet} />
      <Deck defl={defl} />
      <group ref={truck}>
        <Truck />
      </group>
      {/* the load on the structure and the support reactions */}
      <Arrow color={Q.weight} radius={0.14} get={(t) => (t >= CH.forces + 1 && t < CH.stress && truckX(t) > 0 && truckX(t) < SPAN ? { origin: [truckX(t), 6.8, 0], dir: [0, -1, 0], len: 2.6 * smooth(seg(t, CH.forces + 1, CH.forces + 2)) } : null)} />
      <Arrow color={Q.normal} radius={0.14} get={(t) => (t >= CH.forces + 2 && t < CH.stress ? { origin: [0, -2.6, 5.0], dir: [0, 1, 0], len: Math.max(0.01, (bridgeAt(t).sol.reactions[1] / P_TRUCK) * 4) } : null)} />
      <Arrow color={Q.normal} radius={0.14} get={(t) => (t >= CH.forces + 2 && t < CH.stress ? { origin: [SPAN, -2.6, 5.0], dir: [0, 1, 0], len: Math.max(0.01, (bridgeAt(t).sol.reactions[2] / P_TRUCK) * 4) } : null)} />
      <LiveTag tone="brand" text={(t) => `R = ${num(bridgeAt(t).sol.reactions[1], 0)} кН`} get={(t) => (t >= CH.forces + 2.4 && t < CH.stress ? { pos: [0, -1.2, 5.0], opacity: seg(t, CH.forces + 2.4, CH.forces + 3.2) } : null)}>
        R
      </LiveTag>
      <LiveTag tone="brand" text={(t) => `R = ${num(bridgeAt(t).sol.reactions[2], 0)} кН`} get={(t) => (t >= CH.forces + 2.4 && t < CH.stress ? { pos: [SPAN, -1.2, 5.0], opacity: seg(t, CH.forces + 2.4, CH.forces + 3.2) } : null)}>
        R
      </LiveTag>
      {[-50, -36, -22, 20, 34, 48, 66].map((x, i) => (
        <Tree key={x} position={[x < 0 ? x : SPAN + (x - 20), 0.3, 10 + (i % 3) * 3]} scale={1.4} tone={i} />
      ))}

      {/* ---- tensile test ---- */}
      <Paving x={TEST_X} z={0} w={20} d={14} />
      <mesh position={[TEST_X, 2.4, -2.2]} receiveShadow>
        <boxGeometry args={[20, 4.8, 0.1]} />
        <meshStandardMaterial color="#e6ebf3" roughness={0.95} />
      </mesh>
      <TestMachine />

      {/* ---- beam ---- */}
      <Paving x={BEAM_X} z={0} w={20} d={14} />
      <mesh position={[BEAM_X, 2.4, -2.2]} receiveShadow>
        <boxGeometry args={[20, 4.8, 0.1]} />
        <meshStandardMaterial color="#e6ebf3" roughness={0.95} />
      </mesh>
      <BeamRig />
      <LiveTag
        tone="red"
        text={(t) => `P = ${num(P_N(t) / 1000, 1)} кН`}
        get={(t) => (t >= W_T[0] + 0.5 && t < CH.safety + 4 ? { pos: [BEAM_X, BEAM_Y + 1.9 + 0.28 * loadN(t) * 0 + 0.0, 0], opacity: seg(t, W_T[0] + 0.5, W_T[0] + 1.3) } : null)}
      >
        P
      </LiveTag>
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function Overlay({ t }: { t: number }) {
  const { sol, x } = bridgeAt(t);
  const fmaxT = Math.max(0, ...sol.force);
  const fmaxC = Math.min(0, ...sol.force);
  const defMid = deflection(SPAN / 2, x, MID_DEFL) * 1000;
  const e = epsAt(t);
  const sg = sigmaT(t);
  const eFull = (s: number) => s;
  void eFull;
  const n = loadN(t);
  return (
    <>
      <Dip t={t} at={CH.stress} />
      <Dip t={t} at={CH.hooke - 0.0} width={0.6} />
      <Dip t={t} at={CH.beam} />

      <Card t={t} from={CH.forces + 0.4} to={CH.stress} place={{ left: "2.2cqw", top: "17cqh" }} title="Элемент күштері">
        <div style={{ fontSize: "1.55cqw", fontWeight: 800, lineHeight: 1.6 }}>
          <div><i className="st-dot" style={{ background: "#1d4ed8" }} />созылу</div>
          <div><i className="st-dot" style={{ background: "#dc2626" }} />сығылу</div>
        </div>
      </Card>
      <Card t={t} from={CH.forces + 1} to={CH.stress} place={{ right: "2.2cqw", top: "14cqh" }} title="Жүк көлігі · P = 196 кН" width="31cqw">
        <Row label="ең көп созылу" value={num(fmaxT, 0)} unit="кН" color="#1d4ed8" />
        <Row label="ең көп сығылу" value={num(Math.abs(fmaxC), 0)} unit="кН" color="#dc2626" />
        {t >= CH.truck && <Row label="иілу (орта)" value={num(defMid, 0)} unit="мм" color={Q.momentum} />}
      </Card>

      <Card t={t} from={CH.stress + 0.5} to={CH.hooke} place={{ right: "2.2cqw", top: "14cqh" }} title="Кернеу және деформация" width="36cqw">
        <Formula small>σ = F / S    ε = Δl / l₀</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="S (қима)" value="1,77" unit="см²" />
          <Row label="l₀ (өлшеу ұзындығы)" value="150" unit="мм" />
        </div>
      </Card>

      <Card t={t} from={CH.hooke + 0.5} to={CH.yield} place={{ right: "2.2cqw", top: "14cqh" }} title="Гук заңы" width="31cqw">
        <Formula note="E = 210 ГПа">σ = E · ε</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="ε" value={num(e * 100, 3)} unit="%" color={Q.velocity} />
          <Row label="σ" value={num(sg, 0)} unit="МПа" color={Q.force} />
        </div>
      </Card>
      <Card t={t} from={CH.hooke + 1} to={CH.yield} place={{ left: "2.2cqw", top: "17cqh" }} title="σ(ε), серпімді аймақ" width="30cqw">
        <Plot
          lines={[{ fn: (u) => E_MPA * (u / 100), color: Q.force, until: EPS_Y * 100 }]}
          x1={0.12}
          y1={250}
          xTicks={4}
          yTicks={5}
          cursor={Math.min(e * 100, EPS_Y * 100)}
          xLabel="ε, %"
          yLabel="σ, МПа"
          w={27}
          h={13}
          guides={[[SIG_Y, "аққыштық шегі 235 МПа", "below"]]}
        />
      </Card>

      <Card t={t} from={CH.yield + 0.5} to={CH.beam} place={{ left: "2.2cqw", top: "17cqh" }} title="σ(ε), толық қисық" width="30cqw">
        <Plot
          lines={[{ fn: (u) => sigma(u / 100), color: Q.force, until: EPS_F * 100 }]}
          x1={30}
          y1={450}
          xTicks={6}
          yTicks={3}
          cursor={Math.min(e * 100, EPS_F * 100)}
          xLabel="ε, %"
          yLabel="σ, МПа"
          w={27}
          h={13}
          guides={[[SIG_Y, "аққыштық 235", "below"], [400, "беріктік шегі 400"]]}
        />
      </Card>
      <Card t={t} from={CH.yield + 0.5} to={CH.beam} place={{ right: "2.2cqw", top: "14cqh" }} title="Созу сынағы" width="30cqw">
        <Row label="σ" value={num(sg, 0)} unit="МПа" color={Q.force} />
        <Row label="ε" value={num(e * 100, 1)} unit="%" color={Q.velocity} />
        {t >= T_FRACTURE && <div style={{ fontSize: "1.8cqw", fontWeight: 800, color: "#b91c1c", marginTop: "0.3cqw" }}>ҮЗІЛУ</div>}
      </Card>

      <Card t={t} from={CH.beam + 0.6} to={CH.safety} place={{ right: "2.2cqw", top: "14cqh" }} title="Арқалықтың иілуі · IPE 300" width="34cqw">
        <Formula note="L = 4 м">M = F·L / 4</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="жүк" value={num(n, 1)} unit="т" color={Q.weight} />
          <Row label="M" value={num(M_MAX(t) / 1000, 1)} unit="кН·м" color={Q.momentum} />
          <Row label="σ = M·c / I" value={num(SIG_BEAM(t), 0)} unit="МПа" color={Q.force} />
        </div>
      </Card>
      <Card t={t} from={CH.beam + 1} to={CH.safety} place={{ left: "2.2cqw", top: "17cqh" }} title="Иілу моменті M(x), кН·м" width="30cqw">
        <Plot
          lines={[{ fn: (u) => (Math.min(u, L_BEAM - u) * P_N(t)) / 2000, color: Q.momentum }]}
          x1={4}
          y1={50}
          xTicks={4}
          yTicks={5}
          cursor={4}
          xLabel="x, м"
          yLabel="M"
          w={27}
          h={13}
        />
      </Card>

      <Card t={t} from={CH.safety + 0.4} to={80} place={{ right: "2.2cqw", top: "14cqh" }} title="Беріктік қоры" width="32cqw">
        <Formula small>n = σ_аққ / σ</Formula>
        <div style={{ marginTop: "0.4cqw" }}>
          <Row label="σ_аққ" value="235" unit="МПа" color={Q.force} />
          <Row label="σ (5 т)" value="88" unit="МПа" color={Q.momentum} />
          <Row label="n" value="2,7" unit="" color="#16a34a" />
        </div>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson10: LessonScene = {
  moduleId: 10,
  script: S,
  cameraFollow: anchor,
  camera: [
    // the bridge: aerial approach, then side-on
    { t: 0, ...K([-22, 15, 36], [10, 2, 0]) },
    { t: 6.9, ...K([-4, 9, 42], [12, 2.2, 0]) },
    { t: 7.1, ...K([12, 4.5, 33], [12, 1.4, 0]) },
    { t: 27.9, ...K([12, 4.5, 33], [12, 1.4, 0]) },
    // tensile test
    { t: 28.05, ...K([TEST_X + 0.45, 0.95, 2.6], [TEST_X, 0.62, 0]) },
    { t: 59.9, ...K([TEST_X + 0.4, 0.95, 2.4], [TEST_X, 0.66, 0]) },
    // beam
    { t: 60.05, ...K([BEAM_X + 0.2, 1.4, 6.0], [BEAM_X, 0.85, 0]) },
    { t: 79.9, ...K([BEAM_X + 1.8, 1.6, 5.6], [BEAM_X, 0.85, 0]) },
  ],
  World,
  Overlay,
  sky: { top: "#6ea8ee", horizon: "#e6f0fb" },
  light: {
    offset: [14, 24, 14],
    extent: 28,
    extentAt: (t) => (t < CH.stress ? 28 : t < CH.beam ? 3 : 8),
    follow: (t) => (t < CH.stress ? [12, 0, 0] : t < CH.beam ? [TEST_X, 0.6, 0] : [BEAM_X, 0.7, 0]),
  },
  fog: { color: "#e3eefb", near: 100, far: 440 },
};
