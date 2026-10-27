-- =============================================================================
-- Оқушылар жазған сұрақтар: students write quiz questions for their classmates
-- =============================================================================
-- Run after 0015 (it uses are_classmates() from there).
--
-- Writing a good question, with one right answer and three tempting wrong ones, is
-- among the best ways to learn a topic — and the wrong answers are the interesting
-- part. The same safeguards as the gallery apply:
--
--   • a question starts "pending", the client cannot choose otherwise, and only the
--     author's own accepted teacher can approve it (review_question(), the one place a
--     status changes; no UPDATE policy);
--   • classmates get approved questions of their class through peer_questions(), which
--     never returns a pending or rejected one, nor the author's name, nor the
--     student's own questions (they would be answering themselves);
--   • exactly four options, each 1–120 characters and all different, one marked right;
--   • at most ten questions waiting at once.
-- =============================================================================

-- Four options, none empty or over-long, and no two alike.
create or replace function public.question_options_ok(opts text[])
returns boolean
language sql
immutable
as $$
  select array_length(opts, 1) = 4
     and array_ndims(opts) = 1
     and not exists (select 1 from unnest(opts) o where o is null or char_length(btrim(o)) not between 1 and 120)
     and (select count(distinct lower(btrim(o))) from unnest(opts) o) = 4;
$$;

create table if not exists public.student_questions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lesson_id     integer not null,
  question      text not null,
  options       text[] not null,
  correct_index smallint not null,
  explanation   text,
  status        text not null default 'pending',
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint question_lesson  check (lesson_id between 1 and 999),
  constraint question_text    check (char_length(btrim(question)) between 10 and 300),
  constraint question_options check (public.question_options_ok(options)),
  constraint question_correct check (correct_index between 0 and 3),
  constraint question_explanation check (explanation is null or char_length(explanation) <= 300),
  constraint question_status  check (status in ('pending', 'approved', 'rejected')),
  constraint question_review_consistent check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists student_questions_user_idx on public.student_questions (user_id, created_at desc);
create index if not exists student_questions_lesson_idx on public.student_questions (lesson_id, status);

alter table public.student_questions enable row level security;

drop policy if exists questions_select on public.student_questions;
create policy questions_select on public.student_questions
  for select using (user_id = auth.uid() or public.is_my_student(user_id));

drop policy if exists questions_insert on public.student_questions;
create policy questions_insert on public.student_questions
  for insert with check (
    user_id = auth.uid()
    and public.role_of(auth.uid()) = 'student'
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists questions_delete on public.student_questions;
create policy questions_delete on public.student_questions
  for delete using (user_id = auth.uid());

create or replace function public.limit_pending_questions()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pending'
     and (select count(*) from public.student_questions q where q.user_id = new.user_id and q.status = 'pending') >= 10 then
    raise exception 'too many questions waiting for review' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists questions_limit_pending on public.student_questions;
create trigger questions_limit_pending before insert on public.student_questions
  for each row execute function public.limit_pending_questions();

create or replace function public.review_question(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare author uuid;
begin
  select user_id into author from public.student_questions where id = p_id;
  if author is null then
    raise exception 'no such question' using errcode = 'no_data_found';
  end if;
  if not public.is_my_student(author) then
    raise exception 'only the author''s teacher may review this' using errcode = 'insufficient_privilege';
  end if;
  update public.student_questions
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.review_question(uuid, boolean) from public;
revoke execute on function public.review_question(uuid, boolean) from anon;
grant execute on function public.review_question(uuid, boolean) to authenticated;

-- Approved questions of my classmates for a lesson, to practise on. Never my own, never an author.
create or replace function public.peer_questions(p_lesson integer)
returns table (id uuid, lesson_id integer, question text, options text[], correct_index smallint, explanation text)
language sql
stable
security definer
set search_path = public
as $$
  select q.id, q.lesson_id, q.question, q.options, q.correct_index, q.explanation
  from public.student_questions q
  where auth.uid() is not null
    and q.status = 'approved'
    and q.lesson_id = p_lesson
    and q.user_id <> auth.uid()
    and public.are_classmates(auth.uid(), q.user_id)
  order by q.created_at;
$$;

revoke all on function public.peer_questions(integer) from public;
revoke execute on function public.peer_questions(integer) from anon;
grant execute on function public.peer_questions(integer) to authenticated;
