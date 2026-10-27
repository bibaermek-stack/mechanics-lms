import { describe, expect, it } from "vitest";
import { MAX_SAMPLES, motionSupport, SampleCollector } from "./recorder";

describe("SampleCollector", () => {
  it("starts the clock at the first kept reading and turns milliseconds into seconds", () => {
    const c = new SampleCollector();
    expect(c.push(5000, 1, 2, 3)).toBe(true);
    expect(c.push(5020, 1, 2, 3.5)).toBe(true);
    expect(c.samples).toEqual([
      { t: 0, x: 1, y: 2, z: 3 },
      { t: 0.02, x: 1, y: 2, z: 3.5 },
    ]);
  });

  it("does not start the clock on an empty event, which a computer's browser fires once", () => {
    const c = new SampleCollector();
    expect(c.push(100, null, null, null)).toBe(false);
    expect(c.push(120, undefined, 1, 1)).toBe(false);
    expect(c.length).toBe(0);
    c.push(9000, 0, 0, 9.8);
    expect(c.samples[0].t).toBe(0);
    expect(c.dropped).toBe(2);
  });

  it("drops readings whose time does not move forward or is not a number", () => {
    const c = new SampleCollector();
    c.push(1000, 0, 0, 9.8);
    expect(c.push(1000, 0, 0, 9.8)).toBe(false); // repeated stamp
    expect(c.push(990, 0, 0, 9.8)).toBe(false); // backwards
    expect(c.push(NaN, 0, 0, 9.8)).toBe(false);
    expect(c.push(1010, NaN, 0, 9.8)).toBe(false);
    expect(c.push(1020, 0, 0, 9.8)).toBe(true);
    expect(c.length).toBe(2);
    expect(c.dropped).toBe(4);
  });

  it("keeps zero as a reading (free fall can read exactly 0)", () => {
    const c = new SampleCollector();
    expect(c.push(0, 0, 0, 0)).toBe(true);
    expect(c.samples[0]).toEqual({ t: 0, x: 0, y: 0, z: 0 });
  });

  it("stops at its limit", () => {
    const c = new SampleCollector(3);
    for (let i = 0; i < 10; i++) c.push(i * 10, 0, 0, 9.8);
    expect(c.length).toBe(3);
    expect(MAX_SAMPLES).toBeGreaterThan(3600);
  });

  it("reports the rate it is receiving", () => {
    const c = new SampleCollector();
    expect(c.rate).toBe(0);
    for (let i = 0; i <= 100; i++) c.push(i * 20, 0, 0, 9.8); // 50 Hz for 2 s
    expect(c.rate).toBeCloseTo(50, 6);
  });
});

describe("motionSupport", () => {
  it("explains a missing sensor API before an insecure page", () => {
    const s = motionSupport({ secureContext: false, hasDeviceMotion: false, needsPermission: false });
    expect(s.ok).toBe(false);
    expect((s as { reason: string }).reason).toMatch(/сенсор/);
  });

  it("refuses an insecure page, and says why", () => {
    const s = motionSupport({ secureContext: false, hasDeviceMotion: true, needsPermission: false });
    expect(s).toMatchObject({ ok: false });
    expect((s as { reason: string }).reason).toMatch(/https/);
  });

  it("passes on whether a permission tap is needed", () => {
    expect(motionSupport({ secureContext: true, hasDeviceMotion: true, needsPermission: true })).toEqual({ ok: true, needsPermission: true });
    expect(motionSupport({ secureContext: true, hasDeviceMotion: true, needsPermission: false })).toEqual({ ok: true, needsPermission: false });
  });
});
