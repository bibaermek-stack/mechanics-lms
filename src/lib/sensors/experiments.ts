// The four experiments of the phone laboratory: what to do, and what a recording
// says once analysed. Pure — the page only draws what is returned here.

import type { SensorKind } from "@/lib/types";
import { PLANETS } from "@/lib/projectile";
import {
  G,
  analyzeJump,
  analyzeLift,
  analyzePendulum,
  analyzeRest,
  pendulumPeriodFor,
  sampleInterval,
  type Sample,
} from "./analysis";
import { SENSOR_META, plausible } from "./meta";
import { sameJumpOn } from "./standing";

/** A number in Kazakh style: decimal comma, fixed decimals. */
export const num = (n: number, decimals = 2) => n.toFixed(decimals).replace(".", ",").replace("-", "−");

export interface Experiment {
  kind: SensorKind;
  title: string;
  /** One line on what the phone does in this experiment. */
  idea: string;
  steps: string[];
  /** Seconds to get ready, and seconds of recording. */
  countdown: number;
  seconds: number;
  /** What the countdown tells the student to do. */
  getReady: string;
  /** The pendulum alone needs a length. */
  needsLength?: boolean;
}

export const PENDULUM_LENGTH = { min: 0.2, max: 2.5, initial: 1 };

export const EXPERIMENTS: Experiment[] = [
  {
    kind: "rest-g",
    title: "g-ны өлше",
    idea: "Тыныш жатқан телефон сенсоры үнемі жоғары қарай g шамасындай үдеу «сезеді». Осыдан Жердің тартылыс үдеуін табамыз.",
    steps: ["Телефонды үстелге жазық қой.", "«Бастау» бас та, қолыңды ал.", "6 секунд қозғалтпа."],
    countdown: 3,
    seconds: 6,
    getReady: "Телефонды үстелге қой",
  },
  {
    kind: "jump",
    title: "Секіру биіктігі",
    idea: "Ауада тұрғанда сенсор ≈ 0 көрсетеді (салмақсыздық). Ауада болған t уақытынан биіктік шығады: h = g·t²/8.",
    steps: [
      "Телефонды қалтаңа немесе белдігіңе берік сал.",
      "«Бастау» бас, 6 секунд ішінде дайындал.",
      "Ашық, қауіпсіз жерде тік секір. Бірнеше рет қайтала.",
      "14 секундтан кейін жазу өзі тоқтайды.",
    ],
    countdown: 6,
    seconds: 14,
    getReady: "Телефонды қалтаңа сал, секіруге дайындал",
  },
  {
    kind: "pendulum",
    title: "Маятник периоды",
    idea: "Жіпке ілінген телефон — маятник. Сенсор тербеліс периодын өлшейді, ал теория T = 2π√(L/g) дейді. Сәйкес келе ме?",
    steps: [
      "Телефонды қалтасы бар қапшыққа салып, жіппен іл.",
      "Ілу нүктесінен телефонның ортасына дейінгі L ұзындығын өлшеп, өріске жаз.",
      "Телефонды аздап (шамамен 15°) шет шығарып жібер де «Бастау» бас.",
      "20 секунд тербелсін.",
    ],
    countdown: 4,
    seconds: 20,
    getReady: "Телефонды жіпке іліп, шет шығарып жіберуге дайындал",
    needsLength: true,
  },
  {
    kind: "elevator",
    title: "Лифт",
    idea: "Лифт жоғары жүре бастағанда телефон «ауырлайды», тоқтарда «жеңілдейді». Төмен жүргенде — керісінше.",
    steps: [
      "Лифттің ішінде тұрып «Бастау» бас.",
      "Телефонды қолыңда ұстап, алғашқы 5 секунд мүлде қозғалтпа.",
      "Қабатты таңда да, лифт тоқтағанша тұр.",
      "Жазба 40 секундтан кейін тоқтайды.",
    ],
    countdown: 5,
    seconds: 40,
    getReady: "Лифттің ішінде тұр, телефонды қозғалтпа",
  },
];

export const experimentFor = (kind: SensorKind) => EXPERIMENTS.find((e) => e.kind === kind)!;

export interface Highlight {
  from: number;
  to: number;
  label: string;
  tone: "good" | "warn";
}

export interface Analysis {
  kind: SensorKind;
  /** What is saved. */
  value: number;
  /** The one-line answer. */
  headline: string;
  /** What it means, one sentence each. */
  lines: string[];
  /** Cautions that do not stop the result being shown. */
  warnings: string[];
  details: Record<string, unknown>;
  highlights: Highlight[];
  /** True when the value sits in the range the database accepts. */
  saveable: boolean;
}

export type RunResult = { ok: true; analysis: Analysis } | { ok: false; reason: string };

const rateOf = (samples: Sample[]) => {
  const dt = sampleInterval(samples);
  return dt > 0 ? Math.round(1 / dt) : 0;
};

export function analyseRun(kind: SensorKind, samples: Sample[], opts: { length?: number } = {}): RunResult {
  const done = (a: Omit<Analysis, "kind" | "saveable" | "details"> & { details: Record<string, unknown> }): RunResult => ({
    ok: true,
    analysis: { ...a, kind, saveable: plausible(kind, a.value), details: { rateHz: rateOf(samples), samples: samples.length, ...a.details } },
  });

  if (kind === "rest-g") {
    const r = analyzeRest(samples);
    if (!r.ok) return r;
    const off = ((r.g - G) / G) * 100;
    const warnings: string[] = [];
    if (Math.abs(off) > 3) warnings.push("Өлшем 3 %-дан астам ауытқыды: телефон сенсоры калибрленбеген болуы мүмкін, немесе телефон қозғалды. Басқа жерде қайталап көр.");
    return done({
      value: r.g,
      headline: `g = ${num(r.g)} м/с²`,
      lines: [
        `Теориялық мән ${num(G)} м/с². Айырмасы ${num(Math.abs(off), 1)} %.`,
        `Жазба ішіндегі шашырау ±${num(r.sd, 2)} м/с² (${num(r.seconds, 1)} с).`,
        r.tilt < 8 ? "Телефон жазық жатты." : `Телефон ${num(r.tilt, 0)}° көлбеу жатты. Сонда да жалпы үдеу өзгермейді — тек x, y, z құраушылары бөлінеді. Көлбетіп қайталап көр!`,
      ],
      warnings,
      details: { sd: r.sd, tilt: r.tilt, seconds: r.seconds, deviationPercent: off },
      highlights: [],
    });
  }

  if (kind === "jump") {
    const r = analyzeJump(samples);
    if (!r.ok) return r;
    const b = r.best;
    const moon = sameJumpOn(b.height, G, PLANETS.moon.g);
    const warnings: string[] = [];
    if (b.height > 1.0) warnings.push("1 м-ден жоғары секіру өте сирек. Телефон қалтада қозғалып кеткен болуы мүмкін — берік бекітіп қайталап көр.");
    return done({
      value: b.height,
      headline: `h = ${num(b.height)} м`,
      lines: [
        `Ауада болған уақыт ${num(b.flightTime)} с. Формула: h = g·t²/8.`,
        `Дәлдігі шамамен ±${num(b.uncertainty)} м (сенсор секундына ${rateOf(samples)} рет өлшейді).`,
        r.jumps.length > 1 ? `${r.jumps.length} секіріс табылды, ең биігі көрсетілді.` : "Бір секіріс табылды.",
        `Дәл осы күшпен Айда секірсең, шамамен ${num(moon, 1)} м көтерілер едің (g = ${num(PLANETS.moon.g)} м/с²).`,
      ],
      warnings,
      details: { flightTime: b.flightTime, uncertainty: b.uncertainty, jumps: r.jumps.length },
      highlights: r.jumps.map((f) => ({ from: f.start, to: f.end, label: "ауада", tone: f === b ? ("good" as const) : ("warn" as const) })),
    });
  }

  if (kind === "pendulum") {
    const L = opts.length;
    if (L === undefined || !Number.isFinite(L) || L < PENDULUM_LENGTH.min || L > PENDULUM_LENGTH.max) {
      return { ok: false, reason: `Жіптің ұзындығын ${num(PENDULUM_LENGTH.min, 1)}–${num(PENDULUM_LENGTH.max, 1)} м аралығында енгіз.` };
    }
    const r = analyzePendulum(samples);
    if (!r.ok) return r;
    const theory = pendulumPeriodFor(L);
    const off = ((r.period - theory) / theory) * 100;
    const gEst = (4 * Math.PI ** 2 * L) / r.period ** 2;
    const warnings: string[] = [];
    if (Math.abs(off) > 8) warnings.push("Өлшем мен теория 8 %-дан астам алшақ. Ұзындықты ілу нүктесінен телефонның ортасына дейін өлшедің бе? Тербеліс аз (15° шамасында) болды ма?");
    return done({
      value: r.period,
      headline: `T = ${num(r.period)} с`,
      lines: [
        `Теория: T = 2π√(L/g) = ${num(theory)} с (L = ${num(L)} м). Айырмасы ${num(Math.abs(off), 1)} %.`,
        `Мұнан g = 4π²L/T² = ${num(gEst)} м/с².`,
        `Жазбада шамамен ${r.cycles} толық тербеліс болды (қайталану сапасы ${num(r.quality * 100, 0)} %).`,
      ],
      warnings,
      details: { length: L, theory, gEstimate: gEst, cycles: r.cycles, quality: r.quality, deviationPercent: off, axis: r.axis },
      highlights: [],
    });
  }

  const r = analyzeLift(samples);
  if (!r.ok) return r;
  const [first, last] = r.phases;
  const word = (f: "heavier" | "lighter") => (f === "heavier" ? "ауырлады" : "жеңілдеді");
  return done({
    value: r.maxAcceleration,
    headline: `a = ${num(r.maxAcceleration)} м/с², лифт ${r.direction === "up" ? "жоғары" : "төмен"} жүрді`,
    lines: [
      `Жүре бастағанда телефон ${word(first.feel)}, тоқтарда ${word(last.feel)} — сондықтан лифт ${r.direction === "up" ? "жоғары" : "төмен"} кетті.`,
      `Салмағың ең көп дегенде шамамен ${num(r.weightChangePercent, 1)} % өзгерді. Тыныш тұрғанда сенсор ${num(r.rest)} м/с² көрсеткен.`,
      "Біркелкі жүріп бара жатқанда салмақ өзгермейді: сезім үдеуге ғана жауап береді.",
    ],
    warnings: [],
    details: { direction: r.direction, rest: r.rest, weightChangePercent: r.weightChangePercent },
    highlights: r.phases.map((p) => ({ from: p.start, to: p.end, label: word(p.feel), tone: "good" as const })),
  });
}

export const unitFor = (kind: SensorKind) => SENSOR_META[kind].unit;
