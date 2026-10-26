"use client";

// Loads the teacher's cohort: who their accepted students are, and every
// learning record those students have written.
//
// The queries carry no `user_id` filter. Row-level security on each table
// already returns exactly "my own rows or my accepted students' rows" (migration
// 0008/0011), so a teacher asking for the whole table gets their class and
// nothing else — and there is no client-side filter to forget. The columns are
// listed explicitly because `assignment_submissions.content` can be a large
// file reference that an aggregate has no use for.

import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { listLinks, partitionLinks } from "@/lib/supabase/links";
import type { AppUser } from "@/lib/types";
import {
  buildCohortData,
  demoCohortData,
  type CohortData,
  type CohortRecords,
  type CohortStudent,
} from "./cohort";

// PostgREST returns at most 1000 rows per request by default and does not say
// when it has cut a result short. Without paging, a class with a few hundred
// quiz attempts would silently lose its newest ones — the wrong ones to lose.
const PAGE = 1000;

async function fetchAll(table: string, columns: string, orderBy: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: false })
      // `id` breaks ties, so a row on a page boundary is neither repeated nor skipped.
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

async function fetchRecords(): Promise<CohortRecords> {
  const [quiz, games, subs, assess, diag] = await Promise.all([
    fetchAll("quiz_attempts", "id,user_id,module_id,score,total,taken_at", "taken_at"),
    fetchAll("game_results", "id,user_id,module_id,game_type,score,completed_at", "completed_at"),
    fetchAll("assignment_submissions", "id,user_id,module_id,type,status,grade,submitted_at", "submitted_at"),
    fetchAll("competency_assessments", "id,user_id,module_id,scores,average_level,percent,assessor_type,assessed_at", "assessed_at"),
    fetchAll("diagnostic_attempts", "id,user_id,phase,score,total,taken_at", "taken_at"),
  ]);

  return {
    quiz: quiz.map((r) => ({
      id: r.id,
      userId: r.user_id,
      moduleId: r.module_id,
      score: r.score,
      total: r.total,
      answers: [],
      takenAt: r.taken_at,
    })),
    games: games.map((r) => ({
      id: r.id,
      userId: r.user_id,
      moduleId: r.module_id,
      gameType: r.game_type,
      score: r.score,
      completedAt: r.completed_at,
    })),
    submissions: subs.map((r) => ({
      id: r.id,
      userId: r.user_id,
      moduleId: r.module_id,
      type: r.type,
      content: "",
      status: r.status,
      grade: r.grade ?? undefined,
      submittedAt: r.submitted_at,
    })),
    assessments: assess.map((r) => ({
      id: r.id,
      userId: r.user_id,
      moduleId: r.module_id,
      scores: r.scores ?? [],
      averageLevel: Number(r.average_level),
      percent: r.percent,
      assessedAt: r.assessed_at,
      assessorType: r.assessor_type,
    })),
    diagnostics: diag.map((r) => ({
      id: r.id,
      userId: r.user_id,
      phase: r.phase,
      score: r.score,
      total: r.total,
      answers: [],
      takenAt: r.taken_at,
    })),
  };
}

/**
 * The teacher's cohort. With no backend configured this is the synthetic demo
 * class (flagged `source: "demo"` so the page can say so); with one, it is the
 * accepted students' real records.
 */
export async function loadCohort(me: AppUser): Promise<CohortData> {
  if (!(isSupabaseConfigured && supabase)) return demoCohortData();

  const { accepted } = partitionLinks(await listLinks(me));
  const students: CohortStudent[] = accepted.map((l) => ({
    id: l.person.id,
    fullName: l.person.fullName,
    group: l.person.studyGroup ?? null,
  }));
  if (students.length === 0) return buildCohortData([], emptyRecords());

  return buildCohortData(students, await fetchRecords());
}

function emptyRecords(): CohortRecords {
  return { quiz: [], games: [], submissions: [], assessments: [], diagnostics: [] };
}
