"use client";

// Duels: same lesson, same game, same seed, two players, whenever each of them
// gets to it.
//
// The seed is the entire mechanism. Every board in the app is a pure function
// of (lesson, game, seed), so one integer is enough to guarantee both players
// solve the identical crossword or answer the identical shuffled questions —
// no live connection, no clock sync, nothing to drop out on a bad network.

import type { AppUser, PersonSummary } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "./client";
import { mockDuels, mockPerson, mockSaveDuels, type MockDuelRow } from "./mock";

export type DuelOutcome = "waiting-me" | "waiting-them" | "won" | "lost" | "draw";

export interface Duel {
  id: string;
  moduleId: number;
  gameMode: string;
  seed: number;
  createdAt: string;
  /** The other player, from the current user's point of view. */
  opponent: PersonSummary;
  /** True when the current user opened the challenge. */
  iChallenged: boolean;
  myScore: number | null;
  theirScore: number | null;
  outcome: DuelOutcome;
}

interface DuelRow {
  id: string;
  challenger_id: string;
  opponent_id: string;
  module_id: number;
  game_mode: string;
  seed: number;
  challenger_score: number | null;
  opponent_score: number | null;
  created_at: string;
  challenger?: { id: string; full_name: string; user_code: string; study_group: string | null } | null;
  opponent?: { id: string; full_name: string; user_code: string; study_group: string | null } | null;
}

const SELECT = `
  id, challenger_id, opponent_id, module_id, game_mode, seed,
  challenger_score, opponent_score, created_at,
  challenger:profiles!game_duels_challenger_id_fkey (id, full_name, user_code, study_group),
  opponent:profiles!game_duels_opponent_id_fkey (id, full_name, user_code, study_group)
`;

function outcomeOf(mine: number | null, theirs: number | null): DuelOutcome {
  if (mine === null) return "waiting-me";
  if (theirs === null) return "waiting-them";
  if (mine > theirs) return "won";
  if (mine < theirs) return "lost";
  return "draw";
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
}

function rowToDuel(row: DuelRow, meId: string): Duel {
  const iChallenged = row.challenger_id === meId;
  const other = one(iChallenged ? row.opponent : row.challenger);
  const myScore = iChallenged ? row.challenger_score : row.opponent_score;
  const theirScore = iChallenged ? row.opponent_score : row.challenger_score;
  return {
    id: row.id,
    moduleId: row.module_id,
    gameMode: row.game_mode,
    seed: row.seed,
    createdAt: row.created_at,
    opponent: other
      ? {
          id: other.id,
          fullName: other.full_name,
          userCode: other.user_code,
          role: "student",
          studyGroup: other.study_group,
        }
      : { id: "", fullName: "—", userCode: "", role: "student" },
    iChallenged,
    myScore,
    theirScore,
    outcome: outcomeOf(myScore, theirScore),
  };
}

function mockToDuel(row: MockDuelRow, meId: string): Duel {
  const iChallenged = row.challengerId === meId;
  const otherId = iChallenged ? row.opponentId : row.challengerId;
  const person = mockPerson(otherId);
  const myScore = iChallenged ? row.challengerScore : row.opponentScore;
  const theirScore = iChallenged ? row.opponentScore : row.challengerScore;
  return {
    id: row.id,
    moduleId: row.moduleId,
    gameMode: row.gameMode,
    seed: row.seed,
    createdAt: row.createdAt,
    opponent: person ?? { id: otherId, fullName: "Белгісіз", userCode: "", role: "student" },
    iChallenged,
    myScore,
    theirScore,
    outcome: outcomeOf(myScore, theirScore),
  };
}

/** A fresh seed per challenge, so a rematch is a genuinely new board. */
function newSeed() {
  return Math.floor(Math.random() * 2_000_000_000);
}

export async function createDuel(
  me: AppUser,
  opponent: PersonSummary,
  moduleId: number,
  gameMode: string
): Promise<Duel | null> {
  const seed = newSeed();

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("game_duels")
      .insert({
        challenger_id: me.uid,
        opponent_id: opponent.id,
        module_id: moduleId,
        game_mode: gameMode,
        seed,
      })
      .select(SELECT)
      .maybeSingle();
    if (error) throw new Error(translateDuelError(error.message));
    return data ? rowToDuel(data as unknown as DuelRow, me.uid) : null;
  }

  const rows = mockDuels();
  const row: MockDuelRow = {
    id: `duel_${Math.random().toString(36).slice(2, 10)}`,
    challengerId: me.uid,
    opponentId: opponent.id,
    moduleId,
    gameMode,
    seed,
    challengerScore: null,
    opponentScore: null,
    createdAt: new Date().toISOString(),
  };
  rows.unshift(row);
  mockSaveDuels(rows);
  return mockToDuel(row, me.uid);
}

/**
 * Write the current user's own result. The column is chosen from which side of
 * the duel they are on — the database refuses the other one anyway, but doing
 * it here means the mock branch behaves identically.
 */
export async function recordDuelScore(me: AppUser, duelId: string, score: number): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { data, error: findErr } = await supabase
      .from("game_duels")
      .select("challenger_id, opponent_id, challenger_score, opponent_score")
      .eq("id", duelId)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!data) throw new Error("Дуэль табылмады.");

    const row = data as { challenger_id: string; challenger_score: number | null; opponent_score: number | null };
    const mine = row.challenger_id === me.uid ? "challenger_score" : "opponent_score";
    // Already played: a second attempt must not overwrite the first, or the
    // duel becomes "whoever retries most".
    if (row[mine as "challenger_score" | "opponent_score"] !== null) return;

    const { error } = await supabase
      .from("game_duels")
      .update({ [mine]: Math.round(score) })
      .eq("id", duelId);
    if (error) throw new Error(translateDuelError(error.message));
    return;
  }

  const rows = mockDuels();
  const row = rows.find((d) => d.id === duelId);
  if (!row) return;
  if (row.challengerId === me.uid) {
    if (row.challengerScore !== null) return;
    row.challengerScore = Math.round(score);
  } else {
    if (row.opponentScore !== null) return;
    row.opponentScore = Math.round(score);
  }
  mockSaveDuels(rows);
}

export async function listDuels(me: AppUser): Promise<Duel[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("game_duels")
      .select(SELECT)
      .or(`challenger_id.eq.${me.uid},opponent_id.eq.${me.uid}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as DuelRow[]).map((r) => rowToDuel(r, me.uid));
  }

  return mockDuels()
    .filter((d) => d.challengerId === me.uid || d.opponentId === me.uid)
    .map((d) => mockToDuel(d, me.uid))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDuel(me: AppUser, duelId: string): Promise<Duel | null> {
  const all = await listDuels(me);
  return all.find((d) => d.id === duelId) ?? null;
}

export async function deleteDuel(duelId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("game_duels").delete().eq("id", duelId);
    if (error) throw new Error(translateDuelError(error.message));
    return;
  }
  mockSaveDuels(mockDuels().filter((d) => d.id !== duelId));
}

function translateDuelError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duels are between friends"))
    return "Дуэль тек достар арасында өтеді. Алдымен дос ретінде қосыңыз.";
  if (m.includes("record their own score")) return "Тек өз нәтижеңізді жаза аласыз.";
  if (m.includes("starts with no scores")) return "Жаңа дуэль нәтижесіз басталады.";
  if (m.includes("row-level security")) return "Бұл әрекетке рұқсат жоқ.";
  return message;
}
