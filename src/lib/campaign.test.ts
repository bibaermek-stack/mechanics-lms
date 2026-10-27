import { describe, expect, it } from "vitest";
import { computeCampaign, waitingFor } from "./campaign";
import { lessonProgress, starsByLesson, MASTERY_PERCENT, PASS_PERCENT } from "./engagement";
import { CHAPTERS, FALLBACK_CHAPTER, FINALE, chapterFor } from "@/data/campaign";
import type { GameResult, QuizAttempt } from "./types";

const quiz = (moduleId: number, score: number, total = 10): QuizAttempt => ({ id: `q${moduleId}-${score}`, moduleId, userId: "u", score, total, answers: [], takenAt: "2026-10-01T10:00:00Z" });
const game = (moduleId: number, gameType: string, score: number): GameResult => ({ id: `g${moduleId}-${gameType}-${score}`, moduleId, userId: "u", gameType: gameType as GameResult["gameType"], score, completedAt: "2026-10-01T10:00:00Z" });
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

describe("stars for one lesson", () => {
  const p = (quizzes: QuizAttempt[], games: GameResult[] = []) => lessonProgress({ quizzes, games }, 3);

  it("none without a passed quiz, however good the games", () => {
    expect(p([], []).stars).toBe(0);
    expect(p([quiz(3, 5)], []).stars).toBe(0); // 50 %
    expect(p([quiz(3, 5)], [game(3, "memory", 100)]).stars).toBe(0);
    expect(p([], [game(3, "blitz", 100)]).stars).toBe(0);
  });

  it("one for a quiz at 60 %, and 59 % is not a pass", () => {
    expect(p([quiz(3, 6)]).stars).toBe(1);
    expect(p([quiz(3, 59, 100)]).stars).toBe(0);
    expect(p([quiz(3, 60, 100)]).stars).toBe(1);
    expect(PASS_PERCENT).toBe(60);
  });

  it("two with a lesson game at 60 as well", () => {
    expect(p([quiz(3, 7)], [game(3, "memory", 59)]).stars).toBe(1);
    expect(p([quiz(3, 7)], [game(3, "memory", 60)]).stars).toBe(2);
  });

  it("three with the quiz at 90 and the game passed; a mastered quiz alone is two stars short", () => {
    expect(p([quiz(3, 9)], [game(3, "memory", 70)]).stars).toBe(3);
    expect(p([quiz(3, 10)], []).stars).toBe(1);
    expect(p([quiz(3, 8)], [game(3, "memory", 100)]).stars).toBe(2);
    expect(p([quiz(3, 89, 100)], [game(3, "memory", 100)]).stars).toBe(2);
    expect(p([quiz(3, 90, 100)], [game(3, "memory", 100)]).stars).toBe(3);
    expect(MASTERY_PERCENT).toBe(90);
  });

  it("takes the best of several attempts, and ignores other lessons, and the daily and myth games", () => {
    expect(p([quiz(3, 2), quiz(3, 9), quiz(3, 4)], [game(3, "memory", 10), game(3, "memory", 80)]).stars).toBe(3);
    expect(p([quiz(4, 10)], [game(4, "memory", 100)]).stars).toBe(0);
    expect(p([quiz(3, 7)], [game(3, "daily", 100), game(3, "myth", 100)]).stars).toBe(1);
    expect(p([quiz(3, 7)], [game(0, "daily", 100)]).stars).toBe(1);
  });

  it("reports the bests it found", () => {
    expect(p([quiz(3, 7), quiz(3, 8)], [game(3, "blitz", 40), game(3, "blitz", 75)])).toMatchObject({ quizBest: 80, gameBest: 75 });
    expect(p([], [])).toMatchObject({ quizBest: null, gameBest: null });
  });

  it("a quiz with no questions is no pass", () => {
    expect(p([quiz(3, 0, 0)]).stars).toBe(0);
  });
});

describe("starsByLesson", () => {
  it("covers every lesson the records mention, once", () => {
    const m = starsByLesson({ quizzes: [quiz(1, 9), quiz(1, 3), quiz(2, 7)], games: [game(1, "memory", 90), game(5, "blitz", 90), game(0, "daily", 100)] });
    expect([...m.entries()].sort((a, b) => a[0] - b[0])).toEqual([[1, 3], [2, 1], [5, 0]]);
  });
});

describe("the campaign road", () => {
  it("starts with the first chapter open and the rest locked", () => {
    const c = computeCampaign({ quizzes: [], games: [] }, IDS);
    expect(c.nodes.map((n) => n.state)).toEqual(["open", ...Array(9).fill("locked")]);
    expect(c.nodes[0]).toMatchObject({ current: true, storyUnlocked: true, chapter: 1 });
    expect(c.nodes.slice(1).every((n) => !n.current && !n.storyUnlocked)).toBe(true);
    expect(c).toMatchObject({ stars: 0, maxStars: 30, chaptersDone: 0, launchReady: false });
  });

  it("opens the next chapter when a quiz is passed, and marks the passed one done", () => {
    const c = computeCampaign({ quizzes: [quiz(1, 7)], games: [] }, IDS);
    expect(c.nodes.slice(0, 3).map((n) => n.state)).toEqual(["done", "open", "locked"]);
    expect(c.nodes[1]).toMatchObject({ current: true, storyUnlocked: false });
    expect(c.nodes[0]).toMatchObject({ current: false, storyUnlocked: true, stars: 1 });
    expect(c.chaptersDone).toBe(1);
  });

  it("does not skip: lesson 3 passed while 2 is not leaves 3 done but 4 locked and 2 the current", () => {
    const c = computeCampaign({ quizzes: [quiz(1, 7), quiz(3, 9)], games: [] }, IDS);
    expect(c.nodes.map((n) => n.state).slice(0, 5)).toEqual(["done", "open", "done", "open", "locked"]);
    expect(c.nodes.filter((n) => n.current).map((n) => n.lessonId)).toEqual([2]);
    // the chapter after a done one is open even though the one before it is not
    expect(c.nodes[3].state).toBe("open");
  });

  it("names the chapter a locked node waits for", () => {
    const c = computeCampaign({ quizzes: [], games: [] }, IDS);
    expect(waitingFor(c, c.nodes[4])).toBe(4);
    expect(waitingFor(c, c.nodes[0])).toBeNull();
  });

  it("adds up stars and is ready to launch only when every chapter is done", () => {
    const all = IDS.map((id) => quiz(id, 9));
    const games = IDS.map((id) => game(id, "memory", 80));
    const ready = computeCampaign({ quizzes: all, games }, IDS);
    expect(ready).toMatchObject({ stars: 30, chaptersDone: 10, launchReady: true });
    expect(ready.nodes.every((n) => n.state === "done" && !n.current)).toBe(true);
    const missing = computeCampaign({ quizzes: all.slice(0, 9), games }, IDS);
    expect(missing.launchReady).toBe(false);
    expect(missing.stars).toBe(27);
    expect(missing.nodes[9]).toMatchObject({ state: "open", current: true });
  });

  it("orders the road by lesson id, ignores duplicates, and copes with no lessons", () => {
    const c = computeCampaign({ quizzes: [quiz(2, 7)], games: [] }, [3, 1, 2, 2]);
    expect(c.nodes.map((n) => n.lessonId)).toEqual([1, 2, 3]);
    expect(c.nodes.map((n) => n.state)).toEqual(["open", "done", "open"]); // 2 is passed, though 1 is not: 3 opens after it
    expect(c.nodes.filter((n) => n.current).map((n) => n.lessonId)).toEqual([1]);
    expect(computeCampaign({ quizzes: [], games: [] }, [])).toMatchObject({ nodes: [], stars: 0, maxStars: 0, launchReady: false });
  });
});

describe("the story", () => {
  it("has a chapter, with a title, a story and a badge, for each of the ten lessons", () => {
    for (const id of IDS) {
      const ch = chapterFor(id);
      expect(ch, String(id)).toBe(CHAPTERS[id]);
      expect(ch.title.length).toBeGreaterThan(3);
      expect(ch.story.length).toBeGreaterThan(80);
      expect(ch.badge.length).toBeGreaterThan(3);
    }
    expect(new Set(IDS.map((id) => chapterFor(id).badge)).size).toBe(10);
    expect(new Set(IDS.map((id) => chapterFor(id).title)).size).toBe(10);
  });
  it("falls back for a lesson a teacher added", () => {
    expect(chapterFor(99)).toBe(FALLBACK_CHAPTER);
    expect(FINALE.story).toMatch(/Гагарин/);
  });
});
