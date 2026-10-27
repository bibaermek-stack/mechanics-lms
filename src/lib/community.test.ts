import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LESSON_MAX,
  LESSON_MIN,
  PRACTICE_LENGTH,
  QUESTION_LIMITS,
  SHOWCASE_LIMITS,
  buildPractice,
  canLike,
  canSubmit,
  contributionsOf,
  decide,
  peerQuestions,
  rankFeed,
  validateQuestion,
  validateShowcase,
  visibleShowcase,
  type Audience,
  type FeedCard,
  type ShowcasePost,
  type StudentQuestion,
} from "./community";

const sql = (f: string) => readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8");
const x = (n: number, ch = "а") => ch.repeat(n);

describe("the limits are the database's", () => {
  const show = sql("0015_showcase.sql"), ques = sql("0016_student_questions.sql");
  const range = (s: string, re: RegExp) => {
    const m = s.match(re);
    expect(m, String(re)).not.toBeNull();
    return [Number(m![1]), Number(m![2])];
  };
  it("showcase", () => {
    expect(range(show, /btrim\(title\)\) between (\d+) and (\d+)/)).toEqual([SHOWCASE_LIMITS.title.min, SHOWCASE_LIMITS.title.max]);
    expect(range(show, /btrim\(what\)\) between (\d+) and (\d+)/)).toEqual([SHOWCASE_LIMITS.what.min, SHOWCASE_LIMITS.what.max]);
    expect(range(show, /btrim\(physics\)\) between (\d+) and (\d+)/)).toEqual([SHOWCASE_LIMITS.physics.min, SHOWCASE_LIMITS.physics.max]);
    expect(Number(show.match(/char_length\(materials\) <= (\d+)/)![1])).toBe(SHOWCASE_LIMITS.materials.max);
    expect(Number(show.match(/>= (\d+) then/)![1])).toBe(SHOWCASE_LIMITS.pending);
    expect(range(show, /lesson_id between (\d+) and (\d+)/)).toEqual([LESSON_MIN, LESSON_MAX]);
  });
  it("questions", () => {
    expect(range(ques, /btrim\(question\)\) between (\d+) and (\d+)/)).toEqual([QUESTION_LIMITS.text.min, QUESTION_LIMITS.text.max]);
    expect(range(ques, /not between (\d+) and (\d+)/)).toEqual([QUESTION_LIMITS.option.min, QUESTION_LIMITS.option.max]);
    expect(Number(ques.match(/char_length\(explanation\) <= (\d+)/)![1])).toBe(QUESTION_LIMITS.explanation.max);
    expect(Number(ques.match(/>= (\d+) then/)![1])).toBe(QUESTION_LIMITS.pending);
    expect(Number(ques.match(/array_length\(opts, 1\) = (\d+)/)![1])).toBe(QUESTION_LIMITS.options);
    expect(range(ques, /correct_index between (\d+) and (\d+)/)).toEqual([0, QUESTION_LIMITS.options - 1]);
    expect(range(ques, /lesson_id between (\d+) and (\d+)/)).toEqual([LESSON_MIN, LESSON_MAX]);
  });
});

describe("validateShowcase", () => {
  const good = { lessonId: 5, title: "Резеңке зымыран", what: x(20), physics: x(20), materials: "шар, жіп" };
  const errs = (o: Partial<typeof good>) => {
    const r = validateShowcase({ ...good, ...o });
    return r.ok ? [] : Object.keys(r.errors);
  };

  it("accepts a good one, trimmed, with materials optional", () => {
    const r = validateShowcase({ ...good, title: "  Резеңке зымыран  ", materials: "   " });
    expect(r).toEqual({ ok: true, value: { lessonId: 5, title: "Резеңке зымыран", what: x(20), physics: x(20), materials: null } });
    expect(validateShowcase({ ...good, materials: undefined }).ok).toBe(true);
  });
  it("holds every field to its length, on both sides, after trimming", () => {
    expect(errs({ title: x(2) })).toEqual(["title"]);
    expect(errs({ title: x(3) })).toEqual([]);
    expect(errs({ title: x(80) })).toEqual([]);
    expect(errs({ title: x(81) })).toEqual(["title"]);
    expect(errs({ title: "     " })).toEqual(["title"]);
    expect(errs({ title: ` ${x(2)} ` })).toEqual(["title"]);
    expect(errs({ what: x(9) })).toEqual(["what"]);
    expect(errs({ what: x(10) })).toEqual([]);
    expect(errs({ what: x(600) })).toEqual([]);
    expect(errs({ what: x(601) })).toEqual(["what"]);
    expect(errs({ physics: x(9) })).toEqual(["physics"]);
    expect(errs({ physics: x(400) })).toEqual([]);
    expect(errs({ physics: x(401) })).toEqual(["physics"]);
    expect(errs({ materials: x(200) })).toEqual([]);
    expect(errs({ materials: x(201) })).toEqual(["materials"]);
  });
  it("holds the lesson to a whole number in range", () => {
    expect(errs({ lessonId: 0 })).toEqual(["lessonId"]);
    expect(errs({ lessonId: LESSON_MIN })).toEqual([]);
    expect(errs({ lessonId: LESSON_MAX })).toEqual([]);
    expect(errs({ lessonId: LESSON_MAX + 1 })).toEqual(["lessonId"]);
    expect(errs({ lessonId: 2.5 })).toEqual(["lessonId"]);
    expect(errs({ lessonId: NaN })).toEqual(["lessonId"]);
  });
  it("reports every problem at once", () => {
    expect(errs({ title: "", what: "", physics: "", lessonId: 0 }).sort()).toEqual(["lessonId", "physics", "title", "what"]);
  });
});

describe("validateQuestion", () => {
  const good = { lessonId: 5, question: "Қандай энергия көтерілген тасқа тән?", options: ["Потенциалдық", "Кинетикалық", "Жылулық", "Ядролық"], correctIndex: 0, explanation: "E = mgh" };
  const errs = (o: Partial<typeof good>) => {
    const r = validateQuestion({ ...good, ...o });
    return r.ok ? [] : Object.keys(r.errors);
  };

  it("accepts a good one and trims it, with the explanation optional", () => {
    const r = validateQuestion({ ...good, options: [" а ", "ә", "б", "в"], explanation: "  " });
    expect(r).toEqual({ ok: true, value: { lessonId: 5, question: good.question, options: ["а", "ә", "б", "в"], correctIndex: 0, explanation: null } });
  });
  it("holds the question and explanation to their lengths", () => {
    expect(errs({ question: x(9) })).toEqual(["question"]);
    expect(errs({ question: x(10) })).toEqual([]);
    expect(errs({ question: x(300) })).toEqual([]);
    expect(errs({ question: x(301) })).toEqual(["question"]);
    expect(errs({ explanation: x(300) })).toEqual([]);
    expect(errs({ explanation: x(301) })).toEqual(["explanation"]);
  });
  it("needs exactly four options of 1–120 letters, no two alike in any case", () => {
    expect(errs({ options: ["а", "ә", "б"] })).toEqual(["options"]);
    expect(errs({ options: ["а", "ә", "б", "в", "г"] })).toEqual(["options"]);
    expect(errs({ options: ["а", "а", "ә", "б", "в"] })).toEqual(["options"]); // five, of which four differ
    expect(errs({ options: ["а", "ә", "б", ""] })).toEqual(["options"]);
    expect(errs({ options: ["а", "ә", "б", "   "] })).toEqual(["options"]);
    expect(errs({ options: ["а", "ә", "б", x(121)] })).toEqual(["options"]);
    expect(errs({ options: ["а", "ә", "б", x(120)] })).toEqual([]);
    expect(errs({ options: ["Ха", "ә", "б", "ха"] })).toEqual(["options"]);
    expect(errs({ options: ["а", "ә", "б", " а "] })).toEqual(["options"]);
  });
  it("needs the right answer to be one of the four", () => {
    expect(errs({ correctIndex: -1 })).toEqual(["correctIndex"]);
    expect(errs({ correctIndex: 3 })).toEqual([]);
    expect(errs({ correctIndex: 4 })).toEqual(["correctIndex"]);
    expect(errs({ correctIndex: 1.5 })).toEqual(["correctIndex"]);
  });
  it("holds the lesson in range", () => {
    expect(errs({ lessonId: 0 })).toEqual(["lessonId"]);
    expect(errs({ lessonId: 1000 })).toEqual(["lessonId"]);
  });
});

describe("limits on waiting items", () => {
  const w = (userId: string, status: "pending" | "approved" | "rejected") => ({ userId, status });
  it("counts only this student's pending ones", () => {
    const items = [...Array(4).fill(0).map(() => w("a", "pending")), w("a", "approved"), w("a", "rejected"), ...Array(9).fill(0).map(() => w("b", "pending"))];
    expect(canSubmit(items, "a", 5)).toBe(true);
    expect(canSubmit([...items, w("a", "pending")], "a", 5)).toBe(false);
    expect(canSubmit(items, "b", 10)).toBe(true);
    expect(canSubmit(items, "c", 1)).toBe(true);
  });
});

describe("decide", () => {
  const item = { status: "pending" as const, reviewedBy: null as string | null, reviewedAt: null as string | null, title: "x" };
  it("records the decision, who and when, without touching the original, and can be reversed", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    const ok = decide(item, "t1", true, now);
    expect(ok).toEqual({ status: "approved", reviewedBy: "t1", reviewedAt: "2026-10-26T10:00:00.000Z", title: "x" });
    expect(item.status).toBe("pending");
    expect(decide(ok, "t2", false, new Date("2026-10-27T00:00:00Z"))).toMatchObject({ status: "rejected", reviewedBy: "t2" });
  });
});

// The scenario of supabase/tests/0015 and 0016: teacher T1 has A, B, D; G has asked to join T1; teacher T2 has E; F has none.
describe("who sees what: the SQL tests' scenario, replayed", () => {
  const post = (id: string, userId: string, status: ShowcasePost["status"], createdAt = "2026-10-01"): ShowcasePost => ({
    id, userId, lessonId: 5, title: id, what: x(20), physics: x(20), materials: null, status, reviewedBy: status === "pending" ? null : "T1", reviewedAt: status === "pending" ? null : createdAt, createdAt,
  });
  const set = (...ids: string[]) => new Set(ids);
  const audience: Record<string, Audience> = {
    A: { viewerId: "A", classmates: set("A", "B", "D"), myStudents: set() },
    B: { viewerId: "B", classmates: set("A", "B", "D"), myStudents: set() },
    D: { viewerId: "D", classmates: set("A", "B", "D"), myStudents: set() },
    E: { viewerId: "E", classmates: set("E"), myStudents: set() },
    F: { viewerId: "F", classmates: set("F"), myStudents: set() },
    G: { viewerId: "G", classmates: set("G"), myStudents: set() },
    T1: { viewerId: "T1", classmates: set(), myStudents: set("A", "B", "D") },
    T2: { viewerId: "T2", classmates: set(), myStudents: set("E") },
  };
  const posts = [post("p1", "A", "approved"), post("p2", "A", "approved"), post("p3", "A", "rejected"), post("p4", "A", "pending"), post("pe", "E", "approved")];

  it("the gallery shows approved posts of the class, to the class and the teacher only", () => {
    const seen = (who: string) => visibleShowcase(posts, audience[who]).map((p) => p.id);
    expect(seen("B")).toEqual(["p1", "p2"]);
    expect(seen("D")).toEqual(["p1", "p2"]);
    expect(seen("A")).toEqual(["p1", "p2"]);
    expect(seen("T1")).toEqual(["p1", "p2"]);
    expect(seen("E")).toEqual(["pe"]);
    expect(seen("T2")).toEqual(["pe"]);
    expect(seen("F")).toEqual([]);
    expect(seen("G")).toEqual([]);
  });

  it("a like needs an approved post by somebody else in the class", () => {
    const can = (id: string, who: string) => canLike(posts.find((p) => p.id === id)!, audience[who]);
    expect(can("p1", "B")).toBe(true);
    expect(can("p1", "D")).toBe(true);
    expect(can("p1", "A")).toBe(false); // her own
    expect(can("p3", "B")).toBe(false); // rejected
    expect(can("p4", "B")).toBe(false); // pending
    expect(can("p1", "E")).toBe(false); // another class
    expect(can("p1", "F")).toBe(false);
    expect(can("p1", "G")).toBe(false); // not accepted yet
    expect(can("p1", "T1")).toBe(false); // a teacher
  });

  const q = (id: string, userId: string, status: StudentQuestion["status"], lessonId = 5, createdAt = "2026-10-01"): StudentQuestion => ({
    id, userId, lessonId, question: id, options: ["а", "ә", "б", "в"], correctIndex: 0, explanation: null, status, reviewedBy: null, reviewedAt: null, createdAt,
  });
  const questions = [q("q2", "A", "approved", 5, "2027-01-01"), q("q1", "A", "approved", 5, "2026-10-01"), q("q3", "A", "rejected", 3), q("q4", "A", "pending"), q("qe", "E", "approved"), q("qd", "A", "approved", 3)];

  it("practice questions: classmates' approved ones for the lesson, oldest first, never one's own", () => {
    const ids = (who: string, lesson = 5) => peerQuestions(questions, lesson, audience[who]).map((x) => x.id);
    expect(ids("B")).toEqual(["q1", "q2"]);
    expect(ids("D")).toEqual(["q1", "q2"]);
    expect(ids("A")).toEqual([]);
    expect(ids("B", 3)).toEqual(["qd"]);
    expect(ids("B", 9)).toEqual([]);
    for (const who of ["E", "F", "G", "T1", "T2"]) expect(ids(who), who).toEqual(who === "E" ? [] : []);
  });
});

describe("rankFeed", () => {
  const card = (id: string, likes: number, createdAt: string): FeedCard => ({
    id, userId: "a", lessonId: 1, title: id, what: "", physics: "", materials: null, status: "approved", reviewedBy: "t", reviewedAt: createdAt, createdAt, author: "A", likes, likedByMe: false, isMine: false,
  });
  it("puts the most liked first and the newest first among equals, without changing the input", () => {
    const input = [card("old", 0, "2026-01-01"), card("liked", 2, "2026-01-02"), card("new", 0, "2026-03-01"), card("mid", 1, "2026-05-01")];
    expect(rankFeed(input).map((c) => c.id)).toEqual(["liked", "mid", "new", "old"]);
    expect(input[0].id).toBe("old");
  });
});

describe("buildPractice", () => {
  const qs = Array.from({ length: 8 }, (_, i) => ({ id: `q${i}`, question: `Сұрақ ${i}?`, options: [`a${i}`, `b${i}`, `c${i}`, `d${i}`], correctIndex: i % 4, explanation: i % 2 ? `E${i}` : null }));
  it("takes five by default, the same five for the same seed, others for another", () => {
    const a = buildPractice(qs, 1), b = buildPractice(qs, 1), c = buildPractice(qs, 2);
    expect(a).toHaveLength(PRACTICE_LENGTH);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c));
    expect(new Set(a.map((i) => i.id)).size).toBe(5);
  });
  it("shuffles the options but keeps track of the right one", () => {
    let moved = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const item of buildPractice(qs, seed, 8)) {
        const src = qs.find((q) => q.id === item.id)!;
        expect([...item.options].sort()).toEqual([...src.options].sort());
        expect(item.options[item.correct]).toBe(src.options[src.correctIndex]);
        expect(item.explanation).toBe(src.explanation);
        if (item.correct !== src.correctIndex) moved++;
      }
    }
    expect(moved).toBeGreaterThan(50);
  });
  it("copes with few questions and none", () => {
    expect(buildPractice(qs.slice(0, 2), 1)).toHaveLength(2);
    expect(buildPractice([], 1)).toEqual([]);
    expect(buildPractice(qs, 1, 3)).toHaveLength(3);
  });
});

describe("contributionsOf", () => {
  const p = (userId: string, status: ShowcasePost["status"]): ShowcasePost => ({ id: userId + status + Math.random(), userId, lessonId: 1, title: "", what: "", physics: "", materials: null, status, reviewedBy: null, reviewedAt: null, createdAt: "" });
  const q = (userId: string, status: StudentQuestion["status"]): StudentQuestion => ({ id: userId + status + Math.random(), userId, lessonId: 1, question: "", options: [], correctIndex: 0, explanation: null, status, reviewedBy: null, reviewedAt: null, createdAt: "" });
  it("counts the student's own approved work and what still waits", () => {
    const c = contributionsOf([p("a", "approved"), p("a", "approved"), p("a", "pending"), p("a", "rejected"), p("b", "approved")], [q("a", "approved"), q("a", "pending"), q("a", "pending"), q("b", "approved")], "a");
    expect(c).toEqual({ approvedShowcases: 2, approvedQuestions: 1, waiting: 3 });
    expect(contributionsOf([], [], "a")).toEqual({ approvedShowcases: 0, approvedQuestions: 0, waiting: 0 });
  });
});
