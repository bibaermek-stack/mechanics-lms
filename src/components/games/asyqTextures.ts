// The picture of the ground and of a soft shadow, drawn once on a 2D canvas.
// No image files: nothing to download, and each surface looks like what its friction says it is.

import * as THREE from "three";
import { seededRandom } from "@/lib/rng";
import type { SurfaceLook } from "@/lib/asyqView";

const SIZE = 256;
/** World metres one tile of the ground texture covers. */
export const TILE = 4;

const cache = new Map<string, THREE.CanvasTexture>();

function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  return c;
}

function speckle(g: CanvasRenderingContext2D, rnd: () => number, colours: string[], count: number, max: number) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colours[Math.floor(rnd() * colours.length)];
    g.globalAlpha = 0.15 + rnd() * 0.35;
    const s = 1 + rnd() * max;
    g.fillRect(rnd() * SIZE, rnd() * SIZE, s, s);
  }
  g.globalAlpha = 1;
}

function draw(look: SurfaceLook): HTMLCanvasElement {
  const c = canvas();
  const g = c.getContext("2d")!;
  const rnd = seededRandom(look.id.length * 7919 + look.id.charCodeAt(0));
  g.fillStyle = look.base;
  g.fillRect(0, 0, SIZE, SIZE);
  switch (look.id) {
    case "wood": {
      // planks run along the lane (the texture's x), each a little lighter or darker, with grain
      const planks = 4, h = SIZE / planks;
      for (let i = 0; i < planks; i++) {
        g.fillStyle = `rgba(${rnd() > 0.5 ? "255,255,255" : "0,0,0"},${0.04 + rnd() * 0.08})`;
        g.fillRect(0, i * h, SIZE, h);
        g.strokeStyle = look.accent;
        g.globalAlpha = 0.35;
        for (let k = 0; k < 7; k++) {
          const y = i * h + 4 + rnd() * (h - 8);
          g.beginPath();
          g.moveTo(0, y);
          g.bezierCurveTo(SIZE * 0.3, y + (rnd() - 0.5) * 6, SIZE * 0.6, y + (rnd() - 0.5) * 6, SIZE, y);
          g.lineWidth = 1;
          g.stroke();
        }
        g.globalAlpha = 0.8;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, i * h);
        g.lineTo(SIZE, i * h);
        g.stroke();
        g.globalAlpha = 1;
      }
      break;
    }
    case "grass":
      speckle(g, rnd, [look.accent, "#7ccf63", "#2f6f2a"], 2600, 3);
      break;
    case "sand":
      speckle(g, rnd, [look.accent, "#f3dc9b", "#b8924a"], 2200, 2);
      break;
    case "earth":
      speckle(g, rnd, [look.accent, "#bda07a", "#5f4a2e"], 3000, 3);
      break;
    case "snow":
      speckle(g, rnd, [look.accent, "#ffffff", "#c3d3e0"], 1400, 2);
      break;
    case "ice":
      g.strokeStyle = look.accent;
      g.globalAlpha = 0.6;
      g.lineWidth = 1;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        let x = rnd() * SIZE, y = rnd() * SIZE;
        g.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rnd() - 0.5) * 90;
          y += (rnd() - 0.5) * 90;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      g.globalAlpha = 1;
      speckle(g, rnd, ["#ffffff", look.accent], 300, 2);
      break;
  }
  return c;
}

/** The ground texture for a surface, repeating every TILE metres. */
export function groundTexture(look: SurfaceLook): THREE.CanvasTexture {
  const hit = cache.get(look.id);
  if (hit) return hit;
  const tex = new THREE.CanvasTexture(draw(look));
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  cache.set(look.id, tex);
  return tex;
}

let blob: THREE.CanvasTexture | null = null;

/** A soft dark spot that stands in for a shadow under each bone. */
export function blobTexture(): THREE.CanvasTexture {
  if (blob) return blob;
  const c = canvas();
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.55, "rgba(0,0,0,0.25)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, SIZE, SIZE);
  blob = new THREE.CanvasTexture(c);
  blob.colorSpace = THREE.SRGBColorSpace;
  return blob;
}
