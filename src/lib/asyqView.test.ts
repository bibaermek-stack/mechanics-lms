import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildFolk } from "./folk";
import {
  ASYQ_MODEL,
  ASYQ_VIEWS,
  ASYQ_WIDTH_RATIO,
  CAMERA_FOV,
  LANE_HALF_WIDTH,
  ROW_COUNT,
  ROW_Z,
  aimArrowLength,
  asyqLength,
  chasePose,
  damp,
  inFrame,
  overviewPoints,
  overviewPose,
  rowPositions,
  rulerMarks,
  rulerStep,
  sakhaLength,
  surfaceLook,
  viewReach,
} from "./asyqView";

/** Reads the model file's JSON chunk, the way any glTF loader does. */
function glbJson(path: string) {
  const buf = readFileSync(path);
  expect(buf.toString("ascii", 0, 4)).toBe("glTF");
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.toString("utf8", 20, 20 + len));
}

describe("the model file", () => {
  const json = glbJson("public/models/asyk.glb");
  it("is one textured mesh, with the JPEG texture the game ships", () => {
    expect(json.meshes).toHaveLength(1);
    expect(json.images).toHaveLength(1);
    expect(json.images[0].mimeType).toBe("image/jpeg");
  });
  it("has the bounding box ASYQ_MODEL records (the node only flips it over, which changes no size)", () => {
    const acc = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
    const size = acc.max.map((hi: number, i: number) => hi - acc.min[i]);
    expect(size[0]).toBeCloseTo(ASYQ_MODEL.length, 8);
    expect(size[1]).toBeCloseTo(ASYQ_MODEL.height, 8);
    expect(size[2]).toBeCloseTo(ASYQ_MODEL.depth, 8);
    expect(ASYQ_MODEL.length).toBeGreaterThan(ASYQ_MODEL.depth);
    expect(ASYQ_MODEL.length).toBeGreaterThan(ASYQ_MODEL.height);
    // a node rotation of exactly a half turn about x: quaternion (1, 0, 0, ~0)
    const q = json.nodes[0].rotation;
    expect(q[0]).toBeCloseTo(1, 6);
    expect(Math.abs(q[1]) + Math.abs(q[2]) + Math.abs(q[3])).toBeLessThan(1e-6);
  });
  it("stays small enough for a phone to fetch in a game round (under 1 MB)", () => {
    expect(readFileSync("public/models/asyk.glb").length).toBeLessThan(1_000_000);
  });
});

describe("the row of target asyqs", () => {
  it("is n equal cells covering target ± radius, centred", () => {
    const xs = rowPositions(8, 0.5);
    expect(xs).toHaveLength(ROW_COUNT);
    expect(xs.map((x) => +x.toFixed(10))).toEqual([7.6, 7.8, 8, 8.2, 8.4]);
    const half = (xs[1] - xs[0]) / 2;
    expect(xs[0] - half).toBeCloseTo(8 - 0.5, 12);
    expect(xs[4] + half).toBeCloseTo(8 + 0.5, 12);
    expect(rowPositions(10, 0.6, 3).map((x) => +x.toFixed(10))).toEqual([9.6, 10, 10.4]);
  });

  it("never lets two asyqs touch, and never leaves the hit zone, in any round the game can deal", () => {
    for (const kind of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]) {
      for (const r of buildFolk("asyq", kind).rounds) {
        const { target, radius } = r.params;
        const xs = rowPositions(target, radius);
        const cell = xs[1] - xs[0];
        const width = asyqLength(target) * ASYQ_WIDTH_RATIO; // turned to face the lane: its short side is along x
        expect(width, `target ${target}`).toBeLessThan(cell);
        expect(xs[0] - width / 2).toBeGreaterThanOrEqual(target - radius - 1e-9);
        expect(xs[ROW_COUNT - 1] + width / 2).toBeLessThanOrEqual(target + radius + 1e-9);
      }
    }
  });

  it("the sakha is the bigger bone, and both stay small beside the lane", () => {
    for (const target of [4, 6, 8, 10, 12]) {
      expect(sakhaLength(target)).toBeGreaterThan(asyqLength(target));
      expect(sakhaLength(target) * ASYQ_WIDTH_RATIO).toBeLessThan(LANE_HALF_WIDTH); // fits in the lane
    }
    expect(asyqLength(4)).toBeCloseTo(0.2, 12);
    expect(asyqLength(12)).toBeCloseTo(0.34, 12);
    expect(ROW_Z).toBeGreaterThan(LANE_HALF_WIDTH);
  });
});

describe("how far the picture reaches", () => {
  it("is the target with room beyond it, and at least 6 m", () => {
    expect(viewReach(4, [])).toBe(6);
    expect(viewReach(10, [])).toBeCloseTo(13.5, 12);
  });
  it("grows to take in a stop, with a margin", () => {
    expect(viewReach(8, [14])).toBeCloseTo(15.12, 12);
    expect(viewReach(8, [3, 14, 9])).toBeCloseTo(15.12, 12);
  });
  it("but never past three targets: a throw of 200 m on ice does not shrink the asyqs to dust", () => {
    expect(viewReach(8, [199.8])).toBe(24);
    expect(viewReach(4, [199.8])).toBe(12);
  });
});

describe("the ruler", () => {
  it("has at most eleven marks, from 0, at a round step", () => {
    for (let reach = 6; reach <= 40; reach += 0.5) {
      const marks = rulerMarks(reach);
      expect(marks[0]).toBe(0);
      expect(marks.length).toBeLessThanOrEqual(11);
      expect(marks[marks.length - 1]).toBeLessThanOrEqual(reach);
      expect(marks[marks.length - 1]).toBeGreaterThan(reach - rulerStep(reach));
    }
    expect(rulerStep(8)).toBe(1);
    expect(rulerStep(13.5)).toBe(2);
    expect(rulerStep(24)).toBe(5);
    expect(rulerMarks(13.5)).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });
});

describe("the speed arrow", () => {
  it("is longer for a harder throw and always visible", () => {
    expect(aimArrowLength(1)).toBeCloseTo(0.47, 12);
    expect(aimArrowLength(14)).toBeCloseTo(2.68, 12);
    for (let v = 1; v < 14; v += 0.1) expect(aimArrowLength(v + 0.1)).toBeGreaterThan(aimArrowLength(v));
  });
});

describe("the surface under the lane", () => {
  it("is named as the round names it, for every round the game can deal", () => {
    for (let seed = 1; seed <= 25; seed++) {
      for (const r of buildFolk("asyq", seed).rounds) {
        const look = surfaceLook(r.params.mu);
        expect(r.title.endsWith(look.name), `${r.title} vs ${look.name}`).toBe(true);
      }
    }
  });
  it("tells the five surfaces apart, smooth to rough", () => {
    const ids = [0.05, 0.1, 0.3, 0.4, 0.6].map((mu) => surfaceLook(mu).id);
    expect(ids).toEqual(["ice", "snow", "wood", "grass", "sand"]);
    expect(surfaceLook(0.05).roughness).toBeLessThan(surfaceLook(0.6).roughness);
  });
  it("uses the thresholds at their edges", () => {
    expect(surfaceLook(0.0799).id).toBe("ice");
    expect(surfaceLook(0.08).id).toBe("snow");
    expect(surfaceLook(0.2).id).toBe("wood");
    expect(surfaceLook(0.35).id).toBe("grass");
    expect(surfaceLook(0.5).id).toBe("sand");
  });
});

describe("the cameras", () => {
  const ASPECTS = [16 / 9, 4 / 3, 1.2, 0.8];

  it("the chase camera trails the sakha, looks down the lane, and keeps the sakha and the row on its sides of the picture", () => {
    for (const target of [4, 8, 12]) {
      for (const x of [0, 3, 11]) {
        const p = chasePose(x, target);
        expect(p.position[0]).toBeLessThan(x); // behind
        expect(p.target[0]).toBeGreaterThan(x); // looking ahead
        expect(p.position[1]).toBeGreaterThan(0.5); // above the floor
        expect(p.position[2]).toBeLessThan(-LANE_HALF_WIDTH * 0.8); // left of the lane, the row being on the right
        // the sakha is always in the picture, and the asyqs row is to its right on screen
        const cam = new THREE.PerspectiveCamera(CAMERA_FOV, 16 / 9, 0.05, 200);
        cam.position.set(...p.position);
        cam.lookAt(...p.target);
        cam.updateMatrixWorld(true);
        const sakha = new THREE.Vector3(x, 0.1, 0).project(cam);
        expect(Math.abs(sakha.x)).toBeLessThan(0.9);
        expect(Math.abs(sakha.y)).toBeLessThan(0.9);
        // the row is on the right-hand side of the lane as the camera sees it: right of the lane's own centre line
        const row = new THREE.Vector3(x + 5, 0.1, ROW_Z).project(cam);
        const centre = new THREE.Vector3(x + 5, 0.1, 0).project(cam);
        expect(row.x).toBeGreaterThan(centre.x);
      }
    }
  });

  it("the chase camera moves with the sakha: the same view from any x", () => {
    const a = chasePose(0, 8), b = chasePose(5, 8);
    for (let i = 0; i < 3; i++) {
      const shift = i === 0 ? 5 : 0;
      expect(b.position[i] - a.position[i]).toBeCloseTo(shift, 12);
      expect(b.target[i] - a.target[i]).toBeCloseTo(shift, 12);
    }
  });

  it("each overview takes in the whole lane and the row of asyqs, on every screen shape, and is not needlessly far", () => {
    for (const view of ["side", "top"] as const) {
      for (const reach of [6, 13.5, 24, 36]) {
        for (const aspect of ASPECTS) {
          const pose = overviewPose(view, reach, aspect);
          const pts = overviewPoints(reach);
          expect(inFrame(pose, pts, aspect), `${view} reach ${reach} aspect ${aspect}`).toBe(true);
          // pulled in 3 % it no longer fits: the fit is tight, not just generous
          const c = pose.target;
          const closer: typeof pose = { position: [0, 1, 2].map((i) => c[i] + (pose.position[i] - c[i]) * 0.97) as [number, number, number], target: c };
          expect(inFrame(closer, pts, aspect), `tight ${view} ${reach} ${aspect}`).toBe(false);
        }
      }
    }
  });

  it("the top view really is steeper than the side view, and both look at the middle of the lane", () => {
    const side = overviewPose("side", 12, 16 / 9), top = overviewPose("top", 12, 16 / 9);
    const slope = (p: { position: number[]; target: number[] }) => Math.atan2(p.position[1] - p.target[1], Math.hypot(p.position[2] - p.target[2], p.position[0] - p.target[0]));
    expect(slope(top)).toBeGreaterThan(slope(side) + 0.8);
    expect(side.target[0]).toBeCloseTo(6, 12);
    expect(top.target[0]).toBeCloseTo(6, 12);
    expect(side.position[2]).toBeLessThan(0); // the row of asyqs is behind the lane, not in front of the camera
  });

  it("a narrower screen backs the camera off", () => {
    const wide = overviewPose("side", 13.5, 16 / 9), narrow = overviewPose("side", 13.5, 0.8);
    const dist = (p: { position: number[]; target: number[] }) => Math.hypot(...p.position.map((v, i) => v - p.target[i]));
    expect(dist(narrow)).toBeGreaterThan(dist(wide));
  });

  it("offers three views, chase first", () => {
    expect(ASYQ_VIEWS.map((v) => v.id)).toEqual(["chase", "side", "top"]);
  });
});

describe("easing", () => {
  it("stays put for no time and arrives given long enough", () => {
    expect(damp(3, 10, 5, 0)).toBe(3);
    expect(damp(3, 10, 5, 100)).toBeCloseTo(10, 12);
  });
  it("covers 1 − e^(−λdt) of the gap", () => {
    expect(damp(0, 1, 2, 0.5)).toBeCloseTo(1 - Math.exp(-1), 12);
  });
  it("is the same however the time is cut up: two half steps = one whole", () => {
    const one = damp(2, 9, 4, 0.2);
    const two = damp(damp(2, 9, 4, 0.1), 9, 4, 0.1);
    expect(two).toBeCloseTo(one, 12);
  });
  it("never overshoots", () => {
    let x = 0;
    for (let i = 0; i < 100; i++) {
      x = damp(x, 1, 6, 1 / 60);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});
