import type { SurfaceId } from "@/lib/asyq/physics";
import { lookById, type SurfaceLook } from "@/lib/asyqView";

/** One colour per player: their sakha is painted in it, and so are their score and their tray. */
export const PLAYER_COLOURS = ["#f08a3c", "#3b82f6", "#10b981", "#e11d48"] as const;
export const playerColour = (i: number) => PLAYER_COLOURS[i % PLAYER_COLOURS.length];

/** How the floors of the asyq game look. */
export const SURFACE_LOOK: Record<SurfaceId, SurfaceLook> = {
  topyraq: lookById("earth"),
  agash: lookById("wood"),
  shop: lookById("grass"),
  qum: lookById("sand"),
  muz: lookById("ice"),
};

/** The arena is drawn this many times larger than life: a real asyq is 4 cm. */
export const VISUAL_SCALE = 6;
