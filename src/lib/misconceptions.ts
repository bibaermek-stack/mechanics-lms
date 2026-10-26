// What a class gets wrong, and how sure it was.
//
// A student can retake a prediction as often as they like — the answer is shown the
// moment they commit — but only the FIRST attempt at an item says what they believed
// before being told, so every figure here is built from first attempts alone.
//
// The figure a teacher most needs is the confident error: a wrong answer given with
// "I am certain". A guess that missed is a gap; a certainty that missed is a
// misconception, and it is the harder one to dislodge.

import type { PredictionAttempt } from "./types";
import type { PredictItem } from "@/data/predictions";

/** The earliest attempt of each (student, item). */
export function firstAttempts(rows: PredictionAttempt[]): PredictionAttempt[] {
  const first = new Map<string, PredictionAttempt>();
  for (const r of rows) {
    const k = `${r.userId}\u0000${r.itemId}`;
    const cur = first.get(k);
    if (!cur || r.createdAt < cur.createdAt || (r.createdAt === cur.createdAt && r.id < cur.id)) first.set(k, r);
  }
  return [...first.values()];
}

export interface OptionCount {
  optionId: string;
  count: number;
  /** Of the students who attempted the item. */
  share: number;
  misconception: string | null;
}

export interface ItemStat {
  itemId: string;
  lesson: number;
  /** Students who have made a first attempt. */
  n: number;
  correct: number;
  /** 0–1; null while nobody has tried it. */
  correctShare: number | null;
  options: OptionCount[];
  /** Wrong first attempts made with confidence 3. */
  confidentWrong: number;
  /** The wrong option most students chose (ties: the first listed), null if none was wrong. */
  topWrong: OptionCount | null;
}

export function itemStats(rows: PredictionAttempt[], items: readonly PredictItem[]): ItemStat[] {
  const firsts = firstAttempts(rows);
  return items.map((item) => {
    const mine = firsts.filter((r) => r.itemId === item.id);
    const n = mine.length;
    const options: OptionCount[] = item.options.map((o) => {
      const count = mine.filter((r) => r.optionId === o.id).length;
      return { optionId: o.id, count, share: n === 0 ? 0 : count / n, misconception: o.misconception ?? null };
    });
    const wrong = options.filter((o) => o.optionId !== item.correct && o.count > 0);
    const topWrong = wrong.reduce<OptionCount | null>((best, cur) => (!best || cur.count > best.count ? cur : best), null);
    const correct = mine.filter((r) => r.correct).length;
    return {
      itemId: item.id,
      lesson: item.lesson,
      n,
      correct,
      correctShare: n === 0 ? null : correct / n,
      options,
      confidentWrong: mine.filter((r) => !r.correct && r.confidence === 3).length,
      topWrong,
    };
  });
}

export interface MisconceptionStat {
  id: string;
  /** Different students whose first attempt on some item expressed it. */
  students: number;
  /** First attempts that expressed it. */
  occurrences: number;
  /** …of which were given with confidence 3. */
  confident: number;
  /** Items it showed up on. */
  items: string[];
}

/** Misconceptions, most widespread first (by students, then confident cases, then name). */
export function misconceptionStats(rows: PredictionAttempt[]): MisconceptionStat[] {
  const by = new Map<string, PredictionAttempt[]>();
  for (const r of firstAttempts(rows)) {
    if (!r.misconception) continue;
    by.set(r.misconception, [...(by.get(r.misconception) ?? []), r]);
  }
  return [...by.entries()]
    .map(([id, rs]) => ({
      id,
      students: new Set(rs.map((r) => r.userId)).size,
      occurrences: rs.length,
      confident: rs.filter((r) => r.confidence === 3).length,
      items: [...new Set(rs.map((r) => r.itemId))].sort(),
    }))
    .sort((a, b) => b.students - a.students || b.confident - a.confident || a.id.localeCompare(b.id));
}

export interface StudentPredictions {
  attempted: number;
  correct: number;
  /** 0–1; null before the first attempt. */
  accuracy: number | null;
  /** Wrong first attempts made with confidence 3. */
  confidentWrong: number;
}

export function studentPredictions(rows: PredictionAttempt[], userId: string): StudentPredictions {
  const mine = firstAttempts(rows).filter((r) => r.userId === userId);
  const correct = mine.filter((r) => r.correct).length;
  return {
    attempted: mine.length,
    correct,
    accuracy: mine.length === 0 ? null : correct / mine.length,
    confidentWrong: mine.filter((r) => !r.correct && r.confidence === 3).length,
  };
}

export interface Calibration {
  /** First attempts at each confidence level. */
  n: Record<1 | 2 | 3, number>;
  /** Share right at each level (null where none). A well-calibrated student rises from level 1 to 3. */
  accuracy: Record<1 | 2 | 3, number | null>;
}

export function calibration(rows: PredictionAttempt[]): Calibration {
  const firsts = firstAttempts(rows);
  const levels = [1, 2, 3] as const;
  const n = { 1: 0, 2: 0, 3: 0 } as Calibration["n"];
  const accuracy = { 1: null, 2: null, 3: null } as Calibration["accuracy"];
  for (const l of levels) {
    const at = firsts.filter((r) => r.confidence === l);
    n[l] = at.length;
    accuracy[l] = at.length === 0 ? null : at.filter((r) => r.correct).length / at.length;
  }
  return { n, accuracy };
}

/** Every first attempt as CSV rows, for a spreadsheet. `names` maps user ids to what to print. */
export function predictionRows(rows: PredictionAttempt[], names: Record<string, string> = {}): (string | number)[][] {
  const head = ["student", "item", "option", "correct", "misconception", "confidence", "at"];
  const body = firstAttempts(rows)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((r) => [names[r.userId] ?? r.userId, r.itemId, r.optionId, r.correct ? 1 : 0, r.misconception ?? "", r.confidence, r.createdAt]);
  return [head, ...body];
}
