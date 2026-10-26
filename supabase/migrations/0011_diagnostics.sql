-- =============================================================================
-- Диагностика: бастапқы (pre) және қорытынды (post) тест
-- =============================================================================
-- Run after 0010. Dashboard → SQL Editor → paste → Run.
--
-- The thesis claim is a *change*: students know more mechanics, and handle
-- information better, after the course than before it. A change needs two
-- measurements of the same thing, taken at two moments, and kept as they were
-- taken. quiz_attempts cannot be that — a student may retake a lesson quiz
-- until it is right, and the lesson quizzes are the very questions the course
-- teaches. So this is a separate instrument with three rules of its own:
--
--   • one sitting per student per phase (unique), so the figure a teacher
--     exports is the first answer and not the best of several;
--   • append-only: there is no UPDATE or DELETE policy, so a student cannot
--     quietly improve their "pre" score once the course is over;
--   • a "post" cannot exist without a "pre" for the same student, since a
--     post-test with nothing to compare against is a number without a meaning.
--
-- Same ownership rule as the other learning tables: a student reads and writes
-- their own rows, a teacher reads the rows of students they have accepted.
-- =============================================================================

create table if not exists public.diagnostic_attempts (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles (id) on delete cascade,
  phase     text not null check (phase in ('pre', 'post')),
  score     integer not null,
  total     integer not null,
  -- [{ questionId, chosenIndex, correct }]
  answers   jsonb not null default '[]'::jsonb,
  taken_at  timestamptz not null default now(),
  constraint diagnostic_attempts_score check (score >= 0 and total > 0 and score <= total),
  constraint diagnostic_attempts_one_per_phase unique (user_id, phase)
);

create index if not exists diagnostic_attempts_user_idx
  on public.diagnostic_attempts (user_id, phase);

alter table public.diagnostic_attempts enable row level security;

drop policy if exists diag_select on public.diagnostic_attempts;
create policy diag_select on public.diagnostic_attempts
  for select using (user_id = auth.uid() or public.is_my_student(user_id));

-- The EXISTS runs under the caller's own SELECT policy, which lets them see
-- their own rows — exactly the rows it needs to find.
drop policy if exists diag_insert on public.diagnostic_attempts;
create policy diag_insert on public.diagnostic_attempts
  for insert with check (
    user_id = auth.uid()
    and (
      phase = 'pre'
      or exists (
        select 1 from public.diagnostic_attempts d
        where d.user_id = auth.uid() and d.phase = 'pre'
      )
    )
  );
