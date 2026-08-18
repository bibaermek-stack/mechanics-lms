// Shared contracts between the A-Frame layer and the three.js laboratory rigs.

import type * as THREE_NS from "three";
import type { PascoKey } from "@/components/simulation/core/pascoCatalog";
import type { ThreeNS } from "./three-models";

/** Slider values, keyed by `VrParam.key`. */
export type RigParams = Record<string, number>;

export interface RigContext {
  /** A-Frame's three.js namespace — never import THREE inside a rig. */
  THREE: ThreeNS;
  params: RigParams;
}

/**
 * One experiment's physical apparatus and its physics.
 *
 * A rig owns its meshes and its state; the A-Frame component that hosts it only
 * drives the clock and reads values back out. Splitting it this way means the
 * same rig could be mounted on the desktop stage without touching A-Frame.
 */
export interface LabRig {
  /** Everything the rig draws. Sits on y = 0 so it can stand on any floor. */
  object: THREE_NS.Group;
  /** Rebuild the physics state from the current parameters. */
  reset(params: RigParams): void;
  /** Advance by exactly `h` seconds and move the meshes to match. */
  step(h: number, params: RigParams): void;
  /** Values for the readout panel and the chart. */
  read(t: number): Record<string, number>;
  /** True once the run has reached its natural end (cart hit the stop, …). */
  finished(): boolean;
  dispose(): void;
}

export type RigFactory = (ctx: RigContext) => LabRig;

export interface VrParam {
  key: string;
  label: string;
  unit?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  decimals: number;
  /** Shown under the slider on the 2D panel. */
  hint?: string;
  /** Parameters marked `inVr` also get a pair of ± buttons inside the headset. */
  inVr?: boolean;
}

export interface VrReadout {
  key: string;
  label: string;
  unit?: string;
  decimals: number;
  color?: string;
}

export interface VrExperiment {
  id: string;
  title: string;
  subtitle: string;
  goal: string;
  formulas: string[];
  /** Scanned PASCO devices that appear in the scene. */
  devices: PascoKey[];
  /** Equipment modelled procedurally for this rig. */
  built: string[];
  /** Laboratory works from `src/data/labWorks.ts` that this covers. */
  labIds: number[];
  /** The lesson whose theory covers it. */
  lessonId: number;
  minutes: number;
  params: VrParam[];
  readouts: VrReadout[];
  /** Series plotted on the panel that hangs beside the bench. */
  chart: { key: string; label: string; color: string }[];
  tasks: string[];
  /** Seconds of simulated time after which a run auto-pauses (0 = never). */
  duration: number;
}
