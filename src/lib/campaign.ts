// The course as a journey: ten lessons, ten chapters, and the story only goes on as
// far as the student has got. Nothing is stored — every state here is read off the
// student's own records by the rules in engagement.ts (a quiz pass, a game pass, mastery).
//
// The map never *locks* a lesson: a student may open any of them whenever they like.
// What waits for a pass is the chapter's story and its badge.

import { lessonProgress, type EngagementRecords, type LessonProgress } from "./engagement";

export type NodeState =
  | "done" // the quiz is passed: the chapter is told and its badge earned
  | "open" // the previous chapter is done: this one is next
  | "locked"; // an earlier chapter is still waiting

export interface CampaignNode extends LessonProgress {
  lessonId: number;
  /** Position on the road, from 1. */
  chapter: number;
  state: NodeState;
  /** The next chapter to work on: the first one not yet done. */
  current: boolean;
  /** The story is told: the chapter is done, or it is the very first. */
  storyUnlocked: boolean;
}

export interface Campaign {
  nodes: CampaignNode[];
  stars: number;
  maxStars: number;
  chaptersDone: number;
  /** Every chapter is done: the launch can go ahead. */
  launchReady: boolean;
}

/** Lessons in the order of the road (ascending ids), however the caller holds them. */
export function computeCampaign(records: Pick<EngagementRecords, "quizzes" | "games">, lessonIds: readonly number[]): Campaign {
  const ids = [...new Set(lessonIds)].sort((a, b) => a - b);
  let currentTaken = false;
  const nodes = ids.map((lessonId, i): CampaignNode => {
    const progress = lessonProgress(records, lessonId);
    const done = progress.stars >= 1;
    const previousDone = i === 0 || lessonProgress(records, ids[i - 1]).stars >= 1;
    const state: NodeState = done ? "done" : previousDone ? "open" : "locked";
    const current = !done && previousDone && !currentTaken;
    if (current) currentTaken = true;
    return { ...progress, lessonId, chapter: i + 1, state, current, storyUnlocked: done || state === "open" && i === 0 };
  });
  const stars = nodes.reduce((a, n) => a + n.stars, 0);
  const chaptersDone = nodes.filter((n) => n.state === "done").length;
  return { nodes, stars, maxStars: nodes.length * 3, chaptersDone, launchReady: nodes.length > 0 && chaptersDone === nodes.length };
}

/** What a locked node is waiting for, for the panel: the previous chapter's number, or null. */
export const waitingFor = (campaign: Campaign, node: CampaignNode): number | null => (node.state === "locked" ? campaign.nodes[node.chapter - 2]?.chapter ?? null : null);
