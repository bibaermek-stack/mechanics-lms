// Wiring the live quiz's pure state machine to a transport: the teacher's browser runs the
// room (HostController), each phone runs a PlayerClient. Neither knows whether the wire is a
// BroadcastChannel between two tabs, Supabase Realtime between two devices, or — in the
// tests — a MemoryHub with a fake clock.

import { aliasOf, publicState, reduce, type HostState, type LiveEvent, type Msg, type PublicState, type Transport } from "./liveQuiz";

const isStr = (v: unknown, max = 200): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

/** What a message from the network must look like to be looked at at all. */
function wellFormed(m: unknown): m is Msg {
  if (typeof m !== "object" || m === null) return false;
  const x = m as Record<string, unknown>;
  switch (x.t) {
    case "join":
      return isStr(x.code, 12) && isStr(x.playerId, 64) && typeof x.name === "string" && x.name.length <= 200;
    case "answer":
      return isStr(x.code, 12) && isStr(x.playerId, 64) && typeof x.choice === "number";
    case "state":
      return typeof x.state === "object" && x.state !== null;
    default:
      return false;
  }
}

/**
 * The room. It applies each event with its own clock and tells everyone what changed. Only
 * `join` and `answer` are taken from the network: a `state` message sent by a
 * player — someone pretending to be the teacher — is not even considered.
 */
export class HostController {
  state: HostState;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly transport: Transport,
    room: HostState,
    private readonly now: () => number = Date.now,
    private readonly onChange?: (state: HostState) => void
  ) {
    this.state = room;
    this.unsubscribe = transport.subscribe((m) => this.receive(m));
  }

  /** From the teacher's own buttons. */
  command(e: LiveEvent): void {
    this.apply(e, false);
  }

  /** Call about four times a second: closes a question whose time has run out. */
  tick(): void {
    this.apply({ type: "tick" }, false);
  }

  broadcast(): void {
    this.transport.send({ t: "state", state: publicState(this.state, this.now()) });
  }

  close(): void {
    this.unsubscribe();
    this.transport.close();
  }

  private apply(e: LiveEvent, alwaysTell: boolean): void {
    const next = reduce(this.state, e, this.now());
    const changed = next !== this.state;
    this.state = next;
    if (changed) this.onChange?.(next);
    if (changed || alwaysTell) this.broadcast();
  }

  private receive(m: unknown): void {
    if (!wellFormed(m) || m.t === "state" || m.code !== this.state.code) return;
    // a join is always answered with the current state, even a refused one or a refreshed phone's: that is how a phone finds out where things stand
    if (m.t === "join") this.apply({ type: "join", playerId: m.playerId, name: m.name }, true);
    else this.apply({ type: "answer", playerId: m.playerId, choice: m.choice }, false);
  }
}

export interface PlayerView {
  state: PublicState | null;
  /** Local clock when `state` arrived. */
  receivedAt: number;
  /** The option I picked for the question I am on, if I did. */
  myChoice: number | null;
  /** The host has me on its list. */
  joined: boolean;
}

/** One phone. `playerId` is its secret token: it never leaves this phone except to be used. */
export class PlayerClient {
  view: PlayerView = { state: null, receivedAt: 0, myChoice: null, joined: false };
  private choiceAt = -1;
  /** What the room calls this player. */
  readonly alias: string;
  private readonly listeners = new Set<(v: PlayerView) => void>();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly transport: Transport,
    readonly code: string,
    readonly playerId: string,
    private readonly name: string,
    private readonly now: () => number = Date.now
  ) {
    this.alias = aliasOf(code, playerId);
    this.unsubscribe = transport.subscribe((m) => this.receive(m));
    this.join();
  }

  /** Asks to be let in (and, by the host's reply, where things stand); harmless to repeat until the host's list has this player on it. */
  join(): void {
    this.transport.send({ t: "join", code: this.code, playerId: this.playerId, name: this.name });
  }

  answer(choice: number): boolean {
    const s = this.view.state;
    if (!s || s.phase !== "question" || !this.view.joined) return false;
    if (this.view.myChoice !== null || s.answered.includes(this.alias)) return false;
    this.choiceAt = s.index;
    this.view = { ...this.view, myChoice: choice };
    this.transport.send({ t: "answer", code: this.code, playerId: this.playerId, choice });
    this.emit();
    return true;
  }

  /** Time left on the question, by this phone's own clock. */
  remainingMs(at: number = this.now()): number | null {
    const s = this.view.state;
    if (!s || s.remainingMs === null) return null;
    return Math.max(0, s.remainingMs - (at - this.view.receivedAt));
  }

  subscribe(cb: (v: PlayerView) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  close(): void {
    this.unsubscribe();
    this.transport.close();
  }

  private emit() {
    for (const cb of this.listeners) cb(this.view);
  }

  private receive(m: unknown): void {
    if (!wellFormed(m) || m.t !== "state" || m.state.code !== this.code) return;
    const cur = this.view.state;
    if (cur && m.state.seq < cur.seq) return; // an older snapshot, arrived late
    const s = m.state;
    this.view = {
      state: s,
      receivedAt: this.now(),
      myChoice: this.choiceAt === s.index ? this.view.myChoice : null,
      joined: s.players.some((p) => p.id === this.alias),
    };
    this.emit();
  }
}

/**
 * An in-memory network for the tests: every message goes to everybody else, as a copy. At
 * once by default; in `manual` mode it waits for flush(), which is how a slow connection is
 * played.
 */
export class MemoryHub {
  private readonly nodes = new Set<{ cb: ((m: Msg) => void) | null }>();
  private readonly pending: (() => void)[] = [];
  sent: Msg[] = [];

  constructor(private readonly manual = false) {}

  /** Delivers everything that has been sent and is still on its way. */
  flush(): void {
    while (this.pending.length) this.pending.shift()!();
  }

  connect(): Transport {
    const me: { cb: ((m: Msg) => void) | null } = { cb: null };
    this.nodes.add(me);
    return {
      send: (m) => {
        this.sent.push(structuredClone(m));
        const deliver = () => {
          for (const n of this.nodes) if (n !== me && n.cb) n.cb(structuredClone(m));
        };
        if (this.manual) this.pending.push(deliver);
        else deliver();
      },
      subscribe: (cb) => {
        me.cb = cb;
        return () => {
          me.cb = null;
        };
      },
      close: () => {
        this.nodes.delete(me);
      },
    };
  }
}
