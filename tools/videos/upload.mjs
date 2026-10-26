#!/usr/bin/env node
// Uploads the rendered lesson films, posters and captions to a public Supabase
// Storage bucket, so they can be served from there instead of from the
// repository.
//
//   node --env-file=.env.local tools/videos/upload.mjs [--dry-run] [--bucket lesson-videos] [--dir public/videos] [--only 1,2]
//   npm run videos:upload -- --dry-run
//
// Why: public/videos is 65 MB of MP4 that every `git clone` downloads, and every
// re-render adds another 65 MB to the history. Storage serves the same files
// with range requests and a CDN, and the site switches to them with one
// environment variable (NEXT_PUBLIC_VIDEO_BASE_URL — see DEPLOYMENT.md §6).
//
// Needs, in the environment (not in the repository):
//   NEXT_PUBLIC_SUPABASE_URL   the project URL, already in .env.local
//   SUPABASE_SERVICE_ROLE_KEY  Dashboard → Project Settings → API → service_role.
//                              It bypasses every security policy: never put it in
//                              a NEXT_PUBLIC_ variable, never commit it, and
//                              never deploy it to the web host — this script runs
//                              on your machine and is the only thing that uses it.
//
// Safe to run again: files are uploaded with upsert, so a re-render replaces the
// old film. Nothing is deleted from the bucket or from the repository.

import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const DRY = flag("dry-run");
const BUCKET = option("bucket", "lesson-videos");
const DIR = resolve(root, option("dir", "public/videos"));
const ONLY = option("only", "")
  .split(",")
  .map((n) => n.trim())
  .filter(Boolean)
  .map((n) => String(Number(n)).padStart(2, "0"));

const FILE = /^lesson-(\d{2})\.(mp4|jpg|vtt)$/;
const TYPES = { mp4: "video/mp4", jpg: "image/jpeg", vtt: "text/vtt" };
// Supabase's free plan refuses single objects over 50 MB.
const FREE_PLAN_LIMIT = 50 * 1024 * 1024;

const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// ---- what is there ----------------------------------------------------------
let names;
try {
  names = (await readdir(DIR)).filter((n) => FILE.test(n)).sort();
} catch {
  fail(`Cannot read ${DIR}. Render the films first (npm run videos:render) or pass --dir.`);
}
if (ONLY.length) names = names.filter((n) => ONLY.includes(n.match(FILE)[1]));
if (!names.length) fail(`No lesson-NN.mp4 / .jpg / .vtt files found in ${DIR}.`);

const files = [];
for (const name of names) {
  files.push({ name, type: TYPES[name.match(FILE)[2]], size: (await stat(join(DIR, name))).size });
}
const total = files.reduce((a, f) => a + f.size, 0);

console.log(`\n${files.length} files, ${mb(total)}, from ${DIR}\n`);
for (const f of files) console.log(`  ${f.name.padEnd(16)} ${mb(f.size).padStart(9)}  ${f.type}`);

// A lesson needs all three: the film, its poster, and its captions.
const lessons = [...new Set(files.map((f) => f.name.match(FILE)[1]))];
for (const n of lessons) {
  const missing = ["mp4", "jpg", "vtt"].filter((ext) => !files.some((f) => f.name === `lesson-${n}.${ext}`));
  if (missing.length) console.warn(`\n! lesson ${n} has no .${missing.join(", .")} — the lesson page will show a plain player without it.`);
}
for (const f of files.filter((f) => f.size > FREE_PLAN_LIMIT)) {
  console.warn(`\n! ${f.name} is ${mb(f.size)}: Supabase's free plan rejects objects over 50 MB.`);
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const publicBase = url ? `${url}/storage/v1/object/public/${BUCKET}` : `https://<project>.supabase.co/storage/v1/object/public/${BUCKET}`;

if (DRY) {
  console.log(`\nDry run — nothing was uploaded. The films would be served from:\n\n  NEXT_PUBLIC_VIDEO_BASE_URL=${publicBase}\n`);
  process.exit(0);
}

// ---- upload -----------------------------------------------------------------
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url) fail("NEXT_PUBLIC_SUPABASE_URL is not set. Run with: node --env-file=.env.local tools/videos/upload.mjs");
if (!key) fail("SUPABASE_SERVICE_ROLE_KEY is not set. Take it from Dashboard → Project Settings → API (service_role) and export it for this one command; do not save it in the repository.");

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// The bucket must be public: the films are watched by students, who are served
// straight from the CDN with no sign-in step in between.
const existing = await supabase.storage.getBucket(BUCKET);
if (existing.error) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: Object.values(TYPES),
  });
  if (error) fail(`Could not create the bucket "${BUCKET}": ${error.message}`);
  console.log(`\n✓ created the public bucket "${BUCKET}"`);
} else if (!existing.data.public) {
  fail(`The bucket "${BUCKET}" exists but is private, so students could not watch from it. Make it public in Dashboard → Storage, or use another --bucket.`);
} else {
  console.log(`\n✓ bucket "${BUCKET}" exists and is public`);
}

const failed = [];
for (const [i, f] of files.entries()) {
  const body = await readFile(join(DIR, f.name));
  const { error } = await supabase.storage.from(BUCKET).upload(f.name, body, {
    contentType: f.type,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) {
    failed.push(f.name);
    console.error(`  ✗ ${f.name}: ${error.message}`);
  } else {
    console.log(`  ✓ ${f.name}  (${i + 1}/${files.length})`);
  }
}
if (failed.length) fail(`${failed.length} upload(s) failed: ${failed.join(", ")}. Run again — it only replaces what is there.`);

// ---- check it the way a browser will ------------------------------------------
const probe = files.find((f) => f.name.endsWith(".mp4")) ?? files[0];
try {
  const res = await fetch(`${publicBase}/${probe.name}`, { method: "HEAD", headers: { Origin: "https://example.com" } });
  const cors = res.headers.get("access-control-allow-origin");
  console.log(`\n${res.ok ? "✓" : "✗"} ${probe.name} answers ${res.status} (${res.headers.get("content-type") ?? "no content-type"})`);
  if (!res.ok) fail("The uploaded file is not publicly readable. Check the bucket's visibility.");
  if (!cors) console.warn("! No Access-Control-Allow-Origin header: the captions track would not load. Storage normally sends one — check the project's CORS settings.");
} catch (e) {
  console.warn(`\n! Could not reach ${publicBase} to verify (${e.message}). The upload itself succeeded.`);
}

console.log(`
Done. To switch the site over:

  1. On the web host set      NEXT_PUBLIC_VIDEO_BASE_URL=${publicBase}
  2. Redeploy (the value is baked in at build time — a restart is not enough).
  3. Open a lesson and check the film plays and seeks.
  4. Only then, if you want the repository smaller:  git rm public/videos/lesson-*.mp4
     (the history keeps the old copies; see DEPLOYMENT.md §6 for what that means).
`);
