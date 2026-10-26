// The weekly group league: which group of students did the most studying this week?
//
// Scored on *participation*, not on marks. A record earns a fixed number of points
// whatever the score on it, so a student who is still finding their feet can lift
// their group exactly as much as a strong one, and nobody's marks are shown to
// their classmates. A group's figure is the **mean** of its members' points —
// inactive members included — so a group of eight is not beaten by a group of
// thirty for being smaller, and nobody wins by leaving the quiet ones out.
//
// The rule below also exists in SQL, as league_week() in migration 0012, which is
// what the live backend runs (a student may not read their classmates' records, so
// only a security-definer function can add them up). This copy is the demo path.
// supabase/tests/0012_league.sql and src/lib/league.test.ts feed the same records
// to each and expect the same numbers: change one, change the other.

import type { EngagementRecords } from "./engagement";

/** Points a single record is worth. */
export const LEAGUE_POINTS = {
  quiz: 10,
  game: 5,
  daily: 10,
  submission: 15,
  assessment: 5,
  diagnostic: 10,
} as const;

/** The most one student can earn in one day, so a single evening of grinding cannot win a week. */
export const DAY_CAP = 40;

/** A group needs this many members to be ranked: one star cannot stand for a group. */
export const MIN_GROUP_SIZE = 2;

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** Monday 00:00 of the week containing `now`, in the viewer's own time zone. */
export function weekStartOf(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** The same weekday `weeks` weeks away (negative for the past), by calendar rather than by 168 hours. */
export function shiftWeek(weekStart: Date, weeks: number): Date {
  const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  d.setDate(d.getDate() + 7 * weeks);
  return d;
}

const MONTHS = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];

/** "26 қазан – 1 қараша" */
export function weekLabel(weekStart: Date): string {
  const end = shiftWeek(weekStart, 0);
  end.setDate(end.getDate() + 6);
  const a = `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()]}`;
  const b = `${end.getDate()} ${MONTHS[end.getMonth()]}`;
  return `${a} – ${b}`;
}

export interface Participation {
  points: number;
  /** Days of the week with at least one record. */
  activeDays: number;
}

/**
 * What one student earned in the week starting at `weekStart`.
 *
 * Days are 24-hour blocks counted from the start of the week, exactly as in SQL —
 * so on the one night a year the clocks change, a record made in the small hours
 * can fall a block early or late. That is accepted rather than made to disagree
 * with the database.
 */
export function participationPoints(records: EngagementRecords, weekStart: Date): Participation {
  const t0 = weekStart.getTime();
  const perDay = new Map<number, number>();
  const add = (iso: string, pts: number) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t) || t < t0 || t >= t0 + WEEK_MS) return;
    const day = Math.floor((t - t0) / DAY_MS);
    perDay.set(day, (perDay.get(day) ?? 0) + pts);
  };

  for (const q of records.quizzes) add(q.takenAt, LEAGUE_POINTS.quiz);
  for (const g of records.games) add(g.completedAt, g.gameType === "daily" ? LEAGUE_POINTS.daily : LEAGUE_POINTS.game);
  for (const s of records.submissions) add(s.submittedAt, LEAGUE_POINTS.submission);
  for (const a of records.assessments) add(a.assessedAt, LEAGUE_POINTS.assessment);
  for (const d of records.diagnostics) add(d.takenAt, LEAGUE_POINTS.diagnostic);

  let points = 0;
  for (const p of perDay.values()) points += Math.min(DAY_CAP, p);
  return { points, activeDays: perDay.size };
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

export interface LeagueMember {
  userId: string;
  fullName: string;
  /** As the student wrote it; null or blank when they gave none. */
  group: string | null;
  isMe: boolean;
  points: number;
  activeDays: number;
}

export interface RankedMember extends LeagueMember {
  rank: number;
}

export interface GroupStanding {
  /** How the group is written for display. */
  name: string;
  members: number;
  /** Members with any points this week. */
  active: number;
  total: number;
  /** total / members — the figure groups are ranked on. */
  mean: number;
  /** null while the group is too small to be ranked. */
  rank: number | null;
  top: LeagueMember | null;
  hasMe: boolean;
}

/** "МТ-21", " мт-21 " and "Мт-21" are one group. */
export const groupKey = (g: string) => g.trim().replace(/\s+/g, " ").toLowerCase();

/** Competition ranking: equals share a place and the next place is skipped (1, 1, 3). */
function rankBy<T>(rows: T[], same: (a: T, b: T) => boolean): number[] {
  const ranks: number[] = [];
  rows.forEach((r, i) => ranks.push(i > 0 && same(rows[i - 1], r) ? ranks[i - 1] : i + 1));
  return ranks;
}

export function individualStandings(members: LeagueMember[]): RankedMember[] {
  const sorted = [...members].sort(
    (a, b) => b.points - a.points || b.activeDays - a.activeDays || a.fullName.localeCompare(b.fullName, "kk")
  );
  const ranks = rankBy(sorted, (a, b) => a.points === b.points && a.activeDays === b.activeDays);
  return sorted.map((m, i) => ({ ...m, rank: ranks[i] }));
}

export function groupStandings(members: LeagueMember[]): GroupStanding[] {
  const byGroup = new Map<string, LeagueMember[]>();
  for (const m of members) {
    if (!m.group || !m.group.trim()) continue;
    const k = groupKey(m.group);
    byGroup.set(k, [...(byGroup.get(k) ?? []), m]);
  }

  const rows = [...byGroup.values()].map((ms): GroupStanding => {
    const total = ms.reduce((a, m) => a + m.points, 0);
    const best = [...ms].sort((a, b) => b.points - a.points || a.fullName.localeCompare(b.fullName, "kk"))[0];
    return {
      name: ms[0].group!.trim().replace(/\s+/g, " "),
      members: ms.length,
      active: ms.filter((m) => m.points > 0).length,
      total,
      mean: total / ms.length,
      rank: null,
      top: best.points > 0 ? best : null,
      hasMe: ms.some((m) => m.isMe),
    };
  });

  const ranked = rows
    .filter((g) => g.members >= MIN_GROUP_SIZE)
    .sort((a, b) => b.mean - a.mean || b.active / b.members - a.active / a.members || a.name.localeCompare(b.name, "kk"));
  const ranks = rankBy(ranked, (a, b) => a.mean === b.mean && a.active / a.members === b.active / b.members);
  ranked.forEach((g, i) => (g.rank = ranks[i]));

  const small = rows.filter((g) => g.members < MIN_GROUP_SIZE).sort((a, b) => a.name.localeCompare(b.name, "kk"));
  return [...ranked, ...small];
}

/** The group(s) in first place — several on a tie — and only if anyone studied at all. */
export function champions(standings: GroupStanding[]): GroupStanding[] {
  return standings.filter((g) => g.rank === 1 && g.mean > 0);
}

/** How much of the group's week was mine, 0–1 (0 when the group did nothing). */
export function myShare(members: LeagueMember[]): number {
  const me = members.find((m) => m.isMe);
  if (!me || !me.group) return 0;
  const key = groupKey(me.group);
  const total = members.filter((m) => m.group && groupKey(m.group) === key).reduce((a, m) => a + m.points, 0);
  return total === 0 ? 0 : me.points / total;
}
