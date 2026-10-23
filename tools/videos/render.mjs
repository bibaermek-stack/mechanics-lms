#!/usr/bin/env node
// Renders the lesson films to MP4.
//
//   node tools/videos/render.mjs --lesson 2            one lesson
//   node tools/videos/render.mjs --lesson all          all ten
//   node tools/videos/render.mjs --lesson 2 --frames 0-47 --no-encode   a quick look
//
// How it works: the studio page (tools/videos/dist, built by build.mjs) holds
// the 3D scene and exposes window.__studio.setTime(t). For every frame this
// script jumps the page to that instant, takes a screenshot, and finally hands
// the numbered images to ffmpeg. Rendering by seeking, not by recording, makes
// the output independent of how fast the machine is — a slow software GPU
// produces exactly the same film as a fast one, just later.
//
// Needs: playwright-core + a Chromium (CHROMIUM_PATH, or one installed by
// `npx playwright install chromium`) and ffmpeg (FFMPEG, or on PATH).
// A voice-over dropped at tools/videos/narration/lesson-NN.(mp3|m4a|wav) is
// muxed in automatically.

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile, copyFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

// ---------------------------------------------------------------- arguments
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const lessonArg = opt("lesson", "all");
const fps = Number(opt("fps", "24"));
const width = Number(opt("width", "1280"));
const height = Math.round((width * 9) / 16);
const dpr = Number(opt("dpr", "1.5")); // 1280×720 page captured at 1920×1080, then scaled down: crisp edges
const crf = opt("crf", "23");
const workers = Number(opt("workers", "4"));
const outDir = join(root, opt("out", "public/videos"));
const framesDir = join(here, ".frames");
const shard = opt("shard", null); // "i/n" — set by the parent for its workers
const frameRange = opt("frames", null); // "a-b", for a quick look
const noEncode = flag("no-encode");
const encodeOnly = flag("encode-only"); // reuse the frames already in .frames (after an interrupted encode)
const dist = join(root, opt("dist", "tools/videos/dist"));
const times = opt("times", null); // "3,10,20": just photograph these instants (a quick look while editing a scene)
const previewDir = opt("preview-dir", join(here, ".preview"));

const pad2 = (n) => String(n).padStart(2, "0");
const ffmpeg = process.env.FFMPEG || "ffmpeg";

// ----------------------------------------------------------- static server
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".glb": "model/gltf-binary",
  ".json": "application/json",
  ".jpg": "image/jpeg",
  ".png": "image/png",
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      let path = decodeURIComponent(url.pathname);
      if (path === "/") path = "/index.html";
      const base = path.startsWith("/models/") ? join(root, "public") : dist;
      const file = normalize(join(base, path));
      if (!file.startsWith(base)) throw new Error("outside root");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

// -------------------------------------------------------------- one lesson
async function openFilm(server, lesson) {
  const exe = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch({
    executablePath: exe,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--hide-scrollbars",
      "--force-color-profile=srgb",
    ],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
  page.on("pageerror", (e) => console.error(`[page] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") console.error(`[console] ${m.text()}`);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/?lesson=${lesson}&dpr=${dpr}`);
  await page.waitForFunction(() => window.__studio || window.__studioError, null, { timeout: 60_000 });
  const err = await page.evaluate(() => window.__studioError);
  if (err) throw new Error(err);
  await page.evaluate(() => window.__studio.ready);
  return { browser, page };
}

async function renderWorker(lesson) {
  const [si, sn] = shard.split("/").map(Number);
  const server = await serve();
  const { browser, page } = await openFilm(server, lesson);
  const duration = await page.evaluate(() => window.__studio.duration);
  let total = Math.round(duration * fps);
  let first = 0;
  if (frameRange) [first, total] = frameRange.split("-").map(Number).map((v, i) => (i ? v + 1 : v));
  const dir = join(framesDir, `lesson-${pad2(lesson)}`);
  await mkdir(dir, { recursive: true });
  const t0 = Date.now();
  let done = 0;
  for (let f = first; f < total; f++) {
    if (f % sn !== si) continue;
    await page.evaluate((t) => window.__studio.setTime(t), f / fps);
    await page.screenshot({
      path: join(dir, `f${String(f).padStart(6, "0")}.jpg`),
      type: "jpeg",
      quality: 94,
    });
    done++;
    if (done % 25 === 0) {
      const per = (Date.now() - t0) / done / 1000;
      console.log(`[${si}/${sn}] lesson ${lesson}: ${done} frames, ${per.toFixed(2)} s/frame`);
    }
  }
  await browser.close();
  server.close();
}

// ------------------------------------------------------------ orchestrator
function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, cmdArgs, { stdio: "inherit", ...opts });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    p.on("error", reject);
  });
}

async function renderLesson(lesson) {
  const dir = join(framesDir, `lesson-${pad2(lesson)}`);
  if (!encodeOnly) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const self = fileURLToPath(import.meta.url);
    const base = [self, "--lesson", String(lesson), "--fps", String(fps), "--width", String(width), "--dpr", String(dpr)];
    if (frameRange) base.push("--frames", frameRange);
    const t0 = Date.now();
    await Promise.all(
      Array.from({ length: workers }, (_, i) => run(process.execPath, [...base, "--shard", `${i}/${workers}`]))
    );
    console.log(`lesson ${lesson}: frames done in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  if (noEncode) return;

  // Script-derived files come from the page itself so they can never drift from the film.
  const server = await serve();
  const { browser, page } = await openFilm(server, lesson);
  const meta = await page.evaluate(() => ({ vtt: window.__studio.vtt, duration: window.__studio.duration }));
  await browser.close();
  server.close();

  await mkdir(outDir, { recursive: true });
  const name = `lesson-${pad2(lesson)}`;
  const mp4 = join(outDir, `${name}.mp4`);
  await writeFile(join(outDir, `${name}.vtt`), meta.vtt);

  const narration = ["mp3", "m4a", "wav"].map((e) => join(here, "narration", `${name}.${e}`)).find(existsSync);
  const inputs = ["-framerate", String(fps), "-i", join(dir, "f%06d.jpg")];
  const audio = narration ? ["-i", narration, "-c:a", "aac", "-b:a", "128k", "-t", String(meta.duration)] : ["-an"];
  await run(ffmpeg, [
    "-y", "-loglevel", "error", ...inputs, ...(narration ? ["-i", narration] : []),
    "-vf", `scale=${width}:${height}:flags=lanczos`,
    "-c:v", "libx264", "-preset", "slow", "-crf", crf, "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", ...(narration ? ["-c:a", "aac", "-b:a", "128k", "-t", String(meta.duration)] : ["-an"]),
    mp4,
  ]);
  void audio;

  // Poster: a frame from the middle of the opening scene reads better than frame 0.
  const posterAt = Math.min(meta.duration - 1, Number(opt("poster-at", "6")));
  await run(ffmpeg, ["-y", "-loglevel", "error", "-ss", String(posterAt), "-i", mp4, "-frames:v", "1", "-q:v", "3", join(outDir, `${name}.jpg`)]);
  console.log(`lesson ${lesson}: wrote ${name}.mp4 / .vtt / .jpg`);
  if (!flag("keep-frames")) await rm(dir, { recursive: true, force: true });
}

// ----------------------------------------------------------------- preview
async function preview(lesson) {
  const server = await serve();
  const { browser, page } = await openFilm(server, lesson);
  await mkdir(previewDir, { recursive: true });
  for (const sec of times.split(",").map(Number)) {
    await page.evaluate((t) => window.__studio.setTime(t), sec);
    const file = join(previewDir, `l${pad2(lesson)}-t${String(sec).replace(".", "_")}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 88 });
    console.log(file);
  }
  await browser.close();
  server.close();
}

// -------------------------------------------------------------------- main
if (times) {
  await preview(Number(lessonArg));
} else if (shard) {
  await renderWorker(Number(lessonArg));
} else {
  const lessons = lessonArg === "all" ? Array.from({ length: 10 }, (_, i) => i + 1) : lessonArg.split(",").map(Number);
  for (const l of lessons) await renderLesson(l);
}
