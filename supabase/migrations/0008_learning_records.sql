-- =============================================================================
-- Оқу деректері: викторина, ойын, БӨЖ, бағалау, сертификат
-- =============================================================================
-- Run after 0007. Dashboard → SQL Editor → paste → Run.
--
-- Until now accounts, roles and the teacher↔student graph were real while the
-- *work* was not: every attempt, score and submission sat in one browser's
-- localStorage. So a student lost everything by clearing their cache, saw an
-- empty course on their phone, and — the part that mattered most — a teacher
-- could not see a single submission, because they were reading their own
-- browser's storage. The graph we built had nothing flowing through it.
--
-- Ownership rule, applied to every table here:
--   • a student owns their rows and may read and write them,
--   • a teacher may read the rows of students they have accepted,
--   • only assignment_submissions is writable by both, and then only in
--     disjoint halves — the student owns the work, the teacher owns the mark.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: is this person one of my accepted students?
-- -----------------------------------------------------------------------------
create or replace function public.is_my_student(student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_links l
    where l.teacher_id = auth.uid()
      and l.student_id = student
      and l.status = 'accepted'
  );
$$;

-- -----------------------------------------------------------------------------
-- Quiz attempts
-- -----------------------------------------------------------------------------
create table if not exists public.quiz_attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  module_id  integer not null,
  score      integer not null,
  total      integer not null,
  -- [{ questionId, chosenIndex, correct }]
  answers    jsonb not null default '[]'::jsonb,
  taken_at   timestamptz not null default now(),
  constraint quiz_attempts_score check (score >= 0 and total > 0 and score <= total)
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, module_id, taken_at desc);

-- -----------------------------------------------------------------------------
-- Game results
-- -----------------------------------------------------------------------------
create table if not exists public.game_results (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  module_id    integer not null,
  game_type    text not null,
  score        integer not null check (score between 0 and 100),
  completed_at timestamptz not null default now()
);
create index if not exists game_results_user_idx on public.game_results (user_id, module_id, completed_at desc);

-- -----------------------------------------------------------------------------
-- БӨЖ submissions — the one table two people write to
-- -----------------------------------------------------------------------------
create table if not exists public.assignment_submissions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  module_id        integer not null,
  type             text not null check (type in ('text', 'image', 'pdf', 'video', 'voice')),
  content          text not null,
  status           text not null default 'pending' check (status in ('pending', 'reviewed')),
  grade            integer check (grade between 0 and 100),
  teacher_feedback text,
  graded_by        uuid references public.profiles (id) on delete set null,
  submitted_at     timestamptz not null default now(),
  reviewed_at      timestamptz
);
create index if not exists submissions_user_idx on public.assignment_submissions (user_id, submitted_at desc);
create index if not exists submissions_status_idx on public.assignment_submissions (status, submitted_at desc);

-- -----------------------------------------------------------------------------
-- Competency assessments
-- -----------------------------------------------------------------------------
create table if not exists public.competency_assessments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  module_id     integer not null,
  -- [{ criterion, level }] over the ten rubric criteria
  scores        jsonb not null default '[]'::jsonb,
  average_level numeric(3, 2) not null,
  percent       integer not null check (percent between 0 and 100),
  assessor_type text not null check (assessor_type in ('self', 'ai', 'teacher')),
  assessor_id   uuid references public.profiles (id) on delete set null,
  assessed_at   timestamptz not null default now()
);
create index if not exists assessments_user_idx on public.competency_assessments (user_id, assessed_at desc);

-- -----------------------------------------------------------------------------
-- Certificates
--
-- Issued by the holder, as the app has always done. That is weak as proof and
-- is left that way on purpose: making issuance a teacher action is a policy
-- change, not a schema one, and `graded_by`-style attribution can be added the
-- day that decision is taken. `verify_url` stays public-readable so the QR code
-- on a printed certificate resolves for somebody with no account at all.
-- -----------------------------------------------------------------------------
create table if not exists public.certificates (
  id          text primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  course_name text not null,
  qr_data     text not null,
  verify_url  text not null,
  issued_at   timestamptz not null default now()
);
create index if not exists certificates_user_idx on public.certificates (user_id, issued_at desc);

-- -----------------------------------------------------------------------------
-- The work belongs to the student, the mark belongs to the teacher.
--
-- RLS decides *whether* you may update the row; this decides *which columns*
-- your update is allowed to have changed. Without it a student could PATCH
-- their own grade to 100, since the row is theirs.
-- -----------------------------------------------------------------------------
create or replace function public.protect_submission_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  new.submitted_at := old.submitted_at;

  if auth.uid() = old.user_id then
    -- The student may revise their work. The mark is not theirs to touch.
    new.grade := old.grade;
    new.teacher_feedback := old.teacher_feedback;
    new.graded_by := old.graded_by;
    new.reviewed_at := old.reviewed_at;
    -- Re-submitting sends the work back into the queue.
    if new.content is distinct from old.content then
      new.status := 'pending';
    else
      new.status := old.status;
    end if;

  elsif public.is_my_student(old.user_id) then
    -- The teacher may mark it. The work is not theirs to rewrite.
    new.module_id := old.module_id;
    new.type := old.type;
    new.content := old.content;
    if new.grade is distinct from old.grade
       or new.teacher_feedback is distinct from old.teacher_feedback then
      new.graded_by := auth.uid();
      new.reviewed_at := now();
      new.status := 'reviewed';
    end if;

  else
    raise exception 'not allowed to modify this submission';
  end if;

  return new;
end;
$$;

drop trigger if exists submissions_protect on public.assignment_submissions;
create trigger submissions_protect
  before update on public.assignment_submissions
  for each row execute function public.protect_submission_columns();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.quiz_attempts          enable row level security;
alter table public.game_results           enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.competency_assessments enable row level security;
alter table public.certificates           enable row level security;

-- Read-your-own plus read-my-students, insert-your-own. Written out per table
-- rather than generated, because PostgreSQL policies cannot be parameterised
-- and a loop here would be less readable than the repetition.

drop policy if exists quiz_select on public.quiz_attempts;
create policy quiz_select on public.quiz_attempts
  for select using (user_id = auth.uid() or public.is_my_student(user_id));
drop policy if exists quiz_insert on public.quiz_attempts;
create policy quiz_insert on public.quiz_attempts
  for insert with check (user_id = auth.uid());

drop policy if exists games_select on public.game_results;
create policy games_select on public.game_results
  for select using (user_id = auth.uid() or public.is_my_student(user_id));
drop policy if exists games_insert on public.game_results;
create policy games_insert on public.game_results
  for insert with check (user_id = auth.uid());

drop policy if exists subs_select on public.assignment_submissions;
create policy subs_select on public.assignment_submissions
  for select using (user_id = auth.uid() or public.is_my_student(user_id));
drop policy if exists subs_insert on public.assignment_submissions;
create policy subs_insert on public.assignment_submissions
  for insert with check (user_id = auth.uid());
-- Both sides may update; the trigger above decides which columns actually move.
drop policy if exists subs_update on public.assignment_submissions;
create policy subs_update on public.assignment_submissions
  for update using (user_id = auth.uid() or public.is_my_student(user_id))
  with check (user_id = auth.uid() or public.is_my_student(user_id));

drop policy if exists assess_select on public.competency_assessments;
create policy assess_select on public.competency_assessments
  for select using (user_id = auth.uid() or public.is_my_student(user_id));
-- A teacher may also assess a student, which is why the check is wider here.
drop policy if exists assess_insert on public.competency_assessments;
create policy assess_insert on public.competency_assessments
  for insert with check (user_id = auth.uid() or public.is_my_student(user_id));

drop policy if exists certs_select on public.certificates;
create policy certs_select on public.certificates
  for select using (user_id = auth.uid() or public.is_my_student(user_id));
drop policy if exists certs_insert on public.certificates;
create policy certs_insert on public.certificates
  for insert with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- verify_certificate — the QR code has to resolve for a stranger.
--
-- The /verify/[id] page is opened by whoever holds the printed certificate,
-- who is generally not signed in, so this is definer and returns only what a
-- verification needs: the holder's name, the course and the date.
-- -----------------------------------------------------------------------------
create or replace function public.verify_certificate(cert_id text)
returns table (id text, full_name text, course_name text, issued_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, p.full_name, c.course_name, c.issued_at
  from public.certificates c
  join public.profiles p on p.id = c.user_id
  where c.id = cert_id;
$$;

grant execute on function public.verify_certificate(text) to anon, authenticated;
