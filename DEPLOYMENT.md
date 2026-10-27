# Deployment Guide — Механика AI LMS

This guide covers taking the project from the included mock-backend demo to a fully wired production deployment.

## 1. Prerequisites

- Node.js 18.18+ (Node 20 recommended — it is what CI uses)
- A [Supabase](https://supabase.com) project (the free plan is enough for a thesis demo)
- Optional: a Google Cloud project with the OAuth consent screen configured (Google sign-in / Sheets / Drive / Forms)
- Optional: an OpenAI or Google AI Studio (Gemini) API key

Everything optional can be left out: with no keys the site runs in **demo mode**
(data in the browser's `localStorage`, canned Kazakh AI answers, a labelled
synthetic class on the teacher analytics page), which is also what a fresh clone
does.

## 2. Supabase setup

Accounts, roles, the teacher↔student graph, every quiz/game/assignment record,
the pre/post diagnostic, the weekly league, predictions, sensor results and the
class gallery and student questions live in Supabase. Firebase is no longer used and nothing
reads `FIREBASE_*` variables.

1. https://supabase.com → **New project**. Pick a region close to the students.
2. **SQL Editor** → run the files in `supabase/migrations/` **in order, 0001 to
   0016**, each one pasted whole and run once. Do not skip one: `0003` fixes Google
   sign-up, `0008` creates the learning-record tables the teacher pages read, `0011`
   creates the diagnostic table, and `0012`–`0016` back the league, predictions,
   phone lab, gallery and student questions (without them those pages cannot
   save or load their data).

   | File | Adds |
   |---|---|
   | 0001–0003 | accounts, roles, teacher↔student links, Google sign-in |
   | 0004–0006 | classmates (leaderboard), friends, duels |
   | 0007, 0010 | teacher edits to lessons; own-film video fields |
   | 0008 | quiz, game, assignment, rubric and certificate records |
   | 0009 | XP, derived from those records |
   | 0011 | pre/post diagnostic (append-only, one per student per phase) |
   | 0012 | weekly group league (`league_week()`) |
   | 0013 | "predict, then see" attempts (append-only) |
   | 0014 | phone-lab results (append-only) and the anonymous class jump distribution |
   | 0015 | home-experiment gallery: text only, pending until a teacher approves |
   | 0016 | student-written questions, same moderation |

   What each file does and why is in [`supabase/README.md`](supabase/README.md); the
   tables and who may read them are in [`docs/database-schema.md`](docs/database-schema.md).
3. **Project Settings → API** → copy into `.env.local` (and into the host, §5):

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

   Older projects call the second one the *anon* key; `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   is accepted too.
4. **Authentication → Providers → Email**: for a defence demo it is convenient to
   switch **Confirm email** off, so a new account can sign in straight away.
5. **Authentication → URL Configuration**: see "Auth settings for the deployed
   domain" in §5. Google sign-in additionally needs the Google provider enabled in
   Supabase (see `supabase/README.md` §3).

Check it worked: in the SQL Editor, `select count(*) from public.diagnostic_attempts;`
should return `0`, not an error. Then register two accounts (a teacher and a
student), link them, and open `/teacher/analytics` as the teacher — it should say
the class has no data yet instead of showing the demo banner.

Gallery posts and student questions are **pending until the author's own teacher
approves them** (`/teacher/community`), so a student whose teacher has not
accepted them can post but nobody else will ever see it. Tell teachers to check that
page. Posts are text only by design.

Row-level security does the access control, not the app: a teacher's queries
return only their accepted students' rows because the *database* says so. Do not
disable RLS on any table to "make something work".

## 3. AI provider setup

Choose one:

**OpenAI**
```
NEXT_PUBLIC_AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5
```

**Google Gemini**
```
NEXT_PUBLIC_AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-pro
```

Leave `NEXT_PUBLIC_AI_PROVIDER=mock` (or omit the key) to keep using the built-in Kazakh mock responses — useful for offline thesis defense demos where you don't want to depend on network/API availability.

> **Know this before putting a real key on a public site.** `POST /api/ai`
> (`src/app/api/ai/route.ts`) does not check who is calling and does not limit how
> often: anyone who can reach the site can send it requests, and each one is paid
> for by your key. Until the route is made to require a signed-in user and to rate
> limit them, either keep the provider on `mock` for anything public, or put the
> site behind something that restricts access (Vercel password protection, an
> allow-list), or use a key with a hard spending cap at the provider.

## 4. Google Workspace setup

1. https://console.cloud.google.com → APIs & Services → Enable: **Google Sheets API**, **Google Drive API**, **Google Forms API** (or link an existing Form + Sheet manually).
2. Credentials → Create OAuth client ID → Web application → Authorized redirect URI: `https://<your-domain>/api/auth/google/callback`.
3. Fill `.env.local`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://<your-domain>/api/auth/google/callback
GOOGLE_SHEETS_ID=<spreadsheet id from the URL>
GOOGLE_FORMS_ID=<form id from the URL>
GOOGLE_DRIVE_FOLDER_ID=<shared drive folder id>
```

4. Create a Google Form for the competency self-assessment; link its responses to the Sheet referenced by `GOOGLE_SHEETS_ID`. `src/lib/googleWorkspace.ts` reads rows `A2:E` (`studentEmail, studentName, moduleTitle, score, submittedAt`) — adjust the range/columns to match your Form's response sheet.

## 5. Deploying to Vercel (recommended)

1. Push the `mechanics-lms` folder to a GitHub repository.
2. https://vercel.com → New Project → import the repo.
3. Framework preset: Next.js (auto-detected).
4. Add all variables from `.env.local` under Project Settings → Environment Variables.
5. Deploy. Vercel builds with `next build` automatically.

### If the deployed site says "Дерекқор қосылмаған — демо режим"

`.env.local` is gitignored, so the keys never travel with the repository — the
host needs its own copy. Two things trip people up:

- **`NEXT_PUBLIC_*` is inlined at build time, not read at runtime.** Adding the
  variables to an existing deployment changes nothing until you trigger a new
  build (Vercel → Deployments → ⋯ → Redeploy, with the build cache off).
- **Set them for the right environment.** Vercel keeps Production, Preview and
  Development separate; a variable added only to Development leaves the live
  site in demo mode.

The variables the accounts system needs:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

A production build without them prints a warning in the Vercel build log (see
`next.config.js`), so you can catch this before opening the site.

Other `NEXT_PUBLIC_*` values the site reads — all optional, all baked in at build time:

| Variable | Effect |
|---|---|
| `NEXT_PUBLIC_VIDEO_BASE_URL` | serve the lesson films from a storage bucket instead of `public/videos` (§6) |
| `NEXT_PUBLIC_ARENA_SERVER` | `wss://…` of the arena game server (§7) |
| `NEXT_PUBLIC_AI_PROVIDER` | `openai`, `gemini` or `mock` (§3) |

### Auth settings for the deployed domain

In Supabase → Authentication → URL Configuration:

- **Site URL** → `https://<your-domain>`
- **Redirect URLs** → add `https://<your-domain>/auth/callback`
  (keep `http://localhost:3000/auth/callback` for local work)

Google Cloud Console needs **no** per-domain change: the only redirect URI Google
ever sees is Supabase's own `https://<project>.supabase.co/auth/v1/callback`.

## 6. Lesson films

The ten lesson films (`public/videos/lesson-NN.mp4`, plus a `.jpg` poster and a
`.vtt` caption file each) are **64 MB**. By default they ship inside the
repository and the site serves them itself, which is why a plain clone works with
nothing configured — and also why every `git clone` downloads 64 MB, and every
re-render of a film adds its size to the history again.

To serve them from Supabase Storage instead (it streams with range requests, so
seeking works, and it is served from a CDN):

1. Get the **service role** key: Dashboard → Project Settings → API → `service_role`.
   It bypasses every security policy. Use it only for this one command, on your own
   machine; never put it in a `NEXT_PUBLIC_` variable, in the repository, or on the
   web host.
2. See what would be uploaded:

   ```bash
   npm run videos:upload -- --dry-run
   ```
3. Upload. This creates a **public** bucket `lesson-videos` if there is none, and
   uploads with the right content types. It is safe to run again — it replaces the
   files in the bucket and deletes nothing.

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=<service role key> npm run videos:upload
   ```

   It reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` (this needs Node 20.6+ for
   `--env-file`), checks that a file is publicly readable, and prints the value for
   the next step.
4. On the web host set `NEXT_PUBLIC_VIDEO_BASE_URL` to the URL it printed
   (`https://<project>.supabase.co/storage/v1/object/public/lesson-videos`) and
   **redeploy** — it is read at build time.
5. Open a lesson: the film should play, seek, and offer its captions.
6. Only now, if you want the repository smaller: `git rm public/videos/lesson-*.mp4`
   and commit. The old copies stay in the git **history**, so a fresh clone is not
   smaller until the history is rewritten (`git filter-repo`), which changes every
   commit id and is a decision for the repository owner, not a step of this guide.

Leave the variable unset and nothing changes. A value that is not an `https://` URL
or a `/path` is ignored. When you re-render a film, run the upload again.

The films come from your own bucket, so the site asks the browser for
`crossorigin="anonymous"` on them (needed for the caption track); a video link a
teacher pastes from another site is left alone.

## 7. Arena game server (Railway)

The arena — the two-dimensional physics football at `/arena` — plays against bots
with no backend at all. Playing **with other people** needs one of two things.

### Option A — a game server (recommended)

A real server is one authority that outlives any single player: the match does
not restart when whoever arrived first closes their laptop, and nobody sees the
ball a frame before anyone else. It cannot live on Vercel, whose functions do not
stay resident, so it goes somewhere that keeps a process running. Railway is the
cheapest way to do that.

1. Push this repository to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**, pick this repository.
3. Nothing to type: `railway.json` at the repository root already sets the
   build and start commands, the health check and the restart policy.

   ```json
   "buildCommand": "npm ci --include=dev && npm run build:server",
   "startCommand": "npm run start:server",
   "healthcheckPath": "/health"
   ```

   Left to guess, Railway finds a `build` script in `package.json`, builds the
   **Next site** and starts that instead — a working deployment of the wrong
   half of the repository. And `--include=dev` matters: TypeScript is a dev
   dependency and Railway sets `NODE_ENV=production`, which makes a plain
   `npm ci` skip it and the compile fail with `tsc: not found`.

   Anything typed into the service's **Settings** overrides this file, so leave
   those fields empty unless you mean to.
4. **Networking → Generate Domain.** A fresh service is marked *Unexposed*: it
   builds and runs, but nothing outside Railway can reach it, and the browser
   needs a public host to open a socket to.
5. Deploy. Railway passes the port in `PORT`, which the server already reads,
   and binds on every interface — nothing else to configure.
6. Check it: `https://<your-domain>/health` should answer
   `{"ok":true,"rooms":0}`.

> **Railway blocks the build over `next`?** Railway scans `package-lock.json`
> for advisories and refuses to deploy on a HIGH finding — including ones in
> packages the server never loads, since the lockfile covers the whole
> repository. Keep `next` on the current 14.2.x patch (`npm install
> next@^14.2.35`) and commit the lockfile; that clears the two DoS advisories
> it stops on.
7. Back on the **web** deployment (Vercel), add the environment variable and
   **redeploy** — `NEXT_PUBLIC_*` values are baked in at build time:

```
NEXT_PUBLIC_ARENA_SERVER=wss://arena-server-production.up.railway.app
```

`https://` works too; the client rewrites the scheme. Leave it unset and the
platform quietly falls back to Option B.

The server needs no database, no Supabase keys and no secrets of its own. It
holds rooms in memory, sweeps them a minute after the last player leaves, and
imports its physics from `src/lib/arena` so it cannot drift from what the
browsers draw.

### Option B — Supabase Realtime rooms

With no game server but Supabase keys configured, rooms run over Realtime
channels and one of the players referees: the first to arrive integrates the
physics and publishes it, the rest send input. It needs no second deployment and
no extra cost, at the price of the host advantage above and a restart if the host
leaves. Nothing to configure — it turns on with the Supabase keys.

### Neither

Practice against bots still works everywhere, including the demo build.

### The live class quiz (`/teacher/live`, `/live`)

Not part of the arena. The teacher's browser runs the game and the students'
phones talk to it through Supabase Realtime **Broadcast** (so it needs the
Supabase keys and Realtime enabled on the project); with no keys the same pages
run over `BroadcastChannel`, which only connects tabs of one browser — enough for
a demo on one computer, **not** for a class. Nothing is stored. The room code is
the only barrier to entry, so treat a room like a classroom door, not a vault. If
the teacher closes the page the game ends. This path has been tested in-browser
and in unit tests but not yet against a live Supabase project; try a room with
two real phones before you rely on it in a lesson.

## 8. Offline use, tests and CI

**Offline / install.** `public/sw.js` is a small service worker, registered in
production builds only (in `next dev` it would cache the chunks hot reload is
replacing). It keeps the app's code and every page the user has opened, so those
pages open with no connection, and shows `/offline.html` for a page never opened.
It deliberately does not cache `/api/*`, anything from Supabase, or the lesson
films. Two things follow: a page opened offline shows its shell but **cannot load
new data** from Supabase, and a film needs a connection. Service workers need
HTTPS (`localhost` is exempt) — Vercel and Railway provide it. To drop everyone's
cached pages after a deploy, change `VERSION` at the top of `public/sw.js`. The
manifest and icons make the site installable ("Add to Home Screen").

**Tests.** `npm test` runs the unit tests (physics, the formula bank, statistics,
the cohort builder, CSV, the games, sensors, community rules, live quiz);
`npm run typecheck` runs `tsc`. `npm run smoke:mobile` opens every page at 320
and 375 px against a running production server and fails if one scrolls sideways
or throws. `npm run test:db` applies all migrations to an empty **PostgreSQL 15+**
(standard `PG*` variables) and runs `supabase/tests/*.sql` against the row-level
security rules — worth running against a scratch database before you change a
migration.

**CI.** `.github/workflows/ci.yml` runs typecheck, tests and a production build on
every pull request and on `main`, the database tests against a `postgres:16`
service, and the mobile smoke test against the built site. It needs no secrets:
the build runs in demo mode.

## 9. Post-deploy checklist

- [ ] All sixteen migrations ran, in order, with no error
- [ ] Email sign-up works for a student and a teacher; Google sign-in works if enabled
- [ ] A student's link request reaches the teacher, and accepting it fills the teacher's roster
- [ ] `/teacher/analytics` shows **no** demo banner once a student is linked
- [ ] A student can take the pre-test once and is refused a second sitting
- [ ] `/league` lists the teacher's students; a student's gallery post appears in `/teacher/community` and reaches classmates only after approval
- [ ] `/sensors` works on a real phone over HTTPS (iOS asks for motion permission)
- [ ] A live-quiz room opens from `/teacher/live` and a second device joins with the code
- [ ] AI tutor returns real model responses (not mock) when a key is set — and see the warning in §3
- [ ] Google Sheets grade sync returns real rows (if used)
- [ ] Certificate QR codes resolve to `/verify/[id]` on the deployed domain
- [ ] Lessons play their film (from `public/videos` or from your bucket, §6)
- [ ] The site installs from a phone, and a visited page opens in airplane mode
- [ ] Dark mode toggle persists across reload
