import type { ModeDefinition, ModeId } from "../rules";
import { asyqAtu } from "./asyqAtu";
import { PLANNED_MODES } from "./planned";

export const MODES: readonly ModeDefinition[] = [asyqAtu, ...PLANNED_MODES];

export function getMode(id: ModeId): ModeDefinition {
  const m = MODES.find((x) => x.id === id);
  if (!m) throw new Error(`unknown mode ${id}`);
  return m;
}

export const playableModes = () => MODES.filter((m) => m.available);
