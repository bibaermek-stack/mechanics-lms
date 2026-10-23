// Time helpers shared by the lesson videos and the live 3D viewer.
//
// Every lesson scene is a pure function of time: given `t` seconds it knows
// where each body is, what the camera sees and which caption is showing. That
// is what lets the render tool step through the film frame by frame — and lets
// the same scene play live in the browser without a second implementation.

export type Vec3 = [number, number, number];

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Progress of `t` through [from, to], clamped to 0…1. */
export const seg = (t: number, from: number, to: number) =>
  to === from ? (t >= to ? 1 : 0) : clamp((t - from) / (to - from));

/** Smoothstep: zero slope at both ends. */
export const smooth = (u: number) => {
  const x = clamp(u);
  return x * x * (3 - 2 * x);
};

/** Smootherstep: zero first and second derivative at both ends. */
export const smoother = (u: number) => {
  const x = clamp(u);
  return x * x * x * (x * (x * 6 - 15) + 10);
};

export const easeOutCubic = (u: number) => 1 - Math.pow(1 - clamp(u), 3);

/** 0 → 1 → 0 over [from, to] with soft shoulders — for things that appear and go. */
export function pulse(t: number, from: number, to: number, fade = 0.4) {
  return Math.min(smooth(seg(t, from, from + fade)), 1 - smooth(seg(t, to - fade, to)));
}

// ---------------------------------------------------------------------------
// Chapters & captions
// ---------------------------------------------------------------------------

export interface Chapter {
  /** Stable name scenes use to look up their own timing. */
  id: string;
  from: number;
  to: number;
  /** Kazakh narration line, shown as the on-screen caption and written to the .vtt. */
  caption: string;
}

export interface LessonScript {
  moduleId: number;
  /** Lesson title for the on-screen badge. */
  title: string;
  /** Length of the film in seconds. */
  duration: number;
  chapters: Chapter[];
}

export function chapterAt(script: LessonScript, t: number): Chapter | undefined {
  return script.chapters.find((c) => t >= c.from && t < c.to);
}

export function chapterById(script: LessonScript, id: string): Chapter {
  const c = script.chapters.find((x) => x.id === id);
  if (!c) throw new Error(`lesson ${script.moduleId}: no chapter "${id}"`);
  return c;
}

function stamp(sec: number): string {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)}.${p(r, 3)}`;
}

/** WebVTT for the chapters — handy for subtitling or for timing a voice-over. */
export function toVtt(script: LessonScript): string {
  const cues = script.chapters.map(
    (c, i) => `${i + 1}\n${stamp(c.from)} --> ${stamp(c.to)}\n${c.caption}\n`
  );
  return `WEBVTT\n\n${cues.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Camera path
// ---------------------------------------------------------------------------

export interface CamKey {
  t: number;
  pos: Vec3;
  target: Vec3;
  fov?: number;
}

export interface CamPose {
  pos: Vec3;
  target: Vec3;
  fov: number;
}

const mix3 = (a: Vec3, b: Vec3, u: number): Vec3 => [
  lerp(a[0], b[0], u),
  lerp(a[1], b[1], u),
  lerp(a[2], b[2], u),
];

/**
 * Camera pose at time `t`. Between two keys the move is eased at both ends, so
 * the camera glides and settles; to hold a shot, repeat the key.
 */
export function sampleCamera(keys: CamKey[], t: number, defaultFov = 38): CamPose {
  if (keys.length === 0) throw new Error("camera path needs at least one key");
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (t <= first.t) return { pos: first.pos, target: first.target, fov: first.fov ?? defaultFov };
  if (t >= last.t) return { pos: last.pos, target: last.target, fov: last.fov ?? defaultFov };
  let i = 0;
  while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const u = smoother(seg(t, a.t, b.t));
  return {
    pos: mix3(a.pos, b.pos, u),
    target: mix3(a.target, b.target, u),
    fov: lerp(a.fov ?? defaultFov, b.fov ?? defaultFov, u),
  };
}
