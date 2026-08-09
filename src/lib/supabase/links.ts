"use client";

// The teacher ↔ student graph.
//
// One table serves both directions: a student applying to a teacher and a
// teacher inviting a student produce the same row, differing only in
// `requested_by`. Whoever did *not* send it is the one who may accept, which is
// what `awaitingMe` encodes for the UI.

import type {
  AppUser,
  LeaderboardEntry,
  LinkStatus,
  PersonSummary,
  TeacherLink,
  UserRole,
} from "@/lib/types";
import { isSupabaseConfigured, supabase } from "./client";
import { mockLinks, mockPerson, mockSaveLinks, mockDirectory, type MockLinkRow } from "./mock";

/** Embedded profile columns, named so both sides of the edge can be read. */
const LINK_SELECT = `
  id, teacher_id, student_id, status, requested_by, message, created_at, responded_at,
  teacher:profiles!teacher_links_teacher_id_fkey (id, full_name, user_code, role, study_group, avatar_url),
  student:profiles!teacher_links_student_id_fkey (id, full_name, user_code, role, study_group, avatar_url)
`;

interface EmbeddedProfile {
  id: string;
  full_name: string;
  user_code: string;
  role: UserRole;
  study_group: string | null;
  avatar_url: string | null;
}

interface LinkRow {
  id: string;
  teacher_id: string;
  student_id: string;
  status: LinkStatus;
  requested_by: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  teacher: EmbeddedProfile | EmbeddedProfile[] | null;
  student: EmbeddedProfile | EmbeddedProfile[] | null;
}

/** PostgREST returns an embed as an object or a one-element array by version. */
function one(v: EmbeddedProfile | EmbeddedProfile[] | null): EmbeddedProfile | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

function toPerson(p: EmbeddedProfile): PersonSummary {
  return {
    id: p.id,
    fullName: p.full_name,
    userCode: p.user_code,
    role: p.role,
    studyGroup: p.study_group,
    avatarUrl: p.avatar_url,
  };
}

function rowToLink(row: LinkRow, meId: string): TeacherLink {
  const iAmTeacher = row.teacher_id === meId;
  const other = one(iAmTeacher ? row.student : row.teacher);
  return {
    id: row.id,
    teacherId: row.teacher_id,
    studentId: row.student_id,
    status: row.status,
    requestedBy: row.requested_by,
    message: row.message,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    person: other
      ? toPerson(other)
      : { id: "", fullName: "—", userCode: "", role: iAmTeacher ? "student" : "teacher" },
    awaitingMe: row.status === "pending" && row.requested_by !== meId,
  };
}

function mockRowToLink(row: MockLinkRow, meId: string): TeacherLink {
  const otherId = row.teacherId === meId ? row.studentId : row.teacherId;
  const person = mockPerson(otherId);
  return {
    id: row.id,
    teacherId: row.teacherId,
    studentId: row.studentId,
    status: row.status,
    requestedBy: row.requestedBy,
    message: row.message,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    person:
      person ?? {
        id: otherId,
        fullName: "Белгісіз",
        userCode: "",
        role: row.teacherId === meId ? "student" : "teacher",
      },
    awaitingMe: row.status === "pending" && row.requestedBy !== meId,
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Find people you may not be linked to yet, by shareable code, by name, or by
 * an exact email. Two characters minimum — a one-letter query would return a
 * slice of the whole directory.
 */
export async function searchPeople(term: string, wantRole: UserRole): Promise<PersonSummary[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("search_people", { term: q, want_role: wantRole });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      fullName: r.full_name,
      userCode: r.user_code,
      role: r.role,
      studyGroup: r.study_group,
      avatarUrl: r.avatar_url,
      linkStatus: r.link_status ?? null,
      requestedBy: r.requested_by ?? null,
    }));
  }

  const meId = currentMockId();
  const links = mockLinks();
  const needle = q.toLowerCase();
  return mockDirectory()
    .filter((p) => p.role === wantRole && p.id !== meId)
    .filter(
      (p) => p.userCode.toLowerCase() === needle || p.fullName.toLowerCase().includes(needle)
    )
    .slice(0, 20)
    .map((p) => {
      const edge = links.find(
        (l) =>
          (l.teacherId === p.id && l.studentId === meId) ||
          (l.studentId === p.id && l.teacherId === meId)
      );
      return { ...p, linkStatus: edge?.status ?? null, requestedBy: edge?.requestedBy ?? null };
    })
    .sort((a, b) => {
      const exact = (p: PersonSummary) => (p.userCode.toLowerCase() === needle ? 0 : 1);
      return exact(a) - exact(b) || a.fullName.localeCompare(b.fullName, "kk");
    });
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/**
 * Open (or re-open) an edge toward `target`. Works from either side: the caller
 * supplies their own profile, and the roles decide which column each id lands
 * in.
 */
export async function sendLinkRequest(
  me: AppUser,
  target: PersonSummary,
  message?: string
): Promise<void> {
  const teacherId = me.role === "teacher" ? me.uid : target.id;
  const studentId = me.role === "teacher" ? target.id : me.uid;
  if (me.role === target.role) {
    throw new Error("Сұраныс тек оқытушы мен студент арасында жіберіледі.");
  }

  if (isSupabaseConfigured && supabase) {
    // Upsert on the (teacher, student) pair so re-applying after a decline
    // reuses the row instead of hitting the unique constraint.
    const { error } = await supabase.from("teacher_links").upsert(
      {
        teacher_id: teacherId,
        student_id: studentId,
        status: "pending",
        requested_by: me.uid,
        message: message ?? null,
        responded_at: null,
      },
      { onConflict: "teacher_id,student_id" }
    );
    if (error) throw new Error(translateLinkError(error.message));
    return;
  }

  const rows = mockLinks();
  const existing = rows.find((l) => l.teacherId === teacherId && l.studentId === studentId);
  if (existing) {
    existing.status = "pending";
    existing.requestedBy = me.uid;
    existing.message = message ?? null;
    existing.respondedAt = null;
    existing.createdAt = new Date().toISOString();
  } else {
    rows.unshift({
      id: `link_${Math.random().toString(36).slice(2, 10)}`,
      teacherId,
      studentId,
      status: "pending",
      requestedBy: me.uid,
      message: message ?? null,
      createdAt: new Date().toISOString(),
      respondedAt: null,
    });
  }
  mockSaveLinks(rows);
}

/** Accept or decline a request addressed to the current user. */
export async function respondToRequest(linkId: string, accept: boolean): Promise<void> {
  const status: LinkStatus = accept ? "accepted" : "declined";

  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("teacher_links")
      .update({ status })
      .eq("id", linkId);
    if (error) throw new Error(translateLinkError(error.message));
    return;
  }

  const rows = mockLinks();
  const row = rows.find((l) => l.id === linkId);
  if (!row) return;
  row.status = status;
  row.respondedAt = new Date().toISOString();
  mockSaveLinks(rows);
}

/** Withdraw a request you sent, or remove somebody you are linked to. */
export async function removeLink(linkId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("teacher_links").delete().eq("id", linkId);
    if (error) throw new Error(translateLinkError(error.message));
    return;
  }
  mockSaveLinks(mockLinks().filter((l) => l.id !== linkId));
}

// ---------------------------------------------------------------------------
// Reading the graph
// ---------------------------------------------------------------------------

/** Every edge touching the current user, newest first. */
export async function listLinks(me: AppUser): Promise<TeacherLink[]> {
  if (isSupabaseConfigured && supabase) {
    const column = me.role === "teacher" ? "teacher_id" : "student_id";
    const { data, error } = await supabase
      .from("teacher_links")
      .select(LINK_SELECT)
      .eq(column, me.uid)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as LinkRow[]).map((r) => rowToLink(r, me.uid));
  }

  const mine = mockLinks().filter((l) => l.teacherId === me.uid || l.studentId === me.uid);
  return mine
    .map((l) => mockRowToLink(l, me.uid))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Convenience split used by both the student and the teacher screens. */
export function partitionLinks(links: TeacherLink[]) {
  return {
    accepted: links.filter((l) => l.status === "accepted"),
    /** Requests the current user must answer. */
    incoming: links.filter((l) => l.awaitingMe),
    /** Requests the current user sent and is waiting on. */
    outgoing: links.filter((l) => l.status === "pending" && !l.awaitingMe),
    declined: links.filter((l) => l.status === "declined"),
  };
}

/**
 * Students who share a teacher with the current user, plus the user, ranked by
 * XP. Empty until the student is accepted by a teacher — at which point the
 * list is their actual group rather than five invented names.
 */
export async function listClassmates(me: AppUser): Promise<LeaderboardEntry[]> {
  const rank = (rows: { userId: string; fullName: string; xp: number; competencyScore: number }[]) =>
    rows
      .sort((a, b) => b.xp - a.xp || a.fullName.localeCompare(b.fullName, "kk"))
      .map((r, i) => ({ ...r, rank: i + 1 }));

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("classmates");
    if (error) throw new Error(error.message);
    return rank(
      (data ?? []).map((r: any) => ({
        userId: r.id,
        fullName: r.full_name,
        avatarUrl: r.avatar_url ?? undefined,
        xp: r.xp ?? 0,
        competencyScore: r.competency_score ?? 0,
      }))
    );
  }

  // Mock: same rule, walked over the local link store.
  const links = mockLinks();
  const myTeachers = links
    .filter((l) => l.studentId === me.uid && l.status === "accepted")
    .map((l) => l.teacherId);
  const peerIds = new Set<string>([me.uid]);
  for (const l of links) {
    if (l.status === "accepted" && myTeachers.includes(l.teacherId)) peerIds.add(l.studentId);
  }
  return rank(
    [...peerIds]
      .map((id) => mockDirectory().find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.role === "student")
      .map((p) => ({
        userId: p.id,
        fullName: p.fullName,
        xp: p.id === me.uid ? me.xp ?? 0 : 0,
        competencyScore: 0,
      }))
  );
}

// ---------------------------------------------------------------------------

function currentMockId(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem("mechanics-lms:mockSession");
    return raw ? (JSON.parse(raw).uid as string) : "";
  } catch {
    return "";
  }
}

function translateLinkError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("accepted by the other party"))
    return "Өз сұранысыңызды өзіңіз қабылдай алмайсыз.";
  if (m.includes("teacher_id must belong")) return "Таңдалған қолданушы оқытушы емес.";
  if (m.includes("student_id must belong")) return "Таңдалған қолданушы студент емес.";
  if (m.includes("duplicate key")) return "Бұл адаммен байланыс сұранысы бар.";
  if (m.includes("row-level security")) return "Бұл әрекетке рұқсат жоқ.";
  return message;
}
