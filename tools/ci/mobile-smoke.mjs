#!/usr/bin/env node
// Mobile smoke test: every page, at phone widths, must not scroll sideways and
// must not throw.
//
//   node tools/ci/mobile-smoke.mjs [baseUrl]        default http://localhost:3000
//   SMOKE_ONLY=/teacher/analytics,/login node tools/ci/mobile-smoke.mjs   just those routes
//
// Born from a manual audit that found a teacher page 558 px wide on a 375 px
// phone — one wide child in an auto-sized grid column — and a landing page that
// overflowed at 320 px. Both were invisible on a desktop and would have come
// back with the next wide table, so this keeps them fixed.
//
// "Scrolls sideways" is measured as documentElement.scrollWidth > the screen
// width. With a mobile viewport, content wider than the screen makes the browser
// lay the page out at the wider width, so the check fires on the layout bug
// itself rather than on a clipped symptom.
//
// Needs a running production server and a Chromium: `npx playwright-core
// install chromium`, or CHROMIUM_PATH pointing at one.

import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const WIDTHS = [320, 375];
const HEIGHT = 800;

const STUDENT_ROUTES = [
  "/", "/login", "/dashboard", "/diagnostic", "/modules", "/modules/1", "/labs", "/problems",
  "/ai-tutor", "/analytics", "/arena", "/certificates", "/community", "/connections", "/daily", "/duels", "/games", "/leaderboard", "/league", "/live", "/map", "/myths", "/predict", "/sensors",
  "/profile", "/vr-lab", "/verify/demo",
];
const TEACHER_ROUTES = ["/teacher", "/teacher/analytics", "/teacher/assignments", "/teacher/community", "/teacher/lessons", "/teacher/live", "/teacher/misconceptions", "/teacher/students"];

const ONLY = process.env.SMOKE_ONLY?.split(",").map((r) => r.trim()).filter(Boolean);
const wanted = (routes) => (ONLY ? routes.filter((r) => ONLY.includes(r)) : routes);

const SESSIONS = {
  student: { uid: "demo-student-1", fullName: "Айгерім Болатқызы", email: "aigerim.student@ayu.edu.kz", role: "student", group: "МТ-21", createdAt: "2025-01-01T00:00:00Z", competencyScore: 74, badges: [], xp: 1280, userCode: "ST-0001" },
  teacher: { uid: "demo-teacher-1", fullName: "Серік Полатұлы", email: "serik.polatuly@ayu.edu.kz", role: "teacher", createdAt: "2025-01-01T00:00:00Z", xp: 0, userCode: "TE-0001" },
};

// Errors that are the test environment's doing, not the page's: a headless
// Chromium has no H.264 decoder for the lesson films, and no WebGL driver.
const IGNORED = [/Failed to load resource/i, /WebGL/i, /THREE\.WebGLRenderer/i, /videos\/lesson-/i, /Media|MEDIA_ERR|The play\(\) request/i];

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const failures = [];
let checked = 0;

for (const [role, routes] of [["student", wanted(STUDENT_ROUTES)], ["teacher", wanted(TEACHER_ROUTES)]]) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: HEIGHT },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    // Signed in through the demo session, and past the one-time splash screen.
    await ctx.addInitScript((session) => {
      localStorage.setItem("mechanics-lms:mockSession", JSON.stringify(session));
      sessionStorage.setItem("stem:seen-intro", "1");
    }, SESSIONS[role]);

    for (const route of routes) {
      const page = await ctx.newPage();
      const problems = [];
      page.on("pageerror", (e) => problems.push(`uncaught error: ${String(e.message).slice(0, 160)}`));
      page.on("console", (m) => {
        if (m.type() === "error" && !IGNORED.some((re) => re.test(m.text()))) problems.push(`console.error: ${m.text().slice(0, 160)}`);
      });
      try {
        await page.goto(BASE + route, { waitUntil: "load", timeout: 60_000 });
        // Client-rendered pages settle after hydration and their first data load.
        await page.waitForTimeout(1500);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        // Compared with the width we asked for, NOT window.innerWidth: in mobile
        // emulation a page that overflows makes the browser zoom out to fit, which
        // grows innerWidth to match and would let exactly this bug through.
        if (scrollWidth > width) problems.push(`scrolls sideways: page is ${scrollWidth}px wide on a ${width}px screen`);
      } catch (e) {
        problems.push(`did not load: ${String(e.message).split("\n")[0]}`);
      }
      checked++;
      if (problems.length) failures.push({ role, width, route, problems });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();

console.log(`Checked ${checked} page loads (${WIDTHS.join(", ")} px).`);
if (failures.length) {
  console.error(`\n${failures.length} failed:`);
  for (const f of failures) {
    console.error(`\n  ${f.route}  (${f.role}, ${f.width}px)`);
    for (const p of f.problems) console.error(`    - ${p}`);
  }
  process.exit(1);
}
console.log("All pages fit the screen and ran without errors.");
