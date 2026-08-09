-- =============================================================================
-- Оқытушының сабақ мазмұнын өңдеуі
-- =============================================================================
-- Run after 0006. Dashboard → SQL Editor → paste → Run.
--
-- The ten lessons ship in the code and stay there: they are the default every
-- account starts from, and a project with no database configured still has a
-- complete course. What a teacher edits is an *override* — a partial lesson
-- laid over the default for their own students.
--
-- That keeps three properties worth having:
--   • a teacher can never break the course for somebody else's group,
--   • "reset to default" is deleting one row, not restoring a backup,
--   • demo mode still works, because the defaults are the code.
--
-- The patch is jsonb rather than twenty columns. The shape it must match is
-- LessonModule, which is defined in TypeScript; mirroring it in SQL would mean
-- two migrations for every field the course ever gains, and the two copies
-- would drift. A trigger keeps the top-level keys honest instead.
--
-- Simulations are deliberately absent from the allowed keys. They are code —
-- physics integrators with verified numbers — and nothing here can add, edit
-- or disable one.
-- =============================================================================

create table if not exists public.lesson_overrides (
  id          uuid primary key default gen_random_uuid(),
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  module_id   integer not null,
  patch       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (teacher_id, module_id)
);

create index if not exists lesson_overrides_teacher_idx
  on public.lesson_overrides (teacher_id, module_id);

-- -----------------------------------------------------------------------------
-- Only a teacher may own an override, and only these fields may be overridden.
-- An unknown key is a typo or a stale client, and silently storing it would
-- leave content that never renders and nobody can find.
-- -----------------------------------------------------------------------------
create or replace function public.validate_lesson_override()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  bad text;
begin
  if public.role_of(new.teacher_id) is distinct from 'teacher' then
    raise exception 'only a teacher may own a lesson override';
  end if;

  select k into bad
  from jsonb_object_keys(new.patch) k
  where k not in (
    'title', 'shortDescription', 'youtubeId', 'videoDurationMinutes',
    'objectives', 'lectureSummary', 'keyConcepts',
    'glossary', 'quiz', 'gamePairs'
  )
  limit 1;

  if bad is not null then
    raise exception 'unknown lesson field: %', bad;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists lesson_overrides_validate on public.lesson_overrides;
create trigger lesson_overrides_validate
  before insert or update on public.lesson_overrides
  for each row execute function public.validate_lesson_override();

-- -----------------------------------------------------------------------------
-- Row level security
--
-- A teacher owns their overrides outright. A student reads the overrides of
-- any teacher who has accepted them — which is exactly the set of people
-- allowed to teach them.
-- -----------------------------------------------------------------------------
alter table public.lesson_overrides enable row level security;

drop policy if exists overrides_teacher_all on public.lesson_overrides;
create policy overrides_teacher_all on public.lesson_overrides
  for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists overrides_student_read on public.lesson_overrides;
create policy overrides_student_read on public.lesson_overrides
  for select using (
    exists (
      select 1 from public.teacher_links l
      where l.teacher_id = lesson_overrides.teacher_id
        and l.student_id = auth.uid()
        and l.status = 'accepted'
    )
  );

-- -----------------------------------------------------------------------------
-- my_lesson_overrides — what the signed-in user should actually see.
--
-- A student may be accepted by more than one teacher, and both may have edited
-- lesson 3. Rather than leaving the client to pick arbitrarily, the most
-- recently updated one wins and the rule lives in one place.
-- -----------------------------------------------------------------------------
create or replace function public.my_lesson_overrides()
returns table (module_id integer, patch jsonb, updated_at timestamptz, teacher_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (o.module_id)
    o.module_id, o.patch, o.updated_at, o.teacher_id
  from public.lesson_overrides o
  where auth.uid() is not null
    and (
      o.teacher_id = auth.uid()
      or exists (
        select 1 from public.teacher_links l
        where l.teacher_id = o.teacher_id
          and l.student_id = auth.uid()
          and l.status = 'accepted'
      )
    )
  order by o.module_id, o.updated_at desc;
$$;

revoke all on function public.my_lesson_overrides() from public;
revoke execute on function public.my_lesson_overrides() from anon;
grant execute on function public.my_lesson_overrides() to authenticated;
