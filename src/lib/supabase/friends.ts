"use client";

// Student ↔ student friendships.
//
// Same request/accept shape as the teacher graph, but symmetric: there is no
// "teacher side", only a requester and an addressee, and the pair is stored
// once whichever way round it was opened. Reusing TeacherLink as the return
// type keeps the request-list components identical for both graphs — the only
// thing they read is `person`, `status` and `awaitingMe`.

import type { AppUser, LinkStatus, PersonSummary, TeacherLink } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "./client";
import {
  mockFriendLinks,
  mockPerson,
  mockSaveFriendLinks,
  type MockFriendRow,
} from "./mock";

const SELECT = `
  id, requester_id, addressee_id, status, created_at, responded_at,
  requester:profiles!friend_links_requester_id_fkey (id, full_name, user_code, role, study_group, avatar_url),
  addressee:profiles!friend_links_addressee_id_fkey (id, full_name, user_code, role, study_group, avatar_url)
`;

interface EmbeddedProfile {
  id: string;
  full_name: string;
  user_code: string;
  role: "student" | "teacher" | "admin";
  study_group: string | null;
  avatar_url: string | null;
}

interface FriendRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: LinkStatus;
  created_at: string;
  responded_at: string | null;
  requester: EmbeddedProfile | EmbeddedProfile[] | null;
  addressee: EmbeddedProfile | EmbeddedProfile[] | null;
}

function one(v: EmbeddedProfile | EmbeddedProfile[] | null) {
  return Array.isArray(v) ? v[0] ?? null : v;
}

/**
 * Shaped as a TeacherLink so the existing request lists can render it. The
 * teacherId/studentId fields carry requester/addressee — they are never read
 * for friendships, only `person` and `awaitingMe` are.
 */
function toLink(row: FriendRow, meId: string): TeacherLink {
  const iAmRequester = row.requester_id === meId;
  const other = one(iAmRequester ? row.addressee : row.requester);
  return {
    id: row.id,
    teacherId: row.requester_id,
    studentId: row.addressee_id,
    status: row.status,
    requestedBy: row.requester_id,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    person: other
      ? {
          id: other.id,
          fullName: other.full_name,
          userCode: other.user_code,
          role: other.role,
          studyGroup: other.study_group,
          avatarUrl: other.avatar_url,
        }
      : { id: "", fullName: "—", userCode: "", role: "student" },
    awaitingMe: row.status === "pending" && !iAmRequester,
  };
}

function mockToLink(row: MockFriendRow, meId: string): TeacherLink {
  const otherId = row.requesterId === meId ? row.addresseeId : row.requesterId;
  const person = mockPerson(otherId);
  return {
    id: row.id,
    teacherId: row.requesterId,
    studentId: row.addresseeId,
    status: row.status,
    requestedBy: row.requesterId,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    person: person ?? { id: otherId, fullName: "Белгісіз", userCode: "", role: "student" },
    awaitingMe: row.status === "pending" && row.requesterId !== meId,
  };
}

export async function listFriendLinks(me: AppUser): Promise<TeacherLink[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("friend_links")
      .select(SELECT)
      .or(`requester_id.eq.${me.uid},addressee_id.eq.${me.uid}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as FriendRow[]).map((r) => toLink(r, me.uid));
  }

  return mockFriendLinks()
    .filter((f) => f.requesterId === me.uid || f.addresseeId === me.uid)
    .map((f) => mockToLink(f, me.uid))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function sendFriendRequest(me: AppUser, target: PersonSummary): Promise<void> {
  if (me.role !== "student" || target.role !== "student") {
    throw new Error("Достық тек студенттер арасында.");
  }
  if (target.id === me.uid) throw new Error("Өзіңізді дос ретінде қоса алмайсыз.");

  if (isSupabaseConfigured && supabase) {
    // The unique index is on the unordered pair, so a re-application after a
    // decline may need to update a row whose requester is the *other* person.
    // Look first rather than upserting into a conflict target that does not
    // exist as a plain column list.
    const { data: existing, error: findErr } = await supabase
      .from("friend_links")
      .select("id, status")
      .or(
        `and(requester_id.eq.${me.uid},addressee_id.eq.${target.id}),` +
          `and(requester_id.eq.${target.id},addressee_id.eq.${me.uid})`
      )
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);

    if (existing) {
      const { error } = await supabase
        .from("friend_links")
        .update({ requester_id: me.uid, addressee_id: target.id, status: "pending" })
        .eq("id", (existing as { id: string }).id);
      if (error) throw new Error(translateFriendError(error.message));
      return;
    }

    const { error } = await supabase
      .from("friend_links")
      .insert({ requester_id: me.uid, addressee_id: target.id, status: "pending" });
    if (error) throw new Error(translateFriendError(error.message));
    return;
  }

  const rows = mockFriendLinks();
  const existing = rows.find(
    (f) =>
      (f.requesterId === me.uid && f.addresseeId === target.id) ||
      (f.requesterId === target.id && f.addresseeId === me.uid)
  );
  if (existing) {
    existing.requesterId = me.uid;
    existing.addresseeId = target.id;
    existing.status = "pending";
    existing.respondedAt = null;
    existing.createdAt = new Date().toISOString();
  } else {
    rows.unshift({
      id: `friend_${Math.random().toString(36).slice(2, 10)}`,
      requesterId: me.uid,
      addresseeId: target.id,
      status: "pending",
      createdAt: new Date().toISOString(),
      respondedAt: null,
    });
  }
  mockSaveFriendLinks(rows);
}

export async function respondToFriendRequest(id: string, accept: boolean): Promise<void> {
  const status: LinkStatus = accept ? "accepted" : "declined";
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("friend_links").update({ status }).eq("id", id);
    if (error) throw new Error(translateFriendError(error.message));
    return;
  }
  const rows = mockFriendLinks();
  const row = rows.find((f) => f.id === id);
  if (!row) return;
  row.status = status;
  row.respondedAt = new Date().toISOString();
  mockSaveFriendLinks(rows);
}

export async function removeFriend(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("friend_links").delete().eq("id", id);
    if (error) throw new Error(translateFriendError(error.message));
    return;
  }
  mockSaveFriendLinks(mockFriendLinks().filter((f) => f.id !== id));
}

/** Accepted friends only — the list a duel invitation picks from. */
export async function listFriends(me: AppUser): Promise<PersonSummary[]> {
  const links = await listFriendLinks(me);
  return links.filter((l) => l.status === "accepted").map((l) => l.person);
}

function translateFriendError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("friendship is between students"))
    return "Достық тек студенттер арасында болады.";
  if (m.includes("accepted by the other party"))
    return "Өз сұранысыңызды өзіңіз қабылдай алмайсыз.";
  if (m.includes("friend_links_no_self")) return "Өзіңізді дос ретінде қоса алмайсыз.";
  if (m.includes("duplicate key") || m.includes("friend_links_pair_idx"))
    return "Бұл адаммен достық сұранысы бар.";
  if (m.includes("row-level security")) return "Бұл әрекетке рұқсат жоқ.";
  return message;
}
