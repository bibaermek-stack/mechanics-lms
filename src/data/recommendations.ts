// Turns the cohort figures into a ranked list of things the teacher should
// actually do. Charts show what happened; this says what to do about it, which
// is the part a dashboard usually leaves to the reader.

import { ALL_MODULES } from "./modules";
import {
  COHORT,
  lessonAverages,
  lessonCompletion,
  studentAverage,
  studentProgress,
  type StudentRow,
} from "./cohort";
import type { ActionItem, ActionSeverity } from "@/lib/types";

export type { ActionItem, ActionSeverity };

/** A lesson is "hard" when the cohort average falls below this. */
const HARD_LESSON_AVG = 72;
/** Below this a student needs help rather than a nudge. */
const AT_RISK_PROGRESS = 50;
const AT_RISK_SCORE = 65;
const STALE_DAYS = 7;

const ORDER: Record<ActionSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function buildActions(rows: StudentRow[] = COHORT): ActionItem[] {
  const items: ActionItem[] = [];
  const averages = lessonAverages(rows);
  const completion = lessonCompletion(rows);

  // 1. Students who are both behind and scoring badly — these need contact.
  const atRisk = rows.filter(
    (r) => studentProgress(r) < AT_RISK_PROGRESS && studentAverage(r) < AT_RISK_SCORE
  );
  if (atRisk.length > 0) {
    items.push({
      id: "at-risk",
      severity: "critical",
      kind: "Студенттер",
      title: `${atRisk.length} студент қауіп тобында`,
      evidence: `Прогресі ${AT_RISK_PROGRESS}%-дан төмен және орташа ұпайы ${AT_RISK_SCORE}%-дан аз.`,
      action: "Жеке кеңес тағайында, қайталау тапсырмасын бер.",
      href: "/teacher/students",
      names: atRisk.map((r) => r.fullName),
    });
  }

  // 2. Lessons the whole cohort struggles with — a teaching problem, not a
  //    student problem, so it is ranked next.
  const hard = averages
    .map((avg, i) => ({ avg, i }))
    .filter((x): x is { avg: number; i: number } => x.avg !== null && x.avg < HARD_LESSON_AVG)
    .sort((a, b) => a.avg - b.avg);
  for (const h of hard.slice(0, 2)) {
    items.push({
      id: `hard-lesson-${h.i}`,
      severity: "warning",
      kind: "Сабақ",
      title: `«${ALL_MODULES[h.i].title}» — топтың әлсіз тұсы`,
      evidence: `Орташа ұпай ${h.avg}%, топтағы ең төмен көрсеткіштердің бірі.`,
      action: "Осы тақырыпты қайта түсіндір, 3D симуляциясын сабақта бірге өт.",
      href: `/modules/${ALL_MODULES[h.i].id}`,
    });
  }

  // 3. Ungraded work blocks the students' own feedback loop.
  const ungraded = rows.reduce((a, r) => a + r.ungraded, 0);
  if (ungraded > 0) {
    items.push({
      id: "ungraded",
      severity: "warning",
      kind: "Тапсырма",
      title: `${ungraded} БӨЖ тапсырмасы тексерілмеген`,
      evidence: `${rows.filter((r) => r.ungraded > 0).length} студент кері байланыс күтіп тұр.`,
      action: "Тапсырмаларды тексеріп, рубрика бойынша баға қой.",
      href: "/teacher/assignments",
      names: rows.filter((r) => r.ungraded > 0).map((r) => r.fullName),
    });
  }

  // 4. Students who have simply stopped showing up — or never started.
  const stale = rows.filter((r) => r.daysSinceActive === null || r.daysSinceActive >= STALE_DAYS);
  if (stale.length > 0) {
    const days = stale.map((r) => r.daysSinceActive).filter((d): d is number => d !== null);
    const never = stale.length - days.length;
    const parts: string[] = [];
    if (days.length) parts.push(`Соңғы кіру: ${Math.min(...days)}–${Math.max(...days)} күн бұрын.`);
    if (never) parts.push(`${never} студент әлі бірде-бір әрекет жасаған жоқ.`);
    items.push({
      id: "inactive",
      severity: "warning",
      kind: "Белсенділік",
      title: `${stale.length} студент бір аптадан бері кірмеген`,
      evidence: parts.join(" "),
      action: "Хабарландыру жібер, себебін анықта.",
      href: "/teacher/students",
      names: stale.map((r) => r.fullName),
    });
  }

  // 5. The lab is the platform's main differentiator; unused, it is wasted.
  //    Only students *known* not to have opened it: live data does not record
  //    that, and "unknown" is not "no".
  const noSim = rows.filter((r) => r.openedSimulation === false);
  if (noSim.length > 0) {
    items.push({
      id: "no-simulation",
      severity: "info",
      kind: "3D зертхана",
      title: `${noSim.length} студент 3D симуляцияны ашпаған`,
      evidence: "Виртуалды зертхана — курстың негізгі практикалық бөлігі.",
      action: "Сабақта бірге ашып көрсет, симуляция тапсырмасын бер.",
      href: "/modules/1",
      names: noSim.map((r) => r.fullName),
    });
  }

  // 6. The pre-test is only a baseline if it is taken before the course. A
  //    student who has already worked through lessons without one cannot be
  //    compared with themselves later, so this is worth chasing early.
  const noPre = rows.filter((r) => r.pre === null || r.pre === undefined);
  if (noPre.length > 0) {
    const started = noPre.filter((r) => r.scores.some((s) => s !== null)).length;
    items.push({
      id: "no-pre-test",
      severity: started > 0 ? "warning" : "info",
      kind: "Диагностика",
      title: `${noPre.length} студент бастапқы диагностиканы тапсырмаған`,
      evidence:
        started > 0
          ? `${started} студент сабақты бастап қойған — олардың «бастапқы» нәтижесі енді таза болмайды.`
          : "Бастапқы нәтиже оқуды бастамас бұрын алынғанда ғана салыстыруға жарайды.",
      action: "Студенттерге «Диагностика» бөлімін тапсыруды ескерт.",
      href: "/teacher/analytics",
      names: noPre.map((r) => r.fullName),
    });
  }

  // 7. Where the cohort stops in the course — the drop-off point.
  const dropIndex = completion.findIndex((c, i) => i > 0 && c < completion[0] * 0.5);
  if (dropIndex > 0) {
    items.push({
      id: "drop-off",
      severity: "info",
      kind: "Курс",
      title: `Топтың жартысы ${dropIndex + 1}-сабаққа жетпеген`,
      evidence: `1-сабақты ${completion[0]} студент, ${dropIndex + 1}-сабақты ${completion[dropIndex]} студент аяқтаған.`,
      action: "Осы сабақтан бастап қарқынды бәсеңдет немесе қосымша қолдау ұсын.",
      href: `/modules/${dropIndex + 1}`,
    });
  }

  return items.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
