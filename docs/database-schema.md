# Database schema

The platform's database is **Supabase (PostgreSQL)**. The source of truth is
[`supabase/migrations/`](../supabase/migrations) — run the files in order, 0001
to 0011 (see [`supabase/README.md`](../supabase/README.md)). This page is the
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
| `game_results` | `module_id`, `game_type`, `score` 0–100, `completed_at` | | 0008 |
| `assignment_submissions` | БӨЖ work: `type`, `content`, `status` (`pending` / `reviewed`), `grade`, `teacher_feedback`, `graded_by` | The one table two people write to. A trigger decides which *columns* each may change: the student owns the work, the teacher owns the mark. | 0008 |
| `competency_assessments` | the 10-criterion rubric: `scores` (jsonb), `average_level`, `percent`, `assessor_type` (self / ai / teacher) | | 0008 |
| `certificates` | `id`, `course_name`, `qr_data`, `verify_url` | `verify_certificate(id)` is public so a printed QR code resolves for someone with no account. | 0008 |
| `diagnostic_attempts` | the pre/post test: `phase` (`pre` / `post`), `score`, `total`, `answers`, `taken_at` | **One per student per phase, append-only** (no UPDATE or DELETE policy), and a `post` cannot exist without a `pre`. See *Research data* below. | 0011 |

## Functions the app calls

| Function | Used for |
|---|---|
| `search_people(term, want_role)` | find a teacher or student by code, name or exact email — the only way to see people you are not linked to |
| `classmates()` | the leaderboard: students who share a teacher with you |
| `claim_role(role)` | one-time role choice after a Google sign-up |
| `my_lesson_overrides()` | the patches that apply to the signed-in student |
| `compute_xp(uid)` / `refresh_my_xp()` | XP is **derived** from the records above (best quiz per lesson, best game result, graded work, duels, rubric), never incremented, so it cannot drift |
| `verify_certificate(id)` | public certificate lookup |

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
`diagnosticAttempts`, `certificates`, `notifications`, `finalGrades`,
`darkMode`, `researchArms:<teacher id>`.
