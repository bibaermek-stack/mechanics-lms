"use client";

// Drawing the arena.
//
// A pure function of the match state: nothing here mutates anything, so the same
// call renders a local match, a bot practice and a snapshot arriving from the
// host. Metres come in, pixels go out, and the conversion happens in one place.

import { PITCH, TEAM_COLORS } from "@/lib/arena/pitch";
import type { MatchState } from "@/lib/arena/types";

const COURT = "#123a2a";
const COURT_ALT = "#14442f";
const LINE = "rgba(255,255,255,0.55)";

export interface Viewport {
  /** Pixels per metre. */
  scale: number;
  /** Canvas coordinates of the centre spot. */
  cx: number;
  cy: number;
}

/** Fits the pitch, its nets and a margin into the canvas. */
export function viewportFor(width: number, height: number): Viewport {
  const worldW = (PITCH.hx + PITCH.netDepth) * 2 + 1.2;
  const worldH = PITCH.hy * 2 + 1.2;
  const scale = Math.min(width / worldW, height / worldH);
  return { scale, cx: width / 2, cy: height / 2 };
}

export function drawMatch(
  ctx: CanvasRenderingContext2D,
  state: MatchState,
  width: number,
  height: number
) {
  const { scale, cx, cy } = viewportFor(width, height);
  const X = (x: number) => cx + x * scale;
  const Y = (y: number) => cy + y * scale;
  const S = (m: number) => m * scale;

  ctx.clearRect(0, 0, width, height);

  // Surround, then the court itself in two shades so the halves read apart.
  ctx.fillStyle = "#0b1f18";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = COURT;
  ctx.fillRect(X(-PITCH.hx), Y(-PITCH.hy), S(PITCH.hx * 2), S(PITCH.hy * 2));
  ctx.fillStyle = COURT_ALT;
  ctx.fillRect(X(0), Y(-PITCH.hy), S(PITCH.hx), S(PITCH.hy * 2));

  ctx.strokeStyle = LINE;
  ctx.lineWidth = Math.max(1, S(0.06));

  // Touchlines, halfway line and centre circle.
  ctx.strokeRect(X(-PITCH.hx), Y(-PITCH.hy), S(PITCH.hx * 2), S(PITCH.hy * 2));
  ctx.beginPath();
  ctx.moveTo(X(0), Y(-PITCH.hy));
  ctx.lineTo(X(0), Y(PITCH.hy));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(0), Y(0), S(2.4), 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(0), Y(0), Math.max(2, S(0.12)), 0, Math.PI * 2);
  ctx.fillStyle = LINE;
  ctx.fill();

  // Goals: the mouth in the team's colour, the net behind it.
  for (const side of [-1, 1] as const) {
    const team = side === 1 ? 0 : 1; // team 0 attacks the right-hand goal
    const gx = X(PITCH.hx * side);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fillRect(
      side === 1 ? gx : gx - S(PITCH.netDepth),
      Y(-PITCH.goalHalf),
      S(PITCH.netDepth),
      S(PITCH.goalHalf * 2)
    );
    ctx.strokeStyle = TEAM_COLORS[team === 0 ? 1 : 0];
    ctx.lineWidth = Math.max(2, S(0.12));
    ctx.beginPath();
    ctx.moveTo(gx, Y(-PITCH.goalHalf));
    ctx.lineTo(gx, Y(PITCH.goalHalf));
    ctx.stroke();
    // Net hatching, so the goal reads as a goal and not a gap in the wall.
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i++) {
      const yy = Y(-PITCH.goalHalf + (PITCH.goalHalf * 2 * i) / 6);
      ctx.beginPath();
      ctx.moveTo(gx, yy);
      ctx.lineTo(gx + S(PITCH.netDepth) * side, yy);
      ctx.stroke();
    }
  }

  const ball = state.discs.find((d) => d.kind === "ball");

  // A faint trail on the ball's velocity, so a pass reads as a vector.
  if (ball) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0.6) {
      ctx.strokeStyle = "rgba(250, 204, 21, 0.45)";
      ctx.lineWidth = Math.max(1, S(0.06));
      ctx.beginPath();
      ctx.moveTo(X(ball.x), Y(ball.y));
      ctx.lineTo(X(ball.x - ball.vx * 0.12), Y(ball.y - ball.vy * 0.12));
      ctx.stroke();
    }
  }

  for (const d of state.discs) {
    const px = X(d.x);
    const py = Y(d.y);
    const pr = S(d.r);

    if (d.kind === "ball") {
      ctx.fillStyle = "#f8fafc";
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = Math.max(1, S(0.04));
      ctx.stroke();
      continue;
    }

    // Kick reach flashes as a ring the moment the ball is struck.
    if (d.kickFlash) {
      ctx.strokeStyle = `rgba(250, 204, 21, ${(d.kickFlash / 0.18) * 0.9})`;
      ctx.lineWidth = Math.max(2, S(0.08));
      ctx.beginPath();
      ctx.arc(px, py, pr + S(0.26), 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = TEAM_COLORS[d.team ?? 0];
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    // The player this browser drives gets a white collar.
    ctx.strokeStyle = d.local ? "#ffffff" : "rgba(15,23,42,0.65)";
    ctx.lineWidth = Math.max(1, S(d.local ? 0.09 : 0.05));
    ctx.stroke();

    if (d.name) {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `600 ${Math.max(9, Math.round(S(0.42)))}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(d.name, px, py - pr - S(0.14));
    }
  }
}
