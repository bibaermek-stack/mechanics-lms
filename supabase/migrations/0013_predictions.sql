-- =============================================================================
-- Болжамдар: "predict, then look" (src/data/predictions.ts)
-- =============================================================================
-- Run after 0012. Dashboard → SQL Editor → paste → Run.
--
-- A student is shown a set-up, says what will happen and how sure they are, and
-- only then sees the measurement. What the teacher wants out of it is which wrong
-- ideas a class actually holds — so the table keeps the *first* thing each student
-- believed, and the rules below protect exactly that:
--
--   • append-only: there is no UPDATE or DELETE policy. A student cannot, having seen
--     the answer, go back and tidy up what they first predicted. (Retaking an item is
--     fine and is a new row; analysis uses the earliest row per student and item.)
--   • a student writes only their own rows and reads only their own; a teacher reads
--     the rows of students they have accepted — the rule every learning table uses;
--   • a right answer carries no misconception (a CHECK), so the column can be counted
--     without first asking which rows were wrong.
--
-- `correct` and `misconception` are what the client says about its own answer, like
-- every other record here: they describe the student's own work, and a student who
-- falsifies them only misleads their own teacher about themselves.
-- =============================================================================

create table if not exists public.prediction_attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  item_id       text not null,
  option_id     text not null,
  correct       boolean not null,
  misconception text,
  -- 1 = no idea, 2 = fairly sure, 3 = certain
  confidence    smallint not null,
  created_at    timestamptz not null default now(),
  constraint prediction_item_len     check (char_length(item_id) between 1 and 80),
  constraint prediction_option_len   check (char_length(option_id) between 1 and 40),
  constraint prediction_confidence   check (confidence between 1 and 3),
  constraint prediction_misconception_len check (misconception is null or char_length(misconception) between 1 and 80),
  constraint prediction_right_has_none check (not correct or misconception is null)
);

create index if not exists prediction_attempts_user_idx
  on public.prediction_attempts (user_id, item_id, created_at);

alter table public.prediction_attempts enable row level security;

drop policy if exists predictions_select on public.prediction_attempts;
create policy predictions_select on public.prediction_attempts
  for select using (user_id = auth.uid() or public.is_my_student(user_id));

drop policy if exists predictions_insert on public.prediction_attempts;
create policy predictions_insert on public.prediction_attempts
  for insert with check (user_id = auth.uid());
