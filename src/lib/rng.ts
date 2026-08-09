// Seeded randomness.
//
// Every game builds its board by shuffling: which words go in the grid, where
// the blanks fall, the order of the options. `Math.random()` is fine when you
// play alone, but a duel is only fair if both players get *the same* board —
// so the seed travels with the challenge and the board is rebuilt from it.
//
// mulberry32: small, fast, and good enough that a shuffled ten-item list does
// not visibly favour any position.

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any string (a duel id, a module slug) into a usable 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Fisher–Yates against a supplied generator, so the result is reproducible. */
export function seededShuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Pick n items without replacement, reproducibly. */
export function seededPick<T>(arr: readonly T[], n: number, rnd: () => number): T[] {
  return seededShuffle(arr, rnd).slice(0, Math.min(n, arr.length));
}
