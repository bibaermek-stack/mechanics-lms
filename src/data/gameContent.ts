// Builds each game's board from the lesson's own material.
//
// The alternative was to hand-author ten content blocks per lesson — a hundred
// datasets that would silently drift out of step with the glossary they were
// copied from. Instead every board is derived from what the lesson already
// declares (glossary, key concepts, quiz), so editing a definition updates the
// crossword, the word search and the fill-in-the-blank at once. That also means
// teacher edits (step 3) flow into the games for free.
//
// Every builder is a pure function of (module, seed): the same seed gives the
// same board, which is what makes a duel between two friends fair.

import type { LessonModule, QuizQuestion } from "@/lib/types";
import { seededPick, seededRandom, seededShuffle } from "@/lib/rng";
import { lessonGlossary } from "./glossaryExtra";

// ---------------------------------------------------------------------------
// Term classification — the one thing the lesson data cannot imply
// ---------------------------------------------------------------------------

export type TermCategory = "Шама" | "Заң" | "Ұғым" | "Құбылыс";

/**
 * What kind of thing each glossary term *is*. Written once for the whole
 * vocabulary rather than per lesson, because a term means the same thing in
 * lesson 3 as in lesson 8 — and a per-lesson copy would be ten chances to
 * classify "Импульс" differently.
 */
const TERM_CATEGORY: Record<string, TermCategory> = {
  // Шама — measurable quantities
  Жылдамдық: "Шама",
  Үдеу: "Шама",
  "Орын ауыстыру": "Шама",
  Күш: "Шама",
  Масса: "Шама",
  Салмақ: "Шама",
  Жұмыс: "Шама",
  Қуат: "Шама",
  "Кинетикалық энергия": "Шама",
  "Потенциалдық энергия": "Шама",
  Импульс: "Шама",
  "Бұрыштық жылдамдық": "Шама",
  "Центрге тартқыш үдеу": "Шама",
  "Инерция моменті": "Шама",
  Амплитуда: "Шама",
  Период: "Шама",
  Жиілік: "Шама",
  Қысым: "Шама",
  Кернеу: "Шама",
  "Иілу моменті": "Шама",
  "Тең әсерлі күш": "Шама",

  // Заң — laws and principles
  "Импульстің сақталу заңы": "Заң",
  "Архимед заңы": "Заң",
  "Паскаль заңы": "Заң",
  "Әсер және кері әсер": "Заң",
  Инерция: "Заң",

  // Ұғым — concepts, models, branches
  Механика: "Ұғым",
  "Материалдық нүкте": "Ұғым",
  "Санақ жүйесі": "Ұғым",
  Траектория: "Ұғым",
  Статика: "Ұғым",
  Динамика: "Ұғым",
  "Инерциялық жүйе": "Ұғым",
  "Математикалық маятник": "Ұғым",

  // Құбылыс — kinds of motion and events
  "Бірқалыпты қозғалыс": "Құбылыс",
  "Бірқалыпты үдемелі қозғалыс": "Құбылыс",
  "Еркін түсу": "Құбылыс",
  "Серпімді соққы": "Құбылыс",
  "Серпімсіз соққы": "Құбылыс",
  "Реактивті қозғалыс": "Құбылыс",
  Резонанс: "Құбылыс",
  "Гармониялық тербеліс": "Құбылыс",
  "Өшетін тербеліс": "Құбылыс",
  Созылу: "Құбылыс",
  Деформация: "Құбылыс",

  // Additions from glossaryExtra
  "Ауырлық күші": "Шама",
  "Үйкеліс күші": "Шама",
  "Серпімділік күші": "Шама",
  "Тірек реакциясы": "Шама",
  "Күш импульсі": "Шама",
  "Күш моменті": "Шама",
  "Бұрыштық үдеу": "Шама",
  "Айналу периоды": "Шама",
  "Импульс моменті": "Шама",
  "Центрден тепкіш күш": "Шама",
  "Механикалық энергия": "Шама",
  "Пайдалы әсер коэффициенті": "Шама",
  Тығыздық: "Шама",
  "Гидростатикалық қысым": "Шама",
  "Кері итеруші күш": "Шама",
  "Серпімділік модулі": "Шама",
  "Беріктік қоры": "Шама",
  "Инерция радиусы": "Шама",
  Фаза: "Шама",
  Жол: "Шама",
  "Лездік жылдамдық": "Шама",

  "Энергияның сақталу заңы": "Заң",
  "Ньютонның екінші заңы": "Заң",
  "Гук заңы": "Заң",
  "Бернулли теңдеуі": "Заң",
  "Ағын үздіксіздігі": "Заң",
  "Күштердің тепе-теңдігі": "Заң",
  Инерттілік: "Заң",

  Кинематика: "Ұғым",
  "Қатты дене": "Ұғым",
  "Тұйық жүйе": "Ұғым",
  "Массалар центрі": "Ұғым",
  "Серіппелі маятник": "Ұғым",
  "Еркін дене диаграммасы": "Ұғым",
  "Көлбеу жазықтық": "Ұғым",
  Джоуль: "Ұғым",
  "Консервативті күш": "Ұғым",
  Динамометр: "Ұғым",
  Радиан: "Ұғым",
  Уақыт: "Шама",
  Ұзындық: "Шама",
  "Импульс моментінің сақталу заңы": "Заң",
};

// ---------------------------------------------------------------------------
// Crossword
// ---------------------------------------------------------------------------

export interface CrosswordEntry {
  answer: string;
  clue: string;
  row: number;
  col: number;
  direction: "across" | "down";
  number: number;
}

export interface CrosswordBoard {
  entries: CrosswordEntry[];
  rows: number;
  cols: number;
}

/** Letters only — grid cells hold one character, so spaces and hyphens go. */
function gridForm(term: string) {
  return term.replace(/[\s-]/g, "").toUpperCase();
}

/**
 * Lays words out by crossing each new word through a letter already on the
 * board, alternating direction. A full constraint solver would pack tighter,
 * but the point here is a readable puzzle from five to seven terms, and a
 * greedy first-fit reaches that without a second of search.
 */
export function buildCrossword(mod: LessonModule, seed: number): CrosswordBoard | null {
  const rnd = seededRandom(seed);
  const candidates = lessonGlossary(mod)
    .filter((g) => gridForm(g.term).length >= 4 && gridForm(g.term).length <= 14)
    .map((g) => ({ answer: gridForm(g.term), clue: g.definition, label: g.term }));
  if (candidates.length < 3) return null;

  const chosen = seededPick(candidates, 6, rnd).sort(
    (a, b) => b.answer.length - a.answer.length
  );

  const SIZE = 20;
  const grid: (string | null)[][] = Array.from({ length: SIZE }, () =>
    Array<string | null>(SIZE).fill(null)
  );
  const entries: CrosswordEntry[] = [];

  const fits = (word: string, row: number, col: number, dir: "across" | "down") => {
    if (row < 0 || col < 0) return false;
    if (dir === "across" ? col + word.length > SIZE : row + word.length > SIZE) return false;
    for (let i = 0; i < word.length; i++) {
      const r = dir === "across" ? row : row + i;
      const c = dir === "across" ? col + i : col;
      const cell = grid[r][c];
      if (cell !== null && cell !== word[i]) return false;
    }
    return true;
  };

  const place = (word: string, row: number, col: number, dir: "across" | "down") => {
    for (let i = 0; i < word.length; i++) {
      const r = dir === "across" ? row : row + i;
      const c = dir === "across" ? col + i : col;
      grid[r][c] = word[i];
    }
  };

  // First word across the middle, the rest crossing whatever is already down.
  const first = chosen[0];
  const startRow = Math.floor(SIZE / 2);
  const startCol = Math.max(0, Math.floor((SIZE - first.answer.length) / 2));
  place(first.answer, startRow, startCol, "across");
  entries.push({
    answer: first.answer,
    clue: first.clue,
    row: startRow,
    col: startCol,
    direction: "across",
    number: 1,
  });

  for (const cand of chosen.slice(1)) {
    let placed = false;
    for (const placedEntry of entries) {
      if (placed) break;
      const dir = placedEntry.direction === "across" ? "down" : "across";
      for (let i = 0; i < placedEntry.answer.length && !placed; i++) {
        const letter = placedEntry.answer[i];
        for (let j = 0; j < cand.answer.length && !placed; j++) {
          if (cand.answer[j] !== letter) continue;
          const crossRow =
            placedEntry.direction === "across" ? placedEntry.row : placedEntry.row + i;
          const crossCol =
            placedEntry.direction === "across" ? placedEntry.col + i : placedEntry.col;
          const row = dir === "across" ? crossRow : crossRow - j;
          const col = dir === "across" ? crossCol - j : crossCol;
          if (!fits(cand.answer, row, col, dir)) continue;
          place(cand.answer, row, col, dir);
          entries.push({
            answer: cand.answer,
            clue: cand.clue,
            row,
            col,
            direction: dir,
            number: entries.length + 1,
          });
          placed = true;
        }
      }
    }
  }

  if (entries.length < 3) return null;

  // Crop to what was actually used, so the rendered grid has no empty margin.
  const minRow = Math.min(...entries.map((e) => e.row));
  const minCol = Math.min(...entries.map((e) => e.col));
  const maxRow = Math.max(...entries.map((e) => (e.direction === "down" ? e.row + e.answer.length - 1 : e.row)));
  const maxCol = Math.max(...entries.map((e) => (e.direction === "across" ? e.col + e.answer.length - 1 : e.col)));

  const cropped = entries
    .map((e) => ({ ...e, row: e.row - minRow, col: e.col - minCol }))
    // Number in reading order, the way a printed crossword does it.
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .map((e, i) => ({ ...e, number: i + 1 }));

  return { entries: cropped, rows: maxRow - minRow + 1, cols: maxCol - minCol + 1 };
}

// ---------------------------------------------------------------------------
// Word search
// ---------------------------------------------------------------------------

export interface WordSearchBoard {
  grid: string[][];
  words: { word: string; label: string }[];
  size: number;
}

const KZ_LETTERS = "АӘБВГҒДЕЖЗИЙКҚЛМНҢОӨПРСТУҰҮФХҺЦЧШЫІЭЮЯ";

/**
 * Words go in horizontally, vertically or diagonally, forwards only —
 * backwards words in a Cyrillic grid turn a vocabulary exercise into a
 * letter-by-letter scan, which tests patience rather than the lesson.
 */
export function buildWordSearch(mod: LessonModule, seed: number): WordSearchBoard | null {
  const rnd = seededRandom(seed);
  // A phrase like "Күштердің тепе-теңдігі" is 21 letters run together, which
  // no readable grid holds. Hide its first word and show the full term in the
  // list to find — the same convention a printed word search uses.
  const candidates = lessonGlossary(mod)
    .map((g) => ({ word: gridForm(g.term.split(/\s+/)[0]), label: g.term }))
    .filter((w) => w.word.length >= 4 && w.word.length <= 13);
  // Two terms starting with the same word would hide one letter run twice.
  const unique = candidates.filter(
    (w, i) => candidates.findIndex((x) => x.word === w.word) === i
  );
  if (unique.length < 4) return null;

  const words = seededPick(unique, 7, rnd);
  const size = Math.max(12, Math.min(15, Math.max(...words.map((w) => w.word.length)) + 3));
  const grid: (string | null)[][] = Array.from({ length: size }, () =>
    Array<string | null>(size).fill(null)
  );

  const DIRS: [number, number][] = [
    [0, 1],
    [1, 0],
    [1, 1],
    [-1, 1],
  ];

  const placed: { word: string; label: string }[] = [];
  for (const { word, label } of words) {
    let done = false;
    for (let attempt = 0; attempt < 120 && !done; attempt++) {
      const [dr, dc] = DIRS[Math.floor(rnd() * DIRS.length)];
      const row = Math.floor(rnd() * size);
      const col = Math.floor(rnd() * size);
      const endR = row + dr * (word.length - 1);
      const endC = col + dc * (word.length - 1);
      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

      let ok = true;
      for (let i = 0; i < word.length; i++) {
        const cell = grid[row + dr * i][col + dc * i];
        if (cell !== null && cell !== word[i]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      for (let i = 0; i < word.length; i++) grid[row + dr * i][col + dc * i] = word[i];
      placed.push({ word, label });
      done = true;
    }
  }

  if (placed.length < 4) return null;

  const filled = grid.map((r) =>
    r.map((c) => c ?? KZ_LETTERS[Math.floor(rnd() * KZ_LETTERS.length)])
  );
  return { grid: filled, words: placed, size };
}

// ---------------------------------------------------------------------------
// Fill in the blank
// ---------------------------------------------------------------------------

export interface BlankItem {
  /** The definition with the term replaced by a gap. */
  sentence: string;
  answer: string;
  options: string[];
}

/**
 * Takes each definition and hides the term it defines, then offers same-lesson
 * terms as distractors. Distractors from the same lesson matter: picking them
 * from the whole course would make most items answerable by topic alone.
 */
export function buildBlanks(mod: LessonModule, seed: number): BlankItem[] | null {
  const rnd = seededRandom(seed);
  if (lessonGlossary(mod).length < 4) return null;

  const chosen = seededPick(lessonGlossary(mod), 6, rnd);
  const pool = lessonGlossary(mod).map((g) => g.term);

  return chosen.map((g) => {
    const distractors = seededPick(
      pool.filter((t) => t !== g.term),
      3,
      rnd
    );
    return {
      sentence: `______ — ${g.definition.charAt(0).toLowerCase()}${g.definition.slice(1)}`,
      answer: g.term,
      options: seededShuffle([g.term, ...distractors], rnd),
    };
  });
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

export interface SortingBoard {
  categories: TermCategory[];
  items: { term: string; category: TermCategory }[];
}

/**
 * Classify the lesson's terms as quantity / law / concept / phenomenon. Only
 * categories with at least one term are offered, and the game is skipped
 * entirely below four sortable terms — three items in two buckets is not a
 * game, it is a coin toss.
 */
export function buildSorting(mod: LessonModule, seed: number): SortingBoard | null {
  const rnd = seededRandom(seed);
  const items = lessonGlossary(mod)
    .map((g) => ({ term: g.term, category: TERM_CATEGORY[g.term] }))
    .filter((x): x is { term: string; category: TermCategory } => Boolean(x.category));

  if (items.length < 4) return null;
  const categories = [...new Set(items.map((i) => i.category))];
  if (categories.length < 2) return null;

  return { categories, items: seededShuffle(items, rnd) };
}

// ---------------------------------------------------------------------------
// Speed quiz
// ---------------------------------------------------------------------------

export interface SpeedQuizBoard {
  questions: QuizQuestion[];
  /** Seconds allowed per question. */
  perQuestion: number;
}

/**
 * The lesson's own quiz, shuffled and put under a clock. Kept separate from the
 * Викторина tab, which is untimed and explains every answer — this one rewards
 * recall speed, which is also what makes it the fairest duel format.
 */
export function buildSpeedQuiz(mod: LessonModule, seed: number): SpeedQuizBoard | null {
  const rnd = seededRandom(seed);
  if (mod.quiz.length < 3) return null;
  const questions = seededPick(mod.quiz, 8, rnd).map((q) => {
    // Shuffle the options while keeping correctIndex pointing at the right one.
    const order = seededShuffle(
      q.options.map((_, i) => i),
      rnd
    );
    return {
      ...q,
      options: order.map((i) => q.options[i]),
      correctIndex: order.indexOf(q.correctIndex),
    };
  });
  return { questions, perQuestion: 15 };
}

// ---------------------------------------------------------------------------

export type BuildableGame =
  | "crossword"
  | "wordsearch"
  | "fillblank"
  | "sorting"
  | "speedquiz";

/**
 * Which of the derived games this lesson has enough material for. The router
 * uses it to hide a tab rather than open an empty board.
 */
export function availableDerivedGames(mod: LessonModule, seed: number): BuildableGame[] {
  const out: BuildableGame[] = [];
  if (buildCrossword(mod, seed)) out.push("crossword");
  if (buildWordSearch(mod, seed)) out.push("wordsearch");
  if (buildBlanks(mod, seed)) out.push("fillblank");
  if (buildSorting(mod, seed)) out.push("sorting");
  if (buildSpeedQuiz(mod, seed)) out.push("speedquiz");
  return out;
}
