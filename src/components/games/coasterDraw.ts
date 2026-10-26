// Drawing the roller-coaster scene. No state and no physics — the numbers come in
// ready-made from src/lib/coaster.ts and coasterLevels.ts.

import type { Pt, Profile } from "@/lib/coaster";
import { TRACK_X, Y_MAX, type Level } from "@/lib/coasterLevels";

export interface View {
  w: number;
  h: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
}

const X_MAX = TRACK_X[TRACK_X.length - 1];
/** The top of the picture, in metres — a little above the highest a track can go. */
export const Y_TOP = Y_MAX + 1.2;

export const makeView = (w: number, h: number): View => ({ w, h, padL: 18, padR: 18, padT: 14, padB: 26 });
export const X = (v: View, x: number) => v.padL + (x / X_MAX) * (v.w - v.padL - v.padR);
export const Y = (v: View, y: number) => v.h - v.padB - (y / Y_TOP) * (v.h - v.padT - v.padB);
/** Screen height back to metres. */
export const worldY = (v: View, py: number) => ((v.h - v.padB - py) / (v.h - v.padT - v.padB)) * Y_TOP;

export interface CartPose {
  x: number;
  y: number;
  /** Slope angle, rad. */
  angle: number;
  /** Normal force in g: below 0 the cart would leave the rails. */
  gForce: number;
}

export interface Scene {
  profile: Profile;
  points: Pt[];
  level: Level | null;
  cart: CartPose;
  /** Index of the control point being dragged. */
  active: number | null;
}

const FINISH_SIZE = 16;

export function drawScene(ctx: CanvasRenderingContext2D, v: View, s: Scene) {
  const { w, h } = v;
  ctx.clearRect(0, 0, w, h);

  // sky and ground
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#0b1a3a");
  sky.addColorStop(1, "#1e3a6e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const ground = Y(v, 0);
  ctx.fillStyle = "#14532d";
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(0, ground, w, 3);

  // height gridlines every 2 m
  ctx.font = "10px system-ui, sans-serif";
  ctx.textAlign = "left";
  for (let m = 2; m <= Y_MAX; m += 2) {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(v.padL, Y(v, m));
    ctx.lineTo(w - v.padR, Y(v, m));
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(`${m} м`, 3, Y(v, m) - 2);
  }

  // where the cart is meant to stop
  const goal = s.level?.goal;
  if (goal?.kind === "stop") {
    const x0 = X(v, goal.zone[0]), x1 = X(v, goal.zone[1]);
    ctx.fillStyle = "rgba(34,197,94,0.45)";
    ctx.fillRect(x0, ground - 6, x1 - x0, 6);
    ctx.fillStyle = "rgba(34,197,94,0.18)";
    ctx.fillRect(x0, v.padT, x1 - x0, ground - v.padT);
    ctx.fillStyle = "#bbf7d0";
    ctx.textAlign = "center";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillText("тоқтау аймағы", (x0 + x1) / 2, v.padT + 12);
  }

  // supports
  ctx.strokeStyle = "rgba(148,163,184,0.28)";
  ctx.lineWidth = 2;
  for (let x = 0.75; x < X_MAX; x += 1.5) {
    ctx.beginPath();
    ctx.moveTo(X(v, x), ground);
    ctx.lineTo(X(v, x), Y(v, s.profile.y(x)));
    ctx.stroke();
  }

  // the track
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const STEPS = 160;
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * X_MAX;
    const px = X(v, x), py = Y(v, s.profile.y(x));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // start and finish
  const pole = (x: number, color: string, label: string) => {
    const px = X(v, x), py = Y(v, s.profile.y(x));
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 30);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(px, py - 30);
    ctx.lineTo(px + (x === 0 ? FINISH_SIZE : -FINISH_SIZE), py - 24);
    ctx.lineTo(px, py - 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = x === 0 ? "left" : "right";
    ctx.fillText(label, px + (x === 0 ? 4 : -4), py - 34);
  };
  const hm = (i: number) => `${s.points[i].y.toFixed(1).replace(".", ",")} м`;
  pole(0, "#38bdf8", `старт · ${hm(0)}`);
  pole(X_MAX, "#f43f5e", `мәре · ${hm(TRACK_X.length - 1)}`);

  // control points
  s.points.forEach((p, i) => {
    const px = X(v, p.x), py = Y(v, p.y);
    const locked = s.level ? s.level.locked[i] !== undefined : false;
    if (locked) {
      ctx.fillStyle = "#64748b";
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.fillRect(px - 6, py - 6, 12, 12);
      ctx.strokeRect(px - 6, py - 6, 12, 12);
    } else {
      ctx.fillStyle = s.active === i ? "#facc15" : "#3b82f6";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, s.active === i ? 11 : 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // the end points' heights ride on their flags
    if (i === 0 || i === TRACK_X.length - 1) return;
    ctx.fillStyle = "#f1f5f9";
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${p.y.toFixed(1).replace(".", ",")} м`, px, py - 14);
  });

  // the cart
  const c = s.cart;
  const cx = X(v, c.x), cy = Y(v, c.y);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-c.angle);
  const off = c.gForce < -0.05;
  if (off) {
    ctx.strokeStyle = "rgba(244,63,94,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -9, 17, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = off ? "#f43f5e" : "#facc15";
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-11, -15, 22, 11, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(-6, -3, 3, 0, Math.PI * 2);
  ctx.arc(6, -3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
