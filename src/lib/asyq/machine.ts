// The order of a game, as a state machine that cannot be hurried.
//
//   setup → choosePlayer → aiming → throwing → colliding → judging → scoring → nextTurn → choosePlayer …
//                                       └──────────────────────────┘ (a throw that touches nothing skips colliding)
//                                                                                 └→ finished
//
// Each phase has exactly the events that may leave it. Anything else is refused and the state is
// returned untouched, so nothing — a double click, a message arriving late, a bug in the picture —
// can start the next stage before the one in progress is over. The reducer is pure: the same state
// and event give the same new state, and it never runs physics; the physics result arrives as an
// event, and the mode (modes/*.ts) interprets it.

import { getMode } from "./modes";
import { cleanParams, type ThrowParams } from "./throw";
import type { FaceId } from "./faces";
import type {
  FieldBody,
  FinalBody,
  Judgement,
  NextDecision,
  RuleConfig,
  ScoredAsyq,
  Zone,
} from "./rules";

export type Phase = "setup" | "choosePlayer" | "aiming" | "throwing" | "colliding" | "judging" | "scoring" | "nextTurn" | "finished";

export const PHASES: readonly Phase[] = ["setup", "choosePlayer", "aiming", "throwing", "colliding", "judging", "scoring", "nextTurn", "finished"];

export const PHASE_LABEL: Record<Phase, string> = {
  setup: "Дайындық",
  choosePlayer: "Ойыншыны таңдау",
  aiming: "Лақтыруға дайындық",
  throwing: "Лақтыру",
  colliding: "Соқтығысу",
  judging: "Нәтижені анықтау",
  scoring: "Ұпай есептеу",
  nextTurn: "Келесі кезек",
  finished: "Ойынның аяқталуы",
};

export interface PlayerState {
  name: string;
  sakha: string;
  points: number;
  throws: number;
  /** Asyqs this player has won, in order. */
  won: string[];
}

export interface SimulationSummary {
  hz: number;
  maxOverlap: number;
  clean: boolean;
  settled: boolean;
  duration: number;
  attempts: number;
}

interface Pending {
  playerIndex: number;
  params: ThrowParams;
  speed: number;
  before: FieldBody[];
  contacts: [string, string][];
  final: FinalBody[] | null;
  sim: SimulationSummary | null;
  judgement: Judgement | null;
}

export interface ThrowRecord {
  no: number;
  playerIndex: number;
  playerName: string;
  sakha: string;
  params: ThrowParams;
  speed: number;
  /** Pairs that touched, in order (ids). */
  contacts: [string, string][];
  touched: string[];
  moved: string[];
  scored: ScoredAsyq[];
  points: number;
  playerTotal: number;
  sakhaFace: FaceId | null;
  sakhaInZone: boolean;
  /** Side each asyq on the field lies on after the throw. */
  faces: Record<string, FaceId | null>;
  simulation: SimulationSummary;
  /** What happened to the turn, and why. */
  turn: { next: number; over: boolean; reason: string };
}

export interface GameState {
  phase: Phase;
  config: RuleConfig;
  zone: Zone;
  players: PlayerState[];
  /** Player indices in turn order. */
  order: number[];
  turnPos: number;
  /** The player whose turn it is (valid from aiming on). */
  current: number;
  /** Throws the current player has made in a row this turn. */
  streak: number;
  /** Asyqs on the field and where they lie. */
  field: FieldBody[];
  /** Number the next fresh asyq gets. */
  nextId: number;
  history: ThrowRecord[];
  pending: Pending | null;
  decision: NextDecision | null;
  winners: number[] | null;
  endReason: string | null;
}

export type GameEvent =
  | { type: "START"; order: number[] }
  | { type: "CHOOSE" }
  | { type: "THROW"; params: ThrowParams; speed: number }
  | { type: "CONTACT"; contacts: [string, string][] }
  | { type: "SETTLED"; final: FinalBody[]; contacts: [string, string][]; sim: SimulationSummary }
  | { type: "JUDGE" }
  | { type: "SCORE" }
  | { type: "NEXT" }
  | { type: "RESET" };

/** Which events may leave each phase. */
export const ALLOWED: Record<Phase, GameEvent["type"][]> = {
  setup: ["START"],
  choosePlayer: ["CHOOSE"],
  aiming: ["THROW"],
  throwing: ["CONTACT", "SETTLED"],
  colliding: ["SETTLED"],
  judging: ["JUDGE"],
  scoring: ["SCORE"],
  nextTurn: ["NEXT"],
  finished: ["RESET"],
};

export interface Reduced {
  state: GameState;
  /** Set when the event was refused; the state is then the one that came in. */
  error?: string;
}

/** A fresh game, in `setup`, with the field already laid out. */
export function createGame(config: RuleConfig): GameState {
  const mode = getMode(config.mode);
  const layout = mode.layout(config, 1);
  return {
    phase: "setup",
    config,
    zone: layout.zone,
    players: config.players.map((p) => ({ name: p.name, sakha: p.sakha, points: 0, throws: 0, won: [] })),
    order: config.players.map((_, i) => i),
    turnPos: 0,
    current: 0,
    streak: 0,
    field: layout.bodies.map((b) => ({ id: b.id, position: b.position, rotation: b.rotation })),
    nextId: 1 + layout.bodies.length,
    history: [],
    pending: null,
    decision: null,
    winners: null,
    endReason: null,
  };
}

const refuse = (state: GameState, error: string): Reduced => ({ state, error });

export function reduce(state: GameState, event: GameEvent): Reduced {
  if (!ALLOWED[state.phase].includes(event.type)) {
    return refuse(state, `«${PHASE_LABEL[state.phase]}» кезеңінде ${event.type} мүмкін емес`);
  }
  const mode = getMode(state.config.mode);

  switch (event.type) {
    case "START": {
      const valid = [...event.order].sort((a, b) => a - b).every((x, i) => x === i) && event.order.length === state.players.length;
      if (!valid) return refuse(state, "кезек тәртібі әр ойыншыны бір реттен қамтуы керек");
      return { state: { ...state, phase: "choosePlayer", order: [...event.order], turnPos: 0, streak: 0 } };
    }

    case "CHOOSE":
      return { state: { ...state, phase: "aiming", current: state.order[state.turnPos] } };

    case "THROW": {
      const params = cleanParams(event.params, state.config);
      if (!params) return refuse(state, "лақтыру параметрлері сан болуы керек");
      const pending: Pending = {
        playerIndex: state.current,
        params,
        speed: event.speed,
        before: state.field.map((b) => ({ ...b })),
        contacts: [],
        final: null,
        sim: null,
        judgement: null,
      };
      return { state: { ...state, phase: "throwing", pending } };
    }

    case "CONTACT":
      return { state: { ...state, phase: "colliding", pending: { ...state.pending!, contacts: [...event.contacts] } } };

    case "SETTLED":
      return { state: { ...state, phase: "judging", pending: { ...state.pending!, final: event.final, contacts: [...event.contacts], sim: event.sim } } };

    case "JUDGE": {
      const p = state.pending!;
      const judgement = mode.judge({ config: state.config, zone: state.zone, before: p.before, after: p.final!, contacts: p.contacts });
      return { state: { ...state, phase: "scoring", pending: { ...p, judgement } } };
    }

    case "SCORE": {
      const p = state.pending!;
      const j = p.judgement!;
      const won = new Set(j.scored.map((s) => s.id));
      const players = state.players.map((pl, i) => (i === p.playerIndex ? { ...pl, points: pl.points + j.points, throws: pl.throws + 1, won: [...pl.won, ...j.scored.map((s) => s.id)] } : pl));
      // what is left lies where it stopped; what was won goes to the thrower
      const field: FieldBody[] = p.final!.filter((b) => b.kind === "asyq" && !won.has(b.id)).map((b) => ({ id: b.id, position: b.position, rotation: b.rotation }));
      const streak = state.streak + 1;
      const no = state.history.length + 1;
      const decision = mode.next({
        config: state.config,
        players: players.map((x) => ({ points: x.points, throws: x.throws })),
        order: state.order,
        turnPos: state.turnPos,
        streak,
        throwNo: no,
        scored: j.scored.length,
        fieldLeft: field.length,
      });
      const record: ThrowRecord = {
        no,
        playerIndex: p.playerIndex,
        playerName: state.players[p.playerIndex].name,
        sakha: state.players[p.playerIndex].sakha,
        params: p.params,
        speed: p.speed,
        contacts: p.contacts,
        touched: j.touched,
        moved: j.moved,
        scored: j.scored,
        points: j.points,
        playerTotal: players[p.playerIndex].points,
        sakhaFace: j.sakhaFace,
        sakhaInZone: j.sakhaInZone,
        faces: j.faces,
        simulation: p.sim!,
        turn: { next: state.order[decision.turnPos], over: decision.over, reason: decision.reason },
      };
      return { state: { ...state, phase: "nextTurn", players, field, streak, history: [...state.history, record], pending: null, decision } };
    }

    case "NEXT": {
      const d = state.decision!;
      if (d.over) {
        const top = Math.max(...state.players.map((p) => p.points));
        const winners = top > 0 ? state.players.map((p, i) => (p.points === top ? i : -1)).filter((i) => i >= 0) : [];
        return { state: { ...state, phase: "finished", winners, endReason: d.reason } };
      }
      let { field, nextId } = state;
      if (d.refill) {
        const layout = mode.layout(state.config, nextId);
        field = layout.bodies.map((b) => ({ id: b.id, position: b.position, rotation: b.rotation }));
        nextId += layout.bodies.length;
      }
      const streak = d.turnPos === state.turnPos ? state.streak : 0;
      return { state: { ...state, phase: "choosePlayer", turnPos: d.turnPos, streak, field, nextId, decision: null } };
    }

    case "RESET":
      return { state: createGame(state.config) };
  }
}
