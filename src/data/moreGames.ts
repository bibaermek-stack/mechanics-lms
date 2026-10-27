// Three more games, built from what every lesson already has.
//
// Like the other derived games (src/data/gameContent.ts) each board is a pure
// function of (lesson, seed): the same seed is the same board, which is what lets
// a duel give two friends identical cards. And like them, nothing here is
// authored per lesson — a new quiz question, a new film chapter or a new formula
// makes the games longer without touching this file.
//
//   True or false   the quiz bank, turned inside out: instead of "pick the
//                   answer" the student is shown one and judges it.
//   Put in order    the chapters of the lesson's film, shuffled.
//   Problem blitz   numerical problems from the formula bank, with answers that
//                   come from the same verified solvers the Problems page uses.

import type { LessonModule } from "@/lib/types";
import { seededRandom, seededShuffle } from "@/lib/rng";
import { FORMULAS, type Formula, type FormulaVar } from "./formulas";
import { LESSON_SCRIPTS } from "./lessonVideos";

// ---------------------------------------------------------------------------
// True or false
// ---------------------------------------------------------------------------

export interface TrueFalseCard {
  id: string;
  /** The question as the quiz asks it. */
  prompt: string;
  /** The answer being proposed — right or wrong. */
  claim: string;
  isTrue: boolean;
  /** Shown after the answer. For a false claim it also names the right answer. */
  explanation: string;
}

export interface TrueFalseBoard {
  cards: TrueFalseCard[];
  /** Seconds to decide on one card. */
  perCard: number;
}

export const TRUEFALSE_CARDS = 12;

/**
 * Twelve questions from the lesson's bank, each with an answer attached: the
 * right one for half the deck, a wrong one for the other half.
 *
 * Exactly half and half, not a coin per card: a deck that happens to be mostly
 * "true" rewards pressing one button, and a duel on it would be decided by luck.
 */
export function buildTrueFalse(mod: LessonModule, seed: number): TrueFalseBoard | null {
  if (mod.quiz.length < 6) return null;
  const rnd = seededRandom(seed);
  const picked = seededShuffle(mod.quiz, rnd).slice(0, TRUEFALSE_CARDS);
  const flags = seededShuffle(
    picked.map((_, i) => i < Math.ceil(picked.length / 2)),
    rnd
  );
  const cards = picked.map((q, i): TrueFalseCard => {
    const correct = q.options[q.correctIndex];
    const wrongs = q.options.filter((_, k) => k !== q.correctIndex);
    const isTrue = flags[i];
    return {
      id: q.id,
      prompt: q.question,
      claim: isTrue ? correct : wrongs[Math.floor(rnd() * wrongs.length)],
      isTrue,
      explanation: isTrue ? q.explanation : `Дұрыс жауап: ${correct}. ${q.explanation}`,
    };
  });
  return { cards, perCard: 12 };
}

// ---------------------------------------------------------------------------
// Put in order
// ---------------------------------------------------------------------------

export interface OrderItem {
  id: string;
  text: string;
}

export interface OrderBoard {
  /** The cards as they are laid out on the table — never already in order. */
  items: OrderItem[];
  /** The ids in the order the lesson tells them. */
  answer: string[];
}

export const ORDER_STEPS = 6;

/**
 * Six of the lesson film's chapters, shuffled. The film is the lesson told in
 * the order that makes sense — definition before example, example before the
 * summary — so putting its chapters back is a way of recalling how the topic is
 * built, not just what it contains.
 */
export function buildOrder(mod: LessonModule, seed: number): OrderBoard | null {
  const script = LESSON_SCRIPTS[mod.id];
  if (!script || script.chapters.length < 4) return null;
  const rnd = seededRandom(seed);
  const chosen = seededShuffle(script.chapters, rnd)
    .slice(0, Math.min(ORDER_STEPS, script.chapters.length))
    .sort((a, b) => a.from - b.from);
  const answer = chosen.map((c) => c.id);
  let items = seededShuffle(
    chosen.map((c) => ({ id: c.id, text: c.caption })),
    rnd
  );
  // A shuffle can come out sorted. A board that starts solved is not a game.
  if (items.every((it, i) => it.id === answer[i])) items = [...items.slice(1), items[0]];
  return { items, answer };
}

// ---------------------------------------------------------------------------
// Problem blitz
// ---------------------------------------------------------------------------

export interface BlitzGiven {
  sym: string;
  name: string;
  unit: string;
  value: number;
}

export interface BlitzProblem {
  formulaId: string;
  title: string;
  /** The equation as written on the board. */
  expr: string;
  given: BlitzGiven[];
  unknown: { sym: string; name: string; unit: string };
  /** The exact answer from the solver. */
  answer: number;
  /** Decimals the answer and the options are written with. */
  decimals: number;
  /** True when the answer is irrational and has been rounded (π, √). */
  approx: boolean;
  /** Four values, already rounded to `decimals`. */
  options: number[];
  correctIndex: number;
}

export interface BlitzBoard {
  problems: BlitzProblem[];
  /** Seconds to answer one problem. */
  perProblem: number;
}

export const BLITZ_ROUNDS = 8;
const MAX_APPROX = 3;

/** Left out: the answers are never round (sin, cos) so every option would be a guess at digits. */
const NOT_FOR_BLITZ = new Set(["incline", "young"]);

/**
 * The only formulas allowed an answer that is written rounded: they contain π, so
 * no choice of numbers makes them come out even. Everywhere else a problem is
 * only offered if its answer is exact — "1,67" for 5/3 would make the right
 * option a matter of how the rounding fell rather than of the physics.
 */
const ROUNDED_OK = new Set(["pendulum", "spring-pendulum", "angular-velocity"]);

/**
 * Values a variable may be given, by what it is. Realistic magnitudes — a person
 * of 45 kg, a cart at 6 m/s, water at 1000 kg/m³ — so the problem reads like
 * physics and not like a random-number generator.
 */
const POOLS: Record<string, number[]> = {
  "кг": [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 40, 50],
  "м/с": [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
  "м/с²": [1, 2, 3, 4, 5, 6, 8, 10],
  "Н": [10, 15, 20, 25, 30, 40, 50, 60, 80, 100],
  "с": [1, 2, 3, 4, 5, 6, 8, 10],
  "м": [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20],
  "Дж": [10, 20, 25, 40, 50, 60, 80, 100, 200],
  "Вт": [10, 20, 50, 100, 200, 500],
  "Па": [100, 500, 1000, 2000, 5000, 10000],
  "кг/м³": [800, 1000, 1200, 2700],
  "м³": [0.001, 0.002, 0.004, 0.005, 0.01],
  "м²": [0.001, 0.002, 0.005, 0.01, 0.02],
  "Н/м": [50, 100, 200, 250, 500],
  "кг·м/с": [2, 4, 5, 6, 8, 10, 12, 15, 20],
  "°": [0, 60],
  "рад/с": [1, 2, 3, 4, 5, 6, 8, 10],
  "рад/с²": [1, 2, 3, 4, 5],
  "кг·м²": [0.5, 1, 2, 3, 4, 5],
  "Н·м": [5, 10, 12, 15, 20, 25, 40],
  "%": [20, 25, 40, 50, 60, 75, 80],
};

/** Exceptions to the table above, where the unit alone says too little. */
const POOL_OVERRIDES: Record<string, number[]> = {
  "friction.mu": [0.1, 0.2, 0.25, 0.3, 0.4, 0.5],
  "strain.eps": [0.001, 0.002, 0.005],
  "strain.dl": [0.001, 0.002, 0.004, 0.005],
  "strain.l": [1, 2, 4, 5],
  "stress.F": [100, 200, 500, 1000, 2000],
  "pendulum.l": [1, 2, 4, 5, 10],
  "pendulum.T": [1, 2, 3, 4],
  "spring-pendulum.T": [1, 2, 3, 4],
  "angular-velocity.T": [1, 2, 4, 5],
};

function poolFor(formulaId: string, v: FormulaVar): number[] {
  if (v.sym === "g") return [10];
  return POOL_OVERRIDES[`${formulaId}.${v.sym}`] ?? POOLS[v.unit] ?? [1, 2, 3, 4, 5, 6, 8, 10];
}

/** The fewest decimals that write `n` exactly (up to four), or `null` if there is none. */
export function exactDecimals(n: number, max = 4): number | null {
  for (let d = 0; d <= max; d++) {
    if (Math.abs(n - Number(n.toFixed(d))) < 1e-9 * Math.max(1, Math.abs(n))) return d;
  }
  return null;
}

/** A value the student could not reasonably be asked for: not positive, silly in size, or over 100 %. */
function sensible(v: FormulaVar, answer: number): boolean {
  if (!Number.isFinite(answer) || answer <= 0) return false;
  if (answer > 5e6 || answer < 0.0005) return false;
  if (v.unit === "%" && answer > 100) return false;
  return true;
}

function makeProblem(
  f: Formula,
  unknownSym: string,
  rnd: () => number,
  allowApprox: boolean
): BlitzProblem | null {
  const unknown = f.vars.find((v) => v.sym === unknownSym)!;
  const givenVars = f.vars.filter((v) => v.sym !== unknownSym);

  for (let attempt = 0; attempt < 60; attempt++) {
    const given: BlitzGiven[] = givenVars.map((v) => {
      const pool = poolFor(f.id, v);
      return { sym: v.sym, name: v.name, unit: v.unit, value: pool[Math.floor(rnd() * pool.length)] };
    });
    const answer = f.solve[unknownSym](Object.fromEntries(given.map((g) => [g.sym, g.value])));
    if (!sensible(unknown, answer)) continue;

    let decimals = exactDecimals(answer);
    let approx = false;
    if (decimals === null) {
      // Irrational (π, a square root): write it to the hundredth, say so, and
      // allow only a few of these in a game.
      if (!allowApprox || !ROUNDED_OK.has(f.id) || answer < 0.05) continue;
      decimals = 2;
      approx = true;
    }
    const rounded = Number(answer.toFixed(decimals));
    if (rounded <= 0) continue;

    // Wrong answers: what you get by combining the given numbers the wrong way,
    // then plain scalings. Rounded like the right answer, never equal to it.
    const [a, b] = given.map((g) => g.value);
    const slips =
      given.length >= 2
        ? [a * b, a / b, b / a, a + b, Math.abs(a - b), rounded * 2, rounded / 2, rounded * 10, rounded / 10]
        : [rounded * 2, rounded / 2, rounded * 10, rounded / 10, rounded + 1];
    const seen = new Set<number>([rounded]);
    const wrong: number[] = [];
    for (const s of slips) {
      const v = Number(s.toFixed(decimals));
      if (!Number.isFinite(v) || v <= 0 || seen.has(v)) continue;
      seen.add(v);
      wrong.push(v);
    }
    if (wrong.length < 3) continue;
    // Which three of the tempting ones, in what place: a fixed rule would be learnable.
    const options = seededShuffle([rounded, ...seededShuffle(wrong.slice(0, 6), rnd).slice(0, 3)], rnd);

    return {
      formulaId: f.id,
      title: f.title,
      expr: f.expr,
      given,
      unknown: { sym: unknown.sym, name: unknown.name, unit: unknown.unit },
      answer,
      decimals,
      approx,
      options,
      correctIndex: options.indexOf(rounded),
    };
  }
  return null;
}

/**
 * Eight numerical problems from the formulas of this lesson. A lesson without
 * formulas (the introduction) has no blitz.
 *
 * The answers are never typed in: they are `solve[unknown](given)` from
 * src/data/formulas.ts, whose every inverse is tested against a worked example.
 */
export function buildBlitz(mod: LessonModule, seed: number): BlitzBoard | null {
  const formulas = FORMULAS.filter((f) => f.moduleIds.includes(mod.id) && !NOT_FOR_BLITZ.has(f.id));
  if (formulas.length === 0) return null;
  const rnd = seededRandom(seed);

  // Go round the lesson's formulas in a shuffled order, picking the unknown at
  // random each time, so eight problems are eight different questions where possible.
  const order = seededShuffle(formulas, rnd);
  const problems: BlitzProblem[] = [];
  const asked = new Set<string>();
  let approxUsed = 0;

  for (let i = 0; problems.length < BLITZ_ROUNDS && i < BLITZ_ROUNDS * 6; i++) {
    const f = order[i % order.length];
    // The angle is never asked for: acos of a random ratio is never a round number.
    const unknowns = Object.keys(f.solve).filter((k) => k !== "alpha");
    const unknownSym = unknowns[Math.floor(rnd() * unknowns.length)];
    const p = makeProblem(f, unknownSym, rnd, approxUsed < MAX_APPROX);
    if (!p) continue;
    const key = `${p.formulaId}|${p.unknown.sym}|${p.given.map((g) => g.value).join(",")}`;
    if (asked.has(key)) continue;
    asked.add(key);
    if (p.approx) approxUsed++;
    problems.push(p);
  }
  return problems.length >= 4 ? { problems, perProblem: 40 } : null;
}
