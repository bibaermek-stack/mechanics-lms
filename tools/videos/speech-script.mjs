#!/usr/bin/env node
// Prints what the narrator should say for each caption of a lesson, as JSON:
//   node tools/videos/speech-script.mjs 4            one JSON entry per caption
//   node tools/videos/speech-script.mjs 4 --whole    the lesson as one text, captions separated by [long pause]
//   node tools/videos/speech-script.mjs 1,2 --whole  several lessons in one text (fewer requests to the voice service)
// It is the caption text, unless tools/videos/narration/spoken.json replaces it —
// a text-to-speech voice cannot read "F = ma" or "9,8 м/с²" aloud, so those
// captions are spelled out there in words.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const wanted = String(process.argv[2] ?? "").split(",").map((n) => n.padStart(2, "0"));
const all = JSON.parse(readFileSync(join(here, "narration", "spoken.json"), "utf8"));

const lines = wanted.flatMap((lesson) => {
  const vtt = readFileSync(join(here, "..", "..", "public", "videos", `lesson-${lesson}.vtt`), "utf8");
  const spoken = all[lesson] ?? {};
  return vtt
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/))
    .filter((l) => l.some((x) => x.includes("-->")))
    .map((l, i) => {
      const at = l.findIndex((x) => x.includes("-->"));
      const key = String(i + 1).padStart(2, "0");
      return { lesson, cue: key, text: spoken[key] ?? l.slice(at + 1).join(" ") };
    });
});
if (process.argv.includes("--whole")) {
  // One text for the whole lesson, for a single recording that split-speech.mjs cuts afterwards.
  console.log(lines.map((l) => l.text).join("\n\n[long pause]\n\n"));
} else {
  console.log(JSON.stringify(lines, null, 1));
}
