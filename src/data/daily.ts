// The daily challenge: five questions, the same for everyone on the same day.
//
// One question from each of five different lessons, so a day is a short tour of
// the course rather than five questions on one topic. Which lessons, which
// question, and the order of the options all come from the date alone — so a
// teacher can say "did you get today's third question?" and mean the same thing,
// and nothing needs storing on a server for the set to exist.

import type { LessonModule, QuizQuestion } from "@/lib/types";
import { hashSeed, seededPick, seededRandom, seededShuffle } from "@/lib/rng";
import { ALL_MODULES } from "./modules";

export const DAILY_QUESTIONS = 5;

export interface DailyBoard {
  /** The day this set belongs to, YYYY-MM-DD. */
  day: string;
  questions: (QuizQuestion & { moduleId: number })[];
}

export function buildDaily(day: string, modules: readonly LessonModule[] = ALL_MODULES): DailyBoard {
  const rnd = seededRandom(hashSeed(`daily:${day}`));
  const lessons = seededPick(
    modules.filter((m) => m.quiz.length > 0),
    DAILY_QUESTIONS,
    rnd
  );
  const questions = lessons.map((m) => {
    const q = seededPick(m.quiz, 1, rnd)[0];
    // Shuffle the options while keeping correctIndex pointing at the right one.
    const order = seededShuffle(
      q.options.map((_, i) => i),
      rnd
    );
    return {
      ...q,
      moduleId: m.id,
      options: order.map((i) => q.options[i]),
      correctIndex: order.indexOf(q.correctIndex),
    };
  });
  return { day, questions };
}
