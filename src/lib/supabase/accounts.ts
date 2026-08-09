"use client";

// Account lifecycle: sign up with a chosen role, sign in, sign out, read and
// update the profile row.
//
// The role is picked on the signup form and travels as auth user metadata; a
// database trigger copies it into `profiles` and allocates the shareable
// user_code. It is deliberately *not* writable afterwards — see the
// protect_profile_identity trigger in the migration — so this module never
// offers a "change role" call.

import type { AppUser, UserRole } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "./client";
import { mockRegisterPerson, mockUserCode } from "./mock";
import { DEMO_STUDENT, DEMO_TEACHER } from "@/lib/authStore";

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  role: Exclude<UserRole, "admin">;
  studyGroup?: string;
}

export interface AuthResult {
  user: AppUser | null;
  /** Set when Supabase wants the address confirmed before the first sign-in. */
  needsEmailConfirmation?: boolean;
}

/** Row shape of public.profiles, mapped to the app's camelCase AppUser. */
interface ProfileRow {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  user_code: string;
  study_group: string | null;
  avatar_url: string | null;
  xp: number;
  competency_score: number | null;
  created_at: string;
  /** Absent until migration 0002 has been applied. */
  role_locked?: boolean;
}

export function rowToUser(row: ProfileRow): AppUser {
  return {
    uid: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    userCode: row.user_code,
    // Treat a missing column as locked: never send somebody to the role picker
    // just because the database is a migration behind.
    roleLocked: row.role_locked ?? true,
    group: row.study_group ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    xp: row.xp,
    competencyScore: row.competency_score ?? undefined,
    createdAt: row.created_at,
  };
}

const MOCK_KEY = "mechanics-lms:mockSession";

/** In mock mode the "session" is just which demo identity was chosen. */
export function readMockSession(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function writeMockSession(user: AppUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(MOCK_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(MOCK_KEY);
}

export async function signUp(input: SignUpInput): Promise<AuthResult> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        // Read by handle_new_user() to build the profile row.
        data: {
          role: input.role,
          full_name: input.fullName,
          study_group: input.studyGroup ?? null,
        },
      },
    });
    if (error) throw new Error(translateAuthError(error.message));

    // With email confirmation enabled Supabase returns a user but no session;
    // the profile row exists already, but the person cannot read it yet.
    if (!data.session) return { user: null, needsEmailConfirmation: true };
    return { user: await fetchProfile(data.user!.id) };
  }

  // Mock: mint a local identity and put it in the searchable directory.
  const uid = `local_${Math.random().toString(36).slice(2, 10)}`;
  const user: AppUser = {
    uid,
    fullName: input.fullName,
    email: input.email,
    role: input.role,
    userCode: mockUserCode(uid, input.role),
    group: input.studyGroup,
    createdAt: new Date().toISOString(),
    xp: 0,
    badges: [],
  };
  mockRegisterPerson({
    id: uid,
    fullName: user.fullName,
    userCode: user.userCode!,
    role: user.role,
    studyGroup: user.group,
  });
  writeMockSession(user);
  return { user };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error.message));
    return { user: await fetchProfile(data.user.id) };
  }
  throw new Error(
    "Демо режимде құпия сөзбен кіру жоқ. Төмендегі демо тіркелгілерді пайдаланыңыз."
  );
}

/**
 * Hand off to Google.
 *
 * `role` is only meaningful for somebody signing up: it rides back on the
 * redirect URL so /auth/callback can claim it. On a plain sign-in it is
 * omitted, and an existing profile ignores it anyway — the role is frozen.
 *
 * Returns nothing useful: the browser navigates away.
 */
export async function signInWithGoogle(role?: Exclude<UserRole, "admin">): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      "Supabase кілттері жүктелмеген. .env.local тексеріп, dev серверді қайта қосыңыз."
    );
  }
  const callback = new URL("/auth/callback", window.location.origin);
  if (role) callback.searchParams.set("role", role);

  // skipBrowserRedirect and an explicit assign, rather than letting the library
  // navigate for us. Its implicit redirect fails silently when the page cannot
  // leave the origin — no error, no navigation, a button that does nothing.
  // Doing it here means an unusable URL surfaces as a message instead.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      skipBrowserRedirect: true,
      // Force the account chooser: on a shared university machine the silent
      // re-use of the last Google session is the wrong default.
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw new Error(translateAuthError(error.message));
  if (!data?.url) {
    throw new Error("Google сілтемесі алынбады. Supabase-те Google провайдері қосулы ма?");
  }
  window.location.assign(data.url);
}

/**
 * Set the role of a profile that was created by OAuth. Allowed exactly once —
 * the database refuses a second call.
 */
export async function claimRole(role: Exclude<UserRole, "admin">): Promise<AppUser | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc("claim_role", { p_role: role });
  if (error) throw new Error(translateAuthError(error.message));
  return data ? rowToUser(data as ProfileRow) : null;
}

/** Mock mode only: step into one of the two seeded identities. */
export function signInAsDemo(role: Exclude<UserRole, "admin">): AppUser {
  const base = role === "teacher" ? DEMO_TEACHER : DEMO_STUDENT;
  const user: AppUser = { ...base, userCode: mockUserCode(base.uid, role) };
  writeMockSession(user);
  return user;
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    await supabase.auth.signOut();
    return;
  }
  writeMockSession(null);
}

export async function fetchProfile(userId: string): Promise<AppUser | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToUser(data as ProfileRow) : null;
  }
  const session = readMockSession();
  return session && session.uid === userId ? session : null;
}

export async function updateProfile(
  userId: string,
  patch: { fullName?: string; studyGroup?: string | null; avatarUrl?: string | null }
): Promise<AppUser | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
        ...(patch.studyGroup !== undefined ? { study_group: patch.studyGroup } : {}),
        ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
      })
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowToUser(data as ProfileRow) : null;
  }
  const session = readMockSession();
  if (!session || session.uid !== userId) return null;
  const next: AppUser = {
    ...session,
    fullName: patch.fullName ?? session.fullName,
    group: patch.studyGroup === undefined ? session.group : patch.studyGroup ?? undefined,
    avatarUrl: patch.avatarUrl === undefined ? session.avatarUrl : patch.avatarUrl ?? undefined,
  };
  writeMockSession(next);
  return next;
}

/**
 * Supabase returns English auth errors; the whole UI is in Kazakh, and these
 * four cover everything a signup/login form can realistically hit.
 */
export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email немесе құпия сөз қате.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Бұл email тіркелген. Кіру бетіне өтіңіз.";
  if (m.includes("password should be at least"))
    return "Құпия сөз кемінде 6 таңбадан тұруы керек.";
  if (m.includes("email not confirmed"))
    return "Email әлі расталмаған. Поштаңыздағы сілтемені ашыңыз.";
  if (m.includes("unable to validate email")) return "Email форматы қате.";
  if (m.includes("role has already been chosen")) return "Рөл бұрын таңдалған, оны өзгерту мүмкін емес.";
  // GoTrue's blanket message for any exception raised by the signup trigger.
  // Naming the likely cause turns it from a dead end into a next step.
  if (m.includes("database error saving new user"))
    return "Дерекқор жаңа қолданушыны сақтай алмады. Supabase-те 0003 көшірмесі (migration) қолданылған ба?";
  if (m.includes("provider is not enabled"))
    return "Google провайдері Supabase-те қосылмаған.";
  if (m.includes("redirect")) return "Қайтару сілтемесі Supabase-те рұқсат етілмеген.";
  return message;
}
