"use client";

// Lesson 1 — Introduction to mechanics. A car on a road introduces kinematics,
// a pushed crate dynamics, a seesaw statics; then the material point, the frame
// of reference, path versus displacement, and relative motion on a station platform.

import { useRef } from "react";
import * as THREE from "three";
import { useStudioFrame } from "@/components/studio/clock";
import { Card, Dip, Formula, LiveTag, num, Row } from "@/components/studio/overlay";
import type { LessonScene } from "@/components/studio/types";
import { chapterById, clamp, seg, smooth, type Vec3 } from "@/lib/studio/timeline";
import { LESSON_SCRIPTS } from "@/data/lessonVideos";
import { Car, CAR, type CarHandle } from "../objects/Car";
import { Arrow, Ground, Paving, Ribbon, Show, Tree } from "../objects/common";
import { Figure, type FigureHandle } from "../objects/Figure";
import { C, Q } from "../objects/materials";
import { Crate, Kid, Platform, RAIL_Y, Rails, Seesaw, type SeesawHandle, Wagon, type WagonHandle } from "../objects/Props";
import { DistancePosts, ROAD_Y, Road } from "../objects/Road";

const S = LESSON_SCRIPTS[1];
const at = (id: string) => chapterById(S, id);

// ---- the film's places ------------------------------------------------------
const LANE_Z = 2;
const V = 12; // car speed on the road, m/s
const YARD_Z = -150; // crate and seesaw stations
const CRATE_X0 = -8;
const SEESAW_X = 8;
const PLAZA = { cx: 0, cz: -55, R: 20 }; // semicircular route
const V_PLAZA = 10;
const TRACK_Z = -420;
const PLATFORM_Z = -417.2;
const OBSERVER_X = 6;
const V_TRAIN = 5;

const CH = {
  dyn: at("dyn").from,
  stat: at("stat").from,
  point: at("point").from,
  frame: at("frame").from,
  path: at("path").from,
  relA: at("relA").from,
  relB: at("relB").from,
  outro: at("outro").from,
};

// ---- motion -----------------------------------------------------------------
const wagonX = (t: number) => -22 + V_TRAIN * (t - CH.relA);

const crateS = (t: number) => {
  const tau = Math.max(0, t - 14);
  return tau <= 5 ? 0.125 * tau * tau : 3.125 + 1.25 * (tau - 5);
};

const SEE_M1 = 40;
const SEE_M2 = 30;
const SEE_D1 = 1.5;
const SEE_D2 = 2.0;
const seesawTilt = (t: number) => {
  const tau = t - CH.stat;
  // A small wobble that dies away: the plank settles where the moments cancel.
  return tau < 0 ? 0 : 0.11 * Math.exp(-tau * 0.9) * Math.cos(tau * 3.8);
};

interface CarState {
  visible: boolean;
  x: number;
  z: number;
  y: number;
  heading: number;
  dist: number;
}

function carState(t: number): CarState {
  const road = (x: number): CarState => ({ visible: true, x, z: LANE_Z, y: ROAD_Y, heading: 0, dist: x });
  if (t < CH.dyn) return road(V * t - 20);
  if (t < CH.point) return { visible: false, x: 0, z: LANE_Z, y: ROAD_Y, heading: 0, dist: 0 };
  if (t < CH.frame) return road(V * (t - CH.point));
  if (t < CH.path) return road(V * (t - CH.frame));
  if (t < CH.relA) {
    const s = clamp((V_PLAZA * (t - 54)) / (Math.PI * PLAZA.R)) * Math.PI * PLAZA.R;
    const phi = s / PLAZA.R;
    return {
      visible: true,
      x: PLAZA.cx - PLAZA.R * Math.cos(phi),
      z: PLAZA.cz + PLAZA.R * Math.sin(phi),
      y: 0.04,
      heading: Math.atan2(-Math.cos(phi), Math.sin(phi)),
      dist: s,
    };
  }
  if (t < CH.outro) return { visible: false, x: 0, z: LANE_Z, y: ROAD_Y, heading: 0, dist: 0 };
  return road(V * (t - CH.outro));
}

const onRoad = (t: number) => t < CH.dyn || (t >= CH.point && t < CH.path) || t >= CH.outro;

const anchor = (t: number): Vec3 => {
  if (onRoad(t)) return [carState(t).x, 0, 0];
  if (t >= CH.relB && t < CH.outro) return [wagonX(t), 0, TRACK_Z];
  return [0, 0, 0];
};

const lightTarget = (t: number): Vec3 => {
  if (onRoad(t)) return [carState(t).x, 0, 0];
  if (t < CH.stat) return [CRATE_X0 + 2, 0, YARD_Z];
  if (t < CH.point) return [SEESAW_X, 0, YARD_Z];
  if (t < CH.relA) return [0, 0, PLAZA.cz];
  if (t < CH.relB) return [0, 0, TRACK_Z + 4];
  return [wagonX(t), 0, TRACK_Z + 4];
};

// ---- world ------------------------------------------------------------------
const PATH_POINTS: [number, number][] = Array.from({ length: 181 }, (_, i) => {
  const phi = (Math.PI * i) / 180;
  return [PLAZA.cx - PLAZA.R * Math.cos(phi), PLAZA.cz + PLAZA.R * Math.sin(phi)];
});
const TRAJ_POINTS: [number, number][] = Array.from({ length: 361 }, (_, i) => [i * 0.5, LANE_Z]);

/** Moves a group to the given pose each frame. */
function useFollow(ref: React.RefObject<THREE.Object3D>, fn: (t: number) => { p: Vec3; ry?: number; show?: boolean }) {
  useStudioFrame((t) => {
    const o = ref.current;
    if (!o) return;
    const r = fn(t);
    o.visible = r.show ?? true;
    o.position.set(...r.p);
    if (r.ry !== undefined) o.rotation.y = r.ry;
  });
}

function World() {
  const car = useRef<THREE.Group>(null!);
  const carH = useRef<CarHandle>(null!);
  const pusher = useRef<FigureHandle>(null!);
  const pusherG = useRef<THREE.Group>(null!);
  const crate = useRef<THREE.Group>(null!);
  const seesaw = useRef<SeesawHandle>(null!);
  const wagon = useRef<THREE.Group>(null!);
  const wagonH = useRef<WagonHandle>(null!);
  const dot = useRef<THREE.Mesh>(null!);

  useFollow(car, (t) => {
    const c = carState(t);
    carH.current?.setRoll(c.dist / CAR.wheelR);
    return { p: [c.x, c.y, c.z], ry: c.heading, show: c.visible };
  });
  useFollow(crate, (t) => ({ p: [CRATE_X0 + crateS(t), 0.02, YARD_Z] }));
  useFollow(pusherG, (t) => ({ p: [CRATE_X0 + crateS(t) - 1.25, 0.02, YARD_Z] }));
  useFollow(wagon, (t) => {
    wagonH.current?.setRoll(wagonX(t) / 0.46);
    return { p: [wagonX(t), RAIL_Y + 0.06, TRACK_Z] };
  });

  useStudioFrame((t) => {
    // The pusher leans in and walks only while the crate is moving.
    const tau = Math.max(0, t - 14);
    const moving = tau > 0 ? smooth(seg(tau, 0, 1)) : 0;
    const w = tau * 5.2;
    pusher.current?.setPose({
      lean: 0.3 + 0.25 * moving,
      armL: 0.9,
      armR: 0.9,
      elbowL: 0.1,
      elbowR: 0.1,
      legL: 0.45 * Math.sin(w) * moving,
      legR: -0.45 * Math.sin(w) * moving,
      kneeL: Math.max(0, -Math.sin(w)) * 0.7 * moving,
      kneeR: Math.max(0, Math.sin(w)) * 0.7 * moving,
    });
    seesaw.current?.setTilt(seesawTilt(t));
    // "Point" marker: a glow that takes over from the car as the camera climbs away.
    const c = carState(t);
    const k = smooth(seg(t, CH.point + 4, CH.point + 10));
    dot.current.visible = k > 0.01 && t >= CH.point && t < CH.frame;
    dot.current.position.set(c.x, 2.4, c.z);
    dot.current.scale.setScalar(1 + 1.8 * k);
    (dot.current.material as THREE.MeshBasicMaterial).opacity = 0.85 * k;
  });

  return (
    <>
      <Ground size={2600} x={300} />
      <Road x0={-80} x1={520} />
      {/* x-axis of the frame of reference: posts every 20 m, a rod with an arrow, and the observer at the origin */}
      <DistancePosts from={0} step={20} count={10} z={-4.9} show={(t) => (t >= CH.frame && t < CH.path ? seg(t, CH.frame + 1.5, CH.frame + 2.5) : 0)} />
      <Show when={(t) => t >= CH.frame && t < CH.path}>
        <mesh position={[100, 1.05, -4.9]} castShadow>
          <boxGeometry args={[205, 0.06, 0.06]} />
          <meshStandardMaterial color={Q.force} />
        </mesh>
        <mesh position={[206, 1.05, -4.9]} rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[0.28, 0.9, 16]} />
          <meshStandardMaterial color={Q.force} />
        </mesh>
        <group position={[0, 0.14, -5.7]} rotation={[0, Math.PI / 2 - 0.35, 0]}>
          <Figure shirt="#0ea5e9" pose={{ armR: 0.05, armL: 2.6, elbowL: 0.4 }} />
        </group>
      </Show>
      <LiveTag tone="red" get={(t) => (t >= CH.frame && t < CH.path ? { pos: [208, 2.0, -4.9], opacity: seg(t, CH.frame + 2, CH.frame + 3) } : null)}>
        x
      </LiveTag>
      <LiveTag tone="brand" get={(t) => (t >= CH.frame && t < CH.path ? { pos: [0, 2.35, -5.7], opacity: seg(t, CH.frame + 0.5, CH.frame + 1.5) * (1 - seg(t, CH.frame + 7, CH.frame + 8)) } : null)}>
        Санақ денесі
      </LiveTag>
      <Ribbon points={TRAJ_POINTS} width={0.5} y={ROAD_Y + 0.02} color="#0ea5e9" progress={(t) => (t >= CH.frame && t < CH.path ? clamp(carState(t).x / 180) : 0)} />

      <group ref={car}>
        <Car ref={carH} />
      </group>
      <mesh ref={dot} visible={false}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>

      {/* ---- yard: plaza with the crate, seesaw and the circular route ---- */}
      <Paving x={0} z={PLAZA.cz} w={56} d={40} />
      <Paving x={0} z={YARD_Z} w={44} d={22} />
      {[-34, -22, -10, 2, 14, 26, 38].map((x, i) => (
        <Tree key={x} position={[x, 0, YARD_Z - 13 - (i % 3) * 2.5]} scale={1.1 + (i % 2) * 0.3} tone={i} />
      ))}
      {[-30, -18, -6, 8, 20, 32].map((x, i) => (
        <Tree key={`p${x}`} position={[x, 0, TRACK_Z - 22 - (i % 3) * 3]} scale={1.2 + (i % 2) * 0.3} tone={i + 1} />
      ))}
      <group ref={crate}>
        <Crate size={1} />
      </group>
      <group ref={pusherG}>
        <Figure ref={pusher} shirt="#16a34a" pants="#1f2937" />
      </group>
      <Arrow color={Q.force} radius={0.045} get={(t) => (t >= CH.dyn && t < CH.stat ? { origin: [CRATE_X0 + crateS(t) - 0.5, 0.62, YARD_Z], dir: [1, 0, 0], len: 1.2 * smooth(seg(t, 14, 14.8)) } : null)} />
      <Arrow color={Q.friction} radius={0.045} get={(t) => (t >= CH.dyn && t < CH.stat ? { origin: [CRATE_X0 + crateS(t) + 0.5, 0.14, YARD_Z + 0.55], dir: [-1, 0, 0], len: 0.9 * smooth(seg(t, 14, 14.8)) } : null)} />
      <LiveTag tone="red" get={(t) => (t >= CH.dyn && t < CH.stat ? { pos: [CRATE_X0 + crateS(t) - 1.2, 1.25, YARD_Z + 0.2], opacity: seg(t, 14.4, 15) } : null)}>
        F
      </LiveTag>
      <LiveTag tone="amber" get={(t) => (t >= CH.dyn && t < CH.stat ? { pos: [CRATE_X0 + crateS(t) + 1.3, 0.45, YARD_Z + 0.55], opacity: seg(t, 14.4, 15) } : null)}>
        үйкеліс
      </LiveTag>

      <group position={[SEESAW_X, 0.02, YARD_Z]}>
        <Seesaw ref={seesaw}>
          <Kid x={-SEE_D1} facing={1} shirt="#2f6df6" scale={0.82} />
          <Kid x={SEE_D2} facing={-1} shirt="#ec4899" scale={0.72} />
        </Seesaw>
        {/* weights of the two children, from just under the plank */}
        <Arrow color={Q.weight} radius={0.035} get={(t) => (t >= CH.stat && t < CH.point ? { origin: [-SEE_D1, 0.66, 0.0], dir: [0, -1, 0], len: 0.016 * SEE_M1 * smooth(seg(t, 20, 21)) } : null)} />
        <Arrow color={Q.weight} radius={0.035} get={(t) => (t >= CH.stat && t < CH.point ? { origin: [SEE_D2, 0.66, 0.0], dir: [0, -1, 0], len: 0.016 * SEE_M2 * smooth(seg(t, 20, 21)) } : null)} />
        <LiveTag tone="brand" get={(t) => (t >= CH.stat && t < CH.point ? { pos: [-SEE_D1, 1.95, 0], opacity: seg(t, 20.5, 21.3) } : null)}>
          m₁ = 40 кг
        </LiveTag>
        <LiveTag tone="red" get={(t) => (t >= CH.stat && t < CH.point ? { pos: [SEE_D2, 1.85, 0], opacity: seg(t, 20.5, 21.3) } : null)}>
          m₂ = 30 кг
        </LiveTag>
        <LiveTag get={(t) => (t >= CH.stat && t < CH.point ? { pos: [-SEE_D1 / 2, 0.55, 0.3], opacity: seg(t, 21.5, 22.3) } : null)}>
          d₁ = 1,5 м
        </LiveTag>
        <LiveTag get={(t) => (t >= CH.stat && t < CH.point ? { pos: [SEE_D2 / 2, 0.55, 0.3], opacity: seg(t, 21.5, 22.3) } : null)}>
          d₂ = 2,0 м
        </LiveTag>
      </group>

      {/* route: semicircle from A to B, path laid down as the car drives it */}
      <Ribbon points={PATH_POINTS} width={0.7} y={0.07} color="#f59e0b" progress={(t) => (t >= CH.path && t < CH.relA ? clamp((V_PLAZA * (t - 54)) / (Math.PI * PLAZA.R)) : 0)} />
      <Arrow
        color="#0ea5e9"
        radius={0.22}
        get={(t) => {
          if (t < CH.path || t >= CH.relA || t < 54) return null;
          const c = carState(t);
          const dx = c.x - (PLAZA.cx - PLAZA.R);
          const dz = c.z - PLAZA.cz;
          const len = Math.hypot(dx, dz);
          return { origin: [PLAZA.cx - PLAZA.R, 0.5, PLAZA.cz], dir: [dx, 0, dz], len: Math.max(0, len - 0.3) };
        }}
      />
      {[
        { x: PLAZA.cx - PLAZA.R, l: "A" },
        { x: PLAZA.cx + PLAZA.R, l: "B" },
      ].map((p) => (
        <group key={p.l}>
          <mesh position={[p.x, 0.5, PLAZA.cz]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 1, 12]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <LiveTag tone="amber" get={(t) => (t >= CH.path && t < CH.relA ? { pos: [p.x, 1.3, PLAZA.cz], opacity: seg(t, CH.path + 0.5, CH.path + 1.5) } : null)}>
            {p.l}
          </LiveTag>
        </group>
      ))}

      {/* ---- railway: platform, observer, wagon with a passenger ---- */}
      <Rails x0={-130} x1={180} z={TRACK_Z} />
      <group position={[0, 0, PLATFORM_Z]} rotation={[0, Math.PI, 0]}>
        <Platform x0={-70} x1={70} canopy={false} />
      </group>
      <group position={[OBSERVER_X, 1.1, PLATFORM_Z + 2.4]} rotation={[0, Math.PI / 2, 0]}>
        <Figure shirt="#0ea5e9" pose={{ armR: 0.05, armL: 0.05 }} />
      </group>
      <LiveTag tone="brand" get={(t) => (t >= CH.relA && t < CH.outro ? { pos: [OBSERVER_X, 3.35, PLATFORM_Z + 2.4], opacity: seg(t, CH.relA + 0.6, CH.relA + 1.4) } : null)}>
        Перрондағы бақылаушы
      </LiveTag>
      <group ref={wagon}>
        <Wagon ref={wagonH} />
      </group>
      <LiveTag tone="amber" get={(t) => (t >= CH.relA && t < CH.outro ? { pos: [wagonX(t) + 0.6, 3.1, TRACK_Z - 1.0], opacity: seg(t, CH.relA + 0.6, CH.relA + 1.4) } : null)}>
        Жолаушы
      </LiveTag>
      <Arrow color={Q.velocity} radius={0.09} get={(t) => (t >= CH.relA && t < CH.outro ? { origin: [wagonX(t), 4.6, TRACK_Z], dir: [1, 0, 0], len: V_TRAIN * 0.55 } : null)} />
      <LiveTag tone="green" get={(t) => (t >= CH.relA && t < CH.outro ? { pos: [wagonX(t) + V_TRAIN * 0.55 + 0.4, 4.7, TRACK_Z], opacity: seg(t, CH.relA + 0.6, CH.relA + 1.4) } : null)}>
        v = 5 м/с
      </LiveTag>
    </>
  );
}

// ---- overlay ----------------------------------------------------------------
function ForceDiagram() {
  // Free-body diagram of the crate: the same four forces, drawn flat.
  const Arr = ({ x1, y1, x2, y2, c, label, lx, ly }: { x1: number; y1: number; x2: number; y2: number; c: string; label: string; lx: number; ly: number }) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth={6} strokeLinecap="round" markerEnd={`url(#hd-${c.slice(1)})`} />
      <text x={lx} y={ly} fontSize={22} fontWeight={800} fill={c}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 250 190" width="22cqw">
      <defs>
        {[Q.normal, Q.weight, Q.force, Q.friction].map((c) => (
          <marker key={c} id={`hd-${c.slice(1)}`} markerWidth="5" markerHeight="5" refX="3.2" refY="2.5" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L5,2.5 L0,5 z" fill={c} />
          </marker>
        ))}
      </defs>
      <rect x={85} y={65} width={80} height={60} rx={6} fill="#e8c899" stroke="#8d6638" strokeWidth={3} />
      <Arr x1={125} y1={65} x2={125} y2={14} c={Q.normal} label="N" lx={136} ly={28} />
      <Arr x1={125} y1={125} x2={125} y2={176} c={Q.weight} label="mg" lx={136} ly={168} />
      <Arr x1={8} y1={95} x2={80} y2={95} c={Q.force} label="F" lx={28} ly={84} />
      <Arr x1={242} y1={95} x2={170} y2={95} c={Q.friction} label="Fүйк" lx={172} ly={84} />
    </svg>
  );
}

function Overlay({ t }: { t: number }) {
  const c = carState(t);
  const tau = (from: number) => Math.max(0, t - from);
  return (
    <>
      <Dip t={t} at={CH.dyn} />
      <Dip t={t} at={CH.point} />
      <Dip t={t} at={CH.path} />
      <Dip t={t} at={CH.relA} />
      <Dip t={t} at={CH.outro} />

      <Card t={t} from={at("kin").from} to={CH.dyn} place={{ right: "2.2cqw", top: "14cqh" }} title="Кинематика">
        <Row label="t" value={num(t - 7, 1)} unit="с" />
        <Row label="жол s" value={num(V * (t - 7), 0)} unit="м" color="#f59e0b" />
        <Row label="v" value="12" unit="м/с" color={Q.velocity} />
      </Card>

      <Card t={t} from={CH.dyn + 0.5} to={CH.stat + 0.3} place={{ right: "2.2cqw", top: "14cqh" }} title="Динамика: күштер">
        <ForceDiagram />
      </Card>

      <Card t={t} from={CH.stat + 1.8} to={CH.point} place={{ right: "2.2cqw", top: "14cqh" }} title="Статика: моменттер">
        <Formula note="тепе-теңдік">m₁·d₁ = m₂·d₂</Formula>
        <div style={{ fontSize: "1.7cqw", marginTop: "0.5cqw", fontWeight: 700, color: "#0f1a45" }}>
          40 · 1,5 = 30 · 2,0 = <b style={{ color: "#1f47e6" }}>60 кг·м</b>
        </div>
      </Card>

      <Card t={t} from={CH.point + 0.4} to={CH.frame} place={{ left: "2.2cqw", top: "17cqh" }} title="Материалдық нүкте">
        <Row label="көлік ұзындығы" value="4,9" unit="м" />
        <Row label="жүрген жол" value={num(V * (t - CH.point), 0)} unit="м" color="#f59e0b" />
        <div style={{ fontSize: "2.4cqw", fontWeight: 800, color: "#1f47e6", marginTop: "0.4cqw" }}>4,9 м ≪ жол</div>
      </Card>

      <Card t={t} from={CH.frame + 0.4} to={CH.path} place={{ left: "2.2cqw", top: "17cqh" }} title="Санақ жүйесі">
        <div style={{ fontSize: "1.65cqw", lineHeight: 1.7, fontWeight: 700, color: "#0f172a" }}>
          <div style={{ opacity: smooth(seg(t, CH.frame + 0.8, CH.frame + 1.6)) }}>① санақ денесі</div>
          <div style={{ opacity: smooth(seg(t, CH.frame + 2, CH.frame + 2.8)) }}>② x осі (координата)</div>
          <div style={{ opacity: smooth(seg(t, CH.frame + 3.5, CH.frame + 4.3)) }}>③ сағат</div>
        </div>
      </Card>
      <Card t={t} from={CH.frame + 3.5} to={CH.path} place={{ right: "2.2cqw", top: "14cqh" }} title="Сағат · координата">
        <Row label="t" value={num(tau(CH.frame), 1)} unit="с" />
        <Row label="x" value={num(c.x, 0)} unit="м" color={Q.force} />
      </Card>

      <Card t={t} from={CH.path + 1} to={CH.relA} place={{ right: "2.2cqw", top: "14cqh" }} title="Жол және орын ауыстыру">
        <Row label="жол s" value={num(Math.min(c.dist, Math.PI * PLAZA.R), 1)} unit="м" color="#f59e0b" />
        <Row
          label="орын ауыстыру |Δr|"
          value={num(Math.hypot(c.x + PLAZA.R, c.z - PLAZA.cz), 1)}
          unit="м"
          color="#0ea5e9"
        />
      </Card>
      <Card t={t} from={CH.path + 8} to={CH.relA} place={{ left: "2.2cqw", top: "17cqh" }}>
        <Formula note="қисық траекторияда">s &gt; |Δr|</Formula>
      </Card>

      <Card t={t} from={CH.relA + 1} to={CH.relB} place={{ right: "2.2cqw", top: "14cqh" }} title="Жолаушының жылдамдығы">
        <Row label="вагонға қатысты" value="0" unit="м/с" color="#f59e0b" />
        <Row label="перронға қатысты" value="5" unit="м/с" color={Q.velocity} />
      </Card>
      <Card t={t} from={CH.relB + 1} to={CH.outro} place={{ right: "2.2cqw", top: "14cqh" }} title="Вагонға қатысты">
        <Row label="жолаушы" value="0" unit="м/с" color="#f59e0b" />
        <Row label="перрон" value="−5" unit="м/с" color={Q.force} />
      </Card>

      <Card t={t} from={CH.outro + 0.6} to={89} place={{ left: "2.2cqw", top: "17cqh" }} title="Механика">
        <div style={{ fontSize: "1.9cqw", lineHeight: 1.65, fontWeight: 800, color: "#0f172a" }}>
          <div>Кинематика <span style={{ color: "#64748b", fontWeight: 600 }}>— қалай?</span></div>
          <div>Динамика <span style={{ color: "#64748b", fontWeight: 600 }}>— неге?</span></div>
          <div>Статика <span style={{ color: "#64748b", fontWeight: 600 }}>— тепе-теңдік</span></div>
        </div>
      </Card>
    </>
  );
}

const K = (pos: Vec3, target: Vec3) => ({ pos, target });

export const lesson01: LessonScene = {
  moduleId: 1,
  script: S,
  cameraFollow: anchor,
  camera: [
    // intro: alongside the car
    { t: 0, ...K([-6, 1.8, 10], [1, 1, 2]) },
    { t: 7, ...K([5, 2.2, 9.5], [0, 1, 2]) },
    // kinematics: same road, a little higher
    { t: 7.5, ...K([1, 2.8, 12], [2.5, 1, 1.5]) },
    { t: 12.9, ...K([3, 3.2, 12.5], [3.5, 1, 1.5]) },
    // dynamics: the crate
    { t: 13.05, ...K([-4.2, 2.0, YARD_Z + 9.5], [-6.6, 0.8, YARD_Z]) },
    { t: 18.9, ...K([-2.6, 2.2, YARD_Z + 9.5], [-4.8, 0.8, YARD_Z]) },
    // statics: glide across the yard to the seesaw
    { t: 19.0, ...K([-2.6, 2.2, YARD_Z + 9.5], [-4.8, 0.8, YARD_Z]) },
    { t: 20.6, ...K([8.2, 2.5, YARD_Z + 8.8], [8, 1.0, YARD_Z]) },
    { t: 24.9, ...K([8.6, 2.4, YARD_Z + 8.4], [8, 1.0, YARD_Z]) },
    // material point: climb away from the car
    { t: 25.05, ...K([-9, 2.2, 9], [3, 1, 2]) },
    { t: 28, ...K([-12, 6, 14], [4, 1, 2]) },
    { t: 36.9, ...K([-30, 85, 62], [40, 0, 2]) },
    // frame of reference
    { t: 37.05, ...K([-3, 2.4, 11.5], [4.5, 1.3, -1]) },
    { t: 52, ...K([2, 3.4, 12.5], [6, 1.3, -1]) },
    // path vs displacement: overhead
    { t: 52.05, ...K([0, 44, PLAZA.cz + 46], [0, 0, PLAZA.cz - 4]) },
    { t: 66.9, ...K([0, 40, PLAZA.cz + 44], [0, 0, PLAZA.cz - 4]) },
    // relative motion, platform view
    { t: 67.05, ...K([8, 5.6, TRACK_Z + 27], [2, 2.3, TRACK_Z + 2]) },
    { t: 73.9, ...K([4, 5.8, TRACK_Z + 25], [4, 2.4, TRACK_Z + 2]) },
    // ... and from alongside the wagon
    { t: 74.05, ...K([-4, 5.4, 27], [1, 2.4, 2]) },
    { t: 80.9, ...K([-2, 5.6, 25], [2, 2.4, 2]) },
    // outro
    { t: 81.05, ...K([-6, 2.0, 9.5], [1, 1, 2]) },
    { t: 89, ...K([8, 3.4, 12], [-1, 1.2, 2]) },
  ],
  World,
  Overlay,
  sky: { top: "#6ea8ee", horizon: "#e6f0fb" },
  light: { offset: [14, 22, 12], extent: 30, follow: lightTarget },
  fog: { color: "#e3eefb", near: 70, far: 340 },
};
