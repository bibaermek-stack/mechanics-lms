# Database schema

The platform's database is **Supabase (PostgreSQL)**. The source of truth is
[`supabase/migrations/`](../supabase/migrations) — run the files in order, 0001
to 0016 (see [`supabase/README.md`](../supabase/README.md)). This page is the
map; the migrations carry the reasoning behind every rule.

> This file used to describe Firestore collections. The project moved to
> Supabase and nothing reads Firebase any more.

All access from the app goes through `src/lib/dataStore.ts` (learning records)
and `src/lib/supabase/*` (accounts, links, friends, duels, lesson overrides).
Both fall back to `localStorage` when no Supabase keys are configured, with the
same shapes, so the project still demos with no backend.

## Who may read and write what

One ownership rule, applied to every learning table:

- a **student** owns their rows — reads and inserts them;
- a **teacher** reads the rows of students they have **accepted**
  (`is_my_student()`). The only things a teacher writes are the mark on a
  submission and a rubric assessment of a student (`competency_assessments`);
- the database enforces it with row-level security. The client never filters by
  role, so there is no filter to forget.

## Accounts and links

| Table | Holds | Migration |
|---|---|---|
| `profiles` | one row per account: `role` (student / teacher / admin), `full_name`, `email`, shareable `user_code` (`STU-…` / `TCH-…`), `study_group`, `avatar_url`, `xp`, `competency_score`. Role and code are immutable after sign-up. | 0001, 0002, 0003 |
| `teacher_links` | one edge per teacher–student pair, `pending` / `accepted` / `declined`. Only the *other* party may accept. | 0001 |
| `friend_links` | symmetric student–student friendship, one row per unordered pair. | 0005 |
| `game_duels` | a challenge: both players' boards are rebuilt from one `seed`. A player can only write their own score. | 0006 |
| `lesson_overrides` | a teacher's edits to a lesson, stored as a **patch** on top of the lesson in `src/data/modules.ts`, visible only to that teacher's students. `videoSrc` / `videoDurationSeconds` replaced the old YouTube fields in 0010. | 0007, 0010 |

## Learning records

| Table | Holds | Notes | Migration |
|---|---|---|---|
| `quiz_attempts` | `module_id`, `score`, `total`, `answers` (jsonb), `taken_at` | Retakes allowed; the platform counts the **best** per lesson. | 0008 |
| `game_results` | `module_id`, `game_type`, `score` 0–100, `completed_at` | `game_type` is free text (the game's mode name, e.g. `blitz`, `projectile`). The daily challenge is stored here as `game_type = 'daily'`, `module_id = 0` (it belongs to no lesson); streaks and achievements are derived from this table and its siblings, never stored | 0008 |
| `assignment_submissions` | БӨЖ work: `type`, `content`, `status` (`pending` / `reviewed`), `grade`, `teacher_feedback`, `graded_by` | The one table two people write to. A trigger decides which *columns* each may change: the student owns the work, the teacher owns the mark. | 0008 |
| `competency_assessments` | the 10-criterion rubric: `scores` (jsonb), `average_level`, `percent`, `assessor_type` (self / ai / teacher) | | 0008 |
| `certificates` | `id`, `course_name`, `qr_data`, `verify_url` | `verify_certificate(id)` is public so a printed QR code resolves for someone with no account. | 0008 |
| `diagnostic_attempts` | the pre/post test: `phase` (`pre` / `post`), `score`, `total`, `answers`, `taken_at` | **One per student per phase, append-only** (no UPDATE or DELETE policy), and a `post` cannot exist without a `pre`. See *Research data* below. | 0011 |
| `prediction_attempts` | one "predict, then see" answer: `item_id`, `option_id`, `correct`, `misconception` (the id of the wrong idea the option expresses), `confidence` 1–3 | **Append-only.** Retakes add rows; the teacher's statistics count only each student's *first* attempt per item (`src/lib/misconceptions.ts`), because only that one says what they believed before being told. A correct answer carries no misconception (a CHECK). | 0013 |
| `sensor_results` | a phone-lab measurement: `kind` (`rest-g` / `jump` / `pendulum` / `elevator`), `value`, `unit`, `details` (jsonb, < 4 kB) | **Append-only; the recording itself is never stored**, only the result. CHECKs refuse what no phone could have measured (a 40 m jump, a g of 90). | 0014 |

## Functions the app calls

| Function | Used for |
|---|---|
| `search_people(term, want_role)` | find a teacher or student by code, name or exact email — the only way to see people you are not linked to |
| `classmates()` | the leaderboard: students who share a teacher with you |
| `claim_role(role)` | one-time role choice after a Google sign-up |
| `my_lesson_overrides()` | the patches that apply to the signed-in student |
| `compute_xp(uid)` / `refresh_my_xp()` | XP is **derived** from the records above (best quiz per lesson, best game result, graded work, duels, rubric), never incremented, so it cannot drift |
| `verify_certificate(id)` | public certificate lookup |
| `league_week(week_start)` | the weekly group league: for the caller and the students of the caller's accepted teachers, **participation points** (a fixed number per record, whatever its score; at most 40 a day) and active days. No marks, no record contents. The rule is duplicated in `src/lib/league.ts` and the two are tested against each other. |
| `class_jump_bests()` | each classmate's best jump as a bare number plus `is_me` — no id, no name, no ordering that could identify anyone |
| `are_classmates(a, b)` | same student, or two students accepted by one teacher |
| `showcase_feed()` | the approved gallery posts of the caller's class, with the author's name, like counts and `liked_by_me` |
| `review_showcase(id, approve)` | the **only** way a gallery post changes status; allowed only to a teacher who has accepted the post's author |
| `peer_questions(lesson)` | the approved classmates' questions for a lesson, **without** the author |
| `review_question(id, approve)` | the same, for student-written questions |
| `question_options_ok(options)` | validates a question's four options (used by a CHECK) |

## Community content (gallery and student questions)

Written for children, so the surface is deliberately small:

| Table | Holds | Migration |
|---|---|---|
| `showcase_posts` | a home experiment: `title`, `what`, `physics`, `materials`, `lesson_id`, `status`, `reviewed_by`, `reviewed_at` | 0015 |
| `showcase_likes` | one like per (post, student) | 0015 |
| `student_questions` | a question a student wrote: `question`, four `options` (`text[]`), `correct_index`, `explanation`, `status`, `reviewed_*` | 0016 |

- **Text only.** No images and no links — nothing to host, and nothing that can
  show a face, a home or a stranger's website. If images are ever added they need
  storage and a moderation path first.
- **Pending by default.** Insert requires `status = 'pending'` (and no reviewer);
  there is **no UPDATE policy**, so neither words nor status change from the
  client. A student may delete their own post.
- **Approval** happens through `review_showcase()` / `review_question()`
  (security definer), which require the caller to be a teacher who has **accepted**
  the author. A teacher of another class cannot approve it.
- **Reading.** The author and their accepted teachers read the table. Classmates
  read only through `showcase_feed()` / `peer_questions()`, which return approved
  items of their own class; a question's author is not returned. Likes are
  single, by classmates, on approved posts of others.
- **Limits.** At most 5 posts and 10 questions may wait for review at once, so a
  teacher's queue cannot be flooded.
- The same rules are implemented for demo mode in `src/lib/community.ts`;
  `community.test.ts` replays the SQL tests' scenario against it and reads the
  limits out of the migrations to confirm they agree.

## Live quiz (no tables)

The live class quiz (`/teacher/live`, `/live`) stores **nothing** in the database
and has no effect on grades. A teacher's browser acts as the game server; players
join with a 6-character room code. Messages travel over `BroadcastChannel`
(demo) or Supabase Realtime **Broadcast** (live; make sure Realtime is enabled
for the project), see `src/lib/liveQuizTransport.ts`. No migration is involved.

## Research data (pre/post)

The thesis claim is a change in knowledge between the start and the end of the
course, so the instrument has to be measured twice, in the same form, and kept as
it was taken:

- `diagnostic_attempts` — 20 items, two per lesson topic, defined in
  `src/data/diagnostic.ts`. The items are **not** the lesson-quiz questions
  (a student can retake those until they are right).
- Edit the items only **before** the first student sits the pre-test. Changing
  one afterwards makes earlier pre-scores incomparable with later post-scores.
- The post-test opens once a student has taken a quiz in `POST_UNLOCK_LESSONS`
  (8) lessons — a client-side rule, not a database one.
- The analytics page computes, per study group: mean ± SD of pre and post,
  the gain, Hake's normalised gain, a paired t-test and Cohen's d_z; and for two
  groups chosen as experimental and control, Welch's t-test on the gains plus a
  check that they started level. Code and tests: `src/lib/stats.ts`,
  `src/lib/analytics/research.ts`.
- Which group is "experimental" is a choice the teacher makes on the analytics
  page and is stored in that teacher's browser (`localStorage`), not in the
  database.

## What is still local to the browser

`src/lib/dataStore.ts` still keeps these in the browser, with or without
Supabase: notifications (its own comment calls them "the next thing to move"),
the stored final grade, and the per-student analytics snapshot. In demo mode (no
keys) everything is local.

`localStorage` keys, all prefixed `mechanics-lms:`: `mockSession`, `users`,
`quizAttempts`, `gameResults`, `assignmentSubmissions`, `competencyAssessments`,
`diagnosticAttempts`, `predictions`, `sensorResults`, `showcasePosts`,
`showcaseLikes`, `studentQuestions`, `certificates`, `notifications`,
`finalGrades`, `darkMode`, `researchArms:<teacher id>`.

## Testing the rules

`supabase/tests/*.sql` run the rules above against a **real PostgreSQL**:
`tools/db-test/run.sh` applies every migration to an empty database, then each
test file (as different users, by setting the request setting `auth.uid()` reads). A
stub (`tools/db-test/stub.sql`) stands in for Supabase's `auth` schema and API
roles. CI runs the same script in its `database` job. Each file is a series of
checks that raise an exception when one fails, and each was verified by
deliberately breaking the rule it covers.
