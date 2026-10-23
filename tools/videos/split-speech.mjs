#!/usr/bin/env node
// Cuts one recording of a whole lesson into one clip per caption.
//
//   node tools/videos/split-speech.mjs --lesson 4 --in lesson-04.mp3
//   node tools/videos/split-speech.mjs --lesson 1,2 --in lessons-1-2.mp3   one recording of several lessons, in that order
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
const lessons = String(opt("lesson", "")).split(",").map((n) => n.padStart(2, "0"));
const input = resolve(opt("in", ""));
const outRoot = resolve(root, opt("out", "tools/videos/narration"));
const minGap = Number(opt("min-gap", "1.4")); // seconds; the pauses inside sentences are well below this

if (!lessons.every((l) => /^\d\d$/.test(l)) || !opt("in", "")) {
  console.error("usage: split-speech.mjs --lesson N[,M…] --in recording.mp3 [--out DIR]");
  process.exit(2);
}

// How many captions each lesson has, from its caption file.
const counts = lessons.map((l) => readFileSync(join(root, "public", "videos", `lesson-${l}.vtt`), "utf8").split(/\r?\n\r?\n/).filter((b) => b.includes("-->")).length);
const cueCount = counts.reduce((a, b) => a + b, 0);

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

const cuts = [];
let from = 0;
for (const g of chosen) {
  cuts.push([from, g.start + 0.1]);
  from = Math.max(0, g.end - 0.04);
}
cuts.push([from, total]);

// The clips run through the lessons in order: the first counts[0] belong to the first lesson, and so on.
const owner = counts.flatMap((n, li) => Array.from({ length: n }, (_, k) => ({ lesson: lessons[li], cue: k + 1 })));
cuts.forEach(([a, b], i) => {
  const dir = join(outRoot, `lesson-${owner[i].lesson}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `cue-${String(owner[i].cue).padStart(2, "0")}.mp3`);
  const r = spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-i", input, "-ss", a.toFixed(3), "-to", b.toFixed(3), "-c:a", "libmp3lame", "-q:a", "2", file], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed for cue ${i + 1}`);
  console.log(`lesson ${owner[i].lesson} cue ${String(owner[i].cue).padStart(2, "0")}  ${a.toFixed(2)}–${b.toFixed(2)} s  (${(b - a).toFixed(1)} s)`);
});
