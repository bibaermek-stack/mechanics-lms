import { describe, expect, it } from "vitest";
import { AIM_LIMIT, MIN_SPEED, NO_THROW, RELEASE_LIFT, SAKHA_ID, SAKHA_START_FACE, cleanParams, launchFor, setupFor, speedOf } from "./throw";
import { MAX_SPEED, MAX_SPIN } from "./simulate";
import { SAKHAS, sakhaById } from "./rules";
import { getMode } from "./modes";
import { classifyFace } from "./faces";
import { qRotate } from "./math";
import { ASYQ_LENGTH, lowestPointOf } from "./physics";

const mode = getMode("asyq-atu");

describe("strength", () => {
  it("runs from the gentlest to the hardest throw in a straight line", () => {
    expect(speedOf(0)).toBe(MIN_SPEED);
    expect(speedOf(1)).toBe(MAX_SPEED);
    expect(speedOf(0.5)).toBeCloseTo((MIN_SPEED + MAX_SPEED) / 2, 12);
    expect(speedOf(0.25)).toBeCloseTo(MIN_SPEED + 0.25 * (MAX_SPEED - MIN_SPEED), 12);
  });
});

describe("cleaning what the player chose", () => {
  const rules = { allowSpin: true };
  it("keeps what is in range", () => {
    const p = { yaw: 0.2, power: 0.4, spin: -0.5, roll: 0.25 };
    expect(cleanParams(p, rules)).toEqual(p);
  });
  it("pulls everything back into range", () => {
    expect(cleanParams({ yaw: -9, power: -1, spin: 3, roll: -3 }, rules)).toEqual({ yaw: -AIM_LIMIT, power: 0, spin: 1, roll: -1 });
  });
  it("drops the spin when the rules have none", () => {
    expect(cleanParams({ yaw: 0.1, power: 0.5, spin: 1, roll: 1 }, { allowSpin: false })).toEqual({ yaw: 0.1, power: 0.5, spin: 0, roll: 0 });
  });
  it("refuses anything that is not a number", () => {
    for (const bad of [{ ...NO_THROW, yaw: NaN }, { ...NO_THROW, power: Infinity }, { ...NO_THROW, spin: -Infinity }, { ...NO_THROW, roll: NaN }]) expect(cleanParams(bad, rules)).toBeNull();
  });
  it("lets the player aim 50° either side of straight across, no more", () => {
    expect((AIM_LIMIT * 180) / Math.PI).toBeCloseTo(50, 10);
  });
});

describe("the throw as a launched sakha", () => {
  const sakha = sakhaById("ortasha");
  const origin: [number, number, number] = [-0.6, 0, 0];

  it("goes where it is aimed, at the speed chosen, with a small lift", () => {
    for (const yaw of [0, 0.4, -0.7]) {
      for (const power of [0, 0.5, 1]) {
        const l = launchFor({ yaw, power, spin: 0, roll: 0 }, origin, sakha);
        const v = speedOf(power);
        expect(l.speed).toBe(v);
        expect(l.velocity[0]).toBeCloseTo(v * Math.cos(yaw), 12);
        expect(l.velocity[2]).toBeCloseTo(v * Math.sin(yaw), 12);
        expect(l.velocity[1]).toBeCloseTo(0.2 + 0.03 * v, 12);
        expect(Math.hypot(l.velocity[0], l.velocity[2])).toBeCloseTo(v, 12);
      }
    }
  });

  it("positive yaw turns to the right: towards +z, looking down the ring", () => {
    expect(launchFor({ yaw: 0.3, power: 0.5, spin: 0, roll: 0 }, origin, sakha).velocity[2]).toBeGreaterThan(0);
    expect(launchFor({ yaw: -0.3, power: 0.5, spin: 0, roll: 0 }, origin, sakha).velocity[2]).toBeLessThan(0);
  });

  it("spin is about the vertical, the way it is chosen; no spin means no angular velocity", () => {
    expect(Math.hypot(...launchFor({ yaw: 0.3, power: 0.5, spin: 0, roll: 0 }, origin, sakha).angular)).toBe(0);
    const l = launchFor({ yaw: 0.3, power: 0.5, spin: 0.5, roll: 0 }, origin, sakha);
    expect(l.angular[1]).toBeCloseTo(0.5 * MAX_SPIN, 12);
    expect(Math.hypot(l.angular[0], l.angular[2])).toBeCloseTo(0, 12);
    expect(launchFor({ yaw: 0, power: 0.5, spin: 1, roll: 0 }, origin, sakha).angular[1]).toBeCloseTo(MAX_SPIN, 12);
  });

  it("forward roll turns the sakha as a wheel turns when it rolls the way it is going: ω = (up × direction)", () => {
    // thrown along +x, a wheel rolling that way turns about −z (right-handed, y up)
    const a = launchFor({ yaw: 0, power: 0.5, spin: 0, roll: 1 }, origin, sakha).angular;
    expect(a[0]).toBeCloseTo(0, 12);
    expect(a[1]).toBeCloseTo(0, 12);
    expect(a[2]).toBeCloseTo(-MAX_SPIN, 12);
    // thrown along +z, it turns about +x
    const b = launchFor({ yaw: Math.PI / 2, power: 0.5, spin: 0, roll: 1 }, origin, sakha).angular;
    expect(b[0]).toBeCloseTo(MAX_SPIN, 9);
    expect(b[2]).toBeCloseTo(0, 9);
    // backspin is the opposite
    const c = launchFor({ yaw: 0, power: 0.5, spin: 0, roll: -1 }, origin, sakha).angular;
    expect(c[2]).toBeCloseTo(MAX_SPIN, 12);
    // and a full roll is exactly the maximum spin, however it is aimed
    expect(Math.hypot(...launchFor({ yaw: 0.6, power: 0.5, spin: 0, roll: 1 }, origin, sakha).angular)).toBeCloseTo(MAX_SPIN, 12);
  });

  it("starts in the hand: a hand's height above the floor, on its starting side, long axis along the throw", () => {
    for (const yaw of [0, 0.5, -0.5]) {
      for (const s of SAKHAS) {
        const l = launchFor({ yaw, power: 0.5, spin: 0, roll: 0 }, origin, s);
        expect(l.body.id).toBe(SAKHA_ID);
        expect(l.body.kind).toBe("sakha");
        expect(l.body.mass).toBe(s.mass);
        expect(l.body.length).toBe(s.length);
        expect(classifyFace(l.body.rotation).face).toBe(SAKHA_START_FACE);
        const axis = qRotate(l.body.rotation, [1, 0, 0]);
        expect(Math.atan2(axis[2], axis[0])).toBeCloseTo(yaw, 9);
        const low = lowestPointOf(l.body.position, l.body.rotation, s.length);
        expect(low).toBeCloseTo(0.0003 + RELEASE_LIFT, 9);
        expect(l.body.position[0]).toBe(origin[0]);
        expect(l.body.position[2]).toBe(origin[2]);
      }
    }
  });

  it("a heavier sakha is bigger and weighs more", () => {
    const [a, b, c] = SAKHAS;
    expect(a.mass).toBeLessThan(b.mass);
    expect(b.mass).toBeLessThan(c.mass);
    expect(a.length).toBeLessThan(b.length);
    expect(b.length).toBeLessThan(c.length);
    expect(a.length).toBeGreaterThan(ASYQ_LENGTH);
    expect(sakhaById("nope")).toBe(SAKHAS[1]);
  });
});

describe("the throw as physics sees it", () => {
  it("is every asyq on the field exactly where it lies, then the sakha, in a fixed order", () => {
    const config = mode.defaults();
    const layout = mode.layout(config, 1);
    const field = layout.bodies.map((b) => ({ id: b.id, position: b.position, rotation: b.rotation }));
    const { setup, launch } = setupFor(config, field, { yaw: 0, power: 0.6, spin: 0, roll: 0 }, 1, layout.origin);
    expect(setup.bodies.map((b) => b.id)).toEqual(["a1", "a2", "a3", "a4", "a5", "s"]);
    expect(setup.bodies.slice(0, 5).map((b) => b.position)).toEqual(field.map((b) => b.position));
    expect(setup.surface).toBe(config.surface);
    expect(setup.launch).toEqual({ id: "s", velocity: launch.velocity, angular: launch.angular });
    // the second player's sakha is thrown
    expect(setup.bodies[5].mass).toBe(sakhaById(config.players[1].sakha).mass);
  });
});
