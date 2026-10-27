// What a player chooses when throwing, and how it becomes a body with a velocity.

import { bodyOnFace } from "./placement";
import { MAX_SPEED, MAX_SPIN, type ThrowSetup } from "./simulate";
import { clamp, sakhaById, type FieldBody, type RuleConfig, type SakhaSpec } from "./rules";
import { ASYQ_LENGTH, type BodyInit } from "./physics";
import type { Vec3 } from "./math";

export const SAKHA_ID = "s";
/** The side the sakha is held on before it is thrown. */
export const SAKHA_START_FACE = "buk" as const;
/** How far above the floor the hand releases it, metres. */
export const RELEASE_LIFT = 0.03;
/** The widest the player may aim from straight across the ring, radians. */
export const AIM_LIMIT = (50 * Math.PI) / 180;
export const MIN_SPEED = 1;

export interface ThrowParams {
  /** Heading of the throw: 0 is straight across the ring, positive to the right. */
  yaw: number;
  /** 0–1 of the way from the gentlest throw to the hardest. */
  power: number;
  /** Spin about the vertical, −1…1 (the sakha turns flat as it goes). */
  spin: number;
  /** Spin along the throw, −1…1 (it rolls forwards or backwards). */
  roll: number;
}

export const NO_THROW: ThrowParams = { yaw: 0, power: 0.5, spin: 0, roll: 0 };

/** The throw as the game will play it: in range, and without spin if the rules offer none. */
export function cleanParams(p: ThrowParams, config: Pick<RuleConfig, "allowSpin">): ThrowParams | null {
  if (![p.yaw, p.power, p.spin, p.roll].every(Number.isFinite)) return null;
  return {
    yaw: clamp(p.yaw, -AIM_LIMIT, AIM_LIMIT),
    power: clamp(p.power, 0, 1),
    spin: config.allowSpin ? clamp(p.spin, -1, 1) : 0,
    roll: config.allowSpin ? clamp(p.roll, -1, 1) : 0,
  };
}

export const speedOf = (power: number) => MIN_SPEED + power * (MAX_SPEED - MIN_SPEED);

export interface Launch {
  body: BodyInit;
  velocity: Vec3;
  angular: Vec3;
  speed: number;
}

export function launchFor(params: ThrowParams, origin: Vec3, sakha: SakhaSpec): Launch {
  const speed = speedOf(params.power);
  const dx = Math.cos(params.yaw), dz = Math.sin(params.yaw);
  const body = bodyOnFace({ id: SAKHA_ID, kind: "sakha", length: sakha.length, mass: sakha.mass, face: SAKHA_START_FACE, x: origin[0], z: origin[2], yaw: params.yaw });
  body.position = [body.position[0], body.position[1] + RELEASE_LIFT, body.position[2]];
  return {
    body,
    speed,
    velocity: [speed * dx, 0.2 + 0.03 * speed, speed * dz],
    // spin about the vertical, and roll about the horizontal axis across the throw (u × d)
    angular: [params.roll * MAX_SPIN * dz, params.spin * MAX_SPIN, -params.roll * MAX_SPIN * dx],
  };
}

/** The whole throw for the physics: every asyq still on the field where it lies, and the sakha. */
export function setupFor(config: RuleConfig, field: FieldBody[], params: ThrowParams, player: number, origin: Vec3): { setup: ThrowSetup; launch: Launch } {
  const launch = launchFor(params, origin, sakhaById(config.players[player].sakha));
  const bodies: BodyInit[] = field.map((b) => ({ id: b.id, kind: "asyq", length: ASYQ_LENGTH, position: b.position, rotation: b.rotation }));
  bodies.push(launch.body);
  return { setup: { surface: config.surface, bodies, launch: { id: SAKHA_ID, velocity: launch.velocity, angular: launch.angular } }, launch };
}
