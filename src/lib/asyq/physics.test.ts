import { describe, expect, it } from "vitest";
import { seededRandom } from "../rng";
import { AsyqWorld, ASYQ_LENGTH, MAX_THROW_TIME, REST_TIME, STEP, loadPhysics, restingHeight } from "./physics";
import { FACE_IDS, MAX_FACE_ANGLE, MIN_FACE_MARGIN, classifyFace, faceById, type FaceId } from "./faces";
import { orientationOnFace, bodyOnFace } from "./placement";
import { qFromAxisAngle, qFromUnitVectors, qMul, qNormalize, qRotate, type Quat, type Vec3 } from "./math";
import { OVERLAP_LIMIT } from "./simulate";

function randomQuat(rnd: () => number): Quat {
  const u1 = rnd(), u2 = rnd() * 2 * Math.PI, u3 = rnd() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
  return [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
}

describe("placing a bone on a side", () => {
  it("turns the chosen side to the floor, and the long axis to the chosen heading", () => {
    for (const face of FACE_IDS) {
      for (const yaw of [0, 0.7, -1.2, 2.9]) {
        const q = orientationOnFace(face, yaw);
        const down = qRotate(q, faceById(face).normal);
        expect(down[1]).toBeCloseTo(-1, 9);
        const axis = qRotate(q, [1, 0, 0]);
        expect(Math.atan2(axis[2], axis[0])).toBeCloseTo(Math.atan2(Math.sin(yaw), Math.cos(yaw)), 9);
        expect(Math.hypot(...q)).toBeCloseTo(1, 12);
      }
    }
  });

  it("sits it on the floor to within a third of a millimetre: nothing floating, nothing buried", () => {
    for (const face of FACE_IDS) {
      const w = bodyOnFace({ id: "a", kind: "asyq", length: ASYQ_LENGTH, face, x: 0, z: 0, yaw: 0.3 });
      expect(restingHeight(w.rotation, ASYQ_LENGTH)).toBeCloseTo(w.position[1] - 0.0003, 12);
    }
  });
});

describe("naming the side it lies on", () => {
  it("reads each of the four sides back as itself, whatever way the bone faces", () => {
    for (const face of FACE_IDS) {
      for (const yaw of [0, 1, 2, 3, 4, 5, 6]) {
        const r = classifyFace(orientationOnFace(face, yaw));
        expect(r.face, `${face} @ ${yaw}`).toBe(face);
        expect(r.angle).toBeLessThan(0.5);
        expect(r.margin).toBeGreaterThan(40);
      }
    }
  });

  it("says nothing for a bone standing on its end", () => {
    const onEnd = qMul(qFromAxisAngle([0, 0, 1], Math.PI / 2), orientationOnFace("buk", 0));
    expect(classifyFace(onEnd).face).toBe(null);
  });

  it("says nothing for a bone tipped halfway between two sides", () => {
    const a = faceById("buk").normal, b = faceById("alshy").normal;
    const mid: Vec3 = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const m = Math.hypot(...mid);
    const down: Vec3 = [0, -1, 0];
    const axis: Vec3 = [mid[1] * down[2] - mid[2] * down[1], mid[2] * down[0] - mid[0] * down[2], mid[0] * down[1] - mid[1] * down[0]];
    const angle = Math.acos((mid[0] * down[0] + mid[1] * down[1] + mid[2] * down[2]) / m);
    expect(classifyFace(qNormalize(qFromAxisAngle(axis, angle))).face).toBe(null);
  });
});

describe("reading a side when the sides are close together", () => {
  // two sides 40° apart and one far away: the reading must be refused when it could be either, or none is near
  const faces = [
    { id: "alshy" as const, normal: [0, -1, 0] as Vec3 },
    { id: "tayke" as const, normal: [Math.sin((40 * Math.PI) / 180), -Math.cos((40 * Math.PI) / 180), 0] as Vec3 },
    { id: "buk" as const, normal: [0, 0, 1] as Vec3 },
  ];
  const lyingWithDown = (v: Vec3): Quat => {
    // the orientation that puts the body-local direction v at the floor
    const m = Math.hypot(...v);
    const u: Vec3 = [v[0] / m, v[1] / m, v[2] / m];
    return qFromUnitVectors(u, [0, -1, 0]);
  };
  const tilted = (deg: number): Vec3 => [Math.sin((deg * Math.PI) / 180), -Math.cos((deg * Math.PI) / 180), 0];

  it("names a side that is clearly the nearest", () => {
    expect(classifyFace(lyingWithDown(tilted(0)), faces).face).toBe("alshy");
    expect(classifyFace(lyingWithDown(tilted(38)), faces).face).toBe("tayke");
  });
  it("refuses a bone that lies between two sides, even though each is within reach", () => {
    // 20° from each: both are inside the angle limit, so only the margin can tell it is not a clear reading
    const r = classifyFace(lyingWithDown(tilted(20)), faces);
    expect(r.angle).toBeLessThan(MAX_FACE_ANGLE);
    expect(r.margin).toBeLessThan(MIN_FACE_MARGIN);
    expect(r.face).toBe(null);
  });
  it("refuses a bone that is far from every side, even when one is clearly nearer than the rest", () => {
    // tipped 45° towards the one side at +z: 45° from it, much farther from the others
    const toward: Vec3 = [0, -Math.SQRT1_2, Math.SQRT1_2];
    const r = classifyFace(lyingWithDown(toward), faces.filter((f) => f.id === "buk"));
    expect(r.angle).toBeGreaterThan(MAX_FACE_ANGLE);
    expect(r.face).toBe(null);
  });
});

describe("a bone dropped on the floor", () => {
  it("comes to rest lying on one of its four sides, whichever way it falls, with nothing floating or sunk", async () => {
    await loadPhysics();
    const rnd = seededRandom(31);
    const counts: Record<string, number> = { alshy: 0, tayke: 0, buk: 0, shik: 0, edge: 0 };
    for (let i = 0; i < 40; i++) {
      const w = AsyqWorld.createReady({ surface: "topyraq", hz: 480 });
      w.addBody({ id: "a", kind: "asyq", length: ASYQ_LENGTH, position: [(rnd() - 0.5) * 0.2, 0.08 + rnd() * 0.05, (rnd() - 0.5) * 0.2], rotation: randomQuat(rnd) });
      w.launch("a", [(rnd() - 0.5) * 1.5, 0, (rnd() - 0.5) * 1.5]);
      let worst = 0;
      while (!w.allAtRest() && w.time < MAX_THROW_TIME) {
        w.step();
        if (w.steps % 4 === 0) worst = Math.max(worst, w.maxPenetration());
      }
      expect(w.time, "it settles well inside the time limit").toBeLessThan(8);
      expect(worst, "overlap with the floor while it tumbled").toBeLessThan(OVERLAP_LIMIT);
      expect(w.maxPenetration(), "overlap with the floor at rest").toBeLessThan(0.00015);
      const p = w.pose("a");
      expect(p.face, "the side is committed once it has stopped").not.toBeUndefined();
      counts[p.face ?? "edge"]++;
      expect(Math.abs(w.lowestPoint("a")), "on the floor, not above it or in it").toBeLessThan(0.00015);
      if (p.face) expect(p.position[1]).toBeCloseTo(faceById(p.face as FaceId).restHeight * ASYQ_LENGTH, 3);
      w.dispose();
    }
    // the broad sides are the likely ones, the narrow ones the unlikely, as with a real asyq
    expect(counts.buk + counts.shik).toBeGreaterThan(counts.alshy + counts.tayke);
    expect(counts.buk).toBeGreaterThan(0);
    expect(counts.shik).toBeGreaterThan(0);
  }, 120_000);

  it("does not name a side while it is still moving, and does once it has stopped", async () => {
    await loadPhysics();
    const w = AsyqWorld.createReady({ surface: "topyraq", hz: 480 });
    w.addBody({ id: "a", kind: "asyq", length: ASYQ_LENGTH, position: [0, 0.1, 0], rotation: randomQuat(seededRandom(5)) });
    w.step();
    expect(w.pose("a").face).toBeUndefined();
    const seen: (FaceId | null | undefined)[] = [];
    while (!w.allAtRest()) {
      w.step();
      if (w.steps % 48 === 0) seen.push(w.pose("a").face);
      // the rule itself, at every single step: a side is only ever named once the bone has been quiet for REST_TIME
      const p = w.pose("a");
      if (p.face !== undefined) expect(p.quiet, `named at ${w.time.toFixed(3)} s`).toBeGreaterThanOrEqual(REST_TIME - w.dt - 1e-9);
    }
    expect(w.pose("a").face).not.toBeUndefined();
    // until the last half second it said nothing: the result is not fixed early
    expect(seen.slice(0, Math.max(0, seen.length - 6)).every((f) => f === undefined)).toBe(true);
    w.dispose();
  });

  it("takes the side back if the bone is knocked again before the result is used", async () => {
    await loadPhysics();
    const w = AsyqWorld.createReady({ surface: "topyraq", hz: 480 });
    w.addBody(bodyOnFace({ id: "a", kind: "asyq", length: ASYQ_LENGTH, face: "buk", x: 0, z: 0, yaw: 0 }));
    w.stepMany(480);
    expect(w.pose("a").face).toBe("buk");
    w.launch("a", [0.8, 0.5, 0], [0, 0, 5]);
    w.step();
    expect(w.pose("a").face, "a bone that has been knocked is not settled").toBeUndefined();
    while (!w.allAtRest() && w.time < MAX_THROW_TIME) w.step();
    expect(w.pose("a").face).not.toBeUndefined();
    w.dispose();
  });

  it("takes the side back when another body hits it, not only when it is launched", async () => {
    await loadPhysics();
    const w = AsyqWorld.createReady({ surface: "topyraq", hz: 960 });
    w.addBody(bodyOnFace({ id: "a", kind: "asyq", length: ASYQ_LENGTH, face: "alshy", x: 0, z: 0, yaw: Math.PI / 2 }));
    w.addBody(bodyOnFace({ id: "s", kind: "sakha", length: ASYQ_LENGTH * 1.5, mass: 0.09, face: "buk", x: -0.5, z: 0, yaw: 0 }));
    w.stepMany(960);
    expect(w.pose("a").face).toBe("alshy");
    w.launch("s", [3.5, 0.2, 0]);
    let named = true, steps = 0;
    while (steps++ < 960 && named) {
      w.step();
      if (w.pose("a").face === undefined) named = false;
    }
    expect(named, "the asyq was struck, so its settled side has to be withdrawn").toBe(false);
    w.dispose();
  });

  it("stays put when laid on each side: a bone that is down does not wander off or tip", async () => {
    await loadPhysics();
    for (const face of FACE_IDS) {
      const w = AsyqWorld.createReady({ surface: "topyraq", hz: 480 });
      w.addBody(bodyOnFace({ id: "a", kind: "asyq", length: ASYQ_LENGTH, face, x: 0.1, z: -0.1, yaw: 0.8 }));
      w.stepMany(480);
      const p = w.pose("a");
      expect(Math.hypot(p.position[0] - 0.1, p.position[2] + 0.1), face).toBeLessThan(0.0005);
      expect(p.face).toBe(face);
      w.dispose();
    }
  });

  it("slides farther on a smoother floor: ice, then wood, then earth", async () => {
    await loadPhysics();
    async function slide(surface: "muz" | "agash" | "topyraq") {
      const w = AsyqWorld.createReady({ surface, hz: 480 });
      w.addBody(bodyOnFace({ id: "a", kind: "asyq", length: ASYQ_LENGTH, face: "buk", x: 0, z: 0, yaw: 0 }));
      w.launch("a", [1, 0, 0]);
      while (!w.allAtRest() && w.time < MAX_THROW_TIME) w.step();
      const x = w.pose("a").position[0];
      w.dispose();
      return x;
    }
    const [ice, wood, earth] = [await slide("muz"), await slide("agash"), await slide("topyraq")];
    expect(ice).toBeGreaterThan(wood);
    expect(wood).toBeGreaterThan(earth);
    // a slide with friction μ stops after v²/(2μg): 1 m/s on ice (μ = 0.05) would be 1 m, but the first
    // bounce and the tumbling cost something, so only the order and the rough scale are asserted
    expect(earth).toBeLessThan(0.3);
  });
});

describe("the world is repeatable", () => {
  async function scenario() {
    await loadPhysics();
    const w = AsyqWorld.createReady({ surface: "agash", hz: 480 });
    for (let i = 0; i < 4; i++) w.addBody(bodyOnFace({ id: `a${i}`, kind: "asyq", length: ASYQ_LENGTH, face: "alshy", x: 0, z: (i - 1.5) * 0.06, yaw: Math.PI / 2 }));
    w.addBody({ ...bodyOnFace({ id: "s", kind: "sakha", length: ASYQ_LENGTH * 1.5, mass: 0.09, face: "buk", x: -0.5, z: 0.01, yaw: 0 }) });
    w.launch("s", [4.2, 0.2, 0], [0, 0, -30]);
    return w;
  }
  const snapshot = (w: AsyqWorld) => JSON.stringify(w.poses().map((p) => [p.id, p.position, p.rotation, p.face]));
  const settle = (w: AsyqWorld) => {
    while (!w.allAtRest() && w.time < MAX_THROW_TIME) w.step();
  };

  it("gives bit-for-bit the same poses when the same throw is run twice", async () => {
    const a = await scenario(), b = await scenario();
    settle(a);
    settle(b);
    expect(a.steps).toBe(b.steps);
    expect(snapshot(a)).toBe(snapshot(b));
  }, 60_000);

  it("gives the same poses whether it is stepped all at once or in uneven pieces, as the frames of a browser would", async () => {
    const a = await scenario(), b = await scenario();
    const rnd = seededRandom(9);
    while (b.steps < 960) b.stepMany(Math.min(1 + Math.floor(rnd() * 9), 960 - b.steps));
    a.stepMany(960);
    expect(snapshot(b)).toBe(snapshot(a));
  }, 60_000);

  it("depends on the throw: a harder one ends elsewhere", async () => {
    const a = await scenario(), b = await scenario();
    b.launch("s", [5.4, 0.2, 0], [0, 0, -30]);
    settle(a);
    settle(b);
    expect(snapshot(a)).not.toBe(snapshot(b));
  }, 60_000);

  it("never reports a step time it did not take: the clock is the step count", async () => {
    await loadPhysics();
    const w = AsyqWorld.createReady({ surface: "topyraq" });
    w.stepMany(480);
    expect(w.time).toBeCloseTo(480 * STEP, 12);
    expect(w.dt).toBeCloseTo(STEP, 15);
  });
});
