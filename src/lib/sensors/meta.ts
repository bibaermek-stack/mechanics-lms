import type { SensorKind } from "@/lib/types";

/**
 * What each kind of measurement is called, its unit, and the range the database
 * accepts for it (supabase/migrations/0014_sensor_results.sql — meta.test.ts reads
 * that file and fails if the two disagree). Checking here first means a bad reading
 * is explained to the student instead of coming back as a database error.
 */
export const SENSOR_META: Record<SensorKind, { title: string; quantity: string; unit: string; min: number; max: number }> = {
  "rest-g": { title: "Еркін түсу үдеуі g", quantity: "g", unit: "м/с²", min: 8, max: 11 },
  jump: { title: "Секіру биіктігі", quantity: "h", unit: "м", min: 0.02, max: 1.2 },
  pendulum: { title: "Маятник периоды", quantity: "T", unit: "с", min: 0.2, max: 10 },
  elevator: { title: "Лифт үдеуі", quantity: "a", unit: "м/с²", min: 0.05, max: 10 },
};

export const SENSOR_KINDS = Object.keys(SENSOR_META) as SensorKind[];

export function plausible(kind: SensorKind, value: number): boolean {
  const m = SENSOR_META[kind];
  return Number.isFinite(value) && value >= m.min && value <= m.max;
}

/** The ASCII unit the database stores (its column is plain text, ≤ 12 characters). */
export const STORED_UNIT: Record<SensorKind, string> = {
  "rest-g": "m/s²",
  jump: "m",
  pendulum: "s",
  elevator: "m/s²",
};
