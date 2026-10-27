"use client";

// 3D quiz-score matrix: students on one axis, lessons on the other, bar height
// and colour = the score. Supports 3D Bars Mode & 3D Terrain Surface Mode.

import { useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Environment, Html, OrbitControls } from "@react-three/drei";
import { LESSON_SHORT, type StudentRow } from "@/data/cohort";
import { Layers, BarChart3 } from "lucide-react";

const CELL = 0.42; // spacing between bars
const BAR = 0.3; // bar footprint
const MAX_H = 2.2; // height of a 100% score

function scoreColor(score: number): string {
  if (score < 60) return "#e11d48";
  if (score < 80) return "#f59e0b";
  return "#10b981";
}

function Bars({
  rows,
  onHover,
}: {
  rows: StudentRow[];
  onHover: (info: { student: string; lesson: number; score: number } | null) => void;
}) {
  const bars = useMemo(() => {
    const out: { key: string; pos: [number, number, number]; h: number; color: string; s: number; r: number; c: number }[] = [];
    rows.forEach((row, r) => {
      row.scores.forEach((score, c) => {
        if (score === null) return;
        const h = (score / 100) * MAX_H;
        out.push({
          key: `${r}-${c}`,
          pos: [c * CELL, h / 2, r * CELL],
          h,
          color: scoreColor(score),
          s: score,
          r,
          c,
        });
      });
    });
    return out;
  }, [rows]);

  const width = (LESSON_SHORT.length - 1) * CELL;
  const depth = (rows.length - 1) * CELL;

  return (
    <group position={[-width / 2, 0, -depth / 2]}>
      {/* Base Plate */}
      <mesh position={[width / 2, -0.015, depth / 2]} receiveShadow>
        <boxGeometry args={[width + CELL * 1.4, 0.03, depth + CELL * 1.4]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.9} />
      </mesh>

      {bars.map((b) => (
        <mesh
          key={b.key}
          position={b.pos}
          castShadow
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover({ student: rows[b.r].fullName, lesson: b.c + 1, score: b.s });
          }}
          onPointerOut={() => onHover(null)}
        >
          <boxGeometry args={[BAR, b.h, BAR]} />
          <meshStandardMaterial color={b.color} roughness={0.45} metalness={0.1} />
        </mesh>
      ))}

      {/* Lesson numbers along front edge */}
      {LESSON_SHORT.map((label, c) => (
        <Html key={`l-${c}`} position={[c * CELL, 0, depth + CELL * 0.75]} center zIndexRange={[5, 0]}>
          <span className="data-num select-none text-[10px] font-bold text-slate-500">{label}</span>
        </Html>
      ))}

      {/* Student initials down the side */}
      {rows.map((row, r) => (
        <Html key={`s-${r}`} position={[-CELL * 0.8, 0, r * CELL]} center zIndexRange={[5, 0]}>
          <span className="select-none whitespace-nowrap text-[10px] font-semibold text-slate-500">
            {row.fullName.split(" ")[0]}
          </span>
        </Html>
      ))}
    </group>
  );
}

function TerrainMesh({ rows }: { rows: StudentRow[] }) {
  const width = (LESSON_SHORT.length - 1) * CELL;
  const depth = (rows.length - 1) * CELL;

  const wireframeGeo = useMemo(() => {
    const cols = LESSON_SHORT.length;
    const numRows = rows.length;
    const points: THREE.Vector3[] = [];

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < cols; c++) {
        const score = rows[r].scores[c] ?? 0;
        const h = (score / 100) * MAX_H;
        const pt = new THREE.Vector3(c * CELL, h, r * CELL);

        if (c < cols - 1) {
          const rightScore = rows[r].scores[c + 1] ?? 0;
          points.push(pt, new THREE.Vector3((c + 1) * CELL, (rightScore / 100) * MAX_H, r * CELL));
        }
        if (r < numRows - 1) {
          const downScore = rows[r + 1].scores[c] ?? 0;
          points.push(pt, new THREE.Vector3(c * CELL, (downScore / 100) * MAX_H, (r + 1) * CELL));
        }
      }
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [rows]);

  return (
    <group position={[-width / 2, 0, -depth / 2]}>
      <lineSegments geometry={wireframeGeo}>
        <lineBasicMaterial color="#3b82f6" opacity={0.7} transparent linewidth={2} />
      </lineSegments>
    </group>
  );
}

export function ScoreMatrix3D({ rows }: { rows: StudentRow[] }) {
  const [hover, setHover] = useState<{ student: string; lesson: number; score: number } | null>(null);
  const [viewMode, setViewMode] = useState<"bars" | "terrain">("bars");

  return (
    <div className="space-y-3">
      {/* Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode("bars")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-micro font-medium transition-colors ${
              viewMode === "bars"
                ? "bg-brand-600 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <BarChart3 size={14} /> 3D Бағандар
          </button>
          <button
            onClick={() => setViewMode("terrain")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-micro font-medium transition-colors ${
              viewMode === "terrain"
                ? "bg-brand-600 text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            }`}
          >
            <Layers size={14} /> 3D Беткі Тор (Terrain)
          </button>
        </div>

        <span className="text-micro text-slate-500 font-medium">
          Студенттер: <strong>{rows.length}</strong> · Сабақтар: <strong>{LESSON_SHORT.length}</strong>
        </span>
      </div>

      <div className="sim-stage relative h-[360px] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
        <Canvas shadows dpr={[1, 2]} camera={{ position: [3.4, 3.2, 4.4], fov: 40 }}>
          <hemisphereLight args={["#e7eeff", "#8892a3", 1.2]} />
          <directionalLight position={[4, 6, 3]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} />
          <Environment resolution={32} frames={1}>
            <mesh scale={20}>
              <sphereGeometry args={[1, 16, 10]} />
              <meshBasicMaterial color="#dfe8f7" side={THREE.BackSide} />
            </mesh>
            <mesh position={[0, 8, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 8, 1]}>
              <planeGeometry />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </Environment>

          {viewMode === "bars" ? <Bars rows={rows} onHover={setHover} /> : <TerrainMesh rows={rows} />}

          <OrbitControls enablePan={false} minDistance={3} maxDistance={12} maxPolarAngle={Math.PI / 2 - 0.05} makeDefault />
        </Canvas>

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-micro text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          {hover ? (
            <span>
              <span className="font-semibold">{hover.student}</span> · {hover.lesson}-сабақ ·{" "}
              <span className="data-num font-bold">{hover.score}%</span>
            </span>
          ) : (
            <span>
              <span className="[@media(pointer:coarse)]:hidden">Бағанға тінтуірді апарыңыз</span>
              <span className="hidden [@media(pointer:coarse)]:inline">Бағанды түртіңіз</span>
            </span>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-2.5 right-3 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
          {/* A phone has no wheel; say what the fingers do (same wording as SimStage). */}
          <span className="[@media(pointer:coarse)]:hidden">Сүйреу — айналдыру · Дөңгелек — масштаб</span>
          <span className="hidden [@media(pointer:coarse)]:inline">1 саусақ — бұру · 2 саусақ — масштаб</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {[
          { c: "#e11d48", t: "60%-дан төмен" },
          { c: "#f59e0b", t: "60–79%" },
          { c: "#10b981", t: "80%-дан жоғары" },
          { c: "#cbd5e1", t: "тапсырылмаған (баған жоқ)" },
        ].map((l) => (
          <span key={l.t} className="flex items-center gap-1.5 text-micro text-slate-600 dark:text-slate-400">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.c }} />
            {l.t}
          </span>
        ))}
      </div>
    </div>
  );
}

export default ScoreMatrix3D;
