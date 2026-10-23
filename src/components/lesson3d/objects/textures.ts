// Small procedural textures, so the ground is not a flat colour. Drawn once on a
// canvas with a seeded generator: the film must look identical on every render.

import * as THREE from "three";

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function make(size: number, draw: (g: CanvasRenderingContext2D, n: number) => void, repeat: [number, number]) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

const cache = new Map<string, THREE.CanvasTexture>();
function cached(key: string, build: () => THREE.CanvasTexture) {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = build()));
  return t;
}

/** Mottled lawn; multiplies whatever colour the material gives it. Repeats every ~12 m. */
export function grassTexture(repeatX: number, repeatY: number) {
  return cached(`grass${repeatX}x${repeatY}`, () =>
    make(
      512,
      (g, n) => {
        const r = rng(11);
        g.fillStyle = "#ffffff";
        g.fillRect(0, 0, n, n);
        for (let i = 0; i < 1500; i++) {
          const x = r() * n;
          const y = r() * n;
          const rad = 5 + r() * 30;
          const dark = r() > 0.45;
          g.fillStyle = dark ? `rgba(40,70,30,${0.025 + r() * 0.05})` : `rgba(255,255,230,${0.04 + r() * 0.06})`;
          for (const dx of [-n, 0, n])
            for (const dy of [-n, 0, n]) {
              g.beginPath();
              g.arc(x + dx, y + dy, rad, 0, Math.PI * 2);
              g.fill();
            }
        }
        // short blades
        g.strokeStyle = "rgba(30,60,25,0.09)";
        g.lineWidth = 1.2;
        for (let i = 0; i < 2600; i++) {
          const x = r() * n;
          const y = r() * n;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + (r() - 0.5) * 5, y - 3 - r() * 6);
          g.stroke();
        }
      },
      [repeatX, repeatY]
    )
  );
}

/** Square paving slabs, one slab per repeat of `tilesPerRepeat`. */
export function pavingTexture(repeatX: number, repeatY: number) {
  return cached(`paving${repeatX}x${repeatY}`, () =>
    make(
      512,
      (g, n) => {
        const r = rng(5);
        const tiles = 4;
        const s = n / tiles;
        for (let i = 0; i < tiles; i++)
          for (let j = 0; j < tiles; j++) {
            const v = 226 + Math.floor(r() * 22);
            g.fillStyle = `rgb(${v},${v},${v + 2})`;
            g.fillRect(i * s, j * s, s, s);
          }
        g.strokeStyle = "rgba(70,82,104,0.2)";
        g.lineWidth = 2;
        for (let i = 0; i <= tiles; i++) {
          g.beginPath();
          g.moveTo(i * s, 0);
          g.lineTo(i * s, n);
          g.moveTo(0, i * s);
          g.lineTo(n, i * s);
          g.stroke();
        }
      },
      [repeatX, repeatY]
    )
  );
}

/** Office-block facade: rows of windows, one storey per 4 m of a texture repeat. */
export function facadeTexture(repeatX: number, repeatY: number) {
  return cached(`facade${repeatX}x${repeatY}`, () =>
    make(
      512,
      (g, n) => {
        const r = rng(3);
        g.fillStyle = "#cfd5de";
        g.fillRect(0, 0, n, n);
        const cols = 4;
        const rows = 4;
        const cw = n / cols;
        const rh = n / rows;
        for (let i = 0; i < cols; i++)
          for (let j = 0; j < rows; j++) {
            const lit = r() > 0.78;
            g.fillStyle = lit ? "#f4e6a6" : `rgb(${52 + Math.floor(r() * 20)},${86 + Math.floor(r() * 24)},${122 + Math.floor(r() * 24)})`;
            g.fillRect(i * cw + cw * 0.14, j * rh + rh * 0.16, cw * 0.72, rh * 0.62);
            g.fillStyle = "rgba(255,255,255,0.22)";
            g.fillRect(i * cw + cw * 0.14, j * rh + rh * 0.16, cw * 0.72, rh * 0.1);
          }
      },
      [repeatX, repeatY]
    )
  );
}
