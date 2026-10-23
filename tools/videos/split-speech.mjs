#!/usr/bin/env node
// Cuts one recording of a whole lesson into one clip per caption.
//
//   node tools/videos/split-speech.mjs --lesson 4 --in lesson-04.mp3
//
// The recording is made from the text printed by `speech-script.mjs N --whole`,
// which puts "[long pause]" between captions. A text-to-speech voice leaves
// those pauses about 2–4 s long, while the pauses inside a sentence stay under
// a second, so the longest silences are the caption boundaries. The N-1
// longest ones are cut at; the result is tools/videos/narration/lesson-NN/cue-KK.mp3,
// ready for narrate.mjs. If the silences do not separate cleanly the tool says
// so and writes nothing.
//
// Needs ffmpeg (FFMPEG, or on PATH).

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const lesson = String(opt("lesson", "")).padStart(2, "0");
const input = resolve(opt("in", ""));
const outDir = resolve(root, opt("out", join("tools/videos/narration", `lesson-${lesson}`)));
const minGap = Number(opt("min-gap", "1.4")); // seconds; the pauses inside sentences are well below this

if (!/^\d\d$/.test(lesson) || !opt("in", "")) {
  console.error("usage: split-speech.mjs --lesson N --in whole-lesson.mp3 [--cues K] [--out DIR]");
  process.exit(2);
}

// How many captions there are, from the caption file.
const vtt = readFileSync(join(root, "public", "videos", `lesson-${lesson}.vtt`), "utf8");
const cueCount = Number(opt("cues", vtt.split(/\r?\n\r?\n/).filter((b) => b.includes("-->")).length));

const probe = spawnSync(ffmpeg, ["-hide_banner", "-i", input, "-af", `silencedetect=noise=-38dB:d=${minGap}`, "-f", "null", "-"], { encoding: "utf8" });
const log = probe.stderr ?? "";
const total = (() => {
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
})();
const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
const ends = [...log.matchAll(/silence_end: ([\d.]+) \| silence_duration: ([\d.]+)/g)].map((m) => ({ end: Number(m[1]), dur: Number(m[2]) }));
let gaps = starts.map((s, i) => ({ start: s, end: ends[i]?.end ?? total, dur: ends[i]?.dur ?? total - s }));
// A silence that runs to the end of the file is trailing air, not a boundary.
gaps = gaps.filter((g) => g.end < total - 0.05 && g.start > 0.05);

const need = cueCount - 1;
if (gaps.length < need) {
  console.error(`found ${gaps.length} long pauses, need ${need} for ${cueCount} captions — nothing written`);
  process.exit(1);
}
const chosen = [...gaps].sort((a, b) => b.dur - a.dur).slice(0, need).sort((a, b) => a.start - b.start);
const rest = [...gaps].sort((a, b) => b.dur - a.dur)[need];
if (rest && rest.dur > chosen.reduce((m, g) => Math.min(m, g.dur), Infinity) * 0.6) {
  console.error(`the pauses do not separate cleanly (shortest boundary ${Math.min(...chosen.map((g) => g.dur)).toFixed(1)} s, longest other pause ${rest.dur.toFixed(1)} s) — nothing written`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const cuts = [];
let from = 0;
for (const g of chosen) {
  cuts.push([from, g.start + 0.1]);
  from = Math.max(0, g.end - 0.04);
}
cuts.push([from, total]);

cuts.forEach(([a, b], i) => {
  const file = join(outDir, `cue-${String(i + 1).padStart(2, "0")}.mp3`);
  const r = spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", input, "-ss", a.toFixed(3), "-to", b.toFixed(3), "-c:a", "libmp3lame", "-q:a", "2", file], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed for cue ${i + 1}`);
  console.log(`cue-${String(i + 1).padStart(2, "0")}  ${a.toFixed(2)}–${b.toFixed(2)} s  (${(b - a).toFixed(1)} s)`);
});
