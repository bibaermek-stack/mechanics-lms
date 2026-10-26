// What keeps a student coming back: a level, a streak and a shelf of achievements.
//
// Everything here is *derived*, never stored. A level is a function of XP, a
// streak of the days on which any record was written, an achievement of the
// records themselves. So there is nothing to migrate, nothing to get out of
// step with the scoring tables, and the same rules run for the demo (localStorage)
// and the live (Supabase) backend alike.
//
// The module is pure — no store, no clock of its own, no React. The caller hands
// it the records and today's date, which is also what makes it testable.

import type {
  AssignmentSubmission,
  CompetencyAssessment,
  DiagnosticAttempt,
  GameResult,
  PredictionAttempt,
  SensorResult,
  QuizAttempt,
} from "./types";
import { firstAttempts } from "./misconceptions";

/** The lesson id under which the daily challenge is stored: it belongs to no lesson. */
export const DAILY_MODULE_ID = 0;

/** A quiz at or above this percentage counts as a passed lesson. */
export const PASS_PERCENT = 60;

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export const LEVEL_NAMES = [
  "Жаңадан бастаушы",
  "Қызығушы",
  "Зерттеуші",
  "Тәжірибеші",
  "Талдаушы",
  "Инженер",
  "Шебер",
  "Сарапшы",
  "Профессор",
  "Академик",
] as const;

export const MAX_LEVEL = LEVEL_NAMES.length;

/** XP at which a level begins: 0, 100, 400, 900, … — each level costs 200 more than the last. */
export const xpAtLevel = (level: number) => 100 * (level - 1) * (level - 1);

export interface LevelInfo {
  level: number;
  name: string;
  xp: number;
  /** XP at which this level began. */
  floor: number;
  /** XP at which the next begins; null at the top. */
  next: number | null;
  /** XP earned since `floor`. */
  into: number;
  /** XP the level spans; null at the top. */
  span: number | null;
  /** How far through the level, 0–1 (1 at the top). */
  fraction: number;
}

export function levelFor(xp: number): LevelInfo {
  const x = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  // Counted rather than square-rooted: no floating-point surprise at an exact threshold.
  let level = 1;
  while (level < MAX_LEVEL && x >= xpAtLevel(level + 1)) level++;
  const floor = xpAtLevel(level);
  const next = level < MAX_LEVEL ? xpAtLevel(level + 1) : null;
  return {
    level,
    name: LEVEL_NAMES[level - 1],
    xp: x,
    floor,
    next,
    into: x - floor,
    span: next === null ? null : next - floor,
    fraction: next === null ? 1 : (x - floor) / (next - floor),
  };
}

// ---------------------------------------------------------------------------
// Days and streaks
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/** The calendar day of a moment *in the viewer's own time zone*, as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The viewer's calendar day of a stored ISO timestamp; null if it does not parse. */
export function dayKeyOf(iso: string): string | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
}

/** A day key moved by whole days. Works on the key alone, so daylight saving cannot bend it. */
export function shiftDay(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + delta));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export interface EngagementRecords {
  quizzes: QuizAttempt[];
  games: GameResult[];
  submissions: AssignmentSubmission[];
  assessments: CompetencyAssessment[];
  diagnostics: DiagnosticAttempt[];
  /** Left out by callers that predate predictions. */
  predictions?: PredictionAttempt[];
  /** Left out by callers that predate the phone laboratory. */
  sensors?: SensorResult[];
}

/** Every day on which the student did *something* that left a record. */
export function activityDays(r: EngagementRecords): Set<string> {
  const stamps = [
    ...r.quizzes.map((x) => x.takenAt),
    ...r.games.map((x) => x.completedAt),
    ...r.submissions.map((x) => x.submittedAt),
    ...r.assessments.map((x) => x.assessedAt),
    ...r.diagnostics.map((x) => x.takenAt),
    ...(r.predictions ?? []).map((x) => x.createdAt),
    ...(r.sensors ?? []).map((x) => x.createdAt),
  ];
  const days = new Set<string>();
  for (const s of stamps) {
    const k = dayKeyOf(s);
    if (k) days.add(k);
  }
  return days;
}

export interface Streak {
  /** Consecutive days up to today — or up to yesterday, while today is still open. */
  current: number;
  longest: number;
  activeToday: boolean;
  /** A streak is running but today has no activity yet: it ends tonight unless the student acts. */
  atRisk: boolean;
}

export function streakOf(days: ReadonlySet<string>, today: string): Streak {
  // A day after "today" can only come from a wrong clock; it must not lengthen a streak.
  const valid = [...days].filter((d) => d <= today).sort();
  const set = new Set(valid);

  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of valid) {
    run = prev !== null && shiftDay(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }

  const activeToday = set.has(today);
  let cursor = activeToday ? today : shiftDay(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = shiftDay(cursor, -1);
  }
  return { current, longest, activeToday, atRisk: current > 0 && !activeToday };
}

// ---------------------------------------------------------------------------
// The daily challenge's place in the records
// ---------------------------------------------------------------------------

/** Games that belong to no lesson: practice, not coursework. They never reach the final grade or the "kinds of game" tally. */
const OFF_COURSE_GAMES: ReadonlySet<string> = new Set(["daily", "myth"]);

/** A game that belongs to a lesson. The daily challenge and the myth game belong to none, and must not count as one. */
export const isLessonGame = (g: Pick<GameResult, "gameType">) => !OFF_COURSE_GAMES.has(g.gameType);

const dailyResults = (games: GameResult[]) => games.filter((g) => g.gameType === "daily");

/** Today's daily result, if the student has already sat it (the first, should there be several). */
export function dailyToday(games: GameResult[], today: string): GameResult | null {
  const mine = dailyResults(games)
    .filter((g) => dayKeyOf(g.completedAt) === today)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  return mine[0] ?? null;
}

export interface DailyDay {
  day: string;
  /** The day's score, or null if it was not played. */
  score: number | null;
}

/** The last `count` days ending today, oldest first, each with that day's (best) daily score. */
export function dailyHistory(games: GameResult[], today: string, count = 7): DailyDay[] {
  const best = new Map<string, number>();
  for (const g of dailyResults(games)) {
    const k = dayKeyOf(g.completedAt);
    if (k && (!best.has(k) || g.score > best.get(k)!)) best.set(k, g.score);
  }
  return Array.from({ length: count }, (_, i) => {
    const day = shiftDay(today, i - (count - 1));
    return { day, score: best.get(day) ?? null };
  });
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  title: string;
  /** What to do, phrased so that it reads the same locked or unlocked. */
  description: string;
  /** Name of an icon the UI maps to a component. */
  icon: string;
  /** Where the student is, capped at `target`. */
  progress: number;
  target: number;
  unlocked: boolean;
}

interface Context extends EngagementRecords {
  streak: Streak;
  level: LevelInfo;
  /** How many lessons the course has. */
  lessonCount: number;
}

interface Def {
  id: string;
  title: string;
  description: string;
  icon: string;
  target: number;
  measure: (c: Context) => number;
}

const pct = (a: Pick<QuizAttempt, "score" | "total">) => (a.total > 0 ? Math.round((100 * a.score) / a.total) : 0);
const bestOf = (xs: number[]) => (xs.length ? Math.max(...xs) : 0);
const scoresOf = (c: Context, type: string) => c.games.filter((g) => g.gameType === type).map((g) => g.score);

const DEFS: Def[] = [
  {
    id: "first-quiz",
    title: "Алғашқы қадам",
    description: "Кез келген сабақтың викторинасын бір рет тапсыр.",
    icon: "Footprints",
    target: 1,
    measure: (c) => c.quizzes.length,
  },
  {
    id: "quiz-perfect",
    title: "Мінсіз викторина",
    description: "Викторинаны бір де қате жібермей, 100 %-бен тапсыр.",
    icon: "Star",
    target: 1,
    measure: (c) => c.quizzes.filter((q) => q.total > 0 && q.score === q.total).length,
  },
  {
    id: "lessons-passed",
    title: "Курсты меңгерген",
    description: "Барлық сабақтың викторинасын 60 %-дан жоғары тапсыр.",
    icon: "GraduationCap",
    target: 0, // set from lessonCount below
    measure: (c) => {
      const best = new Map<number, number>();
      for (const q of c.quizzes) best.set(q.moduleId, Math.max(best.get(q.moduleId) ?? 0, pct(q)));
      return [...best.values()].filter((p) => p >= PASS_PERCENT).length;
    },
  },
  {
    id: "first-game",
    title: "Ойыншы",
    description: "Сабақтың кез келген ойынын бір рет аяқта.",
    icon: "Gamepad2",
    target: 1,
    measure: (c) => c.games.filter(isLessonGame).length,
  },
  {
    id: "game-variety",
    title: "Әралуан ойыншы",
    description: "8 түрлі ойынды ойна.",
    icon: "Puzzle",
    target: 8,
    measure: (c) => new Set(c.games.filter(isLessonGame).map((g) => g.gameType)).size,
  },
  {
    id: "game-perfect",
    title: "Мінсіз ойын",
    description: "Бір ойыннан 100 ұпай жина.",
    icon: "Medal",
    target: 1,
    measure: (c) => c.games.filter((g) => isLessonGame(g) && g.score >= 100).length,
  },
  {
    id: "game-25",
    title: "Ойын марафоны",
    description: "Барлығы 25 ойын аяқта.",
    icon: "Trophy",
    target: 25,
    measure: (c) => c.games.filter(isLessonGame).length,
  },
  {
    id: "projectile-ace",
    title: "Мерген",
    description: "«Снаряд атысы» ойынынан кемінде 80 ұпай жина.",
    icon: "Crosshair",
    target: 80,
    measure: (c) => bestOf(scoresOf(c, "projectile")),
  },
  {
    id: "blitz-75",
    title: "Жылдам есепші",
    description: "«Есеп-блицтен» кемінде 75 ұпай жина.",
    icon: "Zap",
    target: 75,
    measure: (c) => bestOf(scoresOf(c, "blitz")),
  },
  {
    id: "myth-hunter",
    title: "Миф аңшысы",
    description: "«Миф па, шындық па?» ойынынан кемінде 75 ұпай жина (8-ден 6 дұрыс).",
    icon: "Sparkles",
    target: 75,
    measure: (c) => bestOf(scoresOf(c, "myth")),
  },
  {
    id: "predictor",
    title: "Болжаушы",
    description: "Сегіз болжамды бірінші рет дұрыс айт («Болжам» табы).",
    icon: "Eye",
    target: 8,
    measure: (c) => firstAttempts(c.predictions ?? []).filter((p) => p.correct).length,
  },
  {
    id: "phone-scientist",
    title: "Телефон зерттеуші",
    description: "Өз телефоныңмен үш түрлі өлшем жаса: g, секіру, маятник немесе лифт.",
    icon: "Smartphone",
    target: 3,
    measure: (c) => new Set((c.sensors ?? []).map((x) => x.kind)).size,
  },
  {
    id: "streak-3",
    title: "3 күн қатарынан",
    description: "Үш күн қатарынан оқу белсенділігін көрсет.",
    icon: "Flame",
    target: 3,
    measure: (c) => c.streak.longest,
  },
  {
    id: "streak-7",
    title: "Апталық серия",
    description: "Жеті күн қатарынан оқы.",
    icon: "Flame",
    target: 7,
    measure: (c) => c.streak.longest,
  },
  {
    id: "streak-30",
    title: "Айлық серия",
    description: "Отыз күн қатарынан оқы.",
    icon: "Flame",
    target: 30,
    measure: (c) => c.streak.longest,
  },
  {
    id: "daily-1",
    title: "Күнделікті сынақ",
    description: "Күнделікті сынақты бір рет тапсыр.",
    icon: "CalendarCheck",
    target: 1,
    measure: (c) => new Set(dailyResults(c.games).map((g) => dayKeyOf(g.completedAt))).size,
  },
  {
    id: "daily-7",
    title: "Апта сынағы",
    description: "Күнделікті сынақты жеті түрлі күні тапсыр.",
    icon: "CalendarCheck",
    target: 7,
    measure: (c) => new Set(dailyResults(c.games).map((g) => dayKeyOf(g.completedAt))).size,
  },
  {
    id: "daily-perfect",
    title: "Бес бестік",
    description: "Күнделікті сынақтың бес сұрағына да дұрыс жауап бер.",
    icon: "Star",
    target: 1,
    measure: (c) => dailyResults(c.games).filter((g) => g.score >= 100).length,
  },
  {
    id: "diagnostic",
    title: "Бастапқы деңгей",
    description: "Бастапқы диагностикалық тестті тапсыр.",
    icon: "ClipboardCheck",
    target: 1,
    measure: (c) => c.diagnostics.filter((d) => d.phase === "pre").length,
  },
  {
    id: "growth",
    title: "Өсу",
    description: "Қорытынды диагностикада бастапқыдан жоғары нәтиже көрсет.",
    icon: "TrendingUp",
    target: 1,
    measure: (c) => {
      const pre = c.diagnostics.find((d) => d.phase === "pre");
      const post = c.diagnostics.find((d) => d.phase === "post");
      if (!pre || !post || pre.total === 0 || post.total === 0) return 0;
      return post.score / post.total > pre.score / pre.total ? 1 : 0;
    },
  },
  {
    id: "first-work",
    title: "БӨЖ тапсырушы",
    description: "Бір БӨЖ тапсырмасын жібер.",
    icon: "FileText",
    target: 1,
    measure: (c) => c.submissions.length,
  },
  {
    id: "work-graded",
    title: "Жоғары баға",
    description: "БӨЖ-ден оқытушыдан кемінде 80 баға ал.",
    icon: "CheckCircle2",
    target: 1,
    measure: (c) => c.submissions.filter((s) => s.status === "reviewed" && (s.grade ?? 0) >= 80).length,
  },
  {
    id: "self-assess",
    title: "Өзін-өзі бағалау",
    description: "Құзыреттілікті бір рет бағала.",
    icon: "Brain",
    target: 1,
    measure: (c) => c.assessments.length,
  },
  {
    id: "level-5",
    title: "Талдаушы деңгейі",
    description: "5-деңгейге жет.",
    icon: "Rocket",
    target: 5,
    measure: (c) => c.level.level,
  },
];

export interface EngagementState {
  level: LevelInfo;
  streak: Streak;
  achievements: Achievement[];
  unlocked: number;
}

/**
 * The whole picture, from the records, the XP total and today's date.
 *
 * `today` is a day key in the viewer's time zone; `lessonCount` is how many
 * lessons the course has (the "all lessons" achievement scales with it).
 */
export function computeEngagement(
  records: EngagementRecords,
  xp: number,
  today: string,
  lessonCount: number
): EngagementState {
  const level = levelFor(xp);
  const streak = streakOf(activityDays(records), today);
  const ctx: Context = { ...records, level, streak, lessonCount };

  const achievements = DEFS.map((d): Achievement => {
    const target = d.id === "lessons-passed" ? lessonCount : d.target;
    const raw = d.measure(ctx);
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      icon: d.icon,
      target,
      progress: Math.min(raw, target),
      unlocked: target > 0 && raw >= target,
    };
  });

  return { level, streak, achievements, unlocked: achievements.filter((a) => a.unlocked).length };
}

/** The locked achievements closest to done — what to aim at next. */
export function nextUp(achievements: Achievement[], n = 3): Achievement[] {
  return achievements
    .filter((a) => !a.unlocked && a.target > 0)
    .map((a, i) => ({ a, i, ratio: a.progress / a.target }))
    .sort((x, y) => y.ratio - x.ratio || x.i - y.i)
    .slice(0, n)
    .map((x) => x.a);
}
