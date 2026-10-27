import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { plausible, SENSOR_KINDS, SENSOR_META, STORED_UNIT } from "./meta";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/0014_sensor_results.sql"), "utf8");

describe("sensor limits agree with the database", () => {
  it("has the same four kinds in the CHECK as in the app", () => {
    const m = sql.match(/kind in \(([^)]*)\)/);
    const kinds = m![1].split(",").map((s) => s.trim().replace(/'/g, ""));
    expect([...kinds].sort()).toEqual([...SENSOR_KINDS].sort());
  });

  it.each(SENSOR_KINDS)("has the same range for %s", (kind) => {
    const m = sql.match(new RegExp(`when '${kind}'\\s+then value between ([0-9.]+) and ([0-9.]+)`));
    expect(m, `no range for ${kind} in the migration`).not.toBeNull();
    expect(Number(m![1])).toBe(SENSOR_META[kind].min);
    expect(Number(m![2])).toBe(SENSOR_META[kind].max);
  });

  it("stores units that fit the column", () => {
    for (const k of SENSOR_KINDS) expect(STORED_UNIT[k].length).toBeLessThanOrEqual(12);
  });
});

describe("plausible", () => {
  it("accepts the ends of the range and refuses outside it and non-numbers", () => {
    expect(plausible("jump", 0.02)).toBe(true);
    expect(plausible("jump", 1.2)).toBe(true);
    expect(plausible("jump", 1.21)).toBe(false);
    expect(plausible("jump", 0.019)).toBe(false);
    expect(plausible("rest-g", NaN)).toBe(false);
    expect(plausible("rest-g", Infinity)).toBe(false);
    expect(plausible("pendulum", 2.0)).toBe(true);
  });
});
