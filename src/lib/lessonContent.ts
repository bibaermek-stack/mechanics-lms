// What a teacher may change about a lesson, and how it is applied.
//
// The bundled lessons in src/data/modules.ts are the defaults and are never
// mutated. An override is a partial lesson merged over one of them, so an
// empty patch means "unchanged" and deleting the row restores the original.
//
// Simulations are absent from this type on purpose. They are code — physics
// integrators whose numbers were verified against the real experiments — and
// no editor here can add, replace or disable one.

import type { GamePair, GlossaryTerm, LessonModule, QuizQuestion } from "./types";

/** Every field a teacher can override. Keys mirror the SQL trigger's allowlist. */
export interface LessonPatch {
  title?: string;
  shortDescription?: string;
  youtubeId?: string;
  videoDurationMinutes?: number;
  objectives?: string[];
  lectureSummary?: string[];
  keyConcepts?: string[];
  glossary?: GlossaryTerm[];
  quiz?: QuizQuestion[];
  /** Feeds the matching, memory and drag-drop games. */
  gamePairs?: GamePair[];
}

export const PATCH_KEYS: (keyof LessonPatch)[] = [
  "title",
  "shortDescription",
  "youtubeId",
  "videoDurationMinutes",
  "objectives",
  "lectureSummary",
  "keyConcepts",
  "glossary",
  "quiz",
  "gamePairs",
];

/**
 * Lay a patch over a lesson.
 *
 * Absent and empty are treated the same: a teacher who clears every glossary
 * row is far more likely to have emptied the form by accident than to want a
 * lesson with no vocabulary, and an empty glossary would silently remove four
 * of the ten games. Deleting the override is how you go back to the default.
 */
export function applyPatch(mod: LessonModule, patch: LessonPatch | undefined): LessonModule {
  if (!patch) return mod;

  const text = <K extends "title" | "shortDescription" | "youtubeId">(key: K) => {
    const v = patch[key];
    return typeof v === "string" && v.trim() ? v.trim() : mod[key];
  };
  const list = <T>(v: T[] | undefined, fallback: T[]) => (v && v.length ? v : fallback);

  return {
    ...mod,
    title: text("title"),
    shortDescription: text("shortDescription"),
    youtubeId: text("youtubeId"),
    videoDurationMinutes:
      typeof patch.videoDurationMinutes === "number" && patch.videoDurationMinutes > 0
        ? patch.videoDurationMinutes
        : mod.videoDurationMinutes,
    objectives: list(patch.objectives, mod.objectives),
    lectureSummary: list(patch.lectureSummary, mod.lectureSummary),
    keyConcepts: list(patch.keyConcepts, mod.keyConcepts),
    glossary: list(patch.glossary, mod.glossary),
    quiz: list(patch.quiz, mod.quiz),
    game: { ...mod.game, pairs: list(patch.gamePairs, mod.game.pairs ?? []) },
  };
}

/**
 * Reduce a form's state to only what actually differs from the default, so a
 * teacher who opens the editor and saves without typing stores an empty patch
 * rather than a full copy that would freeze the lesson against future updates.
 */
export function diffPatch(mod: LessonModule, draft: LessonPatch): LessonPatch {
  const out: LessonPatch = {};
  const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

  if (draft.title?.trim() && draft.title.trim() !== mod.title) out.title = draft.title.trim();
  if (draft.shortDescription?.trim() && draft.shortDescription.trim() !== mod.shortDescription)
    out.shortDescription = draft.shortDescription.trim();
  if (draft.youtubeId?.trim() && draft.youtubeId.trim() !== mod.youtubeId)
    out.youtubeId = draft.youtubeId.trim();
  if (
    typeof draft.videoDurationMinutes === "number" &&
    draft.videoDurationMinutes > 0 &&
    draft.videoDurationMinutes !== mod.videoDurationMinutes
  )
    out.videoDurationMinutes = draft.videoDurationMinutes;

  if (draft.objectives?.length && !sameJson(draft.objectives, mod.objectives))
    out.objectives = draft.objectives;
  if (draft.lectureSummary?.length && !sameJson(draft.lectureSummary, mod.lectureSummary))
    out.lectureSummary = draft.lectureSummary;
  if (draft.keyConcepts?.length && !sameJson(draft.keyConcepts, mod.keyConcepts))
    out.keyConcepts = draft.keyConcepts;
  if (draft.glossary?.length && !sameJson(draft.glossary, mod.glossary))
    out.glossary = draft.glossary;
  if (draft.quiz?.length && !sameJson(draft.quiz, mod.quiz)) out.quiz = draft.quiz;
  if (draft.gamePairs?.length && !sameJson(draft.gamePairs, mod.game.pairs ?? []))
    out.gamePairs = draft.gamePairs;

  return out;
}

/** Seed an editor form from the lesson as it currently stands. */
export function patchFromModule(mod: LessonModule): Required<LessonPatch> {
  return {
    title: mod.title,
    shortDescription: mod.shortDescription,
    youtubeId: mod.youtubeId,
    videoDurationMinutes: mod.videoDurationMinutes,
    objectives: [...mod.objectives],
    lectureSummary: [...mod.lectureSummary],
    keyConcepts: [...mod.keyConcepts],
    glossary: mod.glossary.map((g) => ({ ...g })),
    quiz: mod.quiz.map((q) => ({ ...q, options: [...q.options] })),
    gamePairs: (mod.game.pairs ?? []).map((p) => ({ ...p })),
  };
}
