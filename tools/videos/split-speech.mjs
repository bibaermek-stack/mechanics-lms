#!/usr/bin/env node
// Cuts one recording of a whole lesson into one clip per caption.
//
//   node tools/videos/split-speech.mjs --lesson 4 --in lesson-04.mp3
//   node tools/videos/split-speech.mjs --lesson 1,2 --in lessons-1-2.mp3   one recording of several lessons, in that order
//
// The recording is made from the text printed by `speech-script.mjs N --whole`,
// which puts "[long pause]" between captions. The voice leaves those pauses
// 1–4 s long, while the pauses inside a sentence stay under a second — close
// enough that the longest silences alone are not always the boundaries. So the
// cut points are chosen with the text too: of all the silences, the N-1 that make
// every piece about as long as its caption's text should take to say (found by
// dynamic programming). Each piece is checked against that estimate and the
// tool refuses to write anything if one is far off. The result is
// tools/videos/narration/lesson-NN/cue-KK.mp3, ready for narrate.mjs.
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
const minGap = Number(opt("min-gap", "0.45")); // seconds: every silence at least this long is a candidate boundary

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
  console.error(`found ${gaps.length} pauses of at least ${minGap} s, need ${need} for ${cueCount} captions — nothing written`);
  process.exit(1);
}

// What the voice should take for each caption, from the text it was given.
const spoken = JSON.parse(readFileSync(join(here, "narration", "spoken.json"), "utf8"));
const weights = lessons.flatMap((l) => {
  const blocks = readFileSync(join(root, "public", "videos", `lesson-${l}.vtt`), "utf8").split(/\r?\n\r?\n/).filter((b) => b.includes("-->"));
  return blocks.map((b, i) => {
    const lines = b.split(/\r?\n/);
    const key = String(i + 1).padStart(2, "0");
    return (spoken[l]?.[key] ?? lines.slice(lines.findIndex((x) => x.includes("-->")) + 1).join(" ")).length;
  });
});
const sumChars = weights.reduce((a, b) => a + b, 0);
const meanGap = gaps.length ? gaps.slice().sort((a, b) => b.dur - a.dur).slice(0, need).reduce((a, g) => a + g.dur, 0) / need : 0;
const perChar = Math.max(0.01, (total - need * meanGap) / sumChars);
const expected = weights.map((w) => w * perChar);

// f[i][j]: cheapest way to place boundaries 1..i with the i-th at gap j.
const M = gaps.length;
const cost = (len, exp) => ((len - exp) ** 2) / exp;
const gapPenalty = (g) => 2 * Math.max(0, 1.0 - g.dur) ** 2;
const f = Array.from({ length: need + 1 }, () => new Array(M).fill(Infinity));
const back = Array.from({ length: need + 1 }, () => new Array(M).fill(-1));
for (let j = 0; j < M; j++) f[1][j] = cost(gaps[j].start - 0, expected[0]) + gapPenalty(gaps[j]);
for (let i = 2; i <= need; i++) {
  for (let j = 0; j < M; j++) {
    for (let k = 0; k < j; k++) {
      if (f[i - 1][k] === Infinity) continue;
      const len = gaps[j].start - gaps[k].end;
      if (len <= 0) continue;
      const c = f[i - 1][k] + cost(len, expected[i - 1]) + gapPenalty(gaps[j]);
      if (c < f[i][j]) { f[i][j] = c; back[i][j] = k; }
    }
  }
}
let bestJ = -1, best = Infinity;
for (let j = 0; j < M; j++) {
  if (f[need][j] === Infinity) continue;
  const c = f[need][j] + cost(total - gaps[j].end, expected[need]);
  if (c < best) { best = c; bestJ = j; }
}
if (bestJ < 0) {
  console.error("no way to place the boundaries — nothing written");
  process.exit(1);
}
const picks = [];
for (let i = need, j = bestJ; i >= 1; i--) { picks.unshift(gaps[j]); j = back[i][j]; }
const chosen = picks;

// Refuse to write if any piece is far from what its text should take.
const bounds = [0, ...chosen.flatMap((g) => [g.start, g.end]), total];
let worst = 0;
for (let i = 0; i < cueCount; i++) {
  const len = bounds[2 * i + 1] - bounds[2 * i];
  worst = Math.max(worst, Math.abs(len / expected[i] - 1));
}
if (worst > 0.45) {
  console.error(`a piece is ${(worst * 100).toFixed(0)}% off the length its text should take — the boundaries are doubtful, nothing written`);
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
