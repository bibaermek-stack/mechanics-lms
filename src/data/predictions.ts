// Predict, then look.
//
// The student is shown a set-up and must say what will happen *before* seeing it,
// and how sure they are. Then the measurement is shown. The point is the moment of
// surprise: a student who has committed to "the heavy ball lands first" remembers
// being wrong in a way that a student who was simply told never does — and a wrong
// answer that was confidently held is the one worth a teacher's attention.
//
// Every wrong option is a misconception from the physics-education literature, and
// carries its name, so the teacher can see which ideas a class actually holds.
//
// THE OBSERVATION IS COMPUTED, NOT STATED. Each item runs a small simulation or
// calculation (a falling body stepped through time, a track walked segment by
// segment, a pendulum integrated numerically) and `answerFrom` reads the *result*
// to say which option it supports. src/data/predictions.test.ts requires that to
// be the option marked correct — so an item cannot claim an answer its own
// measurement does not give.

import { fmt } from "./quizBank";
import { G, G_MOON } from "./facts";

export interface Misconception {
  id: string;
  title: string;
  /** Why it feels right — said kindly, because it usually is a reasonable guess. */
  why: string;
}

export const MISCONCEPTIONS: Record<string, Misconception> = {
  "weight-never-changes": { id: "weight-never-changes", title: "Салмақ ешқашан өзгермейді", why: "Күнделікті өмірде салмақты өзгермейтін қасиет деп қабылдаймыз, себебі Жерде g әрдайым бірдей." },
  "mass-changes-with-g": { id: "mass-changes-with-g", title: "Масса тартылысқа байланысты деп ойлау", why: "Масса мен салмақ бір сөзбен «ауырлық» деп аталады, сондықтан екеуі бірге өзгереді деп ойлаймыз." },
  "horizontal-motion-delays-fall": { id: "horizontal-motion-delays-fall", title: "Көлденең қозғалыс құлауды кешіктіреді", why: "Ұшып бара жатқан дене «ұзағырақ ұшады» деп сезіледі, бірақ тік және көлденең қозғалыс тәуелсіз." },
  "faster-lands-first": { id: "faster-lands-first", title: "Жылдамырақ дене бірінші түседі", why: "Жылдамдық пен түсу уақытын байланыстырамыз, ал түсу уақытын тек биіктік пен g анықтайды." },
  "heavy-falls-faster": { id: "heavy-falls-faster", title: "Ауыр дене тезірек түседі", why: "Ауада қауырсын мен тас шынымен әртүрлі түседі, сондықтан ереже деп қабылдаймыз; бірақ себебі — ауа кедергісі." },
  "zero-velocity-zero-acceleration": { id: "zero-velocity-zero-acceleration", title: "Жылдамдық нөл болса, үдеу де нөл", why: "Дене «тоқтап тұрғандай» көрінеді, бірақ жылдамдық өзгеруін тоқтатқан жоқ." },
  "acceleration-follows-velocity": { id: "acceleration-follows-velocity", title: "Үдеу әрқашан қозғалыс бағытымен бағыттас", why: "Көтерілгенде үдеу де жоғары деп сезіледі, ал g әрдайым төмен бағытталған." },
  "friction-depends-on-area": { id: "friction-depends-on-area", title: "Үйкеліс жанасу ауданына байланысты", why: "Жанасу көп болса, «көбірек ұстайды» деп ойлаймыз; бірақ қысым сол мөлшерде азаяды." },
  "weight-is-constant": { id: "weight-is-constant", title: "Таразы әрдайым mg көрсетеді", why: "Таразы салмақты өлшейді деп білеміз, ал үдеумен қозғалғанда салмақ өзгереді." },
  "up-means-lighter": { id: "up-means-lighter", title: "Жоғары үдегенде жеңілдейміз", why: "Лифт көтерілгенде «көтерілу» жеңілдік беретіндей сезіледі, бірақ үдеу бағыты тірек күшін арттырады." },
  "force-needed-to-move": { id: "force-needed-to-move", title: "Қозғалыс үшін күш үнемі керек", why: "Күнделікті өмірде үйкеліс бәрін тоқтатады, сондықтан күшсіз қозғалыс мүмкін емес сияқты." },
  "impetus-accumulates": { id: "impetus-accumulates", title: "Итерген күш «жиналып», жылдамдата береді", why: "Итерудің «күші» затта сақталады деп ойлаймыз; ал үдеуді күш қазір әсер еткенде ғана береді." },
  "bigger-exerts-bigger-force": { id: "bigger-exerts-bigger-force", title: "Үлкен дене көбірек күшпен соғады", why: "Ауыр дененің әсері «үлкен» көрінеді, бірақ өзара әрекет күштері әрдайым тең." },
  "damage-means-force": { id: "damage-means-force", title: "Көбірек зақымданған затқа көбірек күш түсті", why: "Зақым көлемін күшпен шатастырамыз; жеңіл дене үдеуді көбірек алады, күш тең." },
  "path-shape-determines-speed": { id: "path-shape-determines-speed", title: "Жолдың пішіні соңғы жылдамдықты анықтайды", why: "Тік жол «жылдамырақ» сияқты; бірақ жылдамдықты тек биіктіктің айырмасы анықтайды (үйкеліссіз)." },
  "proportional-thinking": { id: "proportional-thinking", title: "Жылдамдық екі есе — жол екі есе", why: "Көп шама сызықты тәуелді; ал кинетикалық энергия жылдамдықтың квадратына пропорционал." },
  "exponent-overshoot": { id: "exponent-overshoot", title: "Тәуелділік дәрежесін асыра бағалау", why: "Квадрат тәуелділікті білгенмен, оны одан да күрт деп ойлаймыз." },
  "equal-pushes-equal-speeds": { id: "equal-pushes-equal-speeds", title: "Бірдей итеру — бірдей жылдамдық", why: "Күштер тең болса, жылдамдықтар да тең деп ойлаймыз; ал тең импульс массаға кері жылдамдық береді." },
  "heavier-moves-more": { id: "heavier-moves-more", title: "Ауыр дене тезірек кетеді", why: "Ауыр дене «күштірек» көрінеді; шын мәнінде ауыр дене баяу кетеді." },
  "force-independent-of-time": { id: "force-independent-of-time", title: "Соққы күші тоқтау уақытына байланысты емес", why: "Құлау биіктігі бірдей болса, соққы да бірдей деп ойлаймыз; бірақ F = Δp/Δt." },
  "soft-means-bigger-force": { id: "soft-means-bigger-force", title: "Жұмсақ жер көбірек күш түсіреді", why: "Жастық «көп қысылады» және көп күш жұмсайтындай көрінеді; шын мәнінде ол күшті азайтады." },
  "same-mass-same-motion": { id: "same-mass-same-motion", title: "Масса бірдей болса, қозғалыс та бірдей", why: "Массасы бірдей денелердің домалауы да бірдей деп ойлаймыз, бірақ масса қалай таралғаны (инерция моменті) маңызды." },
  "hollow-is-lighter": { id: "hollow-is-lighter", title: "Қуыс дене жеңіл, сондықтан жылдам", why: "Қуыс зат жеңіл көрінеді; бұл жағдайда массалар бірдей, ал инерция моменті үлкенірек." },
  "angular-speed-constant": { id: "angular-speed-constant", title: "Айналу жылдамдығы өзгермейді", why: "Сыртқы итеру болмаса, жылдамдық сақталады деп ойлаймыз; бірақ сақталатыны — импульс моменті." },
  "arms-in-slows": { id: "arms-in-slows", title: "Қолды қысқанда жылдамдық азаяды", why: "Қолды қысу «күшсіздеу» көрінеді, бірақ инерция моменті кемиді, ал L = Iω сақталады." },
  "mass-affects-period": { id: "mass-affects-period", title: "Масса маятниктің периодына әсер етеді", why: "Ауыр дене «басқаша» тербеледі деп сезіледі; бірақ масса маятник теңдеуінен түсіп қалады." },
  "mass-affects-fall": { id: "mass-affects-fall", title: "Түсу уақыты массаға байланысты", why: "Дененің массасы қозғалысқа әсер етуі керек сияқты көрінеді; бірақ ауырлық күші де, инерция да массаға пропорционал." },
  "period-independent-of-g": { id: "period-independent-of-g", title: "Период тартылысқа байланысты емес", why: "Маятниктің «өз ырғағы» бар деп ойлаймыз; ал T = 2π√(l/g)." },
  "weaker-gravity-faster": { id: "weaker-gravity-faster", title: "Әлсіз тартылыста маятник жылдамырақ", why: "Жеңіл болу «жылдамырақ» деп сезіледі; шын мәнінде қайтарушы күш азайып, тербеліс баяулайды." },
  "ice-expands-overflow": { id: "ice-expands-overflow", title: "Мұз еріген кезде су тасиды", why: "Мұз судан көп көлем алады деп білеміз; бірақ жүзіп тұрған мұз өз салмағындай суды ығыстырған." },
  "melting-shrinks": { id: "melting-shrinks", title: "Мұз еріген кезде су деңгейі төмендейді", why: "Еріген мұз «жоғалады» деп сезіледі; бірақ ол ығыстырған көлемдей су болып қалады." },
  "more-water-more-pressure": { id: "more-water-more-pressure", title: "Су көп болса, түбіндегі қысым көп", why: "Су көп болса, салмағы да көп; бірақ түптегі қысымды тек тереңдік анықтайды." },
  "narrow-more-pressure": { id: "narrow-more-pressure", title: "Тар ыдыста қысым көп", why: "Тар түтікте су «жиналған» көрінеді; бірақ p = ρgh ыдыстың пішініне байланысты емес." },
  "heavier-side-down": { id: "heavier-side-down", title: "Ауыр жағы әрдайым төмен түседі", why: "Ауыр жүк «басым» көрінеді, бірақ иін де есептелуі керек (M = F·d)." },
  "farther-side-down": { id: "farther-side-down", title: "Алыс жағы әрдайым төмен түседі", why: "Иін ұзын болса басым көрінеді, бірақ жүк салмағы да есептелуі керек." },
};

// ---------------------------------------------------------------------------
// What the student is shown afterwards
// ---------------------------------------------------------------------------

export interface Measurement {
  key: string;
  label: string;
  value: number;
  unit: string;
}

export type Scene =
  /** Bodies moving in a plane; `at(t)` is each one's position in metres at time t. */
  | {
      kind: "paths";
      duration: number;
      world: { w: number; h: number };
      bodies: { label: string; color: string; end: number; at: (t: number) => { x: number; y: number } }[];
    }
  /** Runners along parallel lanes; `at(t)` is the fraction (0–1) of its lane covered. */
  | { kind: "race"; duration: number; lanes: { label: string; color: string; finish: number | null; at: (t: number) => number }[] }
  /** The measurements as bars, one scale per unit. */
  | { kind: "bars" };

export interface Observation {
  scene: Scene;
  measurements: Measurement[];
}

export interface PredictOption {
  id: string;
  text: string;
  /** The misconception this answer expresses; absent on the right one. */
  misconception?: string;
}

export interface PredictItem {
  id: string;
  /** A short name, so two items that both ask «which lands first?» can be told apart in a list. */
  title: string;
  lesson: number;
  setup: string;
  question: string;
  options: PredictOption[];
  correct: string;
  observe: () => Observation;
  /** Which option the measurement supports — read from the numbers alone. */
  answerFrom: (o: Observation) => string;
  explain: (o: Observation) => string;
}

export const mval = (o: Observation, key: string): number => {
  const m = o.measurements.find((x) => x.key === key);
  if (!m) throw new Error(`no measurement "${key}"`);
  return m.value;
};

const BLUE = "#38bdf8";
const ORANGE = "#f97316";
const VIOLET = "#a78bfa";
const near = (a: number, b: number, rel = 1e-6) => Math.abs(a - b) <= Math.abs(b) * rel + 1e-12;

// ---------------------------------------------------------------------------
// The small experiments
// ---------------------------------------------------------------------------

/** Time to fall height h from rest, found by stepping Newton's second law — not from a formula. */
export function fallTime(h: number, g = G, dt = 1e-5): number {
  let y = h;
  let v = 0;
  let t = 0;
  while (y > 0) {
    v += g * dt;
    y -= v * dt;
    t += dt;
  }
  return t;
}

/**
 * Slide down a frictionless track given as heights at equally spaced x, one segment
 * at a time. On each straight segment the acceleration along it is g·sinθ, which is
 * constant, so the motion there is exact. Returns the speed and time at the bottom,
 * and the fraction of the track covered at time t.
 */
export function slideDown(ys: number[], dx: number, g = G) {
  const lens: number[] = [];
  const acc: number[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const dy = ys[i] - ys[i + 1];
    const len = Math.hypot(dx, dy);
    lens.push(len);
    acc.push((g * dy) / len);
  }
  const total = lens.reduce((a, b) => a + b, 0);
  // v and t at the end of each segment
  const v: number[] = [0];
  const t: number[] = [0];
  for (let i = 0; i < lens.length; i++) {
    const v2 = v[i] * v[i] + 2 * acc[i] * lens[i];
    v.push(Math.sqrt(Math.max(0, v2)));
    t.push(t[i] + (acc[i] === 0 ? lens[i] / v[i] : (v[i + 1] - v[i]) / acc[i]));
  }
  const fractionAt = (time: number) => {
    if (time >= t[t.length - 1]) return 1;
    let i = 0;
    while (t[i + 1] < time) i++;
    const dt = time - t[i];
    const s = v[i] * dt + 0.5 * acc[i] * dt * dt;
    const before = lens.slice(0, i).reduce((a, b) => a + b, 0);
    return (before + s) / total;
  };
  return { speed: v[v.length - 1], time: t[t.length - 1], length: total, fractionAt };
}

/** The period of a pendulum of mass m on a light rod of length L, integrated with RK4 (small swings stay small). */
export function pendulumPeriod(m: number, L: number, g: number, amplitude = 0.15): number {
  // torque = −m g L sinθ, moment of inertia = m L²: the mass is in both, and cancels only if the physics says so
  const alpha = (th: number) => (-m * g * L * Math.sin(th)) / (m * L * L);
  let th = amplitude;
  let w = 0;
  let t = 0;
  const dt = 1e-4;
  while (th > 0) {
    const k1t = w, k1w = alpha(th);
    const k2t = w + 0.5 * dt * k1w, k2w = alpha(th + 0.5 * dt * k1t);
    const k3t = w + 0.5 * dt * k2w, k3w = alpha(th + 0.5 * dt * k2t);
    const k4t = w + dt * k3w, k4w = alpha(th + dt * k3t);
    const next = th + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
    const nextW = w + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
    if (next <= 0) {
      // crossed the vertical inside this step: interpolate, then a quarter of a swing has passed
      t += (dt * th) / (th - next);
      break;
    }
    th = next;
    w = nextW;
    t += dt;
  }
  return 4 * t;
}

/** Distance covered before stopping from speed v with friction coefficient μ, by stepping time. */
export function brakingDistance(v0: number, mu: number, g = G, dt = 1e-4): number {
  let v = v0;
  let s = 0;
  while (v > 0) {
    v -= mu * g * dt;
    if (v > 0) s += v * dt;
  }
  return s;
}

// ---------------------------------------------------------------------------
// The items
// ---------------------------------------------------------------------------

const kg = "кг";
const N = "Н";

export const PREDICT_ITEMS: PredictItem[] = [
  {
    id: "moon-dumbbell",
    title: "Гантель Айда",
    lesson: 1,
    setup: "Массасы 5 кг гантель Жерден Айға апарылды (Айда g = 1,62 м/с²).",
    question: "Гантельдің массасы мен салмағы Айда қалай өзгереді?",
    options: [
      { id: "none", text: "Массасы да, салмағы да өзгермейді", misconception: "weight-never-changes" },
      { id: "weight", text: "Массасы өзгермейді, салмағы шамамен 6 есе кемиді" },
      { id: "both", text: "Массасы да, салмағы да шамамен 6 есе кемиді", misconception: "mass-changes-with-g" },
    ],
    correct: "weight",
    observe: () => ({
      scene: { kind: "bars" },
      measurements: [
        { key: "m-earth", label: "Масса Жерде", value: 5, unit: kg },
        { key: "m-moon", label: "Масса Айда", value: 5, unit: kg },
        { key: "w-earth", label: "Салмақ Жерде", value: 5 * G, unit: N },
        { key: "w-moon", label: "Салмақ Айда", value: 5 * G_MOON, unit: N },
      ],
    }),
    answerFrom: (o) => {
      const sameMass = near(mval(o, "m-earth"), mval(o, "m-moon"));
      const sameWeight = near(mval(o, "w-earth"), mval(o, "w-moon"));
      return sameMass && sameWeight ? "none" : sameMass ? "weight" : "both";
    },
    explain: (o) =>
      `Масса — дененің мөлшері, ол Айда да ${fmt(mval(o, "m-moon"), 0)} кг. Салмақ P = mg: Жерде ${fmt(mval(o, "w-earth"), 1)} Н, Айда ${fmt(mval(o, "w-moon"), 1)} Н — ${fmt(mval(o, "w-earth") / mval(o, "w-moon"), 1)} есе аз.`,
  },
  {
    id: "drop-vs-shot",
    title: "Босатылған және лақтырылған доп",
    lesson: 2,
    setup: "Бір мезгілде, 1,5 м биіктіктен: А добы жай қолдан босатылды, ал В добы горизонталь бағытта 8 м/с жылдамдықпен лақтырылды. Ауа кедергісін ескермейміз.",
    question: "Қайсысы жерге бірінші тиеді?",
    options: [
      { id: "a", text: "А (босатылған) бірінші", misconception: "horizontal-motion-delays-fall" },
      { id: "b", text: "В (лақтырылған) бірінші", misconception: "faster-lands-first" },
      { id: "same", text: "Бір мезгілде" },
    ],
    correct: "same",
    observe: () => {
      const h = 1.5;
      const vx = 8;
      // Newton's second law in both directions: no force sideways (ax = 0), weight downwards (ay = −g).
      const flight = (vx0: number) => {
        const dt = 1e-5;
        let x = 0, y = h, vxx = vx0, vy = 0, t = 0;
        while (y > 0) {
          vy += -G * dt;
          y += vy * dt;
          x += vxx * dt;
          t += dt;
        }
        return { t, x };
      };
      const a = flight(0);
      const b = flight(vx);
      const yAt = (t: number) => Math.max(0, h - 0.5 * G * t * t);
      return {
        scene: {
          kind: "paths",
          duration: a.t,
          world: { w: 5, h: 1.7 },
          bodies: [
            { label: "А", color: BLUE, end: a.t, at: (t) => ({ x: 0.25, y: yAt(t) }) },
            { label: "В", color: ORANGE, end: b.t, at: (t) => ({ x: 0.25 + vx * Math.min(t, b.t), y: yAt(t) }) },
          ],
        },
        measurements: [
          { key: "t-a", label: "А жерге түскен уақыт", value: a.t, unit: "с" },
          { key: "t-b", label: "В жерге түскен уақыт", value: b.t, unit: "с" },
          { key: "range-b", label: "В-ның ұшу қашықтығы", value: b.x, unit: "м" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "t-a"), mval(o, "t-b"), 1e-6) ? "same" : mval(o, "t-a") < mval(o, "t-b") ? "a" : "b"),
    explain: (o) =>
      `Екеуі де ${fmt(mval(o, "t-a"), 2)} с-тан кейін түседі. Тік қозғалыс горизонталь жылдамдыққа байланысты емес: екеуі де бастапқы тік жылдамдығы нөл күйінде еркін түседі. В тек ${fmt(mval(o, "range-b"), 1)} м алыс түседі.`,
  },
  {
    id: "heavy-light",
    title: "Ауыр және жеңіл шар",
    lesson: 2,
    setup: "Ауасыз кеңістікте 20 м биіктіктен массасы 1 кг және 5 кг екі шар бір мезгілде босатылды.",
    question: "Қайсысы бірінші түседі?",
    options: [
      { id: "heavy", text: "5 кг-дық шар", misconception: "heavy-falls-faster" },
      { id: "light", text: "1 кг-дық шар", misconception: "mass-affects-fall" },
      { id: "same", text: "Екеуі бір мезгілде" },
    ],
    correct: "same",
    observe: () => {
      // Newton's second law with the mass in it: a = (m g) / m
      const fall = (m: number) => {
        const a = (m * G) / m;
        let y = 20, v = 0, t = 0;
        const dt = 1e-5;
        while (y > 0) { v += a * dt; y -= v * dt; t += dt; }
        return { t, v };
      };
      const h = fall(5);
      const l = fall(1);
      const yAt = (t: number) => Math.max(0, 20 - 0.5 * G * t * t);
      return {
        scene: {
          kind: "paths",
          duration: h.t,
          world: { w: 3, h: 21 },
          bodies: [
            { label: "5 кг", color: ORANGE, end: h.t, at: (t) => ({ x: 0.8, y: yAt(t) }) },
            { label: "1 кг", color: BLUE, end: l.t, at: (t) => ({ x: 2.2, y: yAt(t) }) },
          ],
        },
        measurements: [
          { key: "t-heavy", label: "5 кг-дық шардың түсу уақыты", value: h.t, unit: "с" },
          { key: "t-light", label: "1 кг-дық шардың түсу уақыты", value: l.t, unit: "с" },
          { key: "v-heavy", label: "5 кг-дық шардың жерге тию жылдамдығы", value: h.v, unit: "м/с" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "t-heavy"), mval(o, "t-light"), 1e-9) ? "same" : mval(o, "t-heavy") < mval(o, "t-light") ? "heavy" : "light"),
    explain: (o) =>
      `Екеуі де ${fmt(mval(o, "t-heavy"), 2)} с-тан кейін түседі. Ауыр шарды тартатын күш (mg) 5 есе көп, бірақ оның инерциясы (m) да 5 есе көп: a = mg/m = g. Ауада қауырсын тек ауа кедергісінен баяу түседі.`,
  },
  {
    id: "top-of-throw",
    title: "Лақтырылған доптың шыңы",
    lesson: 2,
    setup: "Доп тік жоғары 10 м/с жылдамдықпен лақтырылды. Ол ең биік нүктеге жетті.",
    question: "Ең биік нүктеде допқа үдеу қандай?",
    options: [
      { id: "zero", text: "Нөл — доп бір сәт тоқтайды", misconception: "zero-velocity-zero-acceleration" },
      { id: "down", text: "g, төмен қарай бағытталған" },
      { id: "up", text: "g, жоғары қарай бағытталған", misconception: "acceleration-follows-velocity" },
    ],
    correct: "down",
    observe: () => {
      const v0 = 10;
      const y = (t: number) => v0 * t - 0.5 * G * t * t;
      // The top is where the height stops growing; the speed and acceleration are read off the height record.
      let tTop = 0;
      for (let t = 0; y(t + 1e-4) > y(t); t += 1e-4) tTop = t;
      const h = 1e-3;
      const vel = (t: number) => (y(t + h) - y(t - h)) / (2 * h);
      const acc = (t: number) => (y(t + h) - 2 * y(t) + y(t - h)) / (h * h);
      const total = (2 * v0) / G;
      return {
        scene: {
          kind: "paths",
          duration: total,
          world: { w: 2, h: 5.6 },
          bodies: [{ label: "Доп", color: ORANGE, end: total, at: (t) => ({ x: 1, y: Math.max(0, y(t)) }) }],
        },
        measurements: [
          { key: "v-top", label: "Шыңдағы жылдамдық", value: vel(tTop), unit: "м/с" },
          { key: "a-top", label: "Шыңдағы үдеу (жоғары — оң)", value: acc(tTop), unit: "м/с²" },
          { key: "a-rise", label: "Көтерілу кезіндегі үдеу", value: acc(tTop / 2), unit: "м/с²" },
          { key: "a-fall", label: "Түсу кезіндегі үдеу", value: acc((tTop * 3) / 2), unit: "м/с²" },
          { key: "h-top", label: "Шыңның биіктігі", value: y(tTop), unit: "м" },
        ],
      };
    },
    answerFrom: (o) => {
      const a = mval(o, "a-top");
      return Math.abs(a) < 0.05 ? "zero" : a < 0 ? "down" : "up";
    },
    explain: (o) =>
      `Шыңда жылдамдық ${fmt(mval(o, "v-top"), 0)} м/с, ал үдеу ${fmt(-mval(o, "a-top"), 2)} м/с² төмен: ол көтерілгенде де, түскенде де бірдей. Жылдамдықтың нөл болуы үдеудің нөл екенін білдірмейді — жылдамдық сол сәтте таңбасын өзгертіп жатыр.`,
  },
  {
    id: "friction-area",
    title: "Үйкеліс және аудан",
    lesson: 3,
    setup: "Массасы 2 кг тікбұрышты брусок үстелде сырғанайды. Оны алдымен кең жағымен, содан кейін тар жағымен қояды (материал бірдей, μ = 0,4).",
    question: "Қай жағдайда сырғанау үйкеліс күші көп?",
    options: [
      { id: "wide", text: "Кең жағымен қойғанда", misconception: "friction-depends-on-area" },
      { id: "narrow", text: "Тар жағымен қойғанда", misconception: "friction-depends-on-area" },
      { id: "same", text: "Екі жағдайда бірдей" },
    ],
    correct: "same",
    observe: () => {
      const mu = 0.4, m = 2;
      // Normal force equals weight on a level table; friction = μ N whatever the contact area is.
      const friction = (_area: number) => mu * m * G;
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "f-wide", label: "Кең жағы (0,02 м²)", value: friction(0.02), unit: N },
          { key: "f-narrow", label: "Тар жағы (0,004 м²)", value: friction(0.004), unit: N },
          { key: "p-wide", label: "Кең жағының қысымы", value: (m * G) / 0.02, unit: "Па" },
          { key: "p-narrow", label: "Тар жағының қысымы", value: (m * G) / 0.004, unit: "Па" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "f-wide"), mval(o, "f-narrow")) ? "same" : mval(o, "f-wide") > mval(o, "f-narrow") ? "wide" : "narrow"),
    explain: (o) =>
      `Үйкеліс күші екі жағдайда да ${fmt(mval(o, "f-wide"), 2)} Н: F = μN, ал формулада аудан жоқ. Тар жақта қысым 5 есе көп (${fmt(mval(o, "p-narrow"), 0)} Па-ға қарсы ${fmt(mval(o, "p-wide"), 0)} Па), бірақ жанасу ауданы 5 есе аз — екеуі бір-бірін теңестіреді.`,
  },
  {
    id: "elevator-scale",
    title: "Лифттегі таразы",
    lesson: 3,
    setup: "Массасы 60 кг адам лифттегі таразыда тұр. Лифт жоғары қарай 1,5 м/с² үдеумен жүріп келеді.",
    question: "Таразы лифт тыныш тұрғандағыдан гөрі не көрсетеді?",
    options: [
      { id: "less", text: "Азырақ", misconception: "up-means-lighter" },
      { id: "same", text: "Дәл сондай", misconception: "weight-is-constant" },
      { id: "more", text: "Көбірек" },
    ],
    correct: "more",
    observe: () => {
      const m = 60;
      // Newton's second law for the person: N − mg = m a  →  N = m (g + a)
      const reading = (a: number) => m * (G + a);
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "n-rest", label: "Лифт тыныш", value: reading(0), unit: N },
          { key: "n-up", label: "Жоғары үдейді (1,5 м/с²)", value: reading(1.5), unit: N },
          { key: "n-down", label: "Төмен үдейді (1,5 м/с²)", value: reading(-1.5), unit: N },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "n-up"), mval(o, "n-rest")) ? "same" : mval(o, "n-up") > mval(o, "n-rest") ? "more" : "less"),
    explain: (o) =>
      `Таразы тірек күшін көрсетеді: N − mg = ma, яғни N = m(g + a) = ${fmt(mval(o, "n-up"), 0)} Н (тыныш тұрғанда ${fmt(mval(o, "n-rest"), 0)} Н). Үдеу жоғары бағытталса, таразы көбірек көрсетеді; төмен үдегенде ${fmt(mval(o, "n-down"), 0)} Н.`,
  },
  {
    id: "frictionless-puck",
    title: "Мұздағы шайба",
    lesson: 4,
    setup: "Мұзда жатқан шайбаны итеріп 2 м/с жылдамдық берді де, жіберіп жіберді. Мұз өте тегіс (үйкеліс шамалы). Салыстыру үшін дәл осындай шайба кедір-бұдыр едендегі (μ = 0,05).",
    question: "Мұздағы шайба итеру тоқтағаннан кейін не істейді?",
    options: [
      { id: "stops", text: "Біртіндеп баяулап, тоқтайды", misconception: "force-needed-to-move" },
      { id: "constant", text: "Тұрақты жылдамдықпен жылжи береді" },
      { id: "speeds", text: "Жылдамдай береді", misconception: "impetus-accumulates" },
    ],
    correct: "constant",
    observe: () => {
      const v0 = 2, mu = 0.05, T = 10, L = 20;
      // Velocity of a puck with the given deceleration, stepped through time.
      const run = (decel: number) => {
        const dt = 1e-3;
        const xs: number[] = [];
        let v = v0, x = 0;
        for (let t = 0; t <= T + dt; t += dt) {
          xs.push(x);
          x += v * dt;
          v = Math.max(0, v - decel * dt);
        }
        return { xs, vEnd: v, xEnd: x };
      };
      const ice = run(0);
      const rough = run(mu * G);
      const at = (r: { xs: number[] }) => (t: number) => Math.min(1, r.xs[Math.min(r.xs.length - 1, Math.round(t / 1e-3))] / L);
      return {
        scene: {
          kind: "race",
          duration: T,
          lanes: [
            { label: "Мұз (үйкеліссіз)", color: BLUE, finish: null, at: at(ice) },
            { label: "Кедір-бұдыр еден (μ = 0,05)", color: ORANGE, finish: null, at: at(rough) },
          ],
        },
        measurements: [
          { key: "v-ice", label: "Мұздағы жылдамдық, 10 с кейін", value: ice.vEnd, unit: "м/с" },
          { key: "v-rough", label: "Едендегі жылдамдық, 10 с кейін", value: rough.vEnd, unit: "м/с" },
          { key: "x-ice", label: "Мұздағы жол, 10 с ішінде", value: ice.xEnd, unit: "м" },
          { key: "x-rough", label: "Едендегі жол, 10 с ішінде", value: rough.xEnd, unit: "м" },
        ],
      };
    },
    answerFrom: (o) => {
      const v = mval(o, "v-ice");
      return near(v, 2, 1e-6) ? "constant" : v < 2 ? "stops" : "speeds";
    },
    explain: (o) =>
      `Мұздағы шайбаға қозғалыс бағытында күш әсер етпейді, сондықтан жылдамдық ${fmt(mval(o, "v-ice"), 1)} м/с күйінде қалады (Ньютонның I заңы) және 10 с-та ${fmt(mval(o, "x-ice"), 0)} м өтеді. Кедір-бұдыр еденде үйкеліс баяулатып, ${fmt(mval(o, "x-rough"), 1)} м-де тоқтатады: тоқтататын — үйкеліс, ал қозғалыс үшін күш керек емес.`,
  },
  {
    id: "truck-car",
    title: "Жүк көлігі мен жеңіл көлік",
    lesson: 4,
    setup: "Массасы 8000 кг жүк көлігі мен 1000 кг жеңіл көлік бір-біріне қарама-қарсы 10 м/с жылдамдықпен келіп соғылды да, бірге жылжыды (соққы 0,1 с).",
    question: "Соққы кезінде қай көлікке түсірілген күш көп?",
    options: [
      { id: "car", text: "Жеңіл көлікке түскен күш көп", misconception: "damage-means-force" },
      { id: "truck", text: "Жүк көлігіне түскен күш көп", misconception: "bigger-exerts-bigger-force" },
      { id: "equal", text: "Екеуіне де бірдей" },
    ],
    correct: "equal",
    observe: () => {
      const mT = 8000, mC = 1000, v = 10, dt = 0.1;
      // Perfectly inelastic collision along a line: momentum is conserved
      const vAfter = (mT * v + mC * -v) / (mT + mC);
      const forceTruck = (mT * (vAfter - v)) / dt; // from the change in the truck's own momentum
      const forceCar = (mC * (vAfter - -v)) / dt; // from the change in the car's own momentum
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "f-truck", label: "Жүк көлігіне түскен күш", value: Math.abs(forceTruck) / 1000, unit: "кН" },
          { key: "f-car", label: "Жеңіл көлікке түскен күш", value: Math.abs(forceCar) / 1000, unit: "кН" },
          { key: "a-truck", label: "Жүк көлігінің үдеуі", value: Math.abs(forceTruck / mT), unit: "м/с²" },
          { key: "a-car", label: "Жеңіл көліктің үдеуі", value: Math.abs(forceCar / mC), unit: "м/с²" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "f-truck"), mval(o, "f-car")) ? "equal" : mval(o, "f-truck") > mval(o, "f-car") ? "truck" : "car"),
    explain: (o) =>
      `Күштер тең: екеуіне де ${fmt(mval(o, "f-truck"), 0)} кН (Ньютонның III заңы). Бірақ үдеу a = F/m: жеңіл көлікте ${fmt(mval(o, "a-car"), 0)} м/с², жүк көлігінде небәрі ${fmt(mval(o, "a-truck"), 0)} м/с². Сондықтан жеңіл көлік көбірек зақымданады, ал күш тең.`,
  },
  {
    id: "three-hills",
    title: "Үш жолмен сырғанау",
    lesson: 5,
    setup: "Бірдей үш шарик 1 м биіктіктен тыныштықтан үш үйкеліссіз жолмен сырғанап түседі: тік құлама, жайпақ еңіс және иілген жол. Түбіне жеткенде…",
    question: "Қайсысының жылдамдығы көп болады?",
    options: [
      { id: "steep", text: "Тік жолдағының", misconception: "path-shape-determines-speed" },
      { id: "same", text: "Үшеуінің жылдамдығы бірдей (уақыттары әртүрлі болса да)" },
      { id: "curve", text: "Иілген жолдағының", misconception: "path-shape-determines-speed" },
    ],
    correct: "same",
    observe: () => {
      const n = 400;
      const xs = Array.from({ length: n + 1 }, (_, i) => i / n);
      // Three tracks, all 1 m high; x runs 0..1 on a different horizontal scale each
      const steep = slideDown(xs.map((x) => 1 - x), 0.25 / n); // 1 m across 0.25 m of x: a steep ramp
      const gentle = slideDown(xs.map((x) => 1 - x), 4 / n); // 1 m down over 4 m: a gentle ramp
      const curved = slideDown(xs.map((x) => 1 - Math.sin((x * Math.PI) / 2)), 1.5 / n); // quarter-circle-ish bowl
      const lane = (label: string, color: string, r: ReturnType<typeof slideDown>) => ({ label, color, finish: r.time, at: r.fractionAt });
      return {
        scene: {
          kind: "race",
          duration: Math.max(steep.time, gentle.time, curved.time) * 1.05,
          lanes: [lane("Тік жол", ORANGE, steep), lane("Жайпақ еңіс", BLUE, gentle), lane("Иілген жол", VIOLET, curved)],
        },
        measurements: [
          { key: "v-steep", label: "Тік жолдың түбіндегі жылдамдық", value: steep.speed, unit: "м/с" },
          { key: "v-gentle", label: "Жайпақ еңістің түбіндегі жылдамдық", value: gentle.speed, unit: "м/с" },
          { key: "v-curve", label: "Иілген жолдың түбіндегі жылдамдық", value: curved.speed, unit: "м/с" },
          { key: "t-steep", label: "Тік жолдың уақыты", value: steep.time, unit: "с" },
          { key: "t-gentle", label: "Жайпақ еңістің уақыты", value: gentle.time, unit: "с" },
          { key: "t-curve", label: "Иілген жолдың уақыты", value: curved.time, unit: "с" },
        ],
      };
    },
    answerFrom: (o) => {
      const a = mval(o, "v-steep"), b = mval(o, "v-gentle"), c = mval(o, "v-curve");
      if (near(a, b, 1e-6) && near(b, c, 1e-6)) return "same";
      return a >= c ? "steep" : "curve";
    },
    explain: (o) =>
      `Үшеуі де түбіне ${fmt(mval(o, "v-steep"), 2)} м/с жылдамдықпен жетеді: үйкеліссіз жағдайда жылдамдықты тек биіктіктің айырмасы анықтайды (v = √(2gh)). Ал уақыттары әртүрлі: тік жол ${fmt(mval(o, "t-steep"), 2)} с, иілген ${fmt(mval(o, "t-curve"), 2)} с, жайпақ ${fmt(mval(o, "t-gentle"), 2)} с.`,
  },
  {
    id: "braking-distance",
    title: "Тоқтау жолы",
    lesson: 5,
    setup: "Көлік құрғақ асфальтта (μ = 0,7) 50 км/сағ жылдамдықпен келе жатып, дөңгелектерін құлыптап тежейді. Оның тоқтау жолы 14 м.",
    question: "Дәл солай, бірақ 100 км/сағ жылдамдықтан тежесе, тоқтау жолы қанша болады?",
    options: [
      { id: "x2", text: "Шамамен 2 есе ұзын (≈ 28 м)", misconception: "proportional-thinking" },
      { id: "x4", text: "Шамамен 4 есе ұзын (≈ 56 м)" },
      { id: "x8", text: "Шамамен 8 есе ұзын (≈ 112 м)", misconception: "exponent-overshoot" },
    ],
    correct: "x4",
    observe: () => {
      const s50 = brakingDistance(50 / 3.6, 0.7);
      const s100 = brakingDistance(100 / 3.6, 0.7);
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "s-50", label: "50 км/сағ-тан тоқтау жолы", value: s50, unit: "м" },
          { key: "s-100", label: "100 км/сағ-тан тоқтау жолы", value: s100, unit: "м" },
          { key: "ratio", label: "Қатынасы", value: s100 / s50, unit: "есе" },
        ],
      };
    },
    answerFrom: (o) => {
      const r = mval(o, "ratio");
      const opts: [string, number][] = [["x2", 2], ["x4", 4], ["x8", 8]];
      return opts.reduce((best, cur) => (Math.abs(Math.log(r / cur[1])) < Math.abs(Math.log(r / best[1])) ? cur : best))[0];
    },
    explain: (o) =>
      `Тоқтау жолы ${fmt(mval(o, "s-50"), 0)} м-ден ${fmt(mval(o, "s-100"), 0)} м-ге дейін, яғни ${fmt(mval(o, "ratio"), 1)} есе артады. Тежеу кезінде кинетикалық энергия mv²/2 үйкеліс жұмысына μmg·s айналады, сондықтан s ∝ v²: жылдамдық екі есе артса, жол төрт есе ұзарады.`,
  },
  {
    id: "spring-carts",
    title: "Серіппе мен екі арба",
    lesson: 6,
    setup: "Массасы 1 кг және 3 кг екі арба тыныш тұр, олардың арасында сығылған серіппе (12 Дж). Серіппе босатылып, арбалар әр жаққа кетті.",
    question: "Қай арба тезірек кетеді?",
    options: [
      { id: "light", text: "Жеңіл (1 кг) арба" },
      { id: "equal", text: "Екеуі бірдей жылдамдықпен", misconception: "equal-pushes-equal-speeds" },
      { id: "heavy", text: "Ауыр (3 кг) арба", misconception: "heavier-moves-more" },
    ],
    correct: "light",
    observe: () => {
      const m1 = 1, m2 = 3, E = 12;
      // Momentum is conserved (m1 v1 = m2 v2 in size) and the spring's energy becomes kinetic:
      // ½ m1 v1² + ½ m2 v2² = E  with  v1 = (m2/m1) v2
      const v2 = Math.sqrt((2 * E) / (m2 * (1 + m2 / m1)));
      const v1 = (m2 / m1) * v2;
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "v-light", label: "Жеңіл арбаның жылдамдығы", value: v1, unit: "м/с" },
          { key: "v-heavy", label: "Ауыр арбаның жылдамдығы", value: v2, unit: "м/с" },
          { key: "p-light", label: "Жеңіл арбаның импульсі", value: m1 * v1, unit: "кг·м/с" },
          { key: "p-heavy", label: "Ауыр арбаның импульсі", value: m2 * v2, unit: "кг·м/с" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "v-light"), mval(o, "v-heavy")) ? "equal" : mval(o, "v-light") > mval(o, "v-heavy") ? "light" : "heavy"),
    explain: (o) =>
      `Импульстер тең және қарама-қарсы (екеуі де ${fmt(mval(o, "p-light"), 2)} кг·м/с), сондықтан жылдамдық массаға кері пропорционал: жеңіл арба ${fmt(mval(o, "v-light"), 2)} м/с, ауыр арба ${fmt(mval(o, "v-heavy"), 2)} м/с — үш есе баяу.`,
  },
  {
    id: "egg-drop",
    title: "Жұмыртқа тастау",
    lesson: 6,
    setup: "Массасы 60 г жұмыртқа 1 м биіктіктен түседі: бірінші жағдайда тас еденге (тоқтау ≈ 0,002 с), екінші жағдайда қалың жастыққа (тоқтау ≈ 0,1 с).",
    question: "Қай жағдайда жұмыртқаға түсетін орташа күш көп?",
    options: [
      { id: "stone", text: "Тас едендегі" },
      { id: "pillow", text: "Жастықтағы", misconception: "soft-means-bigger-force" },
      { id: "same", text: "Екеуінде бірдей (құлау биіктігі бірдей)", misconception: "force-independent-of-time" },
    ],
    correct: "stone",
    observe: () => {
      const m = 0.06;
      const v = Math.sqrt(2 * G * 1); // speed at impact after 1 m
      const impulse = m * v; // both stops take the same momentum to zero
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "p", label: "Жұмыртқаның импульсі (соққы алдында)", value: impulse, unit: "кг·м/с" },
          { key: "f-stone", label: "Тастағы орташа күш", value: impulse / 0.002, unit: N },
          { key: "f-pillow", label: "Жастықтағы орташа күш", value: impulse / 0.1, unit: N },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "f-stone"), mval(o, "f-pillow")) ? "same" : mval(o, "f-stone") > mval(o, "f-pillow") ? "stone" : "pillow"),
    explain: (o) =>
      `Импульстің өзгерісі екі жағдайда бірдей (${fmt(mval(o, "p"), 2)} кг·м/с), бірақ F = Δp/Δt: тас үстінде тоқтау 50 есе қысқа, сондықтан күш ${fmt(mval(o, "f-stone"), 0)} Н-ға қарсы ${fmt(mval(o, "f-pillow"), 1)} Н. Жастық күшті азайтады — дәл белдік пен ауа жастығындай.`,
  },
  {
    id: "rolling-race",
    title: "Домалау жарысы",
    lesson: 7,
    setup: "Массасы да, радиусы да бірдей екі цилиндр — тұтас және жұқа қабырғалы қуыс — 20° еңіспен сырғанамай домалап 2 м түседі.",
    question: "Қайсысы бірінші түбіне жетеді?",
    options: [
      { id: "hollow", text: "Қуыс цилиндр", misconception: "hollow-is-lighter" },
      { id: "solid", text: "Тұтас цилиндр" },
      { id: "same", text: "Бір мезгілде", misconception: "same-mass-same-motion" },
    ],
    correct: "solid",
    observe: () => {
      const theta = (20 * Math.PI) / 180, s = 2;
      // A rolling body: a = g sinθ / (1 + I/(mR²)).  Solid cylinder I = ½mR²; thin hollow I = mR².
      const accel = (k: number) => (G * Math.sin(theta)) / (1 + k);
      const aSolid = accel(0.5), aHollow = accel(1);
      const tSolid = Math.sqrt((2 * s) / aSolid), tHollow = Math.sqrt((2 * s) / aHollow);
      const frac = (a: number) => (t: number) => Math.min(1, (0.5 * a * t * t) / s);
      return {
        scene: {
          kind: "race",
          duration: Math.max(tSolid, tHollow) * 1.05,
          lanes: [
            { label: "Қуыс цилиндр", color: ORANGE, finish: tHollow, at: frac(aHollow) },
            { label: "Тұтас цилиндр", color: BLUE, finish: tSolid, at: frac(aSolid) },
          ],
        },
        measurements: [
          { key: "t-solid", label: "Тұтас цилиндрдің уақыты", value: tSolid, unit: "с" },
          { key: "t-hollow", label: "Қуыс цилиндрдің уақыты", value: tHollow, unit: "с" },
          { key: "a-solid", label: "Тұтас цилиндрдің үдеуі", value: aSolid, unit: "м/с²" },
          { key: "a-hollow", label: "Қуыс цилиндрдің үдеуі", value: aHollow, unit: "м/с²" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "t-solid"), mval(o, "t-hollow")) ? "same" : mval(o, "t-solid") < mval(o, "t-hollow") ? "solid" : "hollow"),
    explain: (o) =>
      `Тұтас цилиндр ${fmt(mval(o, "t-solid"), 2)} с-та, қуыс цилиндр ${fmt(mval(o, "t-hollow"), 2)} с-та түседі. Массалар бірдей, бірақ қуыстың массасы шетте орналасқан — инерция моменті үлкен (mR² қарсы ½mR²), сондықтан потенциалдық энергияның көп бөлігі айналуға кетіп, үдеу аз.`,
  },
  {
    id: "skater-arms",
    title: "Мәнерлеп сырғанаушы",
    lesson: 7,
    setup: "Мұзда қолын жайып айналып тұрған сырғанаушы (I = 3,0 кг·м², ω = 2 рад/с) қолын денесіне қысады (I = 1,0 кг·м²).",
    question: "Оның айналу жылдамдығы не болады?",
    options: [
      { id: "slows", text: "Азаяды", misconception: "arms-in-slows" },
      { id: "same", text: "Өзгермейді", misconception: "angular-speed-constant" },
      { id: "speeds", text: "Артады" },
    ],
    correct: "speeds",
    observe: () => {
      const I1 = 3, I2 = 1, w1 = 2;
      // No outside torque: the angular momentum L = Iω is what stays the same
      const L = I1 * w1;
      const w2 = L / I2;
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "w-before", label: "Қолы жайылғанда ω", value: w1, unit: "рад/с" },
          { key: "w-after", label: "Қолы қысылғанда ω", value: w2, unit: "рад/с" },
          { key: "L", label: "Импульс моменті (екі жағдайда)", value: L, unit: "кг·м²/с" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "w-before"), mval(o, "w-after")) ? "same" : mval(o, "w-after") > mval(o, "w-before") ? "speeds" : "slows"),
    explain: (o) =>
      `Сыртқы күш моменті жоқ, сондықтан L = Iω = ${fmt(mval(o, "L"), 0)} кг·м²/с сақталады. I үш есе азайса, ω үш есе артады: ${fmt(mval(o, "w-before"), 0)} рад/с-тан ${fmt(mval(o, "w-after"), 0)} рад/с-қа дейін.`,
  },
  {
    id: "pendulum-mass",
    title: "Маятниктің массасы",
    lesson: 8,
    setup: "Ұзындығы 1 м жіптегі екі маятник: біреуінің жүгі 100 г, екіншісінің жүгі 500 г. Екеуі де кішкентай бұрышқа ауытқытылып жіберілді.",
    question: "Қайсысының тербеліс периоды үлкен?",
    options: [
      { id: "heavy-slow", text: "500 г жүктікі үлкен", misconception: "mass-affects-period" },
      { id: "heavy-fast", text: "100 г жүктікі үлкен", misconception: "mass-affects-period" },
      { id: "same", text: "Екеуінікі бірдей" },
    ],
    correct: "same",
    observe: () => {
      const tLight = pendulumPeriod(0.1, 1, G);
      const tHeavy = pendulumPeriod(0.5, 1, G);
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "t-light", label: "100 г жүктің периоды", value: tLight, unit: "с" },
          { key: "t-heavy", label: "500 г жүктің периоды", value: tHeavy, unit: "с" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "t-light"), mval(o, "t-heavy"), 1e-9) ? "same" : mval(o, "t-heavy") > mval(o, "t-light") ? "heavy-slow" : "heavy-fast"),
    explain: (o) =>
      `Екеуінің периоды да ${fmt(mval(o, "t-light"), 2)} с. Ауыр жүкті тартатын күш (mg) да, оның инерциясы (ml²) да массаға пропорционал, сондықтан масса теңдеуден түсіп қалады: T = 2π√(l/g).`,
  },
  {
    id: "pendulum-moon",
    title: "Маятник Айда",
    lesson: 8,
    setup: "Жерде периоды 2 с шамасындағы (l = 1 м) маятникті Айға әкелді (Айда g = 1,62 м/с²).",
    question: "Айда оның периоды қалай өзгереді?",
    options: [
      { id: "shorter", text: "Азаяды: маятник тезірек тербеледі", misconception: "weaker-gravity-faster" },
      { id: "same", text: "Өзгермейді", misconception: "period-independent-of-g" },
      { id: "longer", text: "Артады: маятник баяу тербеледі" },
    ],
    correct: "longer",
    observe: () => {
      const earth = pendulumPeriod(1, 1, G);
      const moon = pendulumPeriod(1, 1, G_MOON);
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "t-earth", label: "Жердегі период", value: earth, unit: "с" },
          { key: "t-moon", label: "Айдағы период", value: moon, unit: "с" },
          { key: "ratio", label: "Қатынасы", value: moon / earth, unit: "есе" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "t-earth"), mval(o, "t-moon"), 1e-6) ? "same" : mval(o, "t-moon") > mval(o, "t-earth") ? "longer" : "shorter"),
    explain: (o) =>
      `Период ${fmt(mval(o, "t-earth"), 2)} с-тан ${fmt(mval(o, "t-moon"), 2)} с-қа дейін, яғни ${fmt(mval(o, "ratio"), 1)} есе артады. T = 2π√(l/g): g 6 есе аз болса, T ≈ √6 ≈ 2,45 есе артады. Қайтарушы күш әлсіреген сайын тербеліс баяулайды.`,
  },
  {
    id: "melting-ice",
    title: "Еріген мұз",
    lesson: 9,
    setup: "Стакан жиегіне дейін таза сумен толтырылған. Онда мұз кесегі (90 г) жүзіп тұр, оның бір бөлігі судан шығып тұр.",
    question: "Мұз толық еріген кезде не болады?",
    options: [
      { id: "overflow", text: "Су стақаннан тасып кетеді", misconception: "ice-expands-overflow" },
      { id: "same", text: "Су деңгейі өзгермейді" },
      { id: "drops", text: "Су деңгейі төмендейді", misconception: "melting-shrinks" },
    ],
    correct: "same",
    observe: () => {
      const m = 90e-3; // kg
      const rho = 1000;
      // Floating: weight = buoyancy  →  ρ V_displaced g = m g
      const displaced = (m / rho) * 1e6; // cm³
      // Melted: the ice becomes water of the same mass
      const melted = (m / rho) * 1e6;
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "v-displaced", label: "Жүзіп тұрған мұз ығыстырған су", value: displaced, unit: "см³" },
          { key: "v-melted", label: "Еріген мұздан шыққан су", value: melted, unit: "см³" },
          { key: "dv", label: "Деңгей өзгерісі (көлем)", value: melted - displaced, unit: "см³" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "dv"), 0, 1e-9) || Math.abs(mval(o, "dv")) < 1e-9 ? "same" : mval(o, "dv") > 0 ? "overflow" : "drops"),
    explain: (o) =>
      `Жүзіп тұрған мұз өз салмағындай су ығыстырады: ${fmt(mval(o, "v-displaced"), 0)} см³. Еріген кезде массасы сақталады, ол дәл ${fmt(mval(o, "v-melted"), 0)} см³ су болады — ығыстырылған көлемді дәл толтырады. Деңгей өзгермейді, су тасымайды.`,
  },
  {
    id: "vessels",
    title: "Үш ыдыстағы қысым",
    lesson: 9,
    setup: "Түбінің ауданы бірдей үш ыдыс: жоғары қарай кеңейетін, тік цилиндр және жоғары қарай тарылатын. Үшеуінде де су деңгейі 30 см.",
    question: "Қай ыдыстың түбіндегі су қысымы көп?",
    options: [
      { id: "wide", text: "Жоғары қарай кеңейетінде (су көп)", misconception: "more-water-more-pressure" },
      { id: "same", text: "Үшеуінде бірдей" },
      { id: "narrow", text: "Жоғары қарай тарылатынында", misconception: "narrow-more-pressure" },
    ],
    correct: "same",
    observe: () => {
      const h = 0.3, rho = 1000, A0 = 0.01;
      // Volume of each vessel (top area differs), weight of its water, and the pressure at the bottom
      const volume = (Atop: number) => (h / 3) * (A0 + Math.sqrt(A0 * Atop) + Atop); // frustum
      const vWide = volume(0.03), vCyl = A0 * h, vNarrow = volume(0.0033);
      const pressure = () => rho * G * h; // ρ g h: depth, and nothing else
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "p-wide", label: "Кеңейетін ыдыстың түбіндегі қысым", value: pressure(), unit: "Па" },
          { key: "p-cyl", label: "Цилиндрдің түбіндегі қысым", value: pressure(), unit: "Па" },
          { key: "p-narrow", label: "Тарылатын ыдыстың түбіндегі қысым", value: pressure(), unit: "Па" },
          { key: "w-wide", label: "Кеңейетін ыдыстағы судың салмағы", value: rho * vWide * G, unit: N },
          { key: "w-cyl", label: "Цилиндрдегі судың салмағы", value: rho * vCyl * G, unit: N },
          { key: "w-narrow", label: "Тарылатын ыдыстағы судың салмағы", value: rho * vNarrow * G, unit: N },
        ],
      };
    },
    answerFrom: (o) => {
      const a = mval(o, "p-wide"), b = mval(o, "p-cyl"), c = mval(o, "p-narrow");
      if (near(a, b) && near(b, c)) return "same";
      return a > c ? "wide" : "narrow";
    },
    explain: (o) =>
      `Түптегі қысым үшеуінде де ${fmt(mval(o, "p-cyl"), 0)} Па: p = ρgh тек тереңдікке байланысты. Судың салмағы әртүрлі (${fmt(mval(o, "w-narrow"), 0)}, ${fmt(mval(o, "w-cyl"), 0)} және ${fmt(mval(o, "w-wide"), 0)} Н), бірақ қиғаш қабырғалар да судың бір бөлігін көтеріп тұрады.`,
  },
  {
    id: "lever-balance",
    title: "Тепе-теңдік тақтайы",
    lesson: 10,
    setup: "Салмақсыз тақтай ортасынан тіреуге қойылған. Сол жақта тіректен 0,3 м қашықтықта 2 кг жүк, оң жақта 0,6 м қашықтықта 1 кг жүк тұр.",
    question: "Тақтай не істейді?",
    options: [
      { id: "left", text: "Сол жағы (ауыр жүк) түседі", misconception: "heavier-side-down" },
      { id: "balance", text: "Тепе-теңдікте қалады" },
      { id: "right", text: "Оң жағы (алыс жүк) түседі", misconception: "farther-side-down" },
    ],
    correct: "balance",
    observe: () => {
      const left = 2 * G * 0.3, right = 1 * G * 0.6; // moment = F·d about the pivot
      return {
        scene: { kind: "bars" },
        measurements: [
          { key: "m-left", label: "Сол жақтың моменті", value: left, unit: "Н·м" },
          { key: "m-right", label: "Оң жақтың моменті", value: right, unit: "Н·м" },
        ],
      };
    },
    answerFrom: (o) => (near(mval(o, "m-left"), mval(o, "m-right")) ? "balance" : mval(o, "m-left") > mval(o, "m-right") ? "left" : "right"),
    explain: (o) =>
      `Екі жақтың моменті бірдей: ${fmt(mval(o, "m-left"), 2)} Н·м (M = F·d). Жүк екі есе жеңіл, бірақ екі есе алыс — моменттер теңелді. Сондықтан тақтай тепе-теңдікте тұрады.`,
  },
];

export const itemsForLesson = (lesson: number) => PREDICT_ITEMS.filter((i) => i.lesson === lesson);
export const itemById = (id: string) => PREDICT_ITEMS.find((i) => i.id === id);
