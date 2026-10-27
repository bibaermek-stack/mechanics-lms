// The class community: a gallery of home experiments and questions students write for
// each other. This file holds the rules that do not need a database: what may be sent,
// what a student may see, and the practice quiz built from classmates' questions.
//
// Two implementations of one policy: the database enforces it (migrations 0015 and 0016,
// tested on a real PostgreSQL), and the demo mode — no database — applies the same rules
// here. community.test.ts replays the SQL tests' scenario against these functions, and
// reads the migrations to keep every limit identical.

import { seededRandom, seededShuffle } from "./rng";

export type ReviewStatus = "pending" | "approved" | "rejected";

export const LESSON_MIN = 1;
export const LESSON_MAX = 999;

export const SHOWCASE_LIMITS = {
  title: { min: 3, max: 80 },
  what: { min: 10, max: 600 },
  physics: { min: 10, max: 400 },
  materials: { max: 200 },
  /** posts waiting for review at once, per student */
  pending: 5,
} as const;

export const QUESTION_LIMITS = {
  text: { min: 10, max: 300 },
  option: { min: 1, max: 120 },
  explanation: { max: 300 },
  options: 4,
  pending: 10,
} as const;

export interface ShowcasePost {
  id: string;
  userId: string;
  lessonId: number;
  title: string;
  what: string;
  physics: string;
  materials: string | null;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface StudentQuestion {
  id: string;
  userId: string;
  lessonId: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// What may be sent
// ---------------------------------------------------------------------------

export type Check<T, K extends string> = { ok: true; value: T } | { ok: false; errors: Partial<Record<K, string>> };

const len = (s: string) => [...s.trim()].length;
const between = (s: string, min: number, max: number) => len(s) >= min && len(s) <= max;

export interface ShowcaseInput {
  lessonId: number;
  title: string;
  what: string;
  physics: string;
  materials?: string;
}

export type ShowcaseField = "lessonId" | "title" | "what" | "physics" | "materials";

export function validateShowcase(input: ShowcaseInput): Check<{ lessonId: number; title: string; what: string; physics: string; materials: string | null }, ShowcaseField> {
  const errors: Partial<Record<ShowcaseField, string>> = {};
  const L = SHOWCASE_LIMITS;
  if (!Number.isInteger(input.lessonId) || input.lessonId < LESSON_MIN || input.lessonId > LESSON_MAX) errors.lessonId = "Сабақты таңда.";
  if (!between(input.title, L.title.min, L.title.max)) errors.title = `Атауы ${L.title.min}–${L.title.max} әріп болсын.`;
  if (!between(input.what, L.what.min, L.what.max)) errors.what = `Не жасағаныңды ${L.what.min}–${L.what.max} әріппен жаз.`;
  if (!between(input.physics, L.physics.min, L.physics.max)) errors.physics = `Қай физика заңын көрсететінін ${L.physics.min}–${L.physics.max} әріппен жаз.`;
  const materials = (input.materials ?? "").trim();
  // The database measures the text as typed, the form as trimmed; trimmed is never longer, so a form that passes passes there.
  if ([...(input.materials ?? "")].length > L.materials.max) errors.materials = `Материалдар ${L.materials.max} әріптен аспасын.`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { lessonId: input.lessonId, title: input.title.trim(), what: input.what.trim(), physics: input.physics.trim(), materials: materials || null } };
}

export interface QuestionInput {
  lessonId: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export type QuestionField = "lessonId" | "question" | "options" | "correctIndex" | "explanation";

export function validateQuestion(input: QuestionInput): Check<{ lessonId: number; question: string; options: string[]; correctIndex: number; explanation: string | null }, QuestionField> {
  const errors: Partial<Record<QuestionField, string>> = {};
  const L = QUESTION_LIMITS;
  if (!Number.isInteger(input.lessonId) || input.lessonId < LESSON_MIN || input.lessonId > LESSON_MAX) errors.lessonId = "Сабақты таңда.";
  if (!between(input.question, L.text.min, L.text.max)) errors.question = `Сұрақ ${L.text.min}–${L.text.max} әріп болсын.`;
  const options = input.options.map((o) => o.trim());
  if (options.length !== L.options || options.some((o) => !between(o, L.option.min, L.option.max))) {
    errors.options = `Дәл ${L.options} жауап нұсқасы керек, әрқайсысы ${L.option.min}–${L.option.max} әріп.`;
  } else if (new Set(options.map((o) => o.toLowerCase())).size !== L.options) {
    errors.options = "Нұсқалардың екеуі бірдей болмасын.";
  }
  if (!Number.isInteger(input.correctIndex) || input.correctIndex < 0 || input.correctIndex >= L.options) errors.correctIndex = "Дұрыс жауапты белгіле.";
  const explanation = (input.explanation ?? "").trim();
  if ([...(input.explanation ?? "")].length > L.explanation.max) errors.explanation = `Түсініктеме ${L.explanation.max} әріптен аспасын.`;
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { lessonId: input.lessonId, question: input.question.trim(), options, correctIndex: input.correctIndex, explanation: explanation || null } };
}

/** Whether a student may send another item: not too many are waiting. */
export const canSubmit = (items: readonly { userId: string; status: ReviewStatus }[], userId: string, limit: number) =>
  items.filter((i) => i.userId === userId && i.status === "pending").length < limit;

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

/** A decision on an item: the status, who decided and when. A decision can be changed later. */
export function decide<T extends { status: ReviewStatus; reviewedBy: string | null; reviewedAt: string | null }>(item: T, teacherId: string, approve: boolean, now: Date): T {
  return { ...item, status: approve ? "approved" : "rejected", reviewedBy: teacherId, reviewedAt: now.toISOString() };
}

// ---------------------------------------------------------------------------
// Who sees what
// ---------------------------------------------------------------------------

export interface Audience {
  /** The signed-in person. */
  viewerId: string;
  /** Students in the viewer's class, the viewer included if they are a student. */
  classmates: ReadonlySet<string>;
  /** For a teacher: their accepted students. */
  myStudents: ReadonlySet<string>;
}

/** The gallery: approved posts of the viewer's class, or of a teacher's students. */
export function visibleShowcase(posts: readonly ShowcasePost[], who: Audience): ShowcasePost[] {
  return posts.filter((p) => p.status === "approved" && (who.classmates.has(p.userId) || who.myStudents.has(p.userId)));
}

/** A like needs an approved post, by somebody else, in the viewer's class. */
export const canLike = (post: ShowcasePost, who: Audience) => post.status === "approved" && post.userId !== who.viewerId && who.classmates.has(post.userId);

export interface FeedCard extends ShowcasePost {
  author: string;
  likes: number;
  likedByMe: boolean;
  isMine: boolean;
}

/** Most liked first, then newest. */
export const rankFeed = (cards: readonly FeedCard[]): FeedCard[] => [...cards].sort((a, b) => b.likes - a.likes || b.createdAt.localeCompare(a.createdAt));

/** Classmates' approved questions of a lesson, oldest first; never the viewer's own. */
export function peerQuestions(questions: readonly StudentQuestion[], lessonId: number, who: Audience): StudentQuestion[] {
  return questions
    .filter((q) => q.status === "approved" && q.lessonId === lessonId && q.userId !== who.viewerId && who.classmates.has(q.userId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ---------------------------------------------------------------------------
// Practice on classmates' questions
// ---------------------------------------------------------------------------

export interface PracticeItem {
  id: string;
  question: string;
  options: string[];
  /** Index of the right option after the options were shuffled. */
  correct: number;
  explanation: string | null;
}

export const PRACTICE_LENGTH = 5;

/** Up to `n` questions in a seeded order, each with its options shuffled and the right one followed. */
export function buildPractice(questions: readonly Pick<StudentQuestion, "id" | "question" | "options" | "correctIndex" | "explanation">[], seed: number, n = PRACTICE_LENGTH): PracticeItem[] {
  const rnd = seededRandom(seed);
  return seededShuffle(questions, rnd)
    .slice(0, n)
    .map((q) => {
      const order = seededShuffle(q.options.map((_, i) => i), rnd);
      return { id: q.id, question: q.question, options: order.map((i) => q.options[i]), correct: order.indexOf(q.correctIndex), explanation: q.explanation };
    });
}

// ---------------------------------------------------------------------------
// Counting contributions
// ---------------------------------------------------------------------------

export interface Contributions {
  approvedShowcases: number;
  approvedQuestions: number;
  waiting: number;
}

export function contributionsOf(posts: readonly ShowcasePost[], questions: readonly StudentQuestion[], userId: string): Contributions {
  const mine = <T extends { userId: string; status: ReviewStatus }>(xs: readonly T[]) => xs.filter((x) => x.userId === userId);
  return {
    approvedShowcases: mine(posts).filter((p) => p.status === "approved").length,
    approvedQuestions: mine(questions).filter((q) => q.status === "approved").length,
    waiting: mine(posts).filter((p) => p.status === "pending").length + mine(questions).filter((q) => q.status === "pending").length,
  };
}
