import { beforeAll, describe, expect, it, vi } from "vitest";
import { AsyqGame } from "./game";
import { getMode } from "./modes";
import * as simulate from "./simulate";

// the real engine, except where a test says a throw should break
vi.mock("./simulate", async (importOriginal) => {
  const real = await importOriginal<typeof import("./simulate")>();
  return { ...real, simulateThrow: vi.fn(real.simulateThrow), simulateThrowAsync: vi.fn(real.simulateThrowAsync) };
});

const mode = getMode("asyq-atu");
const PARAMS = { yaw: 0, power: 0.6, spin: 0, roll: 0 };

beforeAll(async () => {
  await (await import("./physics")).loadPhysics();
});

describe("when the physics breaks on a throw", () => {
  it("the game says so and stops, instead of waiting for ever in the middle of a throw", async () => {
    const g = await AsyqGame.create(mode.normalize(mode.defaults()).config, true);
    g.start();
    g.tick(1); // choosePlayer → aiming
    expect(g.state.phase).toBe("aiming");
    let heard = 0;
    g.subscribe(() => heard++);

    vi.mocked(simulate.simulateThrowAsync).mockRejectedValueOnce(new Error("memory access out of bounds"));
    await expect(g.throwSakhaAsync(PARAMS)).resolves.toBe(false);

    expect(g.failure).toBe("memory access out of bounds");
    expect(g.isComputing).toBe(false);
    expect(g.state.history).toHaveLength(0); // nothing was scored
    expect(g.state.phase).toBe("throwing"); // and no further phase can start from here
    expect(g.state.players.every((p) => p.points === 0 && p.throws === 0)).toBe(true);
    expect(heard).toBeGreaterThan(1); // the page was told, both that it began and that it failed
    expect(g.refusals.at(-1)).toMatch(/memory access/);

    // nothing more can be thrown, and time passing does not push it on
    expect(g.throwSakha(PARAMS)).toBe(false);
    g.tick(10);
    expect(g.state.phase).toBe("throwing");
  });

  it("the same for a throw worked out at once", async () => {
    const g = await AsyqGame.create(mode.normalize(mode.defaults()).config, false);
    g.start();
    vi.mocked(simulate.simulateThrow).mockImplementationOnce(() => {
      throw new Error("engine refused a body");
    });
    expect(g.throwSakha(PARAMS)).toBe(false);
    expect(g.failure).toBe("engine refused a body");
    expect(g.state.history).toHaveLength(0);
  });

  it("a game that never failed has no failure", async () => {
    const g = await AsyqGame.create(mode.normalize(mode.defaults()).config, false);
    g.start();
    expect(g.playThrow(PARAMS)).not.toBeNull();
    expect(g.failure).toBeNull();
  });
});
