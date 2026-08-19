// Text and charts inside the headset, drawn on a 2D canvas.
//
// A-Frame's own <a-text> renders from a signed-distance-field font atlas that
// is fetched from a CDN and contains no Cyrillic — so "Жылдамдық" would come
// out as a row of blanks. Every label in this laboratory is Kazakh, so text is
// instead drawn with the browser's own font onto a canvas and mapped onto a
// plane. That renders every Kazakh glyph correctly, needs no network, and gives
// us live-updating instrument panels for free.

import type * as THREE_NS from "three";
import type { ThreeNS } from "./three-models";

/** Canvas pixels per metre. 900 keeps 2 cm text crisp at arm's length. */
const PX_PER_M = 900;

const FONT_STACK =
  '"Segoe UI", "Noto Sans", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif';

export interface CanvasPanel {
  object: THREE_NS.Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Canvas size in pixels. */
  size: { w: number; h: number };
  /** Panel size in metres. */
  metres: { w: number; h: number };
  /** Call after drawing so three.js re-uploads the texture. */
  commit: () => void;
  dispose: () => void;
}

/**
 * A flat, unlit panel of the given physical size with a canvas mapped onto it.
 * Unlit is deliberate: an instrument readout should stay legible wherever the
 * student turns, not dim as they walk away from the lamp.
 */
export function createPanel(
  THREE: ThreeNS,
  { width, height, transparent = true }: { width: number; height: number; transparent?: boolean }
): CanvasPanel {
  const w = Math.round(width * PX_PER_M);
  const h = Math.round(height * PX_PER_M);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const object = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);

  return {
    object,
    canvas,
    ctx,
    size: { w, h },
    metres: { w: width, h: height },
    commit: () => {
      texture.needsUpdate = true;
    },
    dispose: () => {
      texture.dispose();
      material.dispose();
      object.geometry.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dark instrument background with a hairline border, filling the panel. */
function panelBackground(p: CanvasPanel, { radius = 26 } = {}) {
  const { ctx, size } = p;
  ctx.clearRect(0, 0, size.w, size.h);
  ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
  roundRect(ctx, 2, 2, size.w - 4, size.h - 4, radius);
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
  ctx.lineWidth = 3;
  ctx.stroke();
}

export interface ReadoutRow {
  label: string;
  value: string;
  color?: string;
}

/**
 * Shrinks the font until the text fits, down to a floor. Kazakh labels such as
 * "Бастапқы бұрыштық жылдамдық" are long, and a value written over the top of
 * its own label is worse than a slightly smaller label.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  weight: number,
  size: number,
  floor = 0.62
): void {
  let px = size;
  const min = size * floor;
  ctx.font = `${weight} ${Math.round(px)}px ${FONT_STACK}`;
  while (ctx.measureText(text).width > maxWidth && px > min) {
    px -= Math.max(1, size * 0.04);
    ctx.font = `${weight} ${Math.round(px)}px ${FONT_STACK}`;
  }
}

/**
 * Instrument readout: a title bar and a stack of rows, each carrying its label
 * above its value. Two lines rather than one because the label and the number
 * are read at different distances — the label once, the number continuously.
 */
export function drawReadout(p: CanvasPanel, title: string, rows: ReadoutRow[]) {
  const { ctx, size } = p;
  panelBackground(p);

  const pad = 30;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#93c5fd";
  ctx.font = `600 ${Math.round(size.h * 0.062)}px ${FONT_STACK}`;
  ctx.fillText(title.toUpperCase(), pad + 4, size.h * 0.075);

  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad, size.h * 0.135);
  ctx.lineTo(size.w - pad, size.h * 0.135);
  ctx.stroke();

  const top = size.h * 0.15;
  const rowH = (size.h - top - 18) / Math.max(rows.length, 1);
  const textX = pad + 20;
  const maxW = size.w - textX - pad;

  rows.forEach((row, i) => {
    const y = top + rowH * i;

    // Coloured spine, the same cue the 2D readout cards use.
    ctx.fillStyle = row.color ?? "rgba(148, 163, 184, 0.55)";
    roundRect(ctx, pad, y + rowH * 0.2, 6, rowH * 0.6, 3);
    ctx.fill();

    ctx.fillStyle = "#94a3b8";
    fitFont(ctx, row.label, maxW, 500, rowH * 0.27);
    ctx.fillText(row.label, textX, y + rowH * 0.33);

    ctx.fillStyle = row.color ?? "#f8fafc";
    fitFont(ctx, row.value, maxW, 700, rowH * 0.44);
    ctx.fillText(row.value, textX, y + rowH * 0.73);

    if (i < rows.length - 1) {
      ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad, y + rowH);
      ctx.lineTo(size.w - pad, y + rowH);
      ctx.stroke();
    }
  });

  p.commit();
}

/** Centred caption, shrunk to fit — used for the console button labels. */
export function drawCaption(p: CanvasPanel, text: string, color = "#cbd5e1") {
  const { ctx, size } = p;
  ctx.clearRect(0, 0, size.w, size.h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  fitFont(ctx, text, size.w * 0.92, 600, size.h * 0.4, 0.45);
  ctx.fillText(text, size.w / 2, size.h / 2);
  p.commit();
}

/** Word-wrapped body text — used for the task card standing in the room. */
export function drawText(
  p: CanvasPanel,
  title: string,
  paragraphs: string[],
  { accent = "#93c5fd" } = {}
) {
  const { ctx, size } = p;
  panelBackground(p);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const pad = 40;
  let y = pad;

  ctx.fillStyle = accent;
  // Titles are experiment names, which can be long — shrink rather than clip.
  fitFont(ctx, title, size.w - pad * 2, 700, size.h * 0.062, 0.55);
  ctx.fillText(title, pad, y);
  y += size.h * 0.095;

  const fontSize = Math.round(size.h * 0.045);
  ctx.font = `400 ${fontSize}px ${FONT_STACK}`;
  ctx.fillStyle = "#e2e8f0";
  const maxW = size.w - pad * 2;

  for (const para of paragraphs) {
    for (const line of wrap(ctx, para, maxW)) {
      ctx.fillText(line, pad, y);
      y += fontSize * 1.45;
    }
    y += fontSize * 0.5;
  }
  p.commit();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// Live chart
// ---------------------------------------------------------------------------

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartSample {
  t: number;
  [key: string]: number;
}

/**
 * The x–t / v–t plot that hangs beside the bench. Axes autoscale to the data,
 * because a student changing v₀ by a factor of five should not have to leave VR
 * to rescale the graph.
 */
export function drawChart(
  p: CanvasPanel,
  samples: ChartSample[],
  series: ChartSeries[],
  { title = "Графиктер", xLabel = "t, с" } = {}
) {
  const { ctx, size } = p;
  panelBackground(p);

  const left = 92;
  const right = size.w - 34;
  const top = size.h * 0.19;
  const bottom = size.h - 78;

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#93c5fd";
  ctx.font = `600 ${Math.round(size.h * 0.06)}px ${FONT_STACK}`;
  ctx.fillText(title.toUpperCase(), 34, size.h * 0.075);

  // Legend, right-aligned on the title row.
  let lx = right;
  ctx.font = `600 ${Math.round(size.h * 0.05)}px ${FONT_STACK}`;
  ctx.textAlign = "right";
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const s = series[i];
    ctx.fillStyle = s.color;
    ctx.fillText(s.label, lx, size.h * 0.075);
    lx -= ctx.measureText(s.label).width + 30;
  }

  if (samples.length < 2) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#64748b";
    ctx.font = `500 ${Math.round(size.h * 0.055)}px ${FONT_STACK}`;
    ctx.fillText("Тәжірибені бастаңыз…", size.w / 2, (top + bottom) / 2);
    p.commit();
    return;
  }

  const tMax = Math.max(samples[samples.length - 1].t, 1);
  const tMin = samples[0].t;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const s of samples) {
    for (const ser of series) {
      const v = s[ser.key];
      if (!Number.isFinite(v)) continue;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  if (!Number.isFinite(yMin)) {
    yMin = 0;
    yMax = 1;
  }
  if (yMax - yMin < 1e-6) {
    yMax += 0.5;
    yMin -= 0.5;
  }
  const pad = (yMax - yMin) * 0.12;
  yMin -= pad;
  yMax += pad;

  const px = (t: number) => left + ((t - tMin) / (tMax - tMin || 1)) * (right - left);
  const py = (v: number) => bottom - ((v - yMin) / (yMax - yMin)) * (bottom - top);

  // Grid and value axis.
  ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
  ctx.lineWidth = 2;
  ctx.font = `500 ${Math.round(size.h * 0.042)}px ${FONT_STACK}`;
  ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const v = yMin + ((yMax - yMin) * i) / 4;
    const y = py(v);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillText(v.toFixed(Math.abs(v) < 10 ? 2 : 0), left - 14, y);
  }
  // Zero line, if it is inside the window.
  if (yMin < 0 && yMax > 0) {
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.beginPath();
    ctx.moveTo(left, py(0));
    ctx.lineTo(right, py(0));
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.fillText(xLabel, (left + right) / 2, bottom + 44);
  ctx.textAlign = "left";
  ctx.fillText(`${tMin.toFixed(1)}`, left, bottom + 44);
  ctx.textAlign = "right";
  ctx.fillText(`${tMax.toFixed(1)}`, right, bottom + 44);

  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  for (const ser of series) {
    ctx.strokeStyle = ser.color;
    ctx.beginPath();
    let started = false;
    for (const s of samples) {
      const v = s[ser.key];
      if (!Number.isFinite(v)) continue;
      const x = px(s.t);
      const y = py(v);
      if (started) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        started = true;
      }
    }
    ctx.stroke();
  }

  p.commit();
}
