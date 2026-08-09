"use client";

// Reading and writing lesson overrides.
//
// Reads go through the my_lesson_overrides() RPC rather than a plain select,
// because a student accepted by two teachers who both edited lesson 3 needs a
// deterministic winner, and that rule belongs in one place — the database —
// not in whichever page happened to load first.

import type { AppUser } from "@/lib/types";
import type { LessonPatch } from "@/lib/lessonContent";
import { isSupabaseConfigured, supabase } from "./client";

/** moduleId → patch. Missing entry means the bundled lesson is unchanged. */
export type OverrideMap = Record<number, LessonPatch>;

const LS_KEY = "mechanics-lms:lessonOverrides";

function mockAll(): Record<string, OverrideMap> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function mockSave(all: Record<string, OverrideMap>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY, JSON.stringify(all));
}

/**
 * Overrides that apply to this user: their own if they teach, their teacher's
 * if they study. Failures resolve to an empty map rather than throwing — a
 * lesson must still open when the override table is unreachable.
 */
export async function loadMyOverrides(user: AppUser | null): Promise<OverrideMap> {
  if (!user) return {};

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("my_lesson_overrides");
    if (error) return {};
    const out: OverrideMap = {};
    for (const row of (data ?? []) as { module_id: number; patch: LessonPatch }[]) {
      out[row.module_id] = row.patch ?? {};
    }
    return out;
  }

  // Mock: a teacher sees their own drafts; a student sees the demo teacher's,
  // which is the only authoring identity the offline mode has.
  const all = mockAll();
  if (user.role === "teacher") return all[user.uid] ?? {};
  const first = Object.values(all)[0];
  return first ?? {};
}

/** A teacher's own overrides, for the editor. */
export async function loadTeacherOverrides(teacher: AppUser): Promise<OverrideMap> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("lesson_overrides")
      .select("module_id, patch")
      .eq("teacher_id", teacher.uid);
    if (error) throw new Error(error.message);
    const out: OverrideMap = {};
    for (const row of (data ?? []) as { module_id: number; patch: LessonPatch }[]) {
      out[row.module_id] = row.patch ?? {};
    }
    return out;
  }
  return mockAll()[teacher.uid] ?? {};
}

export async function saveOverride(
  teacher: AppUser,
  moduleId: number,
  patch: LessonPatch
): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("lesson_overrides")
      .upsert(
        { teacher_id: teacher.uid, module_id: moduleId, patch },
        { onConflict: "teacher_id,module_id" }
      );
    if (error) throw new Error(translateContentError(error.message));
    return;
  }
  const all = mockAll();
  all[teacher.uid] = { ...(all[teacher.uid] ?? {}), [moduleId]: patch };
  mockSave(all);
}

/** Back to the bundled lesson: the override row simply goes away. */
export async function resetOverride(teacher: AppUser, moduleId: number): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase
      .from("lesson_overrides")
      .delete()
      .eq("teacher_id", teacher.uid)
      .eq("module_id", moduleId);
    if (error) throw new Error(translateContentError(error.message));
    return;
  }
  const all = mockAll();
  if (all[teacher.uid]) {
    delete all[teacher.uid][moduleId];
    mockSave(all);
  }
}

function translateContentError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("only a teacher may own")) return "Сабақты тек оқытушы өңдей алады.";
  if (m.includes("unknown lesson field"))
    return "Белгісіз өріс жіберілді. Бетті жаңартып көріңіз.";
  if (m.includes("row-level security")) return "Бұл әрекетке рұқсат жоқ.";
  return message;
}
