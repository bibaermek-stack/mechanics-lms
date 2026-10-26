// The levels of the roller-coaster builder: what is fixed, what the student may move,
// and how a run is judged. Pure — the page only draws it. Each level's thresholds were
// set against what the physics actually allows (see coasterLevels.test.ts, which keeps a
// reference solution for every star), not guessed.

import { G, pchip, simulate, type Pt, type Run } from "./coaster";

/** Seven control points, four metres apart. */
export const TRACK_X = [0, 4, 8, 12, 16, 20, 24] as const;
export const POINTS = TRACK_X.length;
export const Y_MIN = 0.5;
export const Y_MAX = 12;
export const Y_STEP = 0.1;
export const CART_MASS = 500;
/** The lesson (work and energy) whose games include the builder. */
export const COASTER_LESSONS = [5];
/** The track may "pull" the cart by this much (in g) before it counts as the cart leaving the rails. */
export const LIFT_TOLERANCE = 0.05;

export type Goal =
  | { kind: "reach"; /** start height for 3 / 2 stars, m */ star3: number; star2: number }
  | { kind: "speed"; target: number; tol3: number; tol2: number; tol1: number }
  | { kind: "stop"; zone: [number, number]; tol3: number; tol2: number }
  | { kind: "safe"; /** top speed it must reach, m/s: a dull ride is no answer */ minSpeed: number; star3: number; star2: number; star1: number }
  | { kind: "airtime"; star3: number; star2: number; star1: number };

export interface Level {
  id: string;
  title: string;
  /** What the student is asked to do, in a sentence or two. */
  task: string;
  /** What to think about. */
  hint: string;
  mu: number;
  /** Heights that cannot be moved, by control-point index. */
  locked: Record<number, number>;
  /** Where the movable points start. */
  initial: number[];
  goal: Goal;
  hard?: boolean;
}

export const LEVELS: Level[] = [
  {
    id: "hill",
    title: "Төбеден асу",
    task: "Вагонша бастапқы нүктеден жүріп, мәреге (оң жақ шет) жетуі керек. Ортада биіктігі 5 м төбе бар. Бастапқы нүктені мүмкіндігінше төмен ал: көтергіш биік болған сайын электр көп жұмсалады.",
    hint: "Үйкеліс жоқ. Вагонша бастапқы биіктіктен жоғары көтерілмейді. Ең болмағанда қанша биіктік керек?",
    mu: 0,
    locked: { 3: 5, 6: 1 },
    initial: [4, 3, 2, 5, 2, 1.5, 1],
    goal: { kind: "reach", star3: 5.7, star2: 7 },
  },
  {
    id: "friction",
    title: "Үйкеліс бар",
    task: "Енді рельс үйкеледі (μ = 0,1). Екі төбе бар: 3 және 4 метр. Мәреге жету үшін бастапқы нүкте қаншалықты биік болуы керек?",
    hint: "Үйкеліс энергияны жылуға айналдырады. Жол неғұрлым ұзын және қисық болса, жылу соғұрлым көп.",
    mu: 0.1,
    locked: { 2: 3, 4: 4, 6: 1 },
    initial: [5, 2, 3, 1, 4, 1.5, 1],
    goal: { kind: "reach", star3: 6.2, star2: 7.5 },
  },
  {
    id: "speed",
    title: "Жылдамдық нысанасы",
    task: "Мәреден вагонша 12 м/с жылдамдықпен өтуі керек (қателік ±0,3 м/с жақсы, ±0,8 — жаман емес). Бастапқы биіктікті есептеп тап. Мәре биіктігі 1 м, үйкеліс жоқ.",
    hint: "mgh = ½mv² + mg·h₁. Бастапқы биіктік неге тең? Жолдың пішіні маңызды ма?",
    mu: 0,
    locked: { 6: 1 },
    initial: [6, 4, 3, 2, 1.5, 1.2, 1],
    goal: { kind: "speed", target: 12, tol3: 0.3, tol2: 0.8, tol1: 2 },
  },
  {
    id: "stop",
    title: "Дәл тоқта",
    task: "Вагонша мәреге жетпей, жасыл аймақта (18–22 м) толық тоқтауы керек. Рельс үйкеледі (μ = 0,15). Аймақтың ортасына жақын тоқтасаң — көп жұлдыз.",
    hint: "Жазық жерде вагонша тоқтағанша жылу = үйкеліс күші × жол. Бастапқы энергияның қанша бөлігі жылуға кетеді?",
    mu: 0.15,
    locked: { 4: 0.5, 5: 0.5, 6: 0.5 },
    initial: [4, 2, 1.5, 1, 0.5, 0.5, 0.5],
    goal: { kind: "stop", zone: [18, 22], tol3: 0.4, tol2: 1 },
  },
  {
    id: "safe",
    title: "Қауіпсіз аттракцион",
    task: "Жолаушыларға қызық болу үшін вагонша кемінде 12 м/с жылдамдыққа жетіп, мәреге жетуі керек. Бірақ сүйеніш қысымы (G-күш) қауіпсіз болсын: 3 g-ден аз болса — үздік, 7 g-ден асса — қауіпті!",
    hint: "Аңғарда G = 1 + v²/(g·R). Тік құлама өте үлкен G береді. Биіктікті бірнеше сатымен түсір: жол біртіндеп тегістелсін.",
    mu: 0.02,
    locked: { 6: 1 },
    initial: [10, 3, 2, 1.5, 1, 1, 1],
    goal: { kind: "safe", minSpeed: 12, star3: 3, star2: 4.5, star1: 7 },
    hard: true,
  },
  {
    id: "airtime",
    title: "Салмақсыздық",
    task: "Жолдың бір жерінде жолаушылар дерлік салмақсыз болуы керек (G 0-ге жақын: 0,1-ден аз), бірақ вагон рельстен ажырамасын (G < 0 — рельстен ұшып кетер еді). Мәреге жет.",
    hint: "Төбеден жоғары жылдамдықпен өткенде G = 1 − v²/(g·R). v² = g·R болса G = 0. Төбені тегіс (R үлкен) ете аласың ба?",
    mu: 0,
    locked: { 6: 1 },
    initial: [10, 3, 8, 2, 2, 1.5, 1],
    goal: { kind: "airtime", star3: 0.1, star2: 0.25, star1: 0.5 },
    hard: true,
  },
];

export const levelById = (id: string) => LEVELS.find((l) => l.id === id);

/** The control points a level's heights give. */
export function pointsFor(ys: readonly number[]): Pt[] {
  return TRACK_X.map((x, i) => ({ x, y: ys[i] }));
}

/** The heights with the locked ones forced back and every height held inside the allowed range and on the grid. */
export function normalise(level: Level, ys: readonly number[]): number[] {
  return ys.map((y, i) => {
    const locked = level.locked[i];
    if (locked !== undefined) return locked;
    const v = Number.isFinite(y) ? y : Y_MIN;
    return Math.round(Math.min(Y_MAX, Math.max(Y_MIN, v)) / Y_STEP) * Y_STEP;
  }).map((v) => Math.round(v * 1e6) / 1e6);
}

export interface Verdict {
  stars: 0 | 1 | 2 | 3;
  run: Run;
  /** What happened and why, in the student's language. */
  lines: string[];
}

const f1 = (n: number) => n.toFixed(1).replace(".", ",");
const f2 = (n: number) => n.toFixed(2).replace(".", ",");

/** Runs a track and judges it against the level's goal. */
export function evaluate(level: Level, ys: readonly number[]): Verdict {
  const heights = normalise(level, ys);
  const run = simulate(pchip(pointsFor(heights)), { mu: level.mu, mass: CART_MASS, tMax: 40 });
  const g = level.goal;
  const lines: string[] = [];
  const done = run.status === "finished";
  const lifted = run.minG < -LIFT_TOLERANCE;
  const star = (n: 0 | 1 | 2 | 3): Verdict => ({ stars: n, run, lines });

  const notFinished = () => {
    if (run.status === "stopped") lines.push(`Вагонша ${f1(run.endX)} м жерде тоқтап қалды: мәреге (24 м) жетпеді. Энергия жетпеді.`);
    else lines.push(`Вагонша ${f1(run.maxX)} м жерге дейін барып, кері қайтты. Төбеден асатын энергия жетпеді.`);
  };

  switch (g.kind) {
    case "reach": {
      if (!done) {
        notFinished();
        return star(0);
      }
      const y0 = heights[0];
      lines.push(`Мәреге жетті. Бастапқы биіктік: ${f1(y0)} м. Жылу: ${f1(run.heat / 1000)} кДж.`);
      const n = y0 <= g.star3 ? 3 : y0 <= g.star2 ? 2 : 1;
      if (n < 3) lines.push(`Төменірек болса да болады: ${f1(g.star3)} м-ге дейін төмендетіп көр.`);
      return star(n);
    }
    case "speed": {
      if (!done) {
        notFinished();
        return star(0);
      }
      const err = Math.abs(run.endSpeed - g.target);
      lines.push(`Мәредегі жылдамдық: ${f2(run.endSpeed)} м/с (нысана ${f1(g.target)} м/с, айырмасы ${f2(err)}).`);
      if (err > g.tol1) lines.push(run.endSpeed > g.target ? "Тым жылдам: бастапқы нүктені төмендет." : "Тым баяу: бастапқы нүктені көтер.");
      return star(err <= g.tol3 ? 3 : err <= g.tol2 ? 2 : err <= g.tol1 ? 1 : 0);
    }
    case "stop": {
      const [a, b] = g.zone;
      if (done) {
        lines.push("Вагонша мәреден өтіп кетті. Тоқтау үшін энергия артық: бастапқы нүктені төмендет.");
        return star(0);
      }
      if (run.status !== "stopped") {
        lines.push("Вагонша тоқтамады: ол төбеден кері қайтып, тербеліп жүр. Бірінші төбені төмендет.");
        return star(0);
      }
      const mid = (a + b) / 2, off = Math.abs(run.endX - mid);
      lines.push(`Вагонша ${f2(run.endX)} м жерде тоқтады (аймақ ${a}–${b} м, ортасы ${mid} м).`);
      if (run.endX < a) lines.push("Аймаққа жетпей тоқтады: энергия аз.");
      if (run.endX > b) lines.push("Аймақтан асып тоқтады: энергия көп.");
      if (run.endX < a || run.endX > b) return star(0);
      return star(off <= g.tol3 ? 3 : off <= g.tol2 ? 2 : 1);
    }
    case "safe": {
      if (!done) {
        notFinished();
        return star(0);
      }
      lines.push(`Ең үлкен жылдамдық: ${f1(run.maxSpeed)} м/с. Ең үлкен G-күш: ${f1(run.maxG)} g. Ең кіші: ${f1(run.minG)} g.`);
      if (lifted) {
        lines.push(`${f1(run.liftOffAt ?? 0)} м жерде вагонша рельстен ажырап кетер еді (G < 0): ол жерді тегістеу керек.`);
        return star(0);
      }
      if (run.maxSpeed < g.minSpeed) {
        lines.push(`Тым баяу: кемінде ${f1(g.minSpeed)} м/с керек. Бастапқы нүктені көтер.`);
        return star(0);
      }
      const m = run.maxG;
      if (m > g.star1) lines.push("Бұл жолаушыларға тым қауіпті: аңғарды тегістеп, құламаны жұмсарт.");
      return star(m <= g.star3 ? 3 : m <= g.star2 ? 2 : m <= g.star1 ? 1 : 0);
    }
    case "airtime": {
      if (!done) {
        notFinished();
        return star(0);
      }
      lines.push(`Ең кіші G-күш: ${f2(run.minG)} g (${f1(run.frames.reduce((p, q) => (q.gForce < p.gForce ? q : p)).x)} м шамасында).`);
      if (lifted) {
        lines.push("G < 0: вагонша рельстен ұшып кетер еді. Төбені сәл тегістеп көр.");
        return star(0);
      }
      const m = run.minG;
      if (m > g.star1) lines.push("Әлі салмағы бар: төбені өткірлеу немесе вагонды жылдамдату керек.");
      return star(m <= g.star3 ? 3 : m <= g.star2 ? 2 : m <= g.star1 ? 1 : 0);
    }
  }
}

/** Total of the best stars over all levels, and the 0–100 score the game saves. */
export function scoreOf(best: Record<string, number>): { stars: number; score: number } {
  const stars = LEVELS.reduce((a, l) => a + (best[l.id] ?? 0), 0);
  return { stars, score: Math.round((stars / (LEVELS.length * 3)) * 100) };
}

export { G };
