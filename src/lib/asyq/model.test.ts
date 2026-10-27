import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HULL_VERTICES, HULL_VOLUME, MODEL_CENTROID, MODEL_LENGTH, MODEL_SHA256, RESTING_FACES } from "./model.generated";
import { FACE_IDS, FACE_INFO, FACES } from "./faces";
import { ASYQ_MODEL } from "../asyqView";
import { angleDeg, length } from "./math";
import { ASYQ_DENSITY, ASYQ_LENGTH } from "./physics";

describe("the generated model data", () => {
  it("was made from the model file that ships (run node tools/asyq/build-model.mjs if this fails)", () => {
    const sha = createHash("sha256").update(readFileSync("public/models/asyk.glb")).digest("hex");
    expect(sha).toBe(MODEL_SHA256);
  });

  it("agrees with what the picture code knows of the model's size", () => {
    expect(MODEL_LENGTH).toBeCloseTo(ASYQ_MODEL.length, 5);
  });

  it("is a hull of a few hundred vertices, centred on its centre of mass, one bone long", () => {
    expect(HULL_VERTICES.length % 3).toBe(0);
    const n = HULL_VERTICES.length / 3;
    expect(n).toBeGreaterThan(100);
    expect(n).toBeLessThan(400);
    const xs = Array.from({ length: n }, (_, i) => HULL_VERTICES[i * 3]);
    // the long axis is x, and a little longer than one length because the hull is grown to cover the scan
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1.1);
    // centred: the middle of the bounding box is within a few percent of the centre of mass
    for (let k = 0; k < 3; k++) {
      const v = Array.from({ length: n }, (_, i) => HULL_VERTICES[i * 3 + k]);
      expect(Math.abs((Math.max(...v) + Math.min(...v)) / 2)).toBeLessThan(0.12);
    }
    expect(MODEL_CENTROID.every(Number.isFinite)).toBe(true);
  });

  it("weighs about what a sheep's knucklebone does: 20–40 g at 4 cm in bone density", () => {
    const grams = HULL_VOLUME * ASYQ_LENGTH ** 3 * ASYQ_DENSITY * 1000;
    expect(grams).toBeGreaterThan(20);
    expect(grams).toBeLessThan(40);
  });
});

describe("the four sides", () => {
  it("are the four named ones, once each, with unit normals pointing four different ways", () => {
    expect(RESTING_FACES.map((f) => f.id).sort()).toEqual([...FACE_IDS].sort());
    for (const f of FACES) expect(length(f.normal)).toBeCloseTo(1, 12);
    for (let i = 0; i < FACES.length; i++) for (let j = i + 1; j < FACES.length; j++) expect(angleDeg(FACES[i].normal, FACES[j].normal), `${FACES[i].id}/${FACES[j].id}`).toBeGreaterThan(50);
  });

  it("have the shares of a real knucklebone: the two broad sides most of the time, the narrow ones about a tenth each", () => {
    const share = Object.fromEntries(RESTING_FACES.map((f) => [f.id, f.share]));
    expect(share.buk + share.shik).toBeGreaterThan(0.75);
    expect(share.alshy).toBeGreaterThan(0.04);
    expect(share.tayke).toBeGreaterThan(0.04);
    expect(share.alshy + share.tayke).toBeLessThan(0.25);
    expect(RESTING_FACES.reduce((a, f) => a + f.share, 0)).toBeGreaterThan(0.97);
  });

  it("the broad sides lie lower than the narrow ones: the bone sits lower on its wide face", () => {
    const h = Object.fromEntries(RESTING_FACES.map((f) => [f.id, f.restHeight]));
    expect(Math.max(h.buk, h.shik)).toBeLessThan(Math.min(h.alshy, h.tayke));
  });

  it("are told apart by what was measured on the scan: бүк lies on the dished side, алшы on the flatter foot", () => {
    const f = Object.fromEntries(RESTING_FACES.map((x) => [x.id, x]));
    // dished (the middle of the contact face sits below the plane it rests on) vs domed
    expect(f.buk.centreDepth).toBeGreaterThan(f.shik.centreDepth);
    // flatter foot: the surface around it stays closer to the plane
    expect(f.alshy.meanDepth).toBeLessThan(f.tayke.meanDepth);
  });

  it("carry the ranks that order a toss: алшы 1, тәйке 2, бүк 3, шік 4", () => {
    expect(FACE_IDS.map((id) => FACE_INFO[id].rank)).toEqual([1, 2, 3, 4]);
    expect(FACE_IDS.map((id) => FACE_INFO[id].name)).toEqual(["Алшы", "Тәйке", "Бүк", "Шік"]);
  });
});
