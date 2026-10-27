import { describe, expect, it } from "vitest";
import { ARENA_VIEWS, arenaPose, followPose, scalePose, throwPose, topPoints, topPose } from "./camera";
import { inFrame } from "../asyqView";
import { RING } from "./rules";
import * as THREE from "three";

describe("the arena cameras", () => {
  it("offers the three views, thrower's first", () => {
    expect(ARENA_VIEWS.map((v) => v.id)).toEqual(["throw", "follow", "top"]);
  });

  it("the thrower's view stands behind the ring's edge, above the floor, looking across at its middle", () => {
    for (const R of [RING.min, 0.6, RING.max]) {
      const p = throwPose(R);
      expect(p.position[0]).toBeLessThan(-R);
      expect(p.position[1]).toBeGreaterThan(0.1);
      expect(p.target[0]).toBeGreaterThan(p.position[0]);
      expect(Math.abs(p.target[0])).toBeLessThan(0.3);
    }
  });

  it("sees the thrown sakha's whole path across the ring and the asyqs standing in it", () => {
    const R = 0.6;
    const p = throwPose(R);
    const pts = [new THREE.Vector3(-R, 0.03, 0), new THREE.Vector3(0, 0.02, 0), new THREE.Vector3(0, 0.02, 0.135), new THREE.Vector3(0, 0.02, -0.135), new THREE.Vector3(R * 0.8, 0.02, 0)];
    expect(inFrame(p, pts, 16 / 10)).toBe(true);
  });

  it("the follower trails the sakha: behind it, above it, looking ahead of it", () => {
    for (const x of [-0.6, 0, 0.5, 1.4]) {
      const p = followPose([x, 0.02, 0.05]);
      expect(p.position[0]).toBeLessThan(x);
      expect(p.position[1]).toBeGreaterThan(0.1);
      expect(p.target[0]).toBeGreaterThan(x);
      // and keeps the sakha in view
      expect(inFrame(p, [new THREE.Vector3(x, 0.02, 0.05)], 16 / 10)).toBe(true);
    }
  });

  it("the overhead view takes in the whole ring, the trays and the thrower on every screen shape, as close as it can", () => {
    for (const R of [RING.min, 0.6, 1, RING.max]) {
      for (const aspect of [16 / 10, 4 / 3, 1, 0.75]) {
        const p = topPose(R, aspect);
        const pts = topPoints(R);
        expect(inFrame(p, pts, aspect), `R=${R} aspect=${aspect}`).toBe(true);
        const c = p.target;
        const closer = { position: [0, 1, 2].map((i) => c[i] + (p.position[i] - c[i]) * 0.97) as [number, number, number], target: c };
        expect(inFrame(closer, pts, aspect), `tight R=${R} aspect=${aspect}`).toBe(false);
        // looking steeply down
        expect(p.position[1]).toBeGreaterThan(Math.abs(p.position[2]) * 3);
      }
    }
  });

  it("falls back to the thrower's view when the follower has no sakha to follow", () => {
    expect(arenaPose("follow", 0.6, 1.6, null)).toEqual(throwPose(0.6));
    expect(arenaPose("follow", 0.6, 1.6, [0.3, 0.02, 0])).toEqual(followPose([0.3, 0.02, 0]));
    expect(arenaPose("top", 0.6, 1.6, null)).toEqual(topPose(0.6, 1.6));
  });

  it("scales a pose about the origin, camera and target alike", () => {
    const p = scalePose({ position: [1, 2, 3], target: [-1, 0, 4] }, 6);
    expect(p).toEqual({ position: [6, 12, 18], target: [-6, 0, 24] });
  });
});
