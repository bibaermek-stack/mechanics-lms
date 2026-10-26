"use client";

// Where the class's jump distribution comes from.
//
// Live: class_jump_bests() in the database — a number and an "is it me" flag for
// each classmate, never a name, so the page cannot show whose is whose.
// Demo: the classmates of the local link graph, their jumps read from this
// browser's own store.

import type { AppUser } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { listClassmates } from "@/lib/supabase/links";
import { getSensorResults } from "@/lib/dataStore";
import { bestByUser, classFromRows, type ClassBests } from "./standing";

export async function loadClassJumps(me: AppUser): Promise<ClassBests> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.rpc("class_jump_bests");
    if (error) throw new Error(error.message);
    return classFromRows((data ?? []) as { best: number | string; is_me: boolean }[]);
  }

  const classmates = await listClassmates(me);
  const lists = await Promise.all(classmates.map((c) => getSensorResults(c.userId)));
  const best = bestByUser(lists.flat(), "jump");
  const others: number[] = [];
  let mine: number | null = null;
  for (const c of classmates) {
    const v = best.get(c.userId);
    if (v === undefined) continue;
    if (c.userId === me.uid) mine = v;
    else others.push(v);
  }
  return { others, mine };
}
