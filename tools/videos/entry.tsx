// Browser entry for the render tool. The page shows one lesson film at its
// native size and exposes window.__studio so a script can step through it.

import { createRoot } from "react-dom/client";
import { StudioPlayer } from "@/components/studio/StudioPlayer";
import type { StudioApi } from "@/components/studio/types";
import { toVtt } from "@/lib/studio/timeline";
import { SCENES } from "@/components/lesson3d/registry";

declare global {
  interface Window {
    __studio?: StudioApi & { vtt: string; title: string };
    __studioError?: string;
  }
}

const params = new URLSearchParams(location.search);
const id = Number(params.get("lesson"));
const dpr = Number(params.get("dpr") ?? "1");
const scene = SCENES[id];

const host = document.getElementById("root")!;
if (!scene) {
  window.__studioError = `no scene for lesson ${id}`;
  host.textContent = window.__studioError;
} else {
  createRoot(host).render(
    <StudioPlayer
      scene={scene}
      mode="render"
      dpr={dpr}
      onApi={(api) => {
        window.__studio = { ...api, vtt: toVtt(scene.script), title: scene.script.title };
      }}
    />
  );
}
