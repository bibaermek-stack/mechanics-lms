// Which rig builds which experiment.

import type { RigFactory } from "../types";
import { createKinematicsRig } from "./kinematics";
import { createDynamicsRig } from "./dynamics";
import { createEnergyRig } from "./energy";
import { createPendulumRig } from "./pendulum";

export const RIGS: Record<string, RigFactory> = {
  kinematics: createKinematicsRig,
  dynamics: createDynamicsRig,
  energy: createEnergyRig,
  pendulum: createPendulumRig,
};
