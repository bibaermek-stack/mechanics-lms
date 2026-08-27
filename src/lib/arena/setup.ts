// Building the line-ups.
//
// Both ends of an online match derive their bodies from the same roster in the
// same order, so the ids line up and an input addressed to "player 3" reaches
// the same disc everywhere. Any side short of players is filled with bots, which
// is what lets two people start a three-a-side match without waiting for four
// more. Kept free of React and of "use client" so the game server can build the
// same line-up from the same code — two implementations of a kick-off would
// drift apart the first time either was touched.

import { makeBall, makePlayer } from "./pitch";
import type { Disc, MatchConfig, Member, Team } from "./types";

const BOT_NAMES = ["Бот-1", "Бот-2", "Бот-3", "Бот-4"];

/** A practice match: one human, everyone else played by the machine. */
export function practiceDiscs(
  me: { id: string; name: string },
  team: Team,
  config: MatchConfig
): Disc[] {
  const discs: Disc[] = [makeBall()];
  for (const t of [0, 1] as Team[]) {
    for (let i = 0; i < config.perSide; i++) {
      const mine = t === team && i === 0;
      discs.push(
        makePlayer(
          mine ? me.id : `bot-${t}-${i}`,
          t,
          i,
          config.perSide,
          mine ? me.name : BOT_NAMES[i % BOT_NAMES.length],
          mine
        )
      );
    }
  }
  return discs;
}

/** An online match: the roster's picks first, bots after. */
export function rosterDiscs(
  members: Member[],
  config: MatchConfig,
  localId: string | null
): Disc[] {
  const discs: Disc[] = [makeBall()];
  const ordered = [...members].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));

  for (const t of [0, 1] as Team[]) {
    const humans = ordered.filter((m) => m.team === t).slice(0, config.perSide);
    humans.forEach((m, i) => {
      discs.push(makePlayer(m.id, t, i, config.perSide, m.name, m.id === localId));
    });
    for (let i = humans.length; i < config.perSide; i++) {
      discs.push(
        makePlayer(`bot-${t}-${i}`, t, i, config.perSide, BOT_NAMES[i % BOT_NAMES.length])
      );
    }
  }
  return discs;
}

/** Machine-played discs are exactly those with no human behind them. */
export function makeIsBot(humanIds: Set<string>) {
  return (d: Disc) => d.kind === "player" && !humanIds.has(d.id);
}
