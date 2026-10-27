import { describe, expect, it } from "vitest";
import {
  ANGLE_MAX,
  ANGLE_MIN,
  HINT_FACTOR,
  MAX_SHOTS,
  PLANETS,
  PROJECTILE_LESSONS,
  PROJECTILE_ROUNDS,
  SHOT_POINTS,
  V_MAX,
  V_MIN,
  buildProjectile,
  flightTime,
  gameScore,
  heightAtX,
  judgeShot,
  maxHeight,
  positionAt,
  rangeOf,
  roundPoints,
  shotPath,
  trajectory,
  type ProjectileRound,
} from "./projectile";
import { ALL_MODULES } from "@/data/modules";
import { availableDerivedGames } from "@/data/gameContent";

const g = 9.81;
const sin = (deg: number) => Math.sin((deg * Math.PI) / 180);
const cos = (deg: number) => Math.cos((deg * Math.PI) / 180);

describe("the textbook results for a launch from the ground", () => {
  it("time of flight T = 2 v sinθ / g", () => {
    expect(flightTime(20, 30, g)).toBeCloseTo((2 * 20 * 0.5) / g, 12);
    expect(flightTime(20, 90, g)).toBeCloseTo((2 * 20) / g, 12);
  });

  it("range R = v² sin2θ / g — worked by hand for v = 20 m/s at 45° (400/9,81 = 40,77 m)", () => {
    expect(rangeOf(20, 45, g)).toBeCloseTo(400 / 9.81, 10);
    expect(rangeOf(20, 45, g)).toBeCloseTo(40.7747, 3);
    expect(rangeOf(30, 30, g)).toBeCloseTo((900 * sin(60)) / g, 10);
  });

  it("greatest height H = v² sin²θ / 2g", () => {
    expect(maxHeight(20, 30, g)).toBeCloseTo((400 * 0.25) / (2 * g), 10);
    expect(maxHeight(20, 90, g)).toBeCloseTo(400 / (2 * g), 10);
  });

  it("complementary angles give the same range, and 45° gives the longest", () => {
    for (const a of [10, 20, 30, 40]) expect(rangeOf(25, a, g)).toBeCloseTo(rangeOf(25, 90 - a, g), 9);
    const best = rangeOf(25, 45, g);
    for (let a = 5; a <= 85; a += 5) expect(rangeOf(25, a, g)).toBeLessThanOrEqual(best + 1e-9);
  });

  it("range grows with the square of the speed", () => {
    expect(rangeOf(40, 40, g) / rangeOf(20, 40, g)).toBeCloseTo(4, 10);
  });

  it("is inversely proportional to gravity: the Moon throws 6 times as far as the Earth", () => {
    const ratio = rangeOf(20, 35, PLANETS.moon.g) / rangeOf(20, 35, PLANETS.earth.g);
    expect(ratio).toBeCloseTo(9.81 / 1.62, 10);
    expect(ratio).toBeCloseTo(6.06, 2);
  });
});

describe("the path", () => {
  it("is back on the ground at the time of flight, at the range", () => {
    for (const [v, a] of [[20, 45], [35, 20], [12, 70], [40, 85]]) {
      const T = flightTime(v, a, g);
      const p = positionAt(v, a, g, T);
      expect(p.y).toBeCloseTo(0, 9);
      expect(p.x).toBeCloseTo(rangeOf(v, a, g), 9);
    }
  });

  it("peaks at the maximum height, half way through the flight", () => {
    const v = 25, a = 50;
    const T = flightTime(v, a, g);
    expect(positionAt(v, a, g, T / 2).y).toBeCloseTo(maxHeight(v, a, g), 9);
    expect(positionAt(v, a, g, T / 2).x).toBeCloseTo(rangeOf(v, a, g) / 2, 9);
  });

  it("the height at a distance agrees with the height at the matching time", () => {
    const v = 22, a = 38;
    for (const t of [0.3, 0.9, 1.4]) {
      const p = positionAt(v, a, g, t);
      expect(heightAtX(v, a, g, p.x)).toBeCloseTo(p.y, 9);
    }
  });

  it("trajectory() runs from the gun to the landing point and never dips below the ground", () => {
    const pts = trajectory(30, 40, g, 60);
    expect(pts).toHaveLength(61);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[60].x).toBeCloseTo(rangeOf(30, 40, g), 9);
    expect(pts[60].y).toBe(0);
    expect(Math.min(...pts.map((p) => p.y))).toBeGreaterThanOrEqual(-1e-9);
  });

  it("from a height the body stays up longer and lands further", () => {
    expect(flightTime(10, 0, g, 20)).toBeCloseTo(Math.sqrt((2 * 20) / g), 10); // dropped sideways from 20 m
    expect(rangeOf(10, 0, g, 20)).toBeCloseTo(10 * Math.sqrt((2 * 20) / g), 10);
  });
});

describe("judging a shot", () => {
  const round = (over: Partial<ProjectileRound> = {}): ProjectileRound => ({
    planet: PLANETS.earth,
    target: 40,
    radius: 3,
    wall: null,
    ...over,
  });

  it("a shot landing within the radius is a hit", () => {
    // 20 m/s at 45° lands at 40,77 m: 0,77 m past a target at 40 m.
    const r = judgeShot(round(), 20, 45);
    expect(r.kind).toBe("hit");
    expect(r.error).toBeCloseTo(0.7747, 3);
  });

  it("short and long carry the signed miss", () => {
    const short = judgeShot(round({ target: 60 }), 20, 45);
    expect(short.kind).toBe("short");
    expect(short.error).toBeCloseTo(40.7747 - 60, 3);
    const long = judgeShot(round({ target: 30 }), 20, 45);
    expect(long.kind).toBe("long");
    expect(long.error).toBeCloseTo(10.7747, 3);
  });

  it("the edge of the radius counts", () => {
    const r = judgeShot(round({ target: 40.7747 + 3 - 1e-6 }), 20, 45);
    expect(r.kind).toBe("hit");
    expect(judgeShot(round({ target: 40.7747 + 3 + 1e-3 }), 20, 45).kind).toBe("short");
  });

  it("a wall stops a flat shot that would otherwise have hit", () => {
    // At x = 20 the 45° shot is 20 − 9,81·400/(2·400·0,5) = 10,19 m up.
    const lowWall = judgeShot(round({ wall: { x: 20, h: 8 } }), 20, 45);
    expect(lowWall.kind).toBe("hit");
    const highWall = judgeShot(round({ wall: { x: 20, h: 12 } }), 20, 45);
    expect(highWall.kind).toBe("wall");
    if (highWall.kind === "wall") expect(highWall.heightAtWall).toBeCloseTo(10.19, 2);
  });

  it("a shot that lands before the wall never meets it", () => {
    const r = judgeShot(round({ target: 10, wall: { x: 30, h: 50 } }), 12, 45); // lands at 14,7 m
    expect(r.kind).toBe("long");
  });
});

describe("scoring", () => {
  it("pays less for each extra shot, and nothing for a round never won", () => {
    expect([1, 2, 3, 4].map((s) => roundPoints(s, false))).toEqual([...SHOT_POINTS]);
    expect(roundPoints(null, false)).toBe(0);
    expect(roundPoints(5, false)).toBe(0);
    expect(roundPoints(0, false)).toBe(0);
  });

  it("the prediction costs 30 % of the round", () => {
    expect(roundPoints(1, true)).toBe(Math.round(100 * HINT_FACTOR));
    expect(roundPoints(1, true)).toBe(70);
    expect(roundPoints(2, true)).toBe(49);
  });

  it("the game is the mean of its rounds, out of 100", () => {
    expect(gameScore([100, 100, 100, 100, 100])).toBe(100);
    expect(gameScore([100, 70, 45, 25, 0])).toBe(48);
    expect(gameScore([])).toBe(0);
    expect(MAX_SHOTS).toBe(SHOT_POINTS.length);
  });
});

describe("the rounds of a game", () => {
  const seeds = Array.from({ length: 150 }, (_, i) => i * 104729 + 7);

  it("are five, two on Earth and then each of the other worlds once", () => {
    for (const s of seeds) {
      const b = buildProjectile(s);
      expect(b.rounds).toHaveLength(PROJECTILE_ROUNDS);
      expect(b.rounds.slice(0, 2).map((r) => r.planet.id)).toEqual(["earth", "earth"]);
      expect(b.rounds.slice(2).map((r) => r.planet.id).sort()).toEqual(["jupiter", "mars", "moon"]);
      expect(b.rounds.slice(0, 2).every((r) => r.wall === null)).toBe(true);
      expect(b.rounds.slice(2).every((r) => r.wall !== null)).toBe(true);
    }
  });

  it("are the same for the same seed (a duel) and differ between seeds", () => {
    expect(buildProjectile(42)).toEqual(buildProjectile(42));
    const games = new Set(seeds.map((s) => JSON.stringify(buildProjectile(s))));
    expect(games.size).toBeGreaterThan(140);
  });

  it("can always be won with the controls as they are, by a 45° shot where the wall allows", () => {
    for (const s of seeds) {
      for (const r of buildProjectile(s).rounds) {
        // The speed that lands a 45° shot exactly on the target.
        const v = Math.sqrt(r.target * r.planet.g);
        expect(v, `needs ${v} m/s`).toBeLessThanOrEqual(V_MAX);
        expect(v, `needs ${v} m/s`).toBeGreaterThanOrEqual(V_MIN);
        expect(judgeShot(r, v, 45).kind).toBe("hit");
        expect(r.radius).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("a flat shot is no solution once a wall is up — you have to lob it", () => {
    let tried = 0;
    for (const s of seeds) {
      for (const r of buildProjectile(s).rounds.filter((x) => x.wall)) {
        const v = Math.sqrt((r.target * r.planet.g) / Math.sin((2 * 10 * Math.PI) / 180)); // lands on target at 10°
        if (v > V_MAX) continue;
        tried++;
        expect(judgeShot(r, v, 10).kind).toBe("wall");
      }
    }
    expect(tried).toBeGreaterThan(100);
  });

  it("have a target, wall and radius of sensible size", () => {
    for (const s of seeds) {
      for (const r of buildProjectile(s).rounds) {
        expect(r.target).toBeGreaterThanOrEqual(18);
        expect(r.target).toBeLessThanOrEqual(120);
        if (r.wall) {
          expect(r.wall.x).toBeGreaterThan(0);
          expect(r.wall.x).toBeLessThan(r.target);
          expect(r.wall.h).toBeGreaterThan(0);
          expect(r.wall.h).toBeLessThan(r.target / 6);
        }
      }
    }
  });

  it("is not trivially easy: most of the controls miss", () => {
    // Share of the (angle, speed) grid that hits round 1 of 40 games.
    let hits = 0, all = 0;
    for (const s of seeds.slice(0, 40)) {
      const r = buildProjectile(s).rounds[0];
      for (let a = ANGLE_MIN; a <= ANGLE_MAX; a += 1) for (let v = V_MIN; v <= V_MAX; v += 0.5) { all++; if (judgeShot(r, v, a).kind === "hit") hits++; }
    }
    expect(hits).toBeGreaterThan(0);
    expect(hits / all).toBeLessThan(0.05);
  });
});

describe("the path a shot is drawn along", () => {
  const open: ProjectileRound = { planet: PLANETS.earth, target: 40, radius: 3, wall: null };
  const walled: ProjectileRound = { ...open, wall: { x: 20, h: 12 } };

  it("without a wall it is the whole parabola, ending on the ground at the range", () => {
    const pts = shotPath(open, 20, 45, 50);
    expect(pts).toHaveLength(51);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[50].x).toBeCloseTo(400 / 9.81, 9);
    expect(pts[50].y).toBeCloseTo(0, 9);
  });

  it("a shot that clears the wall is the whole parabola too", () => {
    const pts = shotPath({ ...walled, wall: { x: 20, h: 8 } }, 20, 45, 50);
    expect(pts[50].x).toBeCloseTo(400 / 9.81, 9);
  });

  it("a shot that hits the wall stops on its face, at the height judgeShot reported", () => {
    const out = judgeShot(walled, 20, 45);
    expect(out.kind).toBe("wall");
    const pts = shotPath(walled, 20, 45, 50);
    expect(pts[50].x).toBeCloseTo(20, 9);
    expect(pts[50].y).toBeCloseTo(out.kind === "wall" ? out.heightAtWall : NaN, 9);
    expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(20, 9);
  });

  it("a shot that falls short of the wall is not cut off", () => {
    const pts = shotPath({ ...walled, wall: { x: 30, h: 50 } }, 12, 45, 40); // lands at 14,7 m
    expect(pts[40].x).toBeCloseTo((12 * 12) / 9.81, 9);
    expect(pts[40].y).toBeCloseTo(0, 9);
  });
});

describe("where the game is offered", () => {
  it("only in the lessons about motion under gravity — and so only there in a duel", () => {
    const offered = ALL_MODULES.filter((m) => availableDerivedGames(m, m.id * 7919).includes("projectile")).map((m) => m.id);
    expect(offered).toEqual([2, 3]);
    expect(PROJECTILE_LESSONS).toEqual([2, 3]);
  });
});
