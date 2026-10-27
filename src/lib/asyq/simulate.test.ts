import { describe, expect, it, beforeAll } from "vitest";
import { ASYQ_LENGTH, loadPhysics, lowestPointOf } from "./physics";
import { bodyOnFace } from "./placement";
import { ARENA_RADIUS, FRAME_HZ, MAX_SPEED, OVERLAP_LIMIT, STEP_LADDER, poseAt, recordingDuration, simulateThrow, simulateThrowAsync, type Recording, type Simulation, type ThrowSetup } from "./simulate";
import { classifyFace, FACE_IDS } from "./faces";

beforeAll(async () => {
  await loadPhysics();
});

function row(n = 5, gap = 0.054) {
  return Array.from({ length: n }, (_, i) => bodyOnFace({ id: `a${i}`, kind: "asyq", length: ASYQ_LENGTH, face: "alshy", x: 0, z: (i - (n - 1) / 2) * gap, yaw: Math.PI / 2 }));
}

function setup(speed: number, yaw = 0, over: { mass?: number; spin?: number; surface?: ThrowSetup["surface"]; n?: number } = {}): ThrowSetup {
  const bodies = [...row(over.n ?? 5), bodyOnFace({ id: "s", kind: "sakha", length: ASYQ_LENGTH * 1.5, mass: over.mass ?? 0.09, face: "buk", x: -0.8, z: 0, yaw })];
  return {
    surface: over.surface ?? "topyraq",
    bodies,
    launch: { id: "s", velocity: [speed * Math.cos(yaw), 0.25, speed * Math.sin(yaw)], angular: [0, 0, -(over.spin ?? 0)] },
  };
}

describe("a simulated throw", () => {
  it("ends with every body at rest, on the floor or on another bone, and each lying on a named side", () => {
    const sim = simulateThrow(setup(4));
    expect(sim.settled).toBe(true);
    expect(sim.duration).toBeLessThan(10);
    for (const p of sim.final) {
      expect(Math.hypot(...p.velocity), `${p.id} still moving`).toBeLessThan(0.02);
      expect(p.face, `${p.id} has a side`).not.toBeUndefined();
      const len = p.kind === "sakha" ? ASYQ_LENGTH * 1.5 : ASYQ_LENGTH;
      const low = lowestPointOf(p.position, p.rotation, len);
      expect(low, `${p.id} is not in the floor`).toBeGreaterThan(-0.0003);
      if (low > 0.0003) {
        // held up: something must be under it
        const under = sim.final.some((q) => q.id !== p.id && Math.hypot(q.position[0] - p.position[0], q.position[2] - p.position[2]) < 0.05 && q.position[1] < p.position[1]);
        expect(under, `${p.id} floats ${(low * 1000).toFixed(2)} mm up with nothing beneath`).toBe(true);
      }
    }
  });

  it("is clean: no two bones, nor a bone and the floor, overlap by more than the limit", () => {
    for (const v of [1.5, 3, 5]) {
      const sim = simulateThrow(setup(v, 0.1));
      expect(sim.clean, `v=${v}: ${sim.attempts.map((a) => `${a.hz}Hz ${(a.maxOverlap * 1000).toFixed(2)} mm`).join(", ")}`).toBe(true);
      expect(sim.maxOverlap).toBeLessThanOrEqual(OVERLAP_LIMIT);
    }
  });

  it("is repeatable: the same throw records the same frames and ends in the same poses, bit for bit", () => {
    const a = simulateThrow(setup(4.4, 0.12, { spin: 20 })), b = simulateThrow(setup(4.4, 0.12, { spin: 20 }));
    expect(a.hz).toBe(b.hz);
    expect(a.recording.frames.length).toBe(b.recording.frames.length);
    for (let i = 0; i < a.recording.frames.length; i++) expect(Array.from(a.recording.frames[i])).toEqual(Array.from(b.recording.frames[i]));
    expect(JSON.stringify(a.final)).toBe(JSON.stringify(b.final));
    expect(JSON.stringify(a.contacts)).toBe(JSON.stringify(b.contacts));
  });

  it("depends on the initial parameters: direction, strength and spin each change where the bones end up", () => {
    const key = (s: ReturnType<typeof simulateThrow>) => JSON.stringify(s.final.map((p) => p.position.map((x) => +x.toFixed(4))));
    const base = key(simulateThrow(setup(4)));
    expect(key(simulateThrow(setup(4.8)))).not.toBe(base);
    expect(key(simulateThrow(setup(4, 0.15)))).not.toBe(base);
    expect(key(simulateThrow(setup(4, 0, { spin: 25 })))).not.toBe(base);
    expect(key(simulateThrow(setup(4, 0, { mass: 0.14 })))).not.toBe(base);
  });

  it("records the first touch of a target and where each bone went", () => {
    const sim = simulateThrow(setup(4));
    const first = sim.contacts.find((c) => c.started && ((c.a === "s" && c.b.startsWith("a")) || (c.b === "s" && c.a.startsWith("a"))));
    expect(first).toBeDefined();
    // 0.8 m at about 4 m/s: a fifth of a second
    expect(first!.time).toBeGreaterThan(0.1);
    expect(first!.time).toBeLessThan(0.5);
    expect(sim.final.filter((p) => p.kind === "asyq" && Math.hypot(p.position[0], p.position[2]) > 0.2).length).toBeGreaterThan(0);
  });

  it("a throw that misses the row leaves every target where it stood, to within a millimetre", () => {
    const start = row();
    const sim = simulateThrow(setup(3, 0.5)); // thrown far to the right of a row 0.27 m wide, 0.8 m away
    const hit = sim.contacts.some((c) => c.started && ((c.a === "s" && c.b.startsWith("a")) || (c.b === "s" && c.a.startsWith("a"))));
    expect(hit).toBe(false);
    for (const t of start) {
      const p = sim.final.find((q) => q.id === t.id)!;
      expect(Math.hypot(p.position[0] - t.position[0], p.position[2] - t.position[2])).toBeLessThan(0.001); // it settles a fraction of a millimetre into its seat
      expect(p.face).toBe("alshy");
    }
  });

  it("a harder throw sends the bones farther", () => {
    const far = (v: number) => Math.max(...simulateThrow(setup(v)).final.filter((p) => p.kind === "asyq").map((p) => p.position[0]));
    expect(far(5)).toBeGreaterThan(far(2.5));
  });

  it("stops the sakha sooner on earth than on ice, with nothing else in the way", () => {
    const x = (surface: "muz" | "topyraq") => simulateThrow(setup(3, 0.6, { surface, n: 1 })).final.find((p) => p.id === "s")!.position;
    expect(Math.hypot(...x("muz"))).toBeGreaterThan(Math.hypot(...x("topyraq")));
  });
});

describe("keeping a throw honest", () => {
  const hard = () => {
    // a hard throw of a light sakha standing on its foot: the kind that sinks in at the first rate
    const bodies = [...row(), bodyOnFace({ id: "s", kind: "sakha", length: ASYQ_LENGTH * 1.5, mass: 0.06, face: "alshy", x: -0.8, z: 0, yaw: 0 })];
    return { surface: "topyraq" as const, bodies, launch: { id: "s", velocity: [5, 0.25, 0] as [number, number, number], angular: [0, 0, 0] as [number, number, number] } };
  };

  it("stops at the first step rate that is clean", () => {
    const sim = simulateThrow(setup(1.5));
    expect(sim.attempts).toHaveLength(1);
    expect(sim.attempts[0]).toMatchObject({ hz: STEP_LADDER[0], valid: true });
    expect(sim.hz).toBe(STEP_LADDER[0]);
    expect(sim.clean).toBe(true);
  });

  it("by default accepts nothing that overlaps more than 2 mm", () => {
    expect(OVERLAP_LIMIT).toBe(0.002);
    const probe = simulateThrow(hard(), [STEP_LADDER[0]], 1e-9);
    expect(probe.maxOverlap, "this throw really does sink in at the first rate").toBeGreaterThan(OVERLAP_LIMIT);
    const sim = simulateThrow(hard());
    expect(sim.attempts[0].valid).toBe(false);
    expect(sim.attempts.length).toBeGreaterThan(1);
    expect(sim.maxOverlap).toBeLessThanOrEqual(OVERLAP_LIMIT);
    expect(sim.clean).toBe(true);
  });

  it("goes on to faster rates while a run overlaps too much, and keeps the first that is within the limit", () => {
    // measure what each rate gives, then set the limit so that only a later one passes
    const probe = simulateThrow(hard(), STEP_LADDER.slice(0, 6), 1e-9);
    const overlaps = probe.attempts.map((a) => a.maxOverlap);
    const best = overlaps.indexOf(Math.min(...overlaps));
    expect(best, `overlaps by rate: ${overlaps.map((o) => (o * 1000).toFixed(2)).join(", ")} mm`).toBeGreaterThan(0);
    const limit = overlaps[best] + 1e-12;
    const first = overlaps.findIndex((o) => o <= limit);
    const sim = simulateThrow(hard(), STEP_LADDER.slice(0, 6), limit);
    expect(sim.attempts).toHaveLength(first + 1);
    expect(sim.attempts.slice(0, -1).every((a) => !a.valid && a.maxOverlap > limit)).toBe(true);
    expect(sim.attempts[first].valid).toBe(true);
    expect(sim.hz).toBe(STEP_LADDER[first]);
    expect(sim.maxOverlap).toBeLessThanOrEqual(limit);
    expect(sim.clean).toBe(true);
    // the rate that the first run overlapped at was too deep by the real limit's measure, too
    expect(overlaps[0]).toBeGreaterThan(limit);
  });

  it("when no rate is clean, keeps the least overlapping run and says it was not clean", () => {
    const sim = simulateThrow(hard(), [480, 600, 720], 1e-9);
    expect(sim.clean).toBe(false);
    expect(sim.attempts).toHaveLength(3);
    expect(sim.maxOverlap).toBe(Math.min(...sim.attempts.map((a) => a.maxOverlap)));
    expect(sim.attempts.find((a) => a.maxOverlap === sim.maxOverlap)!.hz).toBe(sim.hz);
    expect(sim.final).toHaveLength(6);
  });

  it("with a single rung and no way to improve, still returns the throw", () => {
    const sim = simulateThrow(hard(), [480], 1e-9);
    expect(sim.clean).toBe(false);
    expect(sim.attempts).toHaveLength(1);
    expect(sim.final).toHaveLength(6);
  });

  it("the engine caps any speed at 20 m/s: an absurd throw is still a finite, settled one, never a hang or a crash", () => {
    const s = setup(5);
    s.launch.velocity = [900, 40, 0];
    const sim = simulateThrow(s, [480, 960]);
    expect(sim.settled).toBe(true);
    for (const p of sim.final) expect(p.position.every(Number.isFinite)).toBe(true);
  });

  it("a sakha sent a long way over ice is a throw, not a blow-up: it travels farther than the old 8 m limit and settles", () => {
    const sim = simulateThrow(setup(MAX_SPEED, 0.6, { surface: "muz", n: 1 }));
    expect(sim.settled).toBe(true);
    expect(sim.clean).toBe(true);
    const s = sim.final.find((p) => p.id === "s")!;
    expect(Math.hypot(s.position[0], s.position[2])).toBeGreaterThan(8);
    expect(Math.hypot(s.position[0], s.position[2])).toBeLessThan(ARENA_RADIUS);
  });

  it("a body that starts off the floor is reported as having left the arena", () => {
    const s = setup(3);
    s.bodies[s.bodies.length - 1] = { ...s.bodies[s.bodies.length - 1], position: [55, 0.05, 0] };
    s.launch.velocity = [0.1, 0, 0];
    const sim = simulateThrow(s, [480]);
    expect(sim.clean).toBe(false);
    expect(sim.attempts[0].reason).toMatch(/left the arena/);
  });

  it("the strongest throw the game allows stays inside the arena and settles", () => {
    const sim = simulateThrow(setup(MAX_SPEED, 0, { spin: 30 }));
    expect(sim.settled).toBe(true);
    for (const p of sim.final) expect(Math.hypot(p.position[0], p.position[2])).toBeLessThan(45);
  });
});

describe("playing a recording back", () => {
  let sim: Simulation;
  let rec: Recording;
  beforeAll(() => {
    sim = simulateThrow(setup(4));
    rec = sim.recording;
  });

  it("starts at the start poses and ends at the final ones", () => {
    const i = rec.ids.indexOf("s");
    const start = poseAt(rec, i, 0);
    expect(start.position[0]).toBeCloseTo(-0.8, 6);
    const end = poseAt(rec, i, recordingDuration(rec) + 5);
    const fin = sim.final.find((p) => p.id === "s")!;
    for (let k = 0; k < 3; k++) expect(end.position[k]).toBeCloseTo(fin.position[k], 6);
    for (let k = 0; k < 4; k++) expect(end.rotation[k]).toBeCloseTo(fin.rotation[k], 6);
  });

  it("is made of frames FRAME_HZ a second apart", () => {
    expect(rec.frameDt).toBeCloseTo(1 / FRAME_HZ, 6);
    expect(recordingDuration(rec)).toBeCloseTo(sim.duration, 1);
  });

  it("moves smoothly: between two frames it lies between them, with a unit quaternion", () => {
    const i = rec.ids.indexOf("s");
    for (let f = 0; f < 20; f++) {
      const a = poseAt(rec, i, f * rec.frameDt), b = poseAt(rec, i, (f + 1) * rec.frameDt), m = poseAt(rec, i, (f + 0.5) * rec.frameDt);
      for (let k = 0; k < 3; k++) expect(m.position[k]).toBeCloseTo((a.position[k] + b.position[k]) / 2, 9);
      expect(Math.hypot(...m.rotation)).toBeCloseTo(1, 9);
    }
  });

  it("never lets the sakha pass through a target: it is never inside one", () => {
    const si = rec.ids.indexOf("s");
    // x of the sakha's centre only passes a still standing target's x = 0 if it has been knocked: check frame by frame that no frame has the sakha's centre within 1 cm of an untouched target's
    let touched = false;
    for (let f = 0; f < rec.frames.length; f++) {
      const sx = rec.frames[f][si * 7], sz = rec.frames[f][si * 7 + 2];
      for (const id of rec.ids) {
        if (id === "s") continue;
        const k = rec.ids.indexOf(id);
        const d = Math.hypot(rec.frames[f][k * 7] - sx, rec.frames[f][k * 7 + 2] - sz);
        if (d < 0.01) touched = true;
      }
    }
    expect(touched).toBe(false);
  });
});

describe("running it a slice at a time", () => {
  it("gives the browser a turn and still ends with the very same result", async () => {
    const a = simulateThrow(setup(3.7, -0.1)), b = await simulateThrowAsync(setup(3.7, -0.1));
    expect(JSON.stringify(b.final)).toBe(JSON.stringify(a.final));
    expect(b.hz).toBe(a.hz);
  });
});

describe("the sides of the resting bones", () => {
  it("are read from the final orientation and agree with it", () => {
    const sim = simulateThrow(setup(4.5, 0.05));
    for (const p of sim.final) {
      const r = classifyFace(p.rotation);
      if (p.face) expect(r.face).toBe(p.face);
      if (p.face) expect(FACE_IDS).toContain(p.face);
    }
  });
});
