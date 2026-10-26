// Unified data-access layer. Every read and write of a student's work goes
// through this module: quiz attempts, game results, БӨЖ submissions,
// competency assessments and certificates.
//
// With Supabase configured it talks to the tables from migration 0008;
// otherwise it falls back to localStorage so the project still demos with no
// backend at all. The two branches return identical shapes, so no caller ever
// needs to know which one ran.
//
// Row-level security does the access control, not this file. A teacher reading
// `getAssignmentSubmissions()` with no argument gets exactly their own accepted
// students' work, because that is what the policy allows — there is no
// client-side filter to forget.
"use client";

import { isSupabaseConfigured, supabase } from "./supabase/client";
import type {
  AppUser,
  QuizAttempt,
  GameResult,
  AssignmentSubmission,
  CompetencyAssessment,
  DiagnosticAttempt,
  PredictionAttempt,
  SensorResult,
  Certificate,
  LeaderboardEntry,
  Notification,
  AnalyticsSnapshot,
  FinalGradeResult,
  RubricCriterionScore,
} from "./types";

const LS_PREFIX = "mechanics-lms:";

function lsGet<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

/** True when writes should go to the database rather than the browser. */
function live() {
  return isSupabaseConfigured && supabase !== null;
}

// ---------------------------------------------------------------------------
// Users / Auth profile
//
// Profiles live in Supabase and are handled by src/lib/supabase/accounts.ts;
// these two remain for the localStorage demo path only.
// ---------------------------------------------------------------------------
export async function getCurrentUserProfile(uidValue: string): Promise<AppUser | null> {
  const users = lsGet<Record<string, AppUser>>("users", {});
  return users[uidValue] ?? null;
}

export async function upsertUserProfile(user: AppUser): Promise<void> {
  const users = lsGet<Record<string, AppUser>>("users", {});
  users[user.uid] = { ...users[user.uid], ...user };
  lsSet("users", users);
}

// ---------------------------------------------------------------------------
// Quiz attempts
// ---------------------------------------------------------------------------
export async function saveQuizAttempt(attempt: QuizAttempt): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("quiz_attempts").insert({
      user_id: attempt.userId,
      module_id: attempt.moduleId,
      score: attempt.score,
      total: attempt.total,
      answers: attempt.answers,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const attempts = lsGet<QuizAttempt[]>("quizAttempts", []);
  attempts.unshift(attempt);
  lsSet("quizAttempts", attempts);
}

export async function getQuizAttempts(userId: string, moduleId?: number): Promise<QuizAttempt[]> {
  if (live()) {
    let q = supabase!
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", userId)
      .order("taken_at", { ascending: false });
    if (moduleId) q = q.eq("module_id", moduleId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      moduleId: r.module_id,
      score: r.score,
      total: r.total,
      answers: r.answers ?? [],
      takenAt: r.taken_at,
    }));
  }
  const attempts = lsGet<QuizAttempt[]>("quizAttempts", []);
  return attempts.filter((a) => a.userId === userId && (!moduleId || a.moduleId === moduleId));
}

// ---------------------------------------------------------------------------
// Game results
// ---------------------------------------------------------------------------
export async function saveGameResult(result: GameResult): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("game_results").insert({
      user_id: result.userId,
      module_id: result.moduleId,
      game_type: result.gameType,
      score: Math.round(result.score),
    });
    if (error) throw new Error(error.message);
    return;
  }
  const results = lsGet<GameResult[]>("gameResults", []);
  results.unshift(result);
  lsSet("gameResults", results);
}

export async function getGameResults(userId: string): Promise<GameResult[]> {
  if (live()) {
    const { data, error } = await supabase!
      .from("game_results")
      .select("*")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      moduleId: r.module_id,
      gameType: r.game_type,
      score: r.score,
      completedAt: r.completed_at,
    }));
  }
  return lsGet<GameResult[]>("gameResults", []).filter((r) => r.userId === userId);
}

// ---------------------------------------------------------------------------
// БӨЖ assignment submissions
// ---------------------------------------------------------------------------
function rowToSubmission(r: any): AssignmentSubmission {
  return {
    id: r.id,
    userId: r.user_id,
    moduleId: r.module_id,
    type: r.type,
    content: r.content,
    submittedAt: r.submitted_at,
    teacherFeedback: r.teacher_feedback ?? undefined,
    grade: r.grade ?? undefined,
    status: r.status,
  };
}

export async function submitAssignment(submission: AssignmentSubmission): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("assignment_submissions").insert({
      user_id: submission.userId,
      module_id: submission.moduleId,
      type: submission.type,
      content: submission.content,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const list = lsGet<AssignmentSubmission[]>("assignmentSubmissions", []);
  list.unshift(submission);
  lsSet("assignmentSubmissions", list);
}

/**
 * With no `userId` this returns everything the caller is allowed to see: their
 * own work as a student, or every accepted student's work as a teacher. That
 * filtering is the RLS policy's job, which is why there is no role check here.
 */
export async function getAssignmentSubmissions(userId?: string): Promise<AssignmentSubmission[]> {
  if (live()) {
    let q = supabase!
      .from("assignment_submissions")
      .select("*")
      .order("submitted_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToSubmission);
  }
  const list = lsGet<AssignmentSubmission[]>("assignmentSubmissions", []);
  return userId ? list.filter((a) => a.userId === userId) : list;
}

/** A submission with the student attached — what a marking queue needs. */
export interface SubmissionForReview extends AssignmentSubmission {
  student: { id: string; fullName: string; userCode: string; studyGroup?: string | null };
}

/**
 * The teacher's marking queue. The embed is what makes this different from
 * getAssignmentSubmissions: a queue needs names, and RLS already limits the
 * rows to accepted students, so the join cannot leak anybody else.
 */
export async function getSubmissionsForReview(): Promise<SubmissionForReview[]> {
  if (live()) {
    const { data, error } = await supabase!
      .from("assignment_submissions")
      .select(
        "*, student:profiles!assignment_submissions_user_id_fkey (id, full_name, user_code, study_group)"
      )
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => {
      const p = Array.isArray(r.student) ? r.student[0] : r.student;
      return {
        ...rowToSubmission(r),
        student: {
          id: p?.id ?? r.user_id,
          fullName: p?.full_name ?? "—",
          userCode: p?.user_code ?? "",
          studyGroup: p?.study_group ?? null,
        },
      };
    });
  }

  // Demo path: names come from the mock directory, which is the only place a
  // student identity exists offline.
  const { mockPerson } = await import("./supabase/mock");
  return lsGet<AssignmentSubmission[]>("assignmentSubmissions", []).map((s) => {
    const p = mockPerson(s.userId);
    return {
      ...s,
      student: {
        id: s.userId,
        fullName: p?.fullName ?? "Студент",
        userCode: p?.userCode ?? "",
        studyGroup: p?.studyGroup ?? null,
      },
    };
  });
}

/** Teacher action. The trigger stamps who graded it and flips the status. */
export async function gradeAssignment(
  submissionId: string,
  grade: number,
  feedback: string
): Promise<void> {
  if (live()) {
    const { error } = await supabase!
      .from("assignment_submissions")
      .update({ grade: Math.round(grade), teacher_feedback: feedback })
      .eq("id", submissionId);
    if (error) throw new Error(translateRecordError(error.message));
    return;
  }
  const list = lsGet<AssignmentSubmission[]>("assignmentSubmissions", []);
  const row = list.find((s) => s.id === submissionId);
  if (!row) return;
  row.grade = Math.round(grade);
  row.teacherFeedback = feedback;
  row.status = "reviewed";
  lsSet("assignmentSubmissions", list);
}

// ---------------------------------------------------------------------------
// Competency assessments
// ---------------------------------------------------------------------------
export async function saveCompetencyAssessment(assessment: CompetencyAssessment): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("competency_assessments").insert({
      user_id: assessment.userId,
      module_id: assessment.moduleId,
      scores: assessment.scores,
      average_level: assessment.averageLevel,
      percent: Math.round(assessment.percent),
      assessor_type: assessment.assessorType,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const list = lsGet<CompetencyAssessment[]>("competencyAssessments", []);
  list.unshift(assessment);
  lsSet("competencyAssessments", list);
}

export async function getCompetencyAssessments(userId: string): Promise<CompetencyAssessment[]> {
  if (live()) {
    const { data, error } = await supabase!
      .from("competency_assessments")
      .select("*")
      .eq("user_id", userId)
      .order("assessed_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      moduleId: r.module_id,
      scores: (r.scores ?? []) as RubricCriterionScore[],
      averageLevel: Number(r.average_level),
      percent: r.percent,
      assessedAt: r.assessed_at,
      assessorType: r.assessor_type,
    }));
  }
  return lsGet<CompetencyAssessment[]>("competencyAssessments", []).filter(
    (c) => c.userId === userId
  );
}

// ---------------------------------------------------------------------------
// Diagnostic (pre/post) attempts
//
// One sitting per student per phase, append-only — see migration 0011 for why.
// The localStorage branch enforces the same two rules the database does, so the
// demo cannot do something the real thing refuses.
// ---------------------------------------------------------------------------
export const DIAGNOSTIC_TAKEN_MESSAGE = "Бұл диагностика бұрын тапсырылған — қайта тапсыруға болмайды.";
export const DIAGNOSTIC_NEEDS_PRE_MESSAGE =
  "Қорытынды диагностика бастапқы диагностикадан кейін ғана тапсырылады.";

function rowToDiagnostic(r: any): DiagnosticAttempt {
  return {
    id: r.id,
    userId: r.user_id,
    phase: r.phase,
    score: r.score,
    total: r.total,
    answers: r.answers ?? [],
    takenAt: r.taken_at,
  };
}

export async function saveDiagnosticAttempt(attempt: DiagnosticAttempt): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("diagnostic_attempts").insert({
      user_id: attempt.userId,
      phase: attempt.phase,
      score: attempt.score,
      total: attempt.total,
      answers: attempt.answers,
    });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("duplicate key")) throw new Error(DIAGNOSTIC_TAKEN_MESSAGE);
      if (m.includes("row-level security")) throw new Error(DIAGNOSTIC_NEEDS_PRE_MESSAGE);
      throw new Error(error.message);
    }
    return;
  }
  const list = lsGet<DiagnosticAttempt[]>("diagnosticAttempts", []);
  const mine = list.filter((a) => a.userId === attempt.userId);
  if (mine.some((a) => a.phase === attempt.phase)) throw new Error(DIAGNOSTIC_TAKEN_MESSAGE);
  if (attempt.phase === "post" && !mine.some((a) => a.phase === "pre")) {
    throw new Error(DIAGNOSTIC_NEEDS_PRE_MESSAGE);
  }
  list.unshift(attempt);
  lsSet("diagnosticAttempts", list);
}

/**
 * With no `userId`: everything the caller may see — their own sittings as a
 * student, every accepted student's as a teacher (the RLS policy decides).
 */
export async function getDiagnosticAttempts(userId?: string): Promise<DiagnosticAttempt[]> {
  if (live()) {
    let q = supabase!.from("diagnostic_attempts").select("*").order("taken_at", { ascending: false });
    if (userId) q = q.eq("user_id", userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map(rowToDiagnostic);
  }
  const list = lsGet<DiagnosticAttempt[]>("diagnosticAttempts", []);
  return userId ? list.filter((a) => a.userId === userId) : list;
}

// ---------------------------------------------------------------------------
// Predictions ("predict, then look")
// ---------------------------------------------------------------------------
function rowToPrediction(r: any): PredictionAttempt {
  return {
    id: r.id,
    userId: r.user_id,
    itemId: r.item_id,
    optionId: r.option_id,
    correct: Boolean(r.correct),
    misconception: r.misconception ?? null,
    confidence: r.confidence,
    createdAt: r.created_at,
  };
}

export async function savePrediction(a: PredictionAttempt): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("prediction_attempts").insert({
      user_id: a.userId,
      item_id: a.itemId,
      option_id: a.optionId,
      correct: a.correct,
      misconception: a.misconception,
      confidence: a.confidence,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const list = lsGet<PredictionAttempt[]>("predictions", []);
  list.unshift(a);
  lsSet("predictions", list);
}

/**
 * With no `userId`: everything the caller may see — their own as a student, every
 * accepted student's as a teacher (the RLS policy decides). Paged, because the
 * API returns at most a thousand rows a request and says nothing when it cuts one off.
 */
export async function getPredictions(userId?: string): Promise<PredictionAttempt[]> {
  if (live()) {
    const out: PredictionAttempt[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = supabase!.from("prediction_attempts").select("*").order("created_at", { ascending: false }).order("id");
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []).map(rowToPrediction));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }
  const list = lsGet<PredictionAttempt[]>("predictions", []);
  return userId ? list.filter((a) => a.userId === userId) : list;
}

// ---------------------------------------------------------------------------
// Phone-sensor measurements
// ---------------------------------------------------------------------------
function rowToSensor(r: any): SensorResult {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    value: Number(r.value),
    unit: r.unit,
    details: r.details ?? {},
    createdAt: r.created_at,
  };
}

export async function saveSensorResult(r: SensorResult): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("sensor_results").insert({
      user_id: r.userId,
      kind: r.kind,
      value: r.value,
      unit: r.unit,
      details: r.details,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const list = lsGet<SensorResult[]>("sensorResults", []);
  list.unshift(r);
  lsSet("sensorResults", list);
}

/** With no `userId`: everything the caller may see (a teacher: their accepted students'). */
export async function getSensorResults(userId?: string): Promise<SensorResult[]> {
  if (live()) {
    const out: SensorResult[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = supabase!.from("sensor_results").select("*").order("created_at", { ascending: false }).order("id");
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      out.push(...(data ?? []).map(rowToSensor));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }
  const list = lsGet<SensorResult[]>("sensorResults", []);
  return userId ? list.filter((a) => a.userId === userId) : list;
}

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------
export async function issueCertificate(cert: Certificate): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("certificates").insert({
      id: cert.id,
      user_id: cert.userId,
      course_name: cert.courseName,
      qr_data: cert.qrData,
      verify_url: cert.verifyUrl,
    });
    if (error) throw new Error(error.message);
    return;
  }
  const list = lsGet<Certificate[]>("certificates", []);
  list.unshift(cert);
  lsSet("certificates", list);
}

export async function getCertificates(userId: string): Promise<Certificate[]> {
  if (live()) {
    const { data, error } = await supabase!
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      courseName: r.course_name,
      issuedAt: r.issued_at,
      qrData: r.qr_data,
      verifyUrl: r.verify_url,
    }));
  }
  return lsGet<Certificate[]>("certificates", []).filter((c) => c.userId === userId);
}

/** Public lookup behind the QR code — the reader is usually not signed in. */
export async function verifyCertificate(
  certId: string
): Promise<{ id: string; fullName: string; courseName: string; issuedAt: string } | null> {
  if (live()) {
    const { data, error } = await supabase!.rpc("verify_certificate", { cert_id: certId });
    if (error) return null;
    const row = (data ?? [])[0];
    return row
      ? {
          id: row.id,
          fullName: row.full_name,
          courseName: row.course_name,
          issuedAt: row.issued_at,
        }
      : null;
  }
  const local = lsGet<Certificate[]>("certificates", []).find((c) => c.id === certId);
  return local
    ? { id: local.id, fullName: "—", courseName: local.courseName, issuedAt: local.issuedAt }
    : null;
}

// ---------------------------------------------------------------------------
// Leaderboard — see listClassmates() in supabase/links.ts, which is what the
// page actually uses. This remains for the localStorage demo path.
// ---------------------------------------------------------------------------
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  return lsGet<LeaderboardEntry[]>("leaderboard", []).sort((a, b) => b.xp - a.xp);
}

// ---------------------------------------------------------------------------
// Notifications — still local. Real events (link requests, duel challenges,
// grades) exist now, so this is the next thing to move.
// ---------------------------------------------------------------------------
export async function getNotifications(userId: string): Promise<Notification[]> {
  return lsGet<Notification[]>("notifications", []).filter((n) => n.userId === userId);
}

export async function pushNotification(n: Notification): Promise<void> {
  const list = lsGet<Notification[]>("notifications", []);
  list.unshift(n);
  lsSet("notifications", list);
}

// ---------------------------------------------------------------------------
// Derived figures. studentStats.ts computes these from the records above, so
// these two are only a cache for the demo path.
// ---------------------------------------------------------------------------
export async function getAnalyticsSnapshot(userId: string): Promise<AnalyticsSnapshot> {
  return lsGet<AnalyticsSnapshot>(`analytics:${userId}`, {
    userId,
    weeklyActivityMinutes: [0, 0, 0, 0, 0, 0, 0],
    monthlyActivityMinutes: Array.from({ length: 30 }, () => 0),
    quizAverages: Array.from({ length: 10 }, () => 0),
    competencyRadar: [],
    timeSpentTotalMinutes: 0,
  });
}

export async function saveFinalGrade(result: FinalGradeResult): Promise<void> {
  const map = lsGet<Record<string, FinalGradeResult>>("finalGrades", {});
  map[result.userId] = result;
  lsSet("finalGrades", map);
}

export async function getFinalGrade(userId: string): Promise<FinalGradeResult | null> {
  const map = lsGet<Record<string, FinalGradeResult>>("finalGrades", {});
  return map[userId] ?? null;
}

function translateRecordError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("not allowed to modify this submission"))
    return "Бұл тапсырманы өзгертуге рұқсатыңыз жоқ.";
  if (m.includes("row-level security"))
    return "Рұқсат жоқ — студент сіздің тобыңызда емес болуы мүмкін.";
  return message;
}

export { uid as generateId };
