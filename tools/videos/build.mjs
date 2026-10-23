// Bundles the studio page (React + three.js + the lesson scenes) into
// tools/videos/dist so the render tool can serve it without starting Next.js.

import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = process.argv[2] ? join(root, process.argv[2]) : join(here, "dist");
await mkdir(out, { recursive: true });

await build({
  absWorkingDir: root,
  entryPoints: { studio: join(here, "entry.tsx") },
  outdir: out,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  minify: true,
  logLevel: "info",
  define: { "process.env.NODE_ENV": '"production"' },
  tsconfig: join(root, "tsconfig.json"),
});

await writeFile(
  join(out, "index.html"),
  `<!doctype html>
<html lang="kk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lesson film</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="studio.css">
<style>html,body{margin:0;background:#000}#root{width:100vw;height:100vh;display:grid;place-items:center}#root>.st-root{width:min(100vw,calc(100vh*16/9))}</style>
</head>
<body><div id="root"></div><script src="studio.js"></script></body>
</html>
`
);
console.log("studio bundle ready:", out);
