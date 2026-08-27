// What the match loop needs from a network, and nothing more.
//
// Keeping this an interface is what lets the same match component run three
// ways: with no transport at all (practice against bots), as the host of an
// online room (it owns the physics and publishes snapshots), and as a guest
// (it sends its input and draws what the host sends back).

import type { Input, MatchState } from "./types";

export interface ArenaTransport {
  /** True when this browser is the authority that actually runs the physics. */
  isHost: boolean;
  /** Inputs from the other players, keyed by disc id. Host side. */
  remoteInputs(): Map<string, Input>;
  /** Publish the local player's input. Guest side. */
  sendInput(input: Input): void;
  /** Publish the authoritative state. Host side, called at a reduced rate. */
  sendState(state: MatchState): void;
  /** Most recent snapshot from the host, or null before the first arrives. */
  latestState(): MatchState | null;
}
