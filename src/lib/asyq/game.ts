// One game, from setup to the last throw: the state machine, the physics, and the playback clock
// that tie them together. Rendering code reads `state` and `poses()` and calls `throwSakha()` and
// `tick(dt)`; tests call `playThrow()` and get the whole cycle at once, with no waiting between phases.

import { getMode } from "./modes";
import { createGame, reduce, type GameEvent, type GameState, type Phase, type ThrowRecord } from "./machine";
import { loadPhysics, type BodyKind } from "./physics";
import { poseAt, recordingDuration, simulateThrow, simulateThrowAsync, type Simulation } from "./simulate";
import { SAKHA_ID, cleanParams, setupFor, type ThrowParams } from "./throw";
import { tossForOrder, type Toss } from "./toss";
import type { FaceId } from "./faces";
import type { FinalBody, RuleConfig } from "./rules";
import type { Quat, Vec3 } from "./math";

/** How long each in-between phase lingers when a person is watching, seconds. */
export const PACE: Partial<Record<Phase, number>> = { choosePlayer: 0.7, judging: 1.6, scoring: 1.4, nextTurn: 0.6 };

export interface PosedBody {
  id: string;
  kind: BodyKind;
  position: Vec3;
  rotation: Quat;
  /** Settled side, once known. */
  face: FaceId | null | undefined;
}

interface Playback {
  sim: Simulation;
  t: number;
  contactAt: number | null;
  contactSent: boolean;
}

export class AsyqGame {
  private s: GameState;
  private playback: Playback | null = null;
  private computing = false;
  private left = 0;
  private entered = 0;
  private clock = 0;
  private readonly sims = new Map<number, Simulation>();
  /** Where the thrower stands. */
  private readonly origin: Vec3;
  /** The tosses that fixed the order, when the rules ask for them. */
  toss: Toss | null = null;
  private readonly listeners = new Set<() => void>();
  /** Reasons the game refused an event, newest last (for tests and the log). */
  readonly refusals: string[] = [];

  private constructor(config: RuleConfig, private readonly watched: boolean) {
    this.s = createGame(config);
    this.origin = getMode(config.mode).layout(config, 1).origin;
  }

  /** Loads the physics engine and sets up a game. `watched` adds the pauses between phases a person wants to see. */
  static async create(config: RuleConfig, watched = true): Promise<AsyqGame> {
    await loadPhysics();
    return new AsyqGame(config, watched);
  }

  get state(): GameState {
    return this.s;
  }

  /** Calls `fn` whenever the state changes or a throw starts or finishes being worked out. Returns the way to stop. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Jumps to the end of the throw being played back (for people who want no animation). */
  skipPlayback(): void {
    if (this.playback) this.settlePlayback();
  }

  /** Seconds since the current phase began. */
  get phaseTime(): number {
    return this.clock - this.entered;
  }

  /** True while a throw is being worked out (the picture should wait). */
  get isComputing(): boolean {
    return this.computing;
  }

  /** The recording of throw number `no`, if this game has played it. */
  simulationOf(no: number): Simulation | undefined {
    return this.sims.get(no);
  }

  /** Playback position within the current throw, seconds (0 when none is playing). */
  get playbackTime(): number {
    return this.playback ? this.playback.t : 0;
  }

  private send(e: GameEvent): boolean {
    const r = reduce(this.s, e);
    if (r.error) {
      this.refusals.push(r.error);
      return false;
    }
    const was = this.s.phase;
    this.s = r.state;
    if (this.s.phase !== was) {
      this.entered = this.clock;
      this.left = this.watched ? (PACE[this.s.phase] ?? 0) : 0;
    }
    this.emit();
    return true;
  }

  /** Dispatches the next event of whatever phase is waiting on a timer (never one that waits on the player or the physics). */
  private advance(): void {
    switch (this.s.phase) {
      case "choosePlayer": this.send({ type: "CHOOSE" }); break;
      case "judging": this.send({ type: "JUDGE" }); break;
      case "scoring": this.send({ type: "SCORE" }); break;
      case "nextTurn": this.send({ type: "NEXT" }); break;
      default: break;
    }
  }

  /** Begins the game: fixes the order (by toss if the rules say so) and moves to the first player. */
  start(): boolean {
    if (this.s.phase !== "setup") {
      this.refusals.push("ойын басталып қойған");
      return false;
    }
    let order = this.s.players.map((_, i) => i);
    if (this.s.config.turnOrder === "toss" && this.s.players.length > 1) {
      this.toss = tossForOrder(this.s.config);
      order = this.toss.order;
    }
    if (!this.send({ type: "START", order })) return false;
    if (!this.watched) this.settleTimers();
    return true;
  }

  /** The player throws. Returns false (and changes nothing) if it is not time to. */
  throwSakha(raw: ThrowParams): boolean {
    const prepared = this.prepareThrow(raw);
    if (!prepared) return false;
    this.finishThrow(simulateThrow(prepared.setup), prepared.no);
    return true;
  }

  /** The same, giving the page a turn while the throw is worked out. */
  async throwSakhaAsync(raw: ThrowParams): Promise<boolean> {
    const prepared = this.prepareThrow(raw);
    if (!prepared) return false;
    this.computing = true;
    this.emit();
    try {
      this.finishThrow(await simulateThrowAsync(prepared.setup), prepared.no);
    } finally {
      this.computing = false;
      this.emit();
    }
    return true;
  }

  private prepareThrow(raw: ThrowParams) {
    if (this.computing) {
      this.refusals.push("алдыңғы лақтыру есептелуде");
      return null;
    }
    if (this.s.phase !== "aiming") {
      this.refusals.push(`«${this.s.phase}» кезеңінде лақтыруға болмайды`);
      return null;
    }
    const params = cleanParams(raw, this.s.config);
    if (!params) {
      this.refusals.push("лақтыру параметрлері дұрыс емес");
      return null;
    }
    const { setup, launch } = setupFor(this.s.config, this.s.field, params, this.s.current, this.origin);
    if (!this.send({ type: "THROW", params, speed: launch.speed })) return null;
    return { setup, no: this.s.history.length + 1 };
  }

  private finishThrow(sim: Simulation, no: number): void {
    this.sims.set(no, sim);
    const contactAt =
      sim.contacts.find((c) => c.started && (c.a === SAKHA_ID ? c.b.startsWith("a") : c.b === SAKHA_ID && c.a.startsWith("a")))?.time ?? null;
    this.playback = { sim, t: 0, contactAt, contactSent: false };
    if (!this.watched) this.settlePlayback();
  }

  /** Moves the playback clock on by dt seconds and dispatches whatever comes due. */
  tick(dt: number): void {
    this.clock += dt;
    if (this.playback) {
      const p = this.playback;
      p.t += dt;
      if (!p.contactSent && p.contactAt !== null && p.t >= p.contactAt) {
        p.contactSent = true;
        this.send({ type: "CONTACT", contacts: this.contactPairs(p.sim, p.t) });
      }
      if (p.t >= recordingDuration(p.sim.recording)) this.settlePlayback();
      return;
    }
    if (this.left > 0) {
      this.left -= dt;
      if (this.left > 0) return;
    }
    this.advance();
  }

  private contactPairs(sim: Simulation, upTo: number): [string, string][] {
    const seen = new Set<string>();
    const out: [string, string][] = [];
    for (const c of sim.contacts) {
      if (!c.started || c.time > upTo) continue;
      const key = [c.a, c.b].sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        out.push([c.a, c.b]);
      }
    }
    return out;
  }

  /** The recording is over: hand the result to the machine. */
  private settlePlayback(): void {
    const p = this.playback;
    if (!p) return;
    const sim = p.sim;
    if (this.s.phase === "throwing" && p.contactAt !== null && !p.contactSent) {
      p.contactSent = true;
      this.send({ type: "CONTACT", contacts: this.contactPairs(sim, p.contactAt) });
    }
    this.playback = null;
    const final: FinalBody[] = sim.final.map((b) => ({ id: b.id, kind: b.kind, position: b.position, rotation: b.rotation, face: b.face ?? null }));
    this.send({
      type: "SETTLED",
      final,
      contacts: this.contactPairs(sim, Infinity),
      sim: { hz: sim.hz, maxOverlap: sim.maxOverlap, clean: sim.clean, settled: sim.settled, duration: sim.duration, attempts: sim.attempts.length },
    });
    if (!this.watched) this.settleTimers();
  }

  /** With nobody watching, runs every timed phase straight through to the next point that needs a decision. */
  private settleTimers(): void {
    while (["choosePlayer", "judging", "scoring", "nextTurn"].includes(this.s.phase)) this.advance();
  }

  /** Throws and plays the whole cycle out at once. Headless: the game must have been created with watched = false. */
  playThrow(params: ThrowParams): ThrowRecord | null {
    if (this.watched) throw new Error("playThrow is for games created with watched = false");
    const before = this.s.history.length;
    if (!this.throwSakha(params)) return null;
    return this.s.history.length > before ? this.s.history[this.s.history.length - 1] : null;
  }

  /** Every body to draw right now, with where it is. */
  poses(): PosedBody[] {
    const out: PosedBody[] = [];
    if (this.playback) {
      const rec = this.playback.sim.recording;
      rec.ids.forEach((id, i) => {
        const { position, rotation } = poseAt(rec, i, this.playback!.t);
        out.push({ id, kind: rec.kinds[i], position, rotation, face: undefined });
      });
      return out;
    }
    const pend = this.s.pending;
    const finals = pend?.final;
    if (finals && ["judging", "scoring"].includes(this.s.phase)) {
      for (const b of finals) out.push({ id: b.id, kind: b.kind, position: b.position, rotation: b.rotation, face: b.face });
      return out;
    }
    for (const b of this.s.field) out.push({ id: b.id, kind: "asyq", position: b.position, rotation: b.rotation, face: undefined });
    return out;
  }
}
