import { describe, expect, it } from "vitest";
import { G, contact, frameAt, pchip, simulate, type Profile, type Pt } from "./coaster";

const pts = (ys: number[], dx = 4): Pt[] => ys.map((y, i) => ({ x: i * dx, y }));
const near = (a: number, b: number, rel: number, what = "") => expect(Math.abs(a - b) / Math.abs(b), `${what}: ${a} vs ${b}`).toBeLessThan(rel);

// Reference values: an independent implementation in Python (the Hermite conditions solved as a linear
// system, instead of the closed-form basis used here), see the commit message.
const HILLY = pts([8, 3, 5, 1, 4, 0.5, 1]);
const REF_HILLY: [number, number, number, number][] = [
  [0, 8, -2.125, 0.25],
  [1, 6.0234375, -1.8046875, 0.390625],
  [2.5, 3.834960938, -1.060546875, 0.6015625],
  [4, 3, 0, 0.75],
  [5.3, 3.4964375, 0.658125, 0.2625],
  [8, 5, 0, -1.5],
  [9.7, 3.446625, -1.46625, -0.225],
  [12, 1, 0, 1.125],
  [13.1, 1.55584375, 0.8971875, 0.50625],
  [16, 4, 0, -1.3125],
  [18.2, 1.988375, -1.299375, 0.13125],
  [22, 0.5625, 0.09375, 0.09375],
  [24, 1, 0.375, 0.1875],
];

describe("pchip", () => {
  it("matches an independent implementation: height, slope and curvature", () => {
    const p = pchip(HILLY);
    for (const [x, y, dy, d2y] of REF_HILLY) {
      expect(p.y(x), `y(${x})`).toBeCloseTo(y, 8);
      expect(p.dy(x), `dy(${x})`).toBeCloseTo(dy, 8);
      expect(p.d2y(x), `d2y(${x})`).toBeCloseTo(d2y, 8);
    }
  });

  it("matches the reference on monotone data with a plateau", () => {
    const p = pchip(pts([1, 2, 2.1, 6, 6.5, 9, 9]));
    for (const [x, y, dy] of [[1, 1.351633523, 0.335014205], [3.3, 1.933822656, 0.140804688], [7, 2.065475852, 0.023061080], [10, 3.963579545, 1.394914773], [14.5, 6.297629616, 0.086795691], [19, 8.6484375, 0.638020833]]) {
      expect(p.y(x)).toBeCloseTo(y, 8);
      expect(p.dy(x)).toBeCloseTo(dy, 8);
    }
  });

  it("weights unequally spaced points by their gaps (independent reference)", () => {
    const p = pchip([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 4, y: 2 }, { x: 6, y: 5 }, { x: 7, y: 4 }]);
    const ref: [number, number, number, number][] = [
      [0, 1, 2.583333333, 1.666666667],
      [0.4, 2.076, 2.57, -1.733333333],
      [1, 3, 0, -0.666666667],
      [2.5, 2.5, -0.5, 0],
      [4, 2, 0, 4.5],
      [5, 3.5, 2.25, 0],
      [6, 5, 0, -2.333333333],
      [6.5, 4.729166667, -1.041666667, -1.833333333],
      [7, 4, -1.833333333, -1.333333333],
    ];
    for (const [x, y, dy, d2y] of ref) {
      expect(p.y(x), `y(${x})`).toBeCloseTo(y, 8);
      expect(p.dy(x), `dy(${x})`).toBeCloseTo(dy, 8);
      expect(p.d2y(x), `d2y(${x})`).toBeCloseTo(d2y, 8);
    }
  });

  it("takes the weighted harmonic mean of the two neighbouring slopes on unequally spaced rising data (reference)", () => {
    const p = pchip([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 4, y: 2 }, { x: 6, y: 5 }, { x: 7, y: 6 }]);
    const ref: [number, number, number, number][] = [
      [0, 0, 1.166666667, 0.242424242],
      [0.5, 0.577651515, 1.071969697, -0.621212121],
      [1, 1, 0.545454545, -0.440352896],
      [2.5, 1.49093786, 0.2212313, 0.008055236],
      [4, 2, 0.569620253, 2.18684645],
      [5, 3.348926802, 1.814116676, 0.302146395],
      [6, 5, 1.173913043, -0.362318841],
      [6.5, 5.542572464, 0.998188406, -0.34057971],
      [7, 6, 0.833333333, -0.31884058],
    ];
    for (const [x, y, dy, d2y] of ref) {
      expect(p.y(x), `y(${x})`).toBeCloseTo(y, 8);
      expect(p.dy(x), `dy(${x})`).toBeCloseTo(dy, 8);
      expect(p.d2y(x), `d2y(${x})`).toBeCloseTo(d2y, 8);
    }
  });

  it("levels the end of the curve instead of overshooting when the three-point slope has the wrong sign (reference)", () => {
    const p = pchip([{ x: 0, y: 0 }, { x: 4, y: 0.1 }, { x: 8, y: 5 }]);
    expect(p.dy(0)).toBe(0);
    for (const [x, y, dy] of [[1, 0.0064375, 0.0128125], [2, 0.0255, 0.02525], [4, 0.1, 0.049], [6, 1.662, 1.369], [8, 5, 1.825]]) {
      expect(p.y(x), `y(${x})`).toBeCloseTo(y, 8);
      expect(p.dy(x), `dy(${x})`).toBeCloseTo(dy, 8);
    }
  });

  it("caps the end slope at three times the neighbouring slope when the data bends sharply (reference)", () => {
    const p = pchip([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1.05 }, { x: 3, y: 3 }]);
    expect(p.dy(0)).toBeCloseTo(1.475, 9);
    for (const [x, y, dy] of [[0.5, 0.672470238, 1.107440476], [1, 1, 0.095238095], [3, 3, 2.9]]) {
      expect(p.y(x), `y(${x})`).toBeCloseTo(y, 8);
      expect(p.dy(x), `dy(${x})`).toBeCloseTo(dy, 8);
    }
  });

  it("passes through every control point exactly", () => {
    const p = pchip(HILLY);
    for (const q of HILLY) expect(p.y(q.x)).toBeCloseTo(q.y, 12);
  });

  it("puts a crest and a valley exactly at their control points, with a level tangent", () => {
    const p = pchip(HILLY);
    for (const x of [4, 8, 12, 16, 20]) expect(p.dy(x)).toBeCloseTo(0, 12);
    // and nothing near a crest is higher than it, nothing near a valley lower
    for (let x = 6; x <= 10; x += 0.05) expect(p.y(x)).toBeLessThanOrEqual(5 + 1e-9);
    for (let x = 10; x <= 14; x += 0.05) expect(p.y(x)).toBeGreaterThanOrEqual(1 - 1e-9);
  });

  it("never overshoots its data between two points", () => {
    const data = pts([1, 2, 2.1, 6, 6.5, 9, 9]);
    const p = pchip(data);
    for (let k = 0; k < data.length - 1; k++) {
      const lo = Math.min(data[k].y, data[k + 1].y), hi = Math.max(data[k].y, data[k + 1].y);
      for (let x = data[k].x; x <= data[k + 1].x; x += 0.02) {
        expect(p.y(x)).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(p.y(x)).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });

  it("has a slope that is continuous across the control points", () => {
    const p = pchip(HILLY);
    for (const x of [4, 8, 12, 16, 20]) expect(Math.abs(p.dy(x - 1e-9) - p.dy(x + 1e-9))).toBeLessThan(1e-6);
  });

  it("has derivatives that really are derivatives", () => {
    const p = pchip(HILLY);
    const h = 1e-5;
    for (const x of [0.7, 2.2, 5.1, 6.9, 10.3, 14.4, 17.7, 21.1, 23.5]) {
      expect((p.y(x + h) - p.y(x - h)) / (2 * h), `dy ${x}`).toBeCloseTo(p.dy(x), 5);
      expect((p.dy(x + h) - p.dy(x - h)) / (2 * h), `d2y ${x}`).toBeCloseTo(p.d2y(x), 5);
    }
  });

  it("is a straight line through two points, and clamps outside its range", () => {
    const p = pchip([{ x: 0, y: 6 }, { x: 12, y: 0 }]);
    expect(p.y(6)).toBeCloseTo(3, 12);
    expect(p.dy(3)).toBeCloseTo(-0.5, 12);
    expect(p.d2y(3)).toBeCloseTo(0, 12);
    expect(p.y(-5)).toBeCloseTo(6, 12);
    expect(p.y(99)).toBeCloseTo(0, 12);
  });

  it("refuses too few points and points that do not go left to right", () => {
    expect(() => pchip([{ x: 0, y: 1 }])).toThrow();
    expect(() => pchip([{ x: 0, y: 1 }, { x: 0, y: 2 }])).toThrow();
    expect(() => pchip([{ x: 2, y: 1 }, { x: 1, y: 2 }])).toThrow();
  });
});

describe("the contact force", () => {
  it("is g·cosθ on a straight slope at any speed, g + u²/R at the bottom of a dip, g − u²/R on a crest", () => {
    const R = 10;
    const dip: Profile = { x0: -5, x1: 5, y: (x) => x * x / (2 * R), dy: (x) => x / R, d2y: () => 1 / R };
    const crest: Profile = { x0: -5, x1: 5, y: (x) => -x * x / (2 * R), dy: (x) => -x / R, d2y: () => -1 / R };
    expect(contact(dip, 0, 8).n).toBeCloseTo(G + 64 / R, 10);
    expect(contact(crest, 0, 8).n).toBeCloseTo(G - 64 / R, 10);
    expect(contact(crest, 0, 8).gForce).toBeCloseTo(1 - 64 / (R * G), 10);
    const slope = pchip([{ x: 0, y: 6 }, { x: 12, y: 0 }]);
    expect(contact(slope, 3, 0).n).toBeCloseTo(G * Math.cos(Math.atan(0.5)), 10);
    expect(contact(slope, 3, 30).n).toBeCloseTo(G * Math.cos(Math.atan(0.5)), 10);
  });
});

describe("curvature", () => {
  it("is exactly 1/R everywhere on a circular arc, however steep: κ = y″/(1+y′²)^(3/2)", () => {
    const R = 8;
    const arc: Profile = {
      x0: -6, x1: 6,
      y: (x) => R - Math.sqrt(R * R - x * x),
      dy: (x) => x / Math.sqrt(R * R - x * x),
      d2y: (x) => (R * R) / (R * R - x * x) ** 1.5,
    };
    for (const x of [0, 2, 4, 5.5]) {
      expect(contact(arc, x, 0).kappa, `x=${x}`).toBeCloseTo(1 / R, 12);
      // a circle pressed at speed u: N/m = g·cosθ + u²/R
      expect(contact(arc, x, 7).n).toBeCloseTo(G * contact(arc, x, 0).cos + 49 / R, 10);
    }
  });

  it("makes friction bite harder in a dip: at the bottom of a circle it is μ(g + u²/R), not μg", () => {
    const R = 10, mu = 0.2, v0 = 10;
    const arc: Profile = { x0: 0, x1: 5, y: (x) => R - Math.sqrt(R * R - x * x), dy: (x) => x / Math.sqrt(R * R - x * x), d2y: (x) => (R * R) / (R * R - x * x) ** 1.5 };
    const r = simulate(arc, { mu, v0 });
    const dt = r.frames[1].t;
    // the slope is still small after one frame (x ≈ 0,17 m), so gravity along the track adds only g·x/R
    const decel = mu * (G + v0 * v0 / R) + (G * (v0 * dt / 2)) / R;
    expect(v0 - r.frames[1].u).toBeCloseTo(decel * dt, 3);
    // and the heat in that frame is the force times the distance
    near(r.frames[1].heat, 500 * mu * (G + v0 * v0 / R) * v0 * dt, 0.015, "heat in the first frame");
  });
});

describe("rolling down a straight slope (6 m over 12 m: tanθ = 1/2)", () => {
  const slope = pchip([{ x: 0, y: 6 }, { x: 12, y: 0 }]);
  const len = Math.hypot(12, 6), sinT = 6 / len, cosT = 12 / len;

  it("frictionless: the speed at the bottom is √(2gh) and the time √(2s/a), a = g·sinθ", () => {
    const r = simulate(slope);
    expect(r.status).toBe("finished");
    near(r.endSpeed, Math.sqrt(2 * G * 6), 0.002, "speed");
    near(r.endTime, Math.sqrt((2 * len) / (G * sinT)), 0.002, "time");
  });

  it("with friction μ = 0,2: a = g(sinθ − μ cosθ)", () => {
    const mu = 0.2, a = G * (sinT - mu * cosT);
    const r = simulate(slope, { mu });
    expect(r.status).toBe("finished");
    near(r.endTime, Math.sqrt((2 * len) / a), 0.0004, "time");
    near(r.endSpeed, a * Math.sqrt((2 * len) / a), 0.0004, "speed");
    // the heat is the friction force times the distance: μ·m·g·cosθ·s
    near(r.heat, mu * 500 * G * cosT * len, 0.002, "heat");
  });

  it("with μ just under tanθ it creeps down at a = g(sinθ − μ cosθ), the start of the motion counted exactly", () => {
    const mu = 0.48, a = G * (sinT - mu * cosT);
    const r = simulate(slope, { mu });
    expect(r.status).toBe("finished");
    near(r.endTime, Math.sqrt((2 * len) / a), 0.0005, "time");
    near(r.endSpeed, a * Math.sqrt((2 * len) / a), 0.0005, "speed");
  });

  it("rolls back off the left end when released on an uphill slope with too little speed", () => {
    const up = pchip([{ x: 0, y: 0 }, { x: 8, y: 2 }]);
    const r = simulate(up, { mu: 0.1 });
    expect(r.status).toBe("off-start");
    expect(r.endX).toBe(0);
    // it goes at once, not after rolling on beyond the end
    expect(r.endTime).toBeLessThan(0.01);
    // with a push it climbs, then turns back and leaves by the same end
    const pushed = simulate(up, { mu: 0.1, v0: 3 });
    expect(pushed.status).toBe("off-start");
    expect(pushed.maxX).toBeGreaterThan(1);
    expect(pushed.maxX).toBeLessThan(8);
    // frictionless: up to v²/(2g·sinθ·…): the height gained is v²/2g
    const free = simulate(up, { v0: 3 });
    expect(free.maxHeight).toBeCloseTo(9 / (2 * G), 2);
  });

  it("does not move at all when friction can hold it (μ > tanθ), and says it stopped", () => {
    const r = simulate(slope, { mu: 0.6 });
    expect(r.status).toBe("stopped");
    expect(r.endX).toBe(0);
    expect(r.frames).toHaveLength(1);
    expect(r.heat).toBe(0);
  });

  it("just moves when μ is a little under tanθ", () => {
    const r = simulate(slope, { mu: 0.48, tMax: 120 });
    expect(r.status).toBe("finished");
  });
});

describe("on the flat with friction", () => {
  const flat = pchip([{ x: 0, y: 1 }, { x: 40, y: 1 }]);

  it("stops after v²/(2μg), where all the kinetic energy has become heat", () => {
    const r = simulate(flat, { v0: 6, mu: 0.1 });
    expect(r.status).toBe("stopped");
    near(r.endX, 36 / (2 * 0.1 * G), 0.002, "distance");
    near(r.heat, 0.5 * 500 * 36, 0.002, "heat");
    expect(r.endSpeed).toBe(0);
  });

  it("leaves the end with what it has left if it does not stop in time", () => {
    const r = simulate(flat, { v0: 10, mu: 0.1 });
    expect(r.status).toBe("finished");
    near(r.endSpeed, Math.sqrt(100 - 2 * 0.1 * G * 40), 0.002, "speed");
  });

  it("without friction, goes on at the same speed", () => {
    const r = simulate(flat, { v0: 6 });
    expect(r.status).toBe("finished");
    near(r.endSpeed, 6, 1e-9);
    near(r.endTime, 40 / 6, 0.001);
  });
});

describe("a hilly track", () => {
  const hilly = pchip(HILLY);

  it("matches an independent integration (the Lagrangian equation in x alone): time and speed at the end", () => {
    const r = simulate(hilly);
    expect(r.status).toBe("finished");
    near(r.endTime, 3.722721346, 0.002, "time");
    near(r.endSpeed, Math.sqrt(2 * G * 7), 0.002, "speed = √(2g·Δh), whatever the path");
    near(r.endSpeed, 11.71911658, 0.002, "speed (reference)");
    const second = simulate(pchip(pts([6, 2, 4, 0.8, 3, 0.6, 0.6])));
    near(second.endTime, 3.896596358, 0.002, "time, track 2");
    near(second.endSpeed, 10.29310449, 0.002, "speed, track 2");
  });

  it("conserves KE + PE + heat at every moment, with and without friction", () => {
    for (const mu of [0, 0.05, 0.2]) {
      const r = simulate(hilly, { mu, v0: 1 });
      expect(r.energyError, `μ=${mu}`).toBeLessThan(mu ? 2e-3 : 5e-4);
      for (const f of r.frames) near(f.ke + f.pe + f.heat, r.startEnergy, 2e-3, `frame ${f.t}`);
    }
  });

  it("with no friction the cart never rises above its starting height", () => {
    const r = simulate(pchip(pts([4, 1, 3.9, 1, 3, 0.5, 2])), { tMax: 30 });
    expect(r.maxHeight).toBeLessThanOrEqual(4 + 1e-6);
    for (const f of r.frames) expect(f.y).toBeLessThanOrEqual(4 + 1e-3);
  });

  it("cannot clear a hill that is higher than where it started: it turns back short of it", () => {
    const r = simulate(pchip(pts([4, 1, 5, 1, 2, 1, 1])), { tMax: 20 });
    expect(r.status).not.toBe("finished");
    expect(r.maxX).toBeLessThan(8);
    expect(r.maxX).toBeCloseTo(Math.max(...r.frames.map((f) => f.x)), 2);
    // and it never gets above where it started
    expect(r.maxHeight).toBeLessThanOrEqual(4 + 1e-6);
  });

  it("and clears it from a little higher up", () => {
    const r = simulate(pchip(pts([5.3, 1, 5, 1, 2, 1, 1])));
    expect(r.status).toBe("finished");
  });

  it("is unchanged by the mass in everything but the energies, which scale with it", () => {
    const a = simulate(hilly, { mass: 100 }), b = simulate(hilly, { mass: 400 });
    expect(b.endTime).toBeCloseTo(a.endTime, 9);
    expect(b.maxG).toBeCloseTo(a.maxG, 9);
    near(b.startEnergy, 4 * a.startEnergy, 1e-12);
    near(b.frames[20].ke, 4 * a.frames[20].ke, 1e-9);
  });

  it("gives about sixty frames a second, from the start to the end", () => {
    const r = simulate(hilly);
    expect(r.frames[0].t).toBe(0);
    expect(r.frames[1].t).toBeCloseTo(1 / 60, 9);
    expect(r.frames.length).toBeGreaterThan(60 * r.endTime);
    expect(r.frames.length).toBeLessThan(60 * r.endTime + 3);
  });
});

describe("G-force", () => {
  it("at the bottom of a circular dip of radius R, released from rest h above it, is 1 + 2h/R", () => {
    const R = 10, a = 8.944; // x such that the start is 4 m above the bottom: x²/(2R) = 4 → x = 8.944
    const dip: Profile = { x0: -a, x1: a * 3, y: (x) => (x * x) / (2 * R), dy: (x) => x / R, d2y: () => 1 / R };
    const r = simulate(dip, { tMax: 4 });
    // a parabola, not a circle: close for a gentle dip (the slope here is 0,9, so 2 % is fair)
    near(r.maxG, 1 + (2 * 4) / R, 0.03, "max G");
    expect(r.minG).toBeGreaterThan(0.5);
  });

  it("on a crest of radius R the rider feels g − u²/R, and the cart would lift off above u = √(gR)", () => {
    const R = 10;
    // a short stretch round the top, so the cart's speed there is the speed it started with
    const crest: Profile = { x0: -0.3, x1: 0.3, y: (x) => -(x * x) / (2 * R), dy: (x) => -x / R, d2y: () => -1 / R };
    const slow = simulate(crest, { v0: 8 });
    near(slow.minG, 1 - 64 / (R * G), 0.02, "min G at u = 8");
    expect(slow.liftOffAt).toBeNull();
    const fast = simulate(crest, { v0: 12 });
    expect(fast.liftOffAt).not.toBeNull();
    expect(Math.abs(fast.liftOffAt as number)).toBeLessThanOrEqual(0.3);
    expect(fast.minG).toBeLessThan(0);
  });

  it("notices a lift-off that begins in the middle of the ride, where it is, and the lowest G on the way", () => {
    // a long drop, then a sharp crest at x = 8
    const r = simulate(pchip(pts([10, 1, 9, 1, 1, 1, 1])), { tMax: 20 });
    expect(r.frames[0].gForce).toBeGreaterThan(0);
    expect(r.liftOffAt).not.toBeNull();
    expect(r.liftOffAt as number).toBeGreaterThan(5);
    expect(r.liftOffAt as number).toBeLessThan(9);
    expect(r.minG).toBeLessThan(-1);
    // the frames can only be sampled coarser than the steps: the run's own extremes are at least as extreme
    expect(r.minG).toBeLessThanOrEqual(Math.min(...r.frames.map((f) => f.gForce)) + 1e-9);
    expect(r.maxG).toBeGreaterThanOrEqual(Math.max(...r.frames.map((f) => f.gForce)) - 1e-9);
    expect(r.maxG).toBeGreaterThan(20);
  });

  it("is 1 on the flat and cosθ on a straight slope", () => {
    const flat = simulate(pchip([{ x: 0, y: 1 }, { x: 10, y: 1 }]), { v0: 3 });
    expect(flat.maxG).toBeCloseTo(1, 9);
    expect(flat.minG).toBeCloseTo(1, 9);
    const slope = simulate(pchip([{ x: 0, y: 6 }, { x: 12, y: 0 }]));
    expect(slope.maxG).toBeCloseTo(12 / Math.hypot(12, 6), 9);
  });
});

describe("a small swing in a bowl", () => {
  it("has the period 2π/√(g·y″), whatever the swing's size (to second order)", () => {
    const c = 0.5; // y = c x², y″ = 1
    const bowl: Profile = { x0: -0.05, x1: 5, y: (x) => c * x * x, dy: (x) => 2 * c * x, d2y: () => 2 * c };
    const r = simulate(bowl, { tMax: 12 });
    // times at which the cart passes the bottom, going right
    const cross: number[] = [];
    for (let i = 1; i < r.frames.length; i++) {
      const a = r.frames[i - 1], b = r.frames[i];
      if (a.x < 0 && b.x >= 0) cross.push(a.t + ((0 - a.x) / (b.x - a.x)) * (b.t - a.t));
    }
    expect(cross.length).toBeGreaterThanOrEqual(4);
    const T = 2 * Math.PI / Math.sqrt(G * 2 * c);
    near(cross[0], T / 4, 0.004, "quarter period");
    near(cross[1] - cross[0], T, 0.004, "period");
    near(cross[3] - cross[2], T, 0.004, "period again");
    expect(r.energyError).toBeLessThan(5e-4);
    expect(r.status).toBe("running");
  });
});

describe("frameAt", () => {
  const r = simulate(pchip([{ x: 0, y: 6 }, { x: 12, y: 0 }]));
  it("is exact at a frame, linear between two, and clamped at both ends", () => {
    expect(frameAt(r, r.frames[10].t)).toEqual(r.frames[10]);
    const mid = frameAt(r, (r.frames[10].t + r.frames[11].t) / 2);
    expect(mid.x).toBeCloseTo((r.frames[10].x + r.frames[11].x) / 2, 12);
    expect(frameAt(r, -1)).toBe(r.frames[0]);
    expect(frameAt(r, 1e6)).toBe(r.frames[r.frames.length - 1]);
  });
});
