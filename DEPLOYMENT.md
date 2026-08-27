# Deployment Guide — Механика AI LMS

This guide covers taking the project from the included mock-backend demo to a fully wired production deployment.

## 1. Prerequisites

- Node.js 18.18+ (Node 20 recommended)
- A Firebase project (free Spark plan is enough for a thesis demo)
- A Google Cloud project with OAuth consent screen configured (for Google Login / Sheets / Drive / Forms)
- An OpenAI or Google AI Studio (Gemini) API key

## 2. Firebase setup

1. Go to https://console.firebase.google.com → **Add project**.
2. Enable **Authentication** → Sign-in method → Email/Password and Google.
3. Enable **Firestore Database** → Start in production mode → choose a region.
4. Enable **Storage** (for future file uploads of BOZh submissions).
5. Project Settings → General → "Your apps" → Add a Web app → copy the config values into `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_USE_MOCK_BACKEND=false
```

6. Apply Firestore security rules (see `docs/firestore-schema.md` for the collection list). A minimal starting rule set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /{collection}/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

Tighten these before real production use (teacher-only writes to `courses`/`questions`, etc).

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

### Auth settings for the deployed domain

In Supabase → Authentication → URL Configuration:

- **Site URL** → `https://<your-domain>`
- **Redirect URLs** → add `https://<your-domain>/auth/callback`
  (keep `http://localhost:3000/auth/callback` for local work)

Google Cloud Console needs **no** per-domain change: the only redirect URI Google
ever sees is Supabase's own `https://<project>.supabase.co/auth/v1/callback`.

## 6. Deploying to Firebase Hosting (alternative)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting          # choose "Use an existing project", output dir: .next (with the Next.js adapter) or use `next export` for a static subset
npm run build
firebase deploy
```

For full SSR support on Firebase, use **Firebase App Hosting** (supports Next.js natively) instead of static Hosting.

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
3. In the service's **Settings**:
   - **Build Command:** `npm ci && npm run build:server`
   - **Start Command:** `npm run start:server`
4. Deploy. Railway assigns a public domain such as
   `arena-server-production.up.railway.app` and passes the port in `PORT`, which
   the server already reads — nothing to configure.
5. Check it: `https://<your-domain>/health` should answer
   `{"ok":true,"rooms":0}`.
6. Back on the **web** deployment (Vercel), add the environment variable and
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

## 8. Post-deploy checklist

- [ ] Firebase Auth sign-in works (Google + Email)
- [ ] Firestore rules deployed and tested
- [ ] AI tutor returns real model responses (not mock) when a key is set
- [ ] Google Sheets grade sync returns real rows
- [ ] Certificates QR code resolves to `/verify/[id]` on the deployed domain
- [ ] Lighthouse PWA check passes (manifest, service worker optional for v1)
- [ ] Dark mode toggle persists across reload
