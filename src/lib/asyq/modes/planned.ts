// Modes that have a place in the registry but no rules yet. They are deliberately empty: the rules
// of Ханталапай and Бес табан differ from place to place, and a guess written into code would be
// mistaken for the real thing. When a person who knows the variant writes them down, the mode goes
// in its own file beside asyqAtu.ts, implements ModeDefinition, and is switched on here.

import { asyqAtu } from "./asyqAtu";
import type { ModeDefinition, ModeId } from "../rules";

function planned(id: ModeId, name: string, summary: string): ModeDefinition {
  return { ...asyqAtu, id, name, summary, available: false, defaults: () => ({ ...asyqAtu.defaults(), mode: id }) };
}

export const PLANNED_MODES: ModeDefinition[] = [
  planned("hantalapai", "Ханталапай", "Ережесі кейін қосылады: нұсқасы өңірге қарай өзгереді."),
  planned("bes-taban", "Бес табан", "Ережесі кейін қосылады: нұсқасы өңірге қарай өзгереді."),
];
