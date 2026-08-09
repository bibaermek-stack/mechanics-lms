// Turns one student's own activity into a personal "what to do next" plan —
// the same idea as the teacher's cohort-wide recommendations
// (src/data/recommendations.ts), but built from that student's real quiz
// attempts and assignment submissions (via dataStore, so it works against
// either localStorage mock data or a real Firestore backend without change)
// rather than the synthetic class-wide dataset in src/data/cohort.ts. A
// student must never be shown numbers that do not match their own dashboard.

import { ALL_MODULES, getModuleById } from "@/data/modules";
import { getSimulation } from "@/data/simulations";
import { getAssignmentSubmissions, getGameResults, getQuizAttempts } from "./dataStore";
import type { ActionItem } from "./types";

/** Below this a lesson is flagged for review. */
const WEAK_THRESHOLD = 70;
/** Below this the tone shifts from "warning" to "critical". */
const CRITICAL_THRESHOLD = 50;

const ORDER = { critical: 0, warning: 1, info: 2 } as const;

/**
 * Best quiz score (%) per lesson, in module order. `null` = not attempted.
 * "Best" rather than "latest" so a retake after review counts for the student.
 */
export async function studentLessonScores(userId: string): Promise<(number | null)[]> {
  const attempts = await getQuizAttempts(userId);
  const best = new Map<number, number>();
  for (const a of attempts) {
    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
    const prev = best.get(a.moduleId);
    if (prev === undefined || pct > prev) best.set(a.moduleId, pct);
  }
  return ALL_MODULES.map((m) => best.get(m.id) ?? null);
}

export async function buildStudentPlan(userId: string): Promise<ActionItem[]> {
  const [scores, submissions, games] = await Promise.all([
    studentLessonScores(userId),
    getAssignmentSubmissions(userId),
    getGameResults(userId),
  ]);

  const items: ActionItem[] = [];

  // 1. Lessons already attempted but scored low — worth revising first.
  const weak = scores
    .map((pct, i) => ({ pct, id: ALL_MODULES[i].id, title: ALL_MODULES[i].title }))
    .filter((x): x is { pct: number; id: number; title: string } => x.pct !== null && x.pct < WEAK_THRESHOLD)
    .sort((a, b) => a.pct - b.pct);
  for (const w of weak.slice(0, 3)) {
    items.push({
      id: `weak-${w.id}`,
      severity: w.pct < CRITICAL_THRESHOLD ? "critical" : "warning",
      kind: "Қайталау",
      title: `«${w.title}» тақырыбын қайталау керек`,
      evidence: `Викторинадағы ең жақсы нәтижең: ${w.pct}%.`,
      action: "Дәрісті қайта қара, глоссарийді пысықта да, викторинаны қайта тапсыр.",
      href: `/modules/${w.id}`,
    });
  }

  // 2. Where to continue — the first lesson with no attempt at all.
  const attemptedCount = scores.filter((s) => s !== null).length;
  const nextIndex = scores.findIndex((s) => s === null);
  if (nextIndex !== -1) {
    const next = ALL_MODULES[nextIndex];
    items.push({
      id: "next-lesson",
      severity: "info",
      kind: "Жалғастыру",
      title: attemptedCount === 0 ? "Курсты бастау уақыты келді" : `Келесі сабақ: «${next.title}»`,
      evidence: `${attemptedCount}/${ALL_MODULES.length} сабақтың викторинасын тапсырдың.`,
      action: "Дәрісті қара, 3D симуляцияны сынап көр, содан кейін викторинаны тапсыр.",
      href: `/modules/${next.id}`,
    });
  }

  // 3. The lesson's 3D experiment. This one is always present, for whichever
  //    lesson the student is on: the simulations are the point of the course
  //    and the part nobody can edit away, so the plan should never be a list
  //    that quietly omits them. It points at the weakest attempted lesson
  //    first — running the experiment is the fastest way to fix a bad score —
  //    and otherwise at wherever the student currently is.
  const simTarget = weak[0]?.id ?? ALL_MODULES[Math.max(0, nextIndex)]?.id ?? ALL_MODULES[0].id;
  const sim = getSimulation(simTarget);
  if (sim) {
    const mod = getModuleById(simTarget);
    items.push({
      id: `simulation-${simTarget}`,
      severity: "info",
      kind: "3D тәжірибе",
      title: `«${sim.title}» симуляциясын жаса`,
      evidence: weak[0]
        ? `«${mod?.title ?? ""}» бойынша ұпайың ${weak[0].pct}% — тәжірибе ұғымды бекітеді.`
        : `${sim.devices.join(", ")} қолданылады, шамамен ${sim.minutes} минут.`,
      action: sim.subtitle,
      href: `/modules/${simTarget}?tab=simulation`,
    });
  }

  // 4. Games the student has not tried on their current lesson.
  const playedModules = new Set(games.map((g) => g.moduleId));
  const gameTarget = nextIndex !== -1 ? ALL_MODULES[Math.max(0, nextIndex - 1)]?.id : undefined;
  if (gameTarget && attemptedCount > 0 && !playedModules.has(gameTarget)) {
    items.push({
      id: `games-${gameTarget}`,
      severity: "info",
      kind: "Ойын",
      title: "Терминдерді ойынмен бекіт",
      evidence: "Бұл сабақтың ойындарын әлі ойнамағансың.",
      action: "Кроссворд, сөз табу немесе жылдам жауап — глоссарийді жаттауға көмектеседі.",
      href: `/modules/${gameTarget}?tab=game`,
    });
  }

  // 5. Submitted work waiting on the teacher — informational, not a task.
  const pending = submissions.filter((s) => s.status === "pending");
  if (pending.length > 0) {
    items.push({
      id: "pending-feedback",
      severity: "info",
      kind: "БӨЖ",
      title: `${pending.length} тапсырма тексерілуде`,
      evidence: "Оқытушы әлі баға қойған жоқ.",
      action: "Кері байланысты күте тұр, осы уақытта басқа сабақты жалғастыр.",
    });
  }

  // 6. Graded work with a low mark — done, but worth revisiting.
  const lowGraded = submissions.filter(
    (s) => s.status === "reviewed" && typeof s.grade === "number" && s.grade < WEAK_THRESHOLD
  );
  for (const s of lowGraded.slice(0, 2)) {
    const mod = getModuleById(s.moduleId);
    items.push({
      id: `low-grade-${s.id}`,
      severity: "warning",
      kind: "БӨЖ",
      title: mod ? `«${mod.title}» тапсырмасын жақсарту керек` : "БӨЖ тапсырмасын жақсарту керек",
      evidence: `Баға: ${s.grade}%.${s.teacherFeedback ? " Оқытушы пікір қалдырды." : ""}`,
      action: "Оқытушының ескертуін оқы да, тапсырманы қайта тапсыр.",
      href: mod ? `/modules/${mod.id}` : undefined,
    });
  }

  // 7. Nothing flagged and the student has actually started — encouragement,
  //    not silence, and a concrete next step rather than just praise.
  const hasRisk = items.some((i) => i.severity !== "info");
  if (!hasRisk && attemptedCount > 0) {
    const avg = Math.round(
      scores.reduce((a: number, s) => a + (s ?? 0), 0) / attemptedCount
    );
    items.unshift({
      id: "on-track",
      severity: "info",
      kind: "Прогресс",
      title: "Жақсы қарқынмен барасың",
      evidence: `Тапсырған викториналардың орташа ұпайы: ${avg}%. Артта қалған тақырып жоқ.`,
      action: "AI тьюторда қосымша есептер сұрап, білімді тереңдет.",
      href: "/ai-tutor",
    });
  }

  return items.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
