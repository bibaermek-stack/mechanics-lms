// Grading and eligibility for the pre/post diagnostic. Pure, so the rules a
// student runs into ("why is the final test locked?") are testable.

import { DIAGNOSTIC_QUESTIONS, POST_UNLOCK_LESSONS, type DiagnosticQuestion } from "@/data/diagnostic";
import type { DiagnosticAttempt, DiagnosticPhase, QuizAttempt } from "@/lib/types";

export interface GradedDiagnostic {
  score: number;
  total: number;
  answers: DiagnosticAttempt["answers"];
}

/**
 * Marks a sitting. `chosen` maps question id → the option index picked; a
 * question left out counts as wrong and is recorded as -1, the same convention
 * the lesson quizzes use.
 */
export function gradeDiagnostic(
  chosen: Record<string, number>,
  questions: DiagnosticQuestion[] = DIAGNOSTIC_QUESTIONS
): GradedDiagnostic {
  const answers = questions.map((q) => {
    const idx = chosen[q.id];
    return {
      questionId: q.id,
      chosenIndex: Number.isInteger(idx) ? idx : -1,
      correct: idx === q.correctIndex,
    };
  });
  return { score: answers.filter((a) => a.correct).length, total: questions.length, answers };
}

export const diagnosticPercent = (a: Pick<DiagnosticAttempt, "score" | "total">) =>
  Math.round((100 * a.score) / a.total);

/** How many different lessons the student has taken a quiz in. */
export function lessonsAttempted(quiz: QuizAttempt[]): number {
  return new Set(quiz.map((q) => q.moduleId)).size;
}

export interface DiagnosticStatus {
  pre: DiagnosticAttempt | null;
  post: DiagnosticAttempt | null;
  lessonsDone: number;
  /** Which sitting the student may start now, or `null` if neither. */
  next: DiagnosticPhase | null;
  /** Why the final test is not available yet, when that is why `next` is null. */
  postLockedReason: string | null;
}

export function diagnosticStatus(
  attempts: DiagnosticAttempt[],
  quiz: QuizAttempt[],
  requiredLessons: number = POST_UNLOCK_LESSONS
): DiagnosticStatus {
  const pre = attempts.find((a) => a.phase === "pre") ?? null;
  const post = attempts.find((a) => a.phase === "post") ?? null;
  const lessonsDone = lessonsAttempted(quiz);

  let next: DiagnosticPhase | null = null;
  let postLockedReason: string | null = null;
  if (!pre) {
    next = "pre";
  } else if (!post) {
    if (lessonsDone >= requiredLessons) next = "post";
    else
      postLockedReason = `Қорытынды диагностика кемінде ${requiredLessons} сабақтың викторинасын тапсырғаннан кейін ашылады (қазір: ${lessonsDone}).`;
  }
  return { pre, post, lessonsDone, next, postLockedReason };
}
