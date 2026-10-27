"use client";

// Where the community's data lives.
//
// Live: the tables and functions of migrations 0015 and 0016. The database makes every
// decision — who may post, who sees what, who may review — and this file only asks.
// Demo (no Supabase): the same rules, applied by src/lib/community.ts to what is in this
// browser's own storage, so the pages behave alike and can be tried without a server.

import type { AppUser } from "./types";
import { isSupabaseConfigured, supabase } from "./supabase/client";
import { listClassmates } from "./supabase/links";
import { mockLinks, mockPerson } from "./supabase/mock";
import { generateId, lsGet, lsSet } from "./dataStore";
import {
  QUESTION_LIMITS,
  SHOWCASE_LIMITS,
  canLike,
  canSubmit,
  decide,
  peerQuestions,
  rankFeed,
  validateQuestion,
  validateShowcase,
  visibleShowcase,
  type Audience,
  type FeedCard,
  type QuestionInput,
  type ShowcaseInput,
  type ShowcasePost,
  type StudentQuestion,
} from "./community";

const live = () => isSupabaseConfigured && supabase !== null;

export type PeerQuestion = Pick<StudentQuestion, "id" | "lessonId" | "question" | "options" | "correctIndex" | "explanation">;

/** A pending item with its author's name, for the teacher's queue. */
export type Queued<T> = T & { author: string };

// ---------------------------------------------------------------------------
// Rows ↔ objects
// ---------------------------------------------------------------------------

function postOf(r: any): ShowcasePost {
  return {
    id: r.id, userId: r.user_id, lessonId: r.lesson_id, title: r.title, what: r.what, physics: r.physics, materials: r.materials ?? null,
    status: r.status, reviewedBy: r.reviewed_by ?? null, reviewedAt: r.reviewed_at ?? null, createdAt: r.created_at,
  };
}

function questionOf(r: any): StudentQuestion {
  return {
    id: r.id, userId: r.user_id, lessonId: r.lesson_id, question: r.question, options: r.options, correctIndex: r.correct_index,
    explanation: r.explanation ?? null, status: r.status, reviewedBy: r.reviewed_by ?? null, reviewedAt: r.reviewed_at ?? null, createdAt: r.created_at,
  };
}

/** What a database refusal means to the student. */
function explain(message: string): Error {
  if (/too many/i.test(message)) return new Error("Тексеруді күтіп тұрған жұмыс тым көп. Мұғалімің қарап шыққанша күт.");
  return new Error(message);
}

const firstError = (errors: Record<string, string | undefined>) => Object.values(errors).find(Boolean) ?? "Дұрыс емес деректер";

// ---------------------------------------------------------------------------
// Demo storage
// ---------------------------------------------------------------------------

const LS_POSTS = "showcasePosts";
const LS_LIKES = "showcaseLikes";
const LS_QUESTIONS = "studentQuestions";

interface LikeRow {
  postId: string;
  userId: string;
}

const demoPosts = () => lsGet<ShowcasePost[]>(LS_POSTS, []);
const demoQuestions = () => lsGet<StudentQuestion[]>(LS_QUESTIONS, []);
const demoLikes = () => lsGet<LikeRow[]>(LS_LIKES, []);

const nameOf = (id: string) => mockPerson(id)?.fullName ?? "Оқушы";

/** The demo's version of the classes: what the database works out from teacher_links. */
async function audienceOf(me: AppUser): Promise<Audience> {
  if (me.role === "teacher") {
    const mine = mockLinks().filter((l) => l.teacherId === me.uid && l.status === "accepted").map((l) => l.studentId);
    return { viewerId: me.uid, classmates: new Set(), myStudents: new Set(mine) };
  }
  const classmates = (await listClassmates(me)).map((c) => c.userId);
  return { viewerId: me.uid, classmates: new Set([me.uid, ...classmates]), myStudents: new Set() };
}

const isMyStudent = (teacherId: string, studentId: string) => mockLinks().some((l) => l.teacherId === teacherId && l.studentId === studentId && l.status === "accepted");

// ---------------------------------------------------------------------------
// A student's own work
// ---------------------------------------------------------------------------

export async function listMyShowcase(userId: string): Promise<ShowcasePost[]> {
  if (live()) {
    const { data, error } = await supabase!.from("showcase_posts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(postOf);
  }
  return demoPosts().filter((p) => p.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listMyQuestions(userId: string): Promise<StudentQuestion[]> {
  if (live()) {
    const { data, error } = await supabase!.from("student_questions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(questionOf);
  }
  return demoQuestions().filter((q) => q.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function submitShowcase(me: AppUser, input: ShowcaseInput): Promise<ShowcasePost> {
  const check = validateShowcase(input);
  if (!check.ok) throw new Error(firstError(check.errors));
  const v = check.value;
  if (live()) {
    const { data, error } = await supabase!
      .from("showcase_posts")
      .insert({ user_id: me.uid, lesson_id: v.lessonId, title: v.title, what: v.what, physics: v.physics, materials: v.materials })
      .select("*")
      .single();
    if (error) throw explain(error.message);
    return postOf(data);
  }
  const all = demoPosts();
  if (!canSubmit(all, me.uid, SHOWCASE_LIMITS.pending)) throw explain("too many");
  const post: ShowcasePost = { id: generateId("post"), userId: me.uid, ...v, status: "pending", reviewedBy: null, reviewedAt: null, createdAt: new Date().toISOString() };
  lsSet(LS_POSTS, [post, ...all]);
  return post;
}

export async function submitQuestion(me: AppUser, input: QuestionInput): Promise<StudentQuestion> {
  const check = validateQuestion(input);
  if (!check.ok) throw new Error(firstError(check.errors));
  const v = check.value;
  if (live()) {
    const { data, error } = await supabase!
      .from("student_questions")
      .insert({ user_id: me.uid, lesson_id: v.lessonId, question: v.question, options: v.options, correct_index: v.correctIndex, explanation: v.explanation })
      .select("*")
      .single();
    if (error) throw explain(error.message);
    return questionOf(data);
  }
  const all = demoQuestions();
  if (!canSubmit(all, me.uid, QUESTION_LIMITS.pending)) throw explain("too many");
  const q: StudentQuestion = { id: generateId("question"), userId: me.uid, ...v, status: "pending", reviewedBy: null, reviewedAt: null, createdAt: new Date().toISOString() };
  lsSet(LS_QUESTIONS, [q, ...all]);
  return q;
}

export async function deleteShowcase(me: AppUser, id: string): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("showcase_posts").delete().eq("id", id).eq("user_id", me.uid);
    if (error) throw new Error(error.message);
    return;
  }
  lsSet(LS_POSTS, demoPosts().filter((p) => !(p.id === id && p.userId === me.uid)));
  lsSet(LS_LIKES, demoLikes().filter((l) => l.postId !== id));
}

export async function deleteQuestion(me: AppUser, id: string): Promise<void> {
  if (live()) {
    const { error } = await supabase!.from("student_questions").delete().eq("id", id).eq("user_id", me.uid);
    if (error) throw new Error(error.message);
    return;
  }
  lsSet(LS_QUESTIONS, demoQuestions().filter((q) => !(q.id === id && q.userId === me.uid)));
}

// ---------------------------------------------------------------------------
// The class's gallery and practice questions
// ---------------------------------------------------------------------------

export async function loadFeed(me: AppUser): Promise<FeedCard[]> {
  if (live()) {
    const { data, error } = await supabase!.rpc("showcase_feed");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any): FeedCard => ({
      id: r.id, userId: r.user_id, lessonId: r.lesson_id, title: r.title, what: r.what, physics: r.physics, materials: r.materials ?? null,
      status: "approved", reviewedBy: null, reviewedAt: null, createdAt: r.created_at,
      author: r.author, likes: Number(r.likes), likedByMe: Boolean(r.liked_by_me), isMine: Boolean(r.is_mine),
    }));
  }
  const who = await audienceOf(me);
  const likes = demoLikes();
  return rankFeed(
    visibleShowcase(demoPosts(), who).map((p): FeedCard => ({
      ...p,
      author: nameOf(p.userId),
      likes: likes.filter((l) => l.postId === p.id).length,
      likedByMe: likes.some((l) => l.postId === p.id && l.userId === me.uid),
      isMine: p.userId === me.uid,
    }))
  );
}

export async function setLike(me: AppUser, postId: string, liked: boolean): Promise<void> {
  if (live()) {
    const q = supabase!.from("showcase_likes");
    const { error } = liked ? await q.insert({ post_id: postId, user_id: me.uid }) : await q.delete().eq("post_id", postId).eq("user_id", me.uid);
    if (error) throw new Error(error.message);
    return;
  }
  const likes = demoLikes();
  if (!liked) {
    lsSet(LS_LIKES, likes.filter((l) => !(l.postId === postId && l.userId === me.uid)));
    return;
  }
  const post = demoPosts().find((p) => p.id === postId);
  if (!post || !canLike(post, await audienceOf(me))) throw new Error("Бұл жұмысқа ұнату мүмкін емес.");
  if (!likes.some((l) => l.postId === postId && l.userId === me.uid)) lsSet(LS_LIKES, [...likes, { postId, userId: me.uid }]);
}

export async function loadPeerQuestions(me: AppUser, lessonId: number): Promise<PeerQuestion[]> {
  if (live()) {
    const { data, error } = await supabase!.rpc("peer_questions", { p_lesson: lessonId });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any): PeerQuestion => ({ id: r.id, lessonId: r.lesson_id, question: r.question, options: r.options, correctIndex: Number(r.correct_index), explanation: r.explanation ?? null }));
  }
  return peerQuestions(demoQuestions(), lessonId, await audienceOf(me));
}

// ---------------------------------------------------------------------------
// The teacher's queue
// ---------------------------------------------------------------------------

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  if (live()) {
    const { data } = await supabase!.from("profiles").select("id, full_name").in("id", ids);
    for (const r of data ?? []) names.set(r.id, r.full_name);
  } else {
    for (const id of ids) names.set(id, nameOf(id));
  }
  return names;
}

export async function loadReviewQueue(me: AppUser): Promise<{ posts: Queued<ShowcasePost>[]; questions: Queued<StudentQuestion>[] }> {
  let posts: ShowcasePost[], questions: StudentQuestion[];
  if (live()) {
    const [p, q] = await Promise.all([
      supabase!.from("showcase_posts").select("*").eq("status", "pending").order("created_at"),
      supabase!.from("student_questions").select("*").eq("status", "pending").order("created_at"),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (q.error) throw new Error(q.error.message);
    posts = (p.data ?? []).map(postOf);
    questions = (q.data ?? []).map(questionOf);
  } else {
    const who = await audienceOf(me);
    posts = demoPosts().filter((x) => x.status === "pending" && who.myStudents.has(x.userId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    questions = demoQuestions().filter((x) => x.status === "pending" && who.myStudents.has(x.userId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const names = await namesOf([...new Set([...posts.map((x) => x.userId), ...questions.map((x) => x.userId)])]);
  const named = <T extends { userId: string }>(x: T): Queued<T> => ({ ...x, author: names.get(x.userId) ?? "Оқушы" });
  return { posts: posts.map(named), questions: questions.map(named) };
}

export async function reviewShowcase(me: AppUser, id: string, approve: boolean): Promise<void> {
  if (live()) {
    const { error } = await supabase!.rpc("review_showcase", { p_id: id, p_approve: approve });
    if (error) throw new Error(error.message);
    return;
  }
  const all = demoPosts();
  const post = all.find((p) => p.id === id);
  if (!post || !isMyStudent(me.uid, post.userId)) throw new Error("Бұл жұмыс сенің оқушыңа тиесілі емес.");
  lsSet(LS_POSTS, all.map((p) => (p.id === id ? decide(p, me.uid, approve, new Date()) : p)));
}

export async function reviewQuestion(me: AppUser, id: string, approve: boolean): Promise<void> {
  if (live()) {
    const { error } = await supabase!.rpc("review_question", { p_id: id, p_approve: approve });
    if (error) throw new Error(error.message);
    return;
  }
  const all = demoQuestions();
  const q = all.find((x) => x.id === id);
  if (!q || !isMyStudent(me.uid, q.userId)) throw new Error("Бұл сұрақ сенің оқушыңа тиесілі емес.");
  lsSet(LS_QUESTIONS, all.map((x) => (x.id === id ? decide(x, me.uid, approve, new Date()) : x)));
}
