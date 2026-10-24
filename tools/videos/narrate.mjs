#!/usr/bin/env node
// Adds a voice-over to a rendered lesson film without photographing it again.
//
//   node tools/videos/narrate.mjs --lesson 4            one lesson
//   node tools/videos/narrate.mjs --lesson all          every lesson that has clips
//   node tools/videos/narrate.mjs --lesson 4 --dry      only print the schedule
//
// Input: one audio file per caption, tools/videos/narration/lesson-NN/cue-KK.mp3
// (KK is the caption's number in public/videos/lesson-NN.vtt, from 01). Each
// clip is placed where its caption appears. A clip that is longer than its
// caption is sped up a little (at most 1.25×) and, if it still overruns, the
// next clip waits for it instead of talking over it.
//
// Output: the same MP4 with the video stream copied untouched and the voice
// track added, so this takes seconds and can be repeated with another voice —
// only the audio of the existing file is ever replaced.
//
// Needs ffmpeg (FFMPEG, or on PATH).

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const ffmpeg = process.env.FFMPEG || "ffmpeg";
const videoDir = resolve(root, opt("videos", "public/videos"));
const clipRoot = resolve(root, opt("clips", "tools/videos/narration"));
const outDir = resolve(root, opt("out", "public/videos"));
const dry = flag("dry");
const MAX_TEMPO = 1.25; // faster than this starts to sound hurried
const GAP = 0.2; // seconds of air left between two clips that had to be pushed back
const LEAD = 0.15; // a clip starts a moment after its caption appears
const TAIL = 0.25; // and should end a moment before the next one

const pad2 = (n) => String(n).padStart(2, "0");

function seconds(stamp) {
  const [h, m, s] = stamp.split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function readCues(file) {
  return readFileSync(file, "utf8")
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/))
    .map((lines) => {
      const at = lines.findIndex((l) => l.includes("-->"));
      if (at < 0) return null;
      const [a, b] = lines[at].split("-->").map((s) => s.trim());
      return { start: seconds(a), end: seconds(b), text: lines.slice(at + 1).join(" ") };
    })
    .filter(Boolean);
}

/** Length of an audio or video file in seconds, read from ffmpeg's banner. */
function lengthOf(file) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-i", file], { encoding: "utf8" });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr ?? "");
  if (!m) throw new Error(`cannot read the length of ${file}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function narrate(lesson) {
  const name = `lesson-${pad2(lesson)}`;
  const mp4 = join(videoDir, `${name}.mp4`);
  const cues = readCues(join(videoDir, `${name}.vtt`));
  const filmLength = lengthOf(mp4);

  const clips = [];
  cues.forEach((cue, i) => {
    const file = join(clipRoot, name, `cue-${pad2(i + 1)}.mp3`);
    if (existsSync(file)) clips.push({ i: i + 1, cue, file, length: lengthOf(file) });
  });
  if (!clips.length) {
    console.log(`${name}: no clips in ${join(clipRoot, name)} — skipped`);
    return false;
  }

  // Place each clip: at its caption, unless the previous one is still talking.
  let free = 0; // when the previous clip ends
  let worstDrift = 0;
  const plan = clips.map((c) => {
    const window = c.cue.end - c.cue.start - LEAD - TAIL;
    const tempo = Math.min(MAX_TEMPO, Math.max(1, c.length / window));
    const dur = c.length / tempo;
    const start = Math.max(c.cue.start + LEAD, free);
    free = start + dur + GAP;
    worstDrift = Math.max(worstDrift, start - (c.cue.start + LEAD));
    return { ...c, tempo, dur, start };
  });
  // The closing line must not be cut off by the end of the film: squeeze it a little more if need be.
  const closing = plan[plan.length - 1];
  const room = filmLength - 0.1 - closing.start;
  if (closing.start + closing.dur > filmLength - 0.1 && room > 0) {
    closing.tempo = Math.min(1.4, closing.length / room);
    closing.dur = closing.length / closing.tempo;
  }
  const missing = cues.length - clips.length;

  console.log(`${name}: ${clips.length}/${cues.length} clips${missing ? ` (${missing} captions stay silent)` : ""}`);
  for (const p of plan) {
    const note = p.tempo > 1.001 ? ` ×${p.tempo.toFixed(2)}` : "";
    const late = p.start - (p.cue.start + LEAD);
    console.log(`  cue ${pad2(p.i)}  caption ${p.cue.start.toFixed(1)}–${p.cue.end.toFixed(1)} s  clip ${p.length.toFixed(1)} s${note}  starts ${p.start.toFixed(1)} s${late > 0.05 ? `  (+${late.toFixed(1)} late)` : ""}`);
  }
  const last = plan[plan.length - 1];
  if (last.start + last.dur > filmLength) console.warn(`  ! the last clip ends at ${(last.start + last.dur).toFixed(1)} s, after the film (${filmLength.toFixed(1)} s) and will be cut`);
  if (worstDrift > 1.5) console.warn(`  ! the voice runs ${worstDrift.toFixed(1)} s behind its captions at worst — shorten the text or lengthen the chapter`);
  if (dry) return true;

  const inputs = plan.flatMap((p) => ["-i", p.file]);
  const parts = plan.map((p, k) => {
    const ms = Math.round(p.start * 1000);
    const tempo = p.tempo > 1.001 ? `atempo=${p.tempo.toFixed(4)},` : "";
    return `[${k + 1}:a]${tempo}adelay=${ms}|${ms}[a${k}]`;
  });
  const mix = plan.map((_, k) => `[a${k}]`).join("");
  const filter = `${parts.join(";")};${mix}amix=inputs=${plan.length}:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[aout]`;

  const tmp = join(outDir, `${name}.narrated.mp4`);
  const r = spawnSync(
    ffmpeg,
    [
      "-y", "-loglevel", "error", "-i", mp4, ...inputs,
      "-filter_complex", filter,
      "-map", "0:v:0", "-map", "[aout]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
      "-t", String(filmLength), "-movflags", "+faststart", tmp,
    ],
    { stdio: "inherit" }
  );
  if (r.status !== 0) {
    rmSync(tmp, { force: true });
    throw new Error(`ffmpeg failed for ${name}`);
  }
  renameSync(tmp, join(outDir, `${name}.mp4`));
  console.log(`${name}: wrote ${join(outDir, `${name}.mp4`)}`);
  return true;
}

const which = opt("lesson", "all");
const lessons = which === "all" ? Array.from({ length: 10 }, (_, i) => i + 1) : which.split(",").map(Number);
let done = 0;
for (const l of lessons) if (narrate(l)) done++;
if (!done) process.exitCode = 1;
