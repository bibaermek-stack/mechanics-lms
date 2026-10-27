// Four traditional games, and the physics each one hides.
//
//   bow     Садақ ату    the pulled string stores E = kx²/2; most of it becomes the arrow's ½mv²,
//                        and the arrow then flies as any projectile does
//   asyq    Асық ату     a thrown sakha slides and stops after d = v²/(2μg): friction turns
//                        all of the kinetic energy into heat
//   tug     Арқан тарту  nobody can pull harder than their feet grip: F_max = μMg, so the team
//                        that slips first loses, however strong its arms
//   rocket  Байқоңыр     Tsiolkovsky: Δv = vₑ·ln(m₀/m₁); a rocket cannot make orbit in one
//                        stage with a realistic tank, so it throws the empty tank away
//
// Each is a board of five rounds. A round fixes everything but one or two quantities the
// player chooses; `judge` says whether the choice solves it and why. Pure, SI units.
// Scoring is the projectile game's (attempts and the hint), so the games feel alike.

import { rangeOf } from "./projectile";
import { seededRandom, seededShuffle } from "./rng";

export const G = 9.81;

export type FolkKind = "bow" | "asyq" | "tug" | "rocket";

/** The lessons each game belongs to: where its physics is taught. */
export const FOLK_LESSONS: Record<FolkKind, number[]> = {
  bow: [5],
  asyq: [3],
  tug: [4],
  rocket: [6],
};

export const FOLK_ROUNDS = 5;

export interface Control {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  decimals: number;
}

export interface Fact {
  label: string;
  value: string;
}

export interface FolkRound {
  kind: FolkKind;
  title: string;
  story: string;
  facts: Fact[];
  controls: Control[];
  /** Everything the judge and the picture need. */
  params: Record<string, number>;
}

export interface FolkBoard {
  kind: FolkKind;
  rounds: FolkRound[];
}

export interface Judged {
  hit: boolean;
  /** "hit", "short", "long" — what the picture should show. */
  verdict: "hit" | "low" | "high";
  /** The signed miss, in the quantity the round is about (m, N, m/s). */
  error: number;
  headline: string;
  lines: string[];
  /** The numbers behind it, for drawing. */
  values: Record<string, number>;
}

/** A decimal comma, as everywhere in the app. */
const n = (x: number, d = 1) => x.toFixed(d).replace(".", ",").replace("-", "−");

// ---------------------------------------------------------------------------
// The physics, one function each
// ---------------------------------------------------------------------------

/** Speed of an arrow released from a bow of stiffness k drawn x metres, η of the energy reaching the arrow. */
export const arrowSpeed = (k: number, x: number, m: number, eta: number) => x * Math.sqrt((eta * k) / m);

/** Distance a body sliding at v stops in on ground with friction μ. */
export const slideDistance = (v: number, mu: number, g = G) => (v * v) / (2 * mu * g);

/** How long a sakha thrown at v takes to stop: friction slows it by μg every second. */
export const slideStopTime = (v: number, mu: number, g = G) => v / (mu * g);

/** How far the sakha has slid after t seconds: v·t − ½μg·t² until it stops, and there it stays. */
export function slidePosition(v: number, mu: number, t: number, g = G): number {
  const tt = Math.max(0, Math.min(t, slideStopTime(v, mu, g)));
  return v * tt - 0.5 * mu * g * tt * tt;
}

/** The most a team of total mass M can pull on a rope: the friction its feet can give. */
export const maxPull = (mu: number, mass: number, g = G) => mu * mass * g;

/** Ideal rocket equation for one stage: propellant `mp` and structure ε·mp, carrying `payload` (all kg, or all t). */
export function stageDeltaV(ve: number, payload: number, mp: number, eps: number): number {
  if (mp <= 0) return 0;
  return ve * Math.log((payload + (1 + eps) * mp) / (payload + eps * mp));
}

/** What no amount of fuel can beat in one stage: ve·ln((1+ε)/ε). */
export const singleStageLimit = (ve: number, eps: number) => ve * Math.log((1 + eps) / eps);

/** The propellant one stage needs to give Δv with the given payload. Infinity if it cannot. */
export function propellantFor(ve: number, payload: number, dv: number, eps: number): number {
  const r = Math.exp(dv / ve);
  const den = 1 + eps - eps * r;
  return den <= 0 ? Infinity : (payload * (r - 1)) / den;
}

// ---------------------------------------------------------------------------
// Judging
// ---------------------------------------------------------------------------

const verdictOf = (error: number, tol: number): Judged["verdict"] => (Math.abs(error) <= tol ? "hit" : error < 0 ? "low" : "high");

export function judge(round: FolkRound, values: Record<string, number>): Judged {
  const p = round.params;
  switch (round.kind) {
    case "bow": {
      const x = values.draw / 100, angle = values.angle;
      const energy = 0.5 * p.k * x * x;
      const v = arrowSpeed(p.k, x, p.m, p.eta);
      const range = rangeOf(v, angle, G, p.h0);
      const error = range - p.target;
      const verdict = verdictOf(error, p.radius);
      return {
        hit: verdict === "hit",
        verdict,
        error,
        headline: verdict === "hit" ? "Нысанаға тидің!" : verdict === "low" ? `Жебе ${n(-error)} м жетпей түсті` : `Жебе ${n(error)} м асып түсті`,
        lines: [
          `Садақты ${n(values.draw)} см тарттың: серпімділік энергиясы E = kx²/2 = ${n(energy)} Дж.`,
          `Оның ${n(p.eta * 100, 0)} %-ы жебеге берілді: v = ${n(v)} м/с.`,
          `${n(angle, 0)}° бұрышпен ұшқан жебе ${n(range)} м-ге түсті (нысана ${n(p.target, 0)} ± ${n(p.radius)} м).`,
        ],
        values: { x, energy, v, range, angle },
      };
    }
    case "asyq": {
      const v = values.speed;
      const d = slideDistance(v, p.mu);
      const error = d - p.target;
      const verdict = verdictOf(error, p.radius);
      return {
        hit: verdict === "hit",
        verdict,
        error,
        headline: verdict === "hit" ? "Сақа асықтарға дәл жетті!" : verdict === "low" ? `Сақа ${n(-error, 2)} м жетпей тоқтады` : `Сақа ${n(error, 2)} м асып кетті`,
        lines: [
          `Сақа ${n(v)} м/с жылдамдықпен шықты: Eк = mv²/2.`,
          `Үйкеліс (μ = ${n(p.mu, 2)}) бүкіл энергияны жылуға айналдырды: d = v²/(2μg) = ${n(d, 2)} м.`,
          `Асықтар ${n(p.target, 1)} м жерде тұр (±${n(p.radius, 1)} м).`,
        ],
        values: { v, d },
      };
    }
    case "tug": {
      const mass = values.mass;
      const mine = maxPull(p.mu, mass);
      const theirs = maxPull(p.muOpp, p.massOpp);
      const error = mine - theirs;
      const tol = 0.03 * theirs;
      const verdict = verdictOf(error, tol);
      return {
        hit: verdict === "hit",
        verdict,
        error,
        headline:
          verdict === "hit" ? "Арқан қозғалмады: күштер тең!" : verdict === "low" ? `Арқан қарсыласқа қарай жылжыды (сен ${n(-error, 0)} Н әлсізсің)` : `Арқан саған қарай жылжыды (сен ${n(error, 0)} Н күштісің)`,
        lines: [
          `Сенің командаң аяғымен ұстай алатын ең үлкен күш: F = μMg = ${n(p.mu, 2)} · ${n(mass, 0)} · ${n(G, 2)} = ${n(mine, 0)} Н.`,
          `Қарсылас: ${n(p.muOpp, 2)} · ${n(p.massOpp, 0)} · ${n(G, 2)} = ${n(theirs, 0)} Н.`,
          "Қуаты көп команда емес, жерден көбірек «ұстайтын» команда ұтады: үйкеліс күші салмаққа да, μ-ге де тәуелді.",
        ],
        values: { mine, theirs },
      };
    }
    case "rocket": {
      const dv2 = p.stages === 2 ? stageDeltaV(p.ve, p.payload, values.fuel2, p.eps) : 0;
      const upper = p.stages === 2 ? p.payload + (1 + p.eps) * values.fuel2 : p.payload;
      const dv1 = stageDeltaV(p.ve, upper, values.fuel1, p.eps);
      const total = dv1 + dv2;
      const error = total - p.target;
      const verdict = verdictOf(error, 0.03 * p.target);
      const lines = [
        p.stages === 2
          ? `1-саты: Δv = vₑ·ln(m₀/m₁) = ${n(dv1, 0)} м/с; 2-саты: ${n(dv2, 0)} м/с.`
          : `Δv = vₑ·ln(m₀/m₁) = ${n(p.ve, 0)} · ln(${n(upper + (1 + p.eps) * values.fuel1, 1)}/${n(upper + p.eps * values.fuel1, 1)}) = ${n(dv1, 0)} м/с.`,
        `Барлығы: ${n(total, 0)} м/с (керегі ${n(p.target, 0)} ± ${n(0.03 * p.target, 0)} м/с).`,
      ];
      if (p.stages === 1 && p.target > singleStageLimit(p.ve, p.eps) * 0.92) lines.push(`Бір сатылы зымыранның шегі ${n(singleStageLimit(p.ve, p.eps), 0)} м/с: отынды қанша көбейтсең де одан аспайды.`);
      return {
        hit: verdict === "hit",
        verdict,
        error,
        headline: verdict === "hit" ? "Дәл мақсатқа жеттің!" : verdict === "low" ? `Жылдамдық ${n(-error, 0)} м/с жетпейді` : `Жылдамдық ${n(error, 0)} м/с артық`,
        lines,
        values: { dv1, dv2, total },
      };
    }
  }
}

/**
 * Values that solve the round: what the hint shows. Found from the closed form and then
 * nudged along the slider's own grid, so what is shown can really be set.
 */
export function solutionFor(round: FolkRound): Record<string, number> {
  const p = round.params;
  const snap = (c: Control, v: number) => Math.min(c.max, Math.max(c.min, Math.round((v - c.min) / c.step) * c.step + c.min));
  const ctl = (id: string) => round.controls.find((c) => c.id === id)!;

  if (round.kind === "bow") {
    const angle = 30;
    // bisect the draw that gives the range at this angle
    let lo = 0.05, hi = 0.9;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (rangeOf(arrowSpeed(p.k, mid, p.m, p.eta), angle, G, p.h0) < p.target) lo = mid;
      else hi = mid;
    }
    return { draw: snap(ctl("draw"), ((lo + hi) / 2) * 100), angle };
  }
  if (round.kind === "asyq") return { speed: snap(ctl("speed"), Math.sqrt(2 * p.mu * G * p.target)) };
  if (round.kind === "tug") return { mass: snap(ctl("mass"), (p.muOpp * p.massOpp) / p.mu) };

  // rocket
  const half = p.target / (p.stages === 2 ? 2 : 1);
  if (p.stages === 1) return { fuel1: snap(ctl("fuel1"), propellantFor(p.ve, p.payload, half, p.eps)) };
  const f2 = propellantFor(p.ve, p.payload, half, p.eps);
  const f1 = propellantFor(p.ve, p.payload + (1 + p.eps) * f2, half, p.eps);
  return { fuel1: snap(ctl("fuel1"), f1), fuel2: snap(ctl("fuel2"), f2) };
}

// ---------------------------------------------------------------------------
// The boards
// ---------------------------------------------------------------------------

const pickOne = <T>(arr: readonly T[], rnd: () => number) => arr[Math.floor(rnd() * arr.length)];

const SURFACES = [
  { name: "мұз", mu: 0.05 },
  { name: "тығыздалған қар", mu: 0.1 },
  { name: "ағаш еден", mu: 0.3 },
  { name: "шөп", mu: 0.4 },
  { name: "құм", mu: 0.6 },
];

function buildBow(rnd: () => number): FolkRound[] {
  const targets = [30, 45, 60, 80, 100];
  return targets.map((t, i): FolkRound => {
    const target = Math.round(t + (rnd() - 0.5) * 10);
    const radius = Math.max(2.5, Math.round(target * 0.05 * 2) / 2);
    const k = pickOne([250, 280, 300, 330], rnd);
    const m = pickOne([0.02, 0.025, 0.03, 0.035], rnd);
    const eta = 0.7;
    return {
      kind: "bow",
      title: `${i + 1}-нысана`,
      story: "Садақ тартылғанда оның серпімділік энергиясы E = kx²/2 жебенің кинетикалық энергиясына (mv²/2) айналады. Содан кейін жебе кез келген лақтырылған дене сияқты ұшады. Тарту ұзындығы мен бұрышты таңда.",
      facts: [
        { label: "Садақтың қатаңдығы", value: `k = ${k} Н/м` },
        { label: "Жебенің массасы", value: `m = ${n(m * 1000, 0)} г` },
        { label: "Жебеге берілетін энергия", value: `${n(eta * 100, 0)} %` },
        { label: "Нысана", value: `${target} м, ±${n(radius)} м` },
        { label: "Жебе шығатын биіктік", value: "1,5 м" },
      ],
      controls: [
        { id: "draw", label: "Тарту ұзындығы x", unit: "см", min: 15, max: 75, step: 0.5, initial: 30, decimals: 1 },
        { id: "angle", label: "Бұрыш θ", unit: "°", min: 5, max: 60, step: 1, initial: 25, decimals: 0 },
      ],
      params: { k, m, eta, h0: 1.5, target, radius },
    };
  });
}

function buildAsyq(rnd: () => number): FolkRound[] {
  const order = seededShuffle(SURFACES, rnd);
  return order.map((s, i): FolkRound => {
    const target = Math.round((4 + rnd() * 8) * 2) / 2;
    const radius = Math.max(0.5, Math.round(target * 0.06 * 10) / 10);
    return {
      kind: "asyq",
      title: `${i + 1}-лақтыру: ${s.name}`,
      story: "Асық ату — қазақтың ұлттық ойыны. Сақаны жерге жіберіп, асықтардың қасына тоқтатуың керек. Сақа үйкелістің әсерінен баяулайды: оның бүкіл кинетикалық энергиясы жылуға айналады.",
      facts: [
        { label: "Жер беті", value: `${s.name}, μ = ${n(s.mu, 2)}` },
        { label: "Асықтарға дейін", value: `${n(target, 1)} м, ±${n(radius, 1)} м` },
        { label: "Еркін түсу үдеуі", value: "g = 9,81 м/с²" },
      ],
      controls: [{ id: "speed", label: "Бастапқы жылдамдық v", unit: "м/с", min: 1, max: 14, step: 0.1, initial: 5, decimals: 1 }],
      params: { mu: s.mu, target, radius },
    };
  });
}

function buildTug(rnd: () => number): FolkRound[] {
  const mus = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8];
  const rounds: FolkRound[] = [];
  for (let i = 0; i < FOLK_ROUNDS; i++) {
    let mu = 0.5, muOpp = 0.5, massOpp = 480;
    // keep the answer on the slider, and make the rounds differ from one another
    for (let tries = 0; tries < 200; tries++) {
      mu = pickOne(mus, rnd);
      muOpp = pickOne(mus, rnd);
      massOpp = 250 + 10 * Math.floor(rnd() * 41);
      const m = (muOpp * massOpp) / mu;
      if ((i === 0 || mu !== muOpp) && m >= 120 && m <= 860) break;
    }
    const answer = (muOpp * massOpp) / mu;
    rounds.push({
      kind: "tug",
      title: `${i + 1}-жарыс`,
      story: "Арқан тарту — қазақтың ұлттық ойындарының бірі. Команда арқанды қанша күшпен тартса да, аяғы сырғымайынша ғана тарта алады: ең үлкен күш F = μMg. Арқан қозғалмауы үшін екі команданың осы күші тең болуы керек. Команданың жалпы салмағын таңда.",
      facts: [
        { label: "Сенің аяқ киіміңнің үйкелісі", value: `μ = ${n(mu, 2)}` },
        { label: "Қарсылас командасының үйкелісі", value: `μ = ${n(muOpp, 2)}` },
        { label: "Қарсылас командасының салмағы", value: `${n(massOpp, 0)} кг` },
      ],
      controls: [{ id: "mass", label: "Сенің командаңның салмағы M", unit: "кг", min: 100, max: 900, step: 5, initial: Math.round(Math.max(100, Math.min(900, answer * 0.6)) / 5) * 5, decimals: 0 }],
      params: { mu, muOpp, massOpp },
    });
  }
  return rounds;
}

function buildRocket(rnd: () => number): FolkRound[] {
  const eps = 0.1;
  const spec = [
    { ve: 2500, payload: 2, stages: 1, target: 3000 },
    { ve: 3000, payload: 2, stages: 1, target: 4500 },
    { ve: 4000, payload: 2, stages: 1, target: 7000 },
    { ve: 3000, payload: 1, stages: 2, target: 7800 },
    { ve: 3200, payload: 1, stages: 2, target: 9000 },
  ];
  return spec.map((s, i): FolkRound => {
    const target = Math.round((s.target * (0.97 + rnd() * 0.06)) / 50) * 50;
    const controls: Control[] = [{ id: "fuel1", label: s.stages === 2 ? "1-саты отыны" : "Отын массасы", unit: "т", min: 0, max: 150, step: 0.5, initial: 10, decimals: 1 }];
    if (s.stages === 2) controls.push({ id: "fuel2", label: "2-саты отыны", unit: "т", min: 0, max: 60, step: 0.5, initial: 3, decimals: 1 });
    return {
      kind: "rocket",
      title: `${i + 1}-ұшыру${s.stages === 2 ? " (екі сатылы)" : ""}`,
      story: "Байқоңырдан 1961 жылы Юрий Гагарин ғарышқа ұшқан. Зымыран жанармайын шығарып, өзі кері қарай итеріледі: Δv = vₑ·ln(m₀/m₁) (Циолковский формуласы, ауа мен ауырлық шығындарынсыз). Ең қажетті жылдамдыққа жету үшін отынның массасын таңда.",
      facts: [
        { label: "Газдың шығу жылдамдығы", value: `vₑ = ${s.ve} м/с` },
        { label: "Жүк массасы", value: `${s.payload} т` },
        { label: "Бак массасы", value: `отынның ${n(eps * 100, 0)} %-ы` },
        { label: "Керекті жылдамдық өсімі", value: `Δv = ${target} м/с (±3 %)` },
        ...(s.stages === 1 ? [{ label: "Бір сатылы зымыранның шегі", value: `${n(singleStageLimit(s.ve, eps), 0)} м/с` }] : []),
      ],
      controls,
      params: { ve: s.ve, payload: s.payload, stages: s.stages, eps, target },
    };
  });
}

/** A round must not start already solved: if the sliders' first position hits, move the first slider along its own grid until it does not. */
function startUnsolved(round: FolkRound): FolkRound {
  const values = Object.fromEntries(round.controls.map((c) => [c.id, c.initial]));
  if (!judge(round, values).hit) return round;
  const c = round.controls[0];
  for (let k = 1; k <= 40; k++) {
    for (const dir of [1, -1]) {
      const v = c.initial + dir * k * 5 * c.step;
      if (v < c.min || v > c.max) continue;
      if (!judge(round, { ...values, [c.id]: v }).hit) {
        return { ...round, controls: round.controls.map((x) => (x === c ? { ...x, initial: v } : x)) };
      }
    }
  }
  return round;
}

export function buildFolk(kind: FolkKind, seed: number): FolkBoard {
  const rnd = seededRandom(seed + kind.length * 101 + kind.charCodeAt(0));
  const rounds = kind === "bow" ? buildBow(rnd) : kind === "asyq" ? buildAsyq(rnd) : kind === "tug" ? buildTug(rnd) : buildRocket(rnd);
  return { kind, rounds: rounds.map(startUnsolved) };
}

/** The grid of every value combination a round's controls can take: for proving a round can be won. */
export function controlGrid(round: FolkRound): Record<string, number>[] {
  let out: Record<string, number>[] = [{}];
  for (const c of round.controls) {
    const values: number[] = [];
    for (let v = c.min; v <= c.max + 1e-9; v += c.step) values.push(Math.round(v * 1e6) / 1e6);
    out = out.flatMap((o) => values.map((v) => ({ ...o, [c.id]: v })));
  }
  return out;
}

export const defaultValues = (round: FolkRound): Record<string, number> => Object.fromEntries(round.controls.map((c) => [c.id, c.initial]));
