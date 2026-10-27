// Which way a thrown asyq lies, and the four names for it.
//
// The names follow how Kazakh sources describe a thrown bone (the side that ends up on top):
//   алшы   stands on its smooth, flat foot            — the best throw, rank 1
//   тәйке  stands on its hollowed foot                — rank 2
//   бүк    convex back up, lying on its belly          — rank 3
//   шік    hollow side up, lying on its back           — rank 4
// The ranks are what some games use to fix who throws first. Regional usage differs and sources
// do not agree on every detail, so nothing here is built into a rule: the rank and the name are
// data, and every rule that cares about a face takes it as a parameter (see rules.ts).
//
// Which side of THIS scan is which was decided by measuring it (tools/asyq/build-model.mjs):
// the two broad sides are the dished one (бүк lies on it) and the domed one (шік lies on it);
// the two narrow ones are the flatter foot (алшы) and the more hollowed foot (тәйке).

import { RESTING_FACES, type FaceId, type RestingFace } from "./model.generated";
import { DOWN, angleDeg, normalize, qInvRotate, type Quat, type Vec3 } from "./math";

export type { FaceId, RestingFace };

export const FACE_IDS: readonly FaceId[] = ["alshy", "tayke", "buk", "shik"];

export const FACE_INFO: Record<FaceId, { name: string; how: string; rank: number }> = {
  alshy: { name: "Алшы", how: "тегіс табанымен тұрады", rank: 1 },
  tayke: { name: "Тәйке", how: "шұңқырлау табанымен тұрады", rank: 2 },
  buk: { name: "Бүк", how: "дөңес жоны жоғары, етпетінен жатады", rank: 3 },
  shik: { name: "Шік", how: "ойыс жағы жоғары, шалқасынан жатады", rank: 4 },
};

/** The four sides, with their normals made exactly unit length (the generated file rounds them to six places). */
export const FACES: readonly RestingFace[] = RESTING_FACES.map((f) => ({ ...f, normal: normalize(f.normal) }));

export const faceById = (id: FaceId): RestingFace => FACES.find((f) => f.id === id)!;

/** The body-local direction that points at the floor: the normal of the side it is lying on. */
export const localDown = (q: Quat): Vec3 => qInvRotate(q, DOWN);

/** A bone this close to a side's normal counts as lying on that side… */
export const MAX_FACE_ANGLE = 30;
/** …provided no other side is nearly as close. */
export const MIN_FACE_MARGIN = 15;

export interface FaceReading {
  /** The side it lies on, or null when it is on an edge or an end (or still tumbling). */
  face: FaceId | null;
  /** Degrees between the floor direction and the nearest side's normal. */
  angle: number;
  /** How much farther the runner-up side is: a clear reading has a big margin. */
  margin: number;
}

export function classifyFace(q: Quat, faces: readonly Pick<RestingFace, "id" | "normal">[] = FACES): FaceReading {
  const down = localDown(q);
  const ranked = faces.map((f) => ({ id: f.id, a: angleDeg(down, f.normal) })).sort((a, b) => a.a - b.a);
  const [best, next] = ranked;
  // with a single side there is no runner-up to confuse it with
  const margin = next ? next.a - best.a : 180 - best.a;
  return { face: best.a <= MAX_FACE_ANGLE && margin >= MIN_FACE_MARGIN ? best.id : null, angle: best.a, margin };
}

/**
 * Names a side only after the bone has stopped. While it moves the reading is recomputed every
 * step and thrown away; it is committed once the bone has been quiet for `settleSteps`
 * consecutive steps, and withdrawn if the bone is disturbed again before the result is used.
 */
export class FaceTracker {
  private quiet = 0;
  private committed: FaceReading | null = null;
  /** The latest reading, committed or not: for the picture, never for the result. */
  live: FaceReading | null = null;

  constructor(private readonly settleSteps: number) {}

  update(q: Quat, moving: boolean): void {
    this.live = classifyFace(q);
    if (moving) {
      this.quiet = 0;
      this.committed = null;
      return;
    }
    this.quiet++;
    if (this.quiet >= this.settleSteps) this.committed = this.live;
  }

  /** The side it lies on, once settled; undefined while it has not settled. null = settled on an edge or end. */
  get result(): FaceId | null | undefined {
    return this.committed ? this.committed.face : undefined;
  }

  get settled(): boolean {
    return this.committed !== null;
  }

  reset(): void {
    this.quiet = 0;
    this.committed = null;
    this.live = null;
  }
}
