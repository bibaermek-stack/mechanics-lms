"use client";

// localStorage stand-in for the Supabase tables.
//
// Without this the whole request flow would be invisible on a machine with no
// backend, which is the state the project demos in. The directory is seeded
// from the same cohort the analytics pages use, so a demo teacher searching for
// "Айгерім" finds the student whose charts they were just looking at.
//
// The shapes returned here are identical to the Supabase branch — every
// difference is confined to this file.

import type { LinkStatus, PersonSummary, UserRole } from "@/lib/types";
import { COHORT } from "@/data/cohort";
import { DEMO_STUDENT, DEMO_TEACHER } from "@/lib/authStore";

const LS = "mechanics-lms:links";
const LS_FRIENDS = "mechanics-lms:friendLinks";
const LS_DUELS = "mechanics-lms:duels";
const LS_DIR = "mechanics-lms:directory";

export interface MockLinkRow {
  id: string;
  teacherId: string;
  studentId: string;
  status: LinkStatus;
  requestedBy: string;
  message?: string | null;
  createdAt: string;
  respondedAt?: string | null;
}

/**
 * Deterministic code from an id, so a reload does not reshuffle the handles.
 *
 * The mixing matters more than it looks: the seeded ids differ only in their
 * last character, and a plain rolling hash gave every student a code differing
 * in one place too, which reads as a bug. This avalanches each digit.
 */
function codeFor(id: string, role: UserRole) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 2166136261 >>> 0; // FNV-1a
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let body = "";
  for (let i = 0; i < 6; i++) {
    // Re-mix between digits so neighbouring ids do not share a prefix. Every
    // step re-forces unsigned: `^` yields a signed int32, and a negative `h`
    // would make the modulo index off the end of the alphabet.
    h = (h ^ (h >>> 15)) >>> 0;
    h = Math.imul(h, 2246822519) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    body += alphabet[h % alphabet.length];
  }
  const prefix = role === "teacher" ? "TCH" : role === "admin" ? "ADM" : "STU";
  return `${prefix}-${body}`;
}

/** Two extra teachers so a student's search has something to choose between. */
const EXTRA_TEACHERS: PersonSummary[] = [
  {
    id: "demo-teacher-2",
    fullName: "Гүлмира Асқарқызы",
    userCode: codeFor("demo-teacher-2", "teacher"),
    role: "teacher",
    studyGroup: "Механика кафедрасы",
  },
  {
    id: "demo-teacher-3",
    fullName: "Ерлан Тұрсынбекұлы",
    userCode: codeFor("demo-teacher-3", "teacher"),
    role: "teacher",
    studyGroup: "Инженерия кафедрасы",
  },
];

function seedDirectory(): PersonSummary[] {
  const people: PersonSummary[] = [
    {
      id: DEMO_TEACHER.uid,
      fullName: DEMO_TEACHER.fullName,
      userCode: codeFor(DEMO_TEACHER.uid, "teacher"),
      role: "teacher",
      studyGroup: "Механика кафедрасы",
    },
    ...EXTRA_TEACHERS,
    {
      id: DEMO_STUDENT.uid,
      fullName: DEMO_STUDENT.fullName,
      userCode: codeFor(DEMO_STUDENT.uid, "student"),
      role: "student",
      studyGroup: DEMO_STUDENT.group,
    },
    // The analytics cohort, minus the demo student who is already above.
    ...COHORT.filter((r) => r.fullName !== DEMO_STUDENT.fullName).map((r) => ({
      id: r.id,
      fullName: r.fullName,
      userCode: codeFor(r.id, "student" as UserRole),
      role: "student" as UserRole,
      studyGroup: r.group,
    })),
  ];
  return people;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function mockDirectory(): PersonSummary[] {
  const stored = read<PersonSummary[] | null>(LS_DIR, null);
  if (stored && stored.length) return stored;
  const seeded = seedDirectory();
  write(LS_DIR, seeded);
  return seeded;
}

/** Register a signed-up mock account so other mock users can find them. */
export function mockRegisterPerson(p: PersonSummary) {
  const dir = mockDirectory();
  if (dir.some((d) => d.id === p.id)) return;
  write(LS_DIR, [...dir, p]);
}

export function mockPerson(id: string): PersonSummary | undefined {
  return mockDirectory().find((p) => p.id === id);
}

export function mockUserCode(id: string, role: UserRole) {
  return codeFor(id, role);
}

/**
 * Seeded edges: the demo teacher already has most of the cohort accepted, plus
 * two students waiting on an answer and one invite the demo student has not
 * replied to. Without this the inbox screens would only ever be demoed empty.
 */
function seedLinks(): MockLinkRow[] {
  const students = mockDirectory().filter((p) => p.role === "student");
  const teacher = DEMO_TEACHER.uid;
  const now = Date.now();
  return students.map((s, i) => {
    const pending = i >= students.length - 3;
    // The last one is an invite the teacher sent to the demo student's peer,
    // the two before it are applications waiting on the teacher.
    const fromTeacher = i === students.length - 1;
    return {
      id: `link_seed_${i}`,
      teacherId: teacher,
      studentId: s.id,
      status: (pending ? "pending" : "accepted") as LinkStatus,
      requestedBy: fromTeacher ? teacher : s.id,
      message: pending && !fromTeacher ? "Сіздің тобыңызға қосылғым келеді." : null,
      createdAt: new Date(now - (students.length - i) * 86_400_000).toISOString(),
      respondedAt: pending ? null : new Date(now - (students.length - i) * 43_200_000).toISOString(),
    };
  });
}

export function mockLinks(): MockLinkRow[] {
  const stored = read<MockLinkRow[] | null>(LS, null);
  if (stored) return stored;
  const seeded = seedLinks();
  write(LS, seeded);
  return seeded;
}

export function mockSaveLinks(rows: MockLinkRow[]) {
  write(LS, rows);
}

// --- Friendships ------------------------------------------------------------

export interface MockFriendRow {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: LinkStatus;
  createdAt: string;
  respondedAt?: string | null;
}

/**
 * Unlike teacher links these start empty: seeding a demo account with friends
 * it never made is exactly the kind of borrowed data this app has been getting
 * rid of. The list fills as soon as somebody sends a request.
 */
export function mockFriendLinks(): MockFriendRow[] {
  return read<MockFriendRow[]>(LS_FRIENDS, []);
}

export function mockSaveFriendLinks(rows: MockFriendRow[]) {
  write(LS_FRIENDS, rows);
}

// --- Duels ------------------------------------------------------------------

export interface MockDuelRow {
  id: string;
  challengerId: string;
  opponentId: string;
  moduleId: number;
  gameMode: string;
  seed: number;
  challengerScore: number | null;
  opponentScore: number | null;
  createdAt: string;
}

export function mockDuels(): MockDuelRow[] {
  return read<MockDuelRow[]>(LS_DUELS, []);
}

export function mockSaveDuels(rows: MockDuelRow[]) {
  write(LS_DUELS, rows);
}
