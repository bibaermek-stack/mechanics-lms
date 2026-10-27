// Can this browser draw WebGL at all? Asked once, before a page commits to a 3D scene, so a
// phone or a locked-down school computer without it gets the flat picture instead of a black box.

let cached: boolean | null = null;

export function webglAvailable(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    cached = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}
