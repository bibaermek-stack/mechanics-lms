"use client";

// Browser-side Supabase client.
//
// Like the Firebase module before it, this is optional: with no keys in
// .env.local the export is null and every caller falls back to the localStorage
// mock, so the project still demos on a machine with no backend at all. The one
// difference is that Supabase is now the *primary* backend — accounts, roles and
// the teacher↔student graph live there, and the mock only stands in for a demo.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim();

/** True when both keys are present, so callers can pick a branch. */
export const isSupabaseConfigured = Boolean(url && anonKey);

// One client per browser session. createBrowserClient already memoises the
// underlying GoTrue instance, but keeping the module-level constant makes the
// null case explicit at the type level.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createBrowserClient(url!, anonKey!)
  : null;

/** Narrowing helper — `const sb = requireSupabase()` inside a configured branch. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}
