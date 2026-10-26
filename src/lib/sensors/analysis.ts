// Turning a phone's accelerometer into physics.
//
// A phone's accelerometer reports *specific force* — the acceleration the case
// feels relative to free fall — so at rest it reads g (9.81 m/s², straight up) and
// in free fall it reads ≈ 0. That one fact is most of what the experiments below
// use:
//
//   rest        |a| = g                     → a measurement of g, and of tilt
//   a jump      push-off, then ≈ 0 while in the air, then a landing spike:
//               the flight time t gives the height  h = g·t²/8
//   a pendulum  the swing axis oscillates at the pendulum's own period
//   a lift      |a| leaves g while the lift speeds up and again as it stops
//
// Everything here is pure: samples in, numbers out, no sensors and no clock, so each
// method is tested against synthetic recordings built from the physics (see
// synthesize* below and analysis.test.ts), with noise and different sample rates.

export const G = 9.80665;

export interface Sample {
  /** Seconds since the start of the recording. */
  t: number;
  /** Acceleration including gravity, m/s², along the phone's own axes. */
  x: number;
  y: number;
  z: number;
}

export type Failure = { ok: false; reason: string };
export type Ok<T> = { ok: true } & T;

export const magnitude = (s: Pick<Sample, "x" | "y" | "z">) => Math.hypot(s.x, s.y, s.z);

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
};

/** The typical gap between samples, seconds. */
export function sampleInterval(samples: Sample[]): number {
  if (samples.length < 2) return NaN;
  const gaps = samples.slice(1).map((s, i) => s.t - samples[i].t).filter((d) => d > 0);
  return gaps.length ? median(gaps) : NaN;
}

/** A moving average over `window` samples (odd), same length, edges shortened. */
export function smooth(values: number[], window = 3): number[] {
  const h = window >> 1;
  return values.map((_, i) => {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - h); k <= Math.min(values.length - 1, i + h); k++) {
      s += values[k];
      n++;
    }
    return s / n;
  });
}

// ---------------------------------------------------------------------------
// At rest
// ---------------------------------------------------------------------------

export interface RestResult {
  /** Mean |a| over the steadiest stretch: the phone's measurement of g. */
  g: number;
  /** Scatter within that stretch. */
  sd: number;
  seconds: number;
  /** Angle of the screen from flat, degrees (0 = lying face up). */
  tilt: number;
}

/**
 * Hold the phone still: the steadiest stretch of at least `minSeconds` is the
 * measurement. The first half-second is dropped — it holds the hand letting go.
 */
export function analyzeRest(samples: Sample[], minSeconds = 2): Ok<RestResult> | Failure {
  if (samples.length < 10) return { ok: false, reason: "Жазба тым қысқа." };
  const t0 = samples[0].t + 0.5;
  const body = samples.filter((s) => s.t >= t0);
  const dt = sampleInterval(samples);
  const need = Math.max(5, Math.round(minSeconds / dt));
  if (body.length < need) return { ok: false, reason: `Телефон кемінде ${minSeconds} секунд қозғалмай тұруы керек.` };

  // Slide a window of `need` samples; keep the one with the smallest scatter.
  const m = body.map(magnitude);
  let best = -1, bestSd = Infinity;
  const step = Math.max(1, need >> 3);
  for (let i = 0; i + need <= body.length; i += step) {
    const s = sd(m.slice(i, i + need));
    if (s < bestSd) { bestSd = s; best = i; }
  }
  if (bestSd > 0.35) return { ok: false, reason: "Телефон тым қозғалып тұр. Үстелге жатқыз да, қолыңды алып ал." };

  const win = body.slice(best, best + need);
  const g = mean(win.map(magnitude));
  const vx = mean(win.map((s) => s.x)), vy = mean(win.map((s) => s.y)), vz = mean(win.map((s) => s.z));
  const tilt = (Math.acos(Math.min(1, Math.abs(vz) / Math.hypot(vx, vy, vz))) * 180) / Math.PI;
  return { ok: true, g, sd: bestSd, seconds: win[win.length - 1].t - win[0].t, tilt };
}

// ---------------------------------------------------------------------------
// A jump
// ---------------------------------------------------------------------------

export interface Flight {
  start: number;
  end: number;
  flightTime: number;
  /** h = g t² / 8: the body rises for half the flight and falls for half. */
  height: number;
  /** ± from the sample interval alone: an edge can be a sample early or late. */
  uncertainty: number;
}

export interface JumpResult {
  jumps: Flight[];
  best: Flight;
}

const FREE_FRACTION = 0.3; // below this share of g, the phone is "in the air" (free fall reads ≈ 0)
const MIN_FLIGHT = 0.12; // s — shorter is a bump, not a jump
const MAX_FLIGHT = 1.4; // s — longer than any human jump (a 2 m rise)

/**
 * Finds each stretch of free fall — |a| well below g, flanked by a push-off and a
 * landing — and turns its duration into a height. A drop of the phone alone would
 * show the same weightless stretch; the push-off before it is what says "jump".
 *
 * The edges of a flight are close to steps: the reading falls to ≈ 0 within a
 * sample or two of leaving the ground, and climbs again on touching down. A step
 * between two samples happened somewhere in that gap, so the unbiased estimate of
 * when is the middle of it. (Interpolating a level across the gap, which looks more
 * careful, is biased: it puts the take-off late and the landing early, and both
 * shorten the flight. It also needs the raw signal — smoothing a step moves it.)
 */
export function analyzeJump(samples: Sample[]): Ok<JumpResult> | Failure {
  if (samples.length < 20) return { ok: false, reason: "Жазба тым қысқа." };
  const dt = sampleInterval(samples);
  if (!(dt > 0) || dt > 0.05) return { ok: false, reason: "Сенсор тым сирек өлшейді (кемінде 20 рет секундына керек)." };

  const t = samples.map((s) => s.t);
  const m = samples.map(magnitude);
  const level = FREE_FRACTION * G;
  const flights: Flight[] = [];

  let i = 1;
  while (i < m.length) {
    // the first of at least two samples under the level, just after one above it
    if (!(m[i - 1] >= level && m[i] < level && i + 1 < m.length && m[i + 1] < level)) { i++; continue; }
    let j = i;
    while (j < m.length && m[j] < level) j++;
    if (j >= m.length) break; // never landed inside the recording
    const start = (t[i - 1] + t[i]) / 2;
    const end = (t[j - 1] + t[j]) / 2;
    const flightTime = end - start;
    i = j + 1;
    if (flightTime < MIN_FLIGHT || flightTime > MAX_FLIGHT) continue;

    // The push-off before, and the landing after, must both be real.
    const before = m.filter((_, k) => t[k] >= start - 0.6 && t[k] < start);
    const after = m.filter((_, k) => t[k] > end && t[k] <= end + 0.4);
    if (before.length === 0 || after.length === 0) continue;
    if (Math.max(...before) < 1.25 * G) continue;
    if (Math.max(...after) < 1.5 * G) continue;

    flights.push({
      start,
      end,
      flightTime,
      height: (G * flightTime ** 2) / 8,
      // each edge can be off by half a gap, so the time by one: dh = (g t / 4) dt
      uncertainty: (G * flightTime * dt) / 4,
    });
  }

  if (flights.length === 0) {
    return { ok: false, reason: "Секіріс табылмады: ауадағы салмақсыз кезең көрінбейді. Телефонды қалтаңа берік салып, нақты секір." };
  }
  const best = flights.reduce((a, b) => (b.flightTime > a.flightTime ? b : a));
  return { ok: true, jumps: flights, best };
}

// ---------------------------------------------------------------------------
// A pendulum
// ---------------------------------------------------------------------------

export interface PendulumResult {
  period: number;
  frequency: number;
  /** Swings in the recording, to the nearest whole one. */
  cycles: number;
  /** 0–1: how clean the repetition is. */
  quality: number;
  /** Which phone axis carried the swing. */
  axis: "x" | "y" | "z";
}

/** The samples on an even grid of `hz`, by linear interpolation. */
export function resample(samples: Sample[], hz: number): Sample[] {
  if (samples.length < 2) return samples;
  const out: Sample[] = [];
  const t0 = samples[0].t, t1 = samples[samples.length - 1].t;
  let k = 0;
  for (let t = t0; t <= t1 + 1e-9; t += 1 / hz) {
    while (k < samples.length - 2 && samples[k + 1].t < t) k++;
    const a = samples[k], b = samples[k + 1];
    const f = b.t === a.t ? 0 : Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    out.push({ t, x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), z: a.z + f * (b.z - a.z) });
  }
  return out;
}

/**
 * The period of a repeating signal, from the autocorrelation of the axis that
 * moves most. Autocorrelation rather than counting zero crossings: it uses every
 * sample, so one noisy crossing cannot throw the figure.
 */
export function analyzePendulum(samples: Sample[]): Ok<PendulumResult> | Failure {
  if (samples.length < 40) return { ok: false, reason: "Жазба тым қысқа." };
  const HZ = 50;
  const even = resample(samples, HZ);
  const dur = even[even.length - 1].t - even[0].t;
  if (dur < 6) return { ok: false, reason: "Кемінде 6 секунд жазу керек, тербеліс кемінде 3 толық болуы үшін." };

  const axes = ["x", "y", "z"] as const;
  const variance = axes.map((a) => sd(even.map((s) => s[a])));
  const axis = axes[variance.indexOf(Math.max(...variance))];
  if (Math.max(...variance) < 0.15) return { ok: false, reason: "Тербеліс байқалмайды: маятникті анық қозғалт." };

  const raw = even.map((s) => s[axis]);
  const mu = mean(raw);
  const sig = smooth(raw.map((v) => v - mu), 5);

  // Normalised autocorrelation, lags up to half the recording.
  const maxLag = Math.floor((dur / 2) * HZ);
  // Divided by the number of products, not left as a bare sum: a bare sum has fewer terms at
  // long lags and so leans toward short ones, which reads the period a little low.
  const r0 = sig.reduce((a, v) => a + v * v, 0) / sig.length;
  const ac: number[] = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < sig.length; i++) s += sig[i] * sig[i + lag];
    ac.push(s / (sig.length - lag) / r0);
  }

  // Skip the central lobe (until it first goes negative). Of the peaks after it, the period is
  // the FIRST one nearly as high as the best — not the highest, which can be two or three
  // periods out where the same repetition comes round again.
  let k = 1;
  while (k < ac.length && ac[k] > 0) k++;
  const peaks: number[] = [];
  for (let i = Math.max(k, 2); i < ac.length - 1; i++) {
    if (ac[i] > ac[i - 1] && ac[i] >= ac[i + 1]) peaks.push(i);
  }
  const top = peaks.reduce((m, i) => Math.max(m, ac[i]), -Infinity);
  const peak = peaks.find((i) => ac[i] >= 0.8 * top) ?? -1;
  const best = peak < 0 ? -Infinity : ac[peak];
  if (peak < 0 || best < 0.3) return { ok: false, reason: "Тербеліс жеткілікті тұрақты емес. Маятник бір жазықтықта тербелсін." };

  // Parabola through the peak for a sub-sample lag
  const a = ac[peak - 1], b = ac[peak], c = ac[peak + 1];
  const shift = a - 2 * b + c === 0 ? 0 : (0.5 * (a - c)) / (a - 2 * b + c);
  const rough = (peak + shift) / HZ;

  // The autocorrelation peak of a finite recording leans a little (by how much depends on how many
  // whole swings fit, up to a third of a percent), so it is only the rough answer. The refined one is
  // the slope of a straight line through the times of every rising zero crossing, which a periodic signal
  // puts exactly one period apart: it uses all the cycles and has no such lean.
  const period = refineByCrossings(sig, even.map((s) => s.t), rough) ?? rough;
  return { ok: true, period, frequency: 1 / period, cycles: Math.round(dur / period), quality: Math.min(1, best), axis };
}

/**
 * Rising zero crossings of `sig` (a Schmitt trigger, so noise near zero cannot count twice), numbered by how
 * many rough periods from the first, and fitted by least squares: t = t₀ + k·T. Null with fewer than three
 * crossings or when the crossings do not sit on a regular grid.
 */
function refineByCrossings(sig: number[], t: number[], rough: number): number | null {
  const amp = percentile(sig.map(Math.abs), 0.9);
  const hys = 0.25 * amp;
  const times: number[] = [];
  let armed = false;
  let zeroAt = NaN;
  for (let i = 1; i < sig.length; i++) {
    if (sig[i] < -hys) armed = true;
    if (armed && sig[i - 1] < 0 && sig[i] >= 0) zeroAt = t[i - 1] + ((0 - sig[i - 1]) / (sig[i] - sig[i - 1])) * (t[i] - t[i - 1]);
    if (armed && sig[i] > hys) {
      times.push(zeroAt);
      armed = false;
    }
  }
  if (times.length < 3) return null;
  const k = times.map((x) => Math.round((x - times[0]) / rough));
  // every crossing must sit near its grid line, or this is not a clean repetition
  if (k.some((v, i) => i > 0 && v <= k[i - 1])) return null;
  const kBar = mean(k), tBar = mean(times);
  const sxx = k.reduce((acc, v) => acc + (v - kBar) ** 2, 0);
  if (sxx === 0) return null;
  const slope = k.reduce((acc, v, i) => acc + (v - kBar) * (times[i] - tBar), 0) / sxx;
  if (Math.abs(slope - rough) / rough > 0.1) return null;
  return slope;
}

/** T = 2π√(l/g) for a small swing. */
export const pendulumPeriodFor = (length: number, g = G) => 2 * Math.PI * Math.sqrt(length / g);

/** The length that gives a period T: l = g (T / 2π)². */
export const pendulumLengthFor = (period: number, g = G) => g * (period / (2 * Math.PI)) ** 2;

// ---------------------------------------------------------------------------
// A lift
// ---------------------------------------------------------------------------

export interface LiftPhase {
  /** "heavier": the phone reads more than at rest; "lighter": less. */
  feel: "heavier" | "lighter";
  start: number;
  end: number;
  /** The largest departure from g, m/s², with its sign dropped. */
  peak: number;
}

export interface LiftResult {
  rest: number;
  phases: LiftPhase[];
  /** Judged from the order of the two phases. */
  direction: "up" | "down";
  /** Largest acceleration, m/s², and the change of apparent weight it made, %. */
  maxAcceleration: number;
  weightChangePercent: number;
}

const LIFT_THRESHOLD = 0.25; // m/s² off the resting reading
const LIFT_MIN = 0.4; // s a departure must last to be a phase

/**
 * Stand still in a lift, press a floor, ride. The reading rises while the lift
 * speeds up *upwards* and falls while it slows; downwards it is the other way
 * round. So the order of the two phases says which way the lift went.
 */
export function analyzeLift(samples: Sample[]): Ok<LiftResult> | Failure {
  if (samples.length < 40) return { ok: false, reason: "Жазба тым қысқа." };
  const dt = sampleInterval(samples);
  if (!(dt > 0) || dt > 0.1) return { ok: false, reason: "Сенсор тым сирек өлшейді." };

  const t = samples.map((s) => s.t);
  const m = smooth(samples.map(magnitude), Math.max(3, Math.round(0.15 / dt) | 1));
  const settle = Math.round(1.2 / dt);
  if (m.length < settle * 2) return { ok: false, reason: "Лифтке мінер алдында кемінде 1,5 секунд тыныш тұр." };
  const rest = median(m.slice(0, settle));
  const rest0sd = sd(m.slice(0, settle));
  if (rest0sd > 0.25) return { ok: false, reason: "Бастапқыда телефон қозғалып тұр: алдымен тыныш тұр." };

  const phases: LiftPhase[] = [];
  let i = 0;
  while (i < m.length) {
    const d = m[i] - rest;
    if (Math.abs(d) <= LIFT_THRESHOLD) { i++; continue; }
    const sign = Math.sign(d);
    let j = i;
    const dev: number[] = [];
    while (j < m.length && Math.sign(m[j] - rest) === sign && Math.abs(m[j] - rest) > LIFT_THRESHOLD * 0.6) {
      dev.push(Math.abs(m[j] - rest));
      j++;
    }
    // The 90th percentile, not the largest: with noise on every sample the largest is
    // always a little too high, and a lift's plateau is wide enough to read off.
    if (t[j - 1] - t[i] >= LIFT_MIN) phases.push({ feel: sign > 0 ? "heavier" : "lighter", start: t[i], end: t[j - 1], peak: percentile(dev, 0.9) });
    i = Math.max(j, i + 1);
  }

  if (phases.length < 2) return { ok: false, reason: "Лифттің жүріп-тоқтауы байқалмады. Кемінде бір қабатқа жүріп көр." };
  // The first and last departures are the start and the stop
  const first = phases[0], last = phases[phases.length - 1];
  if (first.feel === last.feel) return { ok: false, reason: "Бастау мен тоқтау қарама-қарсы болуы керек. Қайталап көр." };
  const maxAcceleration = Math.max(first.peak, last.peak);
  return {
    ok: true,
    rest,
    phases: [first, last],
    direction: first.feel === "heavier" ? "up" : "down",
    maxAcceleration,
    weightChangePercent: (maxAcceleration / rest) * 100,
  };
}

// ---------------------------------------------------------------------------
// A file from another app
// ---------------------------------------------------------------------------

/**
 * Reads the CSV a sensor app saves (Phyphox, Sensor Logger and the like): a time
 * column and three acceleration columns, comma, semicolon or tab separated.
 * Understands readings in g as well as in m/s², and refuses acceleration *without*
 * gravity, which cannot show a rest, a jump or a lift.
 */
export function parseSensorCsv(text: string): Ok<{ samples: Sample[]; unit: "m/s²" | "g" }> | Failure {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 10) return { ok: false, reason: "Файл тым қысқа." };
  const sep = [";", "\t", ","].find((s) => lines[0].includes(s)) ?? ",";
  const split = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const head = split(lines[0]);
  const numeric = (v: string) => v !== "" && !Number.isNaN(Number(v.replace(",", ".")));
  const hasHeader = !head.every(numeric);
  const rows = lines.slice(hasHeader ? 1 : 0).map(split);

  let ti = 0, xi = 1, yi = 2, zi = 3, unit: "m/s²" | "g" = "m/s²";
  if (hasHeader) {
    const lower = head.map((h) => h.toLowerCase());
    if (lower.some((h) => /linear|without g|без g|g-сіз/.test(h))) {
      return { ok: false, reason: "Бұл файлда гравитациясыз үдеу бар. Қолданбада «g-мен» (Acceleration with g) нұсқасын таңдап жазыңыз." };
    }
    const find = (re: RegExp, from = 0) => lower.findIndex((h, i) => i >= from && re.test(h));
    ti = find(/time|уақыт|^t\b|^t \(/);
    const acc = (axis: string) => lower.findIndex((h) => new RegExp(`(acc|үдеу|accel).*\\b${axis}\\b|^${axis}\\b|\\b${axis}\\s*\\(`).test(h));
    xi = acc("x"); yi = acc("y"); zi = acc("z");
    if ([ti, xi, yi, zi].some((i) => i < 0)) return { ok: false, reason: "Уақыт пен x, y, z үдеу бағандары табылмады." };
    if (/\(g\)|\[g\]|\bin g\b/.test(lower[xi])) unit = "g";
  }

  const to = (v: string) => Number(v.replace(",", "."));
  let samples: Sample[] = rows
    .filter((r) => [ti, xi, yi, zi].every((i) => numeric(r[i] ?? "")))
    .map((r) => ({ t: to(r[ti]), x: to(r[xi]), y: to(r[yi]), z: to(r[zi]) }));
  if (samples.length < 10) return { ok: false, reason: "Сандық жолдар жеткіліксіз." };
  // Some apps stamp milliseconds
  const span = samples[samples.length - 1].t - samples[0].t;
  if (span > 600 && sampleInterval(samples) > 1) samples = samples.map((s) => ({ ...s, t: s.t / 1000 }));
  // An app that writes g without saying so: the resting reading is 1, not 9,8
  const early = median(samples.slice(0, Math.min(40, samples.length)).map(magnitude));
  if (unit === "m/s²" && early > 0.8 && early < 1.25) unit = "g";
  if (unit === "g") samples = samples.map((s) => ({ ...s, x: s.x * G, y: s.y * G, z: s.z * G }));
  const t0 = samples[0].t;
  return { ok: true, samples: samples.map((s) => ({ ...s, t: s.t - t0 })), unit };
}

// ---------------------------------------------------------------------------
// Recordings built from the physics: for tests, and for trying the page on a computer
// ---------------------------------------------------------------------------

/** A small seeded noise source, so a "recording" is the same every time. */
export function noise(seed: number): () => number {
  let a = seed >>> 0;
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box–Muller
  return () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u());
}

export interface SynthOptions {
  hz?: number;
  /** Standard deviation of the sensor noise, m/s². */
  noise?: number;
  seed?: number;
}

function build(seconds: number, f: (t: number) => [number, number, number], o: SynthOptions): Sample[] {
  const hz = o.hz ?? 50;
  const n = noise(o.seed ?? 1);
  const sigma = o.noise ?? 0.12;
  return Array.from({ length: Math.round(seconds * hz) + 1 }, (_, i) => {
    const t = i / hz;
    const [x, y, z] = f(t);
    return { t, x: x + sigma * n(), y: y + sigma * n(), z: z + sigma * n() };
  });
}

/**
 * A person standing, crouching, pushing off, flying for exactly the time a rise of
 * `height` takes, landing and settling. The phone lies along z (face to the body).
 */
export function synthesizeJump(
  height: number,
  o: SynthOptions & {
    /** Seconds the reading takes to fall into free fall and to climb out of it. Real phones: 0,02–0,05. */
    ramp?: number;
  } = {}
): { samples: Sample[]; flightTime: number } {
  const flight = Math.sqrt((8 * height) / G);
  const ramp = o.ramp ?? 0;
  const t0 = 1.5; // standing still
  const crouch = 0.35, push = 0.2, land = 0.08, settle = 0.6;
  const tPush = t0 + crouch, tFly = tPush + push, tLand = tFly + flight, tEnd = tLand + land + settle + 1;
  const FREE = 0.15;
  const samples = build(tEnd, (t) => {
    let a = G;
    if (t >= t0 && t < tPush) a = G * (1 - 0.35 * Math.sin((Math.PI * (t - t0)) / crouch)); // down
    else if (t >= tPush && t < tFly) a = G * (1 + 1.2 * Math.sin((Math.PI * (t - tPush)) / push)); // up
    else if (t >= tFly && t < tLand) {
      // airborne: the case feels nothing — though the reading takes `ramp` to get there from the push-off
      const since = t - tFly;
      a = ramp > 0 && since < ramp ? FREE + (G - FREE) * (1 - since / ramp) : FREE;
    } else if (t >= tLand && t < tLand + land) {
      // touchdown: the spike builds over `ramp` seconds
      const spike = G * (1 + 3 * Math.sin((Math.PI * (t - tLand)) / land));
      const since = t - tLand;
      a = ramp > 0 && since < ramp ? FREE + (spike - FREE) * (since / ramp) : spike;
    } else if (t >= tLand + land && t < tLand + land + settle) a = G * (1 + 0.25 * Math.exp(-(t - tLand - land) * 6) * Math.cos(25 * (t - tLand)));
    return [0.3, 0.2, a];
  }, o);
  return { samples, flightTime: flight };
}

/** A phone lying flat and still for `seconds`, reading `g` (a real sensor is rarely exactly 9,81). */
export function synthesizeRest(seconds = 6, g = G, o: SynthOptions = {}): Sample[] {
  return build(seconds, (t) => [0.08, -0.05, t < 0.4 ? g * 1.15 : g], o);
}

/** A phone on a string, swinging with the period of a pendulum of `length` metres. */
export function synthesizePendulum(length: number, o: SynthOptions & { seconds?: number; amplitude?: number; damping?: number } = {}): { samples: Sample[]; period: number } {
  const period = pendulumPeriodFor(length);
  const w = (2 * Math.PI) / period;
  const A = o.amplitude ?? 0.18; // rad
  const samples = build(o.seconds ?? 12, (t) => {
    const th = A * Math.cos(w * t) * Math.exp(-t * (o.damping ?? 0.02)); // slightly damped, unless asked not to be
    // along the string (z): g cosθ + centripetal; across it (x): g sinθ
    const vel = -A * w * Math.sin(w * t);
    return [G * Math.sin(th), 0.1, G * Math.cos(th) + length * vel * vel];
  }, o);
  return { samples, period };
}

/** A lift: still, speeds up for `rampSeconds` at `accel`, cruises, slows for the same time, still again. */
export function synthesizeLift(direction: "up" | "down", accel = 1.1, o: SynthOptions & { cruise?: number; ramp?: number } = {}): Sample[] {
  const ramp = o.ramp ?? 1.6, cruise = o.cruise ?? 2.5, lead = 2.2;
  const s = direction === "up" ? 1 : -1;
  const total = lead + ramp + cruise + ramp + 2;
  return build(total, (t) => {
    let a = 0;
    if (t >= lead && t < lead + ramp) a = s * accel * Math.sin((Math.PI * (t - lead)) / ramp) ** 1; // speeding up
    else if (t >= lead + ramp + cruise && t < lead + 2 * ramp + cruise) a = -s * accel * Math.sin((Math.PI * (t - lead - ramp - cruise)) / ramp);
    return [0.2, 0.1, G + a];
  }, o);
}
