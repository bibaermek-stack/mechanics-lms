-- =============================================================================
-- Телефон-зертхана: measurements made with the phone's own sensors
-- =============================================================================
-- Run after 0013. Dashboard → SQL Editor → paste → Run.
--
-- A student measures g, a jump, a pendulum or a lift with their phone
-- (src/lib/sensors/analysis.ts) and may save the result. Two things need care.
--
-- 1. THE NUMBERS MUST BE PLAUSIBLE. A result is the client's own analysis, so the
--    table does not vouch for it; it only refuses what no phone could have measured
--    (a 40 m jump, a g of 90). That keeps typos and idle experiments out of every
--    chart and ranking built on top.
--
-- 2. A PHYSICAL PERFORMANCE IS NOT A MARK. How high someone jumped is theirs to
--    show or not. Classmates therefore never see each other's results, only the
--    *distribution* — class_jump_bests() returns bare numbers, with no id, no name
--    and no row order that could give one away — so a student can see where they sit
--    without a leaderboard of people. A teacher reads the rows of students they have
--    accepted, as for every learning table.
--
-- Append-only, like predictions and the diagnostic: no UPDATE, no DELETE.
-- =============================================================================

create table if not exists public.sensor_results (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  value      numeric not null,
  unit       text not null,
  -- what else was measured (flight time, pendulum length, lift direction, …)
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint sensor_kind check (kind in ('rest-g', 'jump', 'pendulum', 'elevator')),
  constraint sensor_unit_len check (char_length(unit) between 1 and 12),
  constraint sensor_details_size check (pg_column_size(details) < 4096),
  constraint sensor_plausible check (
    case kind
      when 'rest-g'   then value between 8 and 11      -- m/s²: what a phone at rest can read
      when 'jump'     then value between 0.02 and 1.2  -- m: vertical jumps
      when 'pendulum' then value between 0.2 and 10    -- s: period
      when 'elevator' then value between 0.05 and 10   -- m/s²: a lift's acceleration
    end
  )
);

create index if not exists sensor_results_user_idx on public.sensor_results (user_id, kind, created_at desc);

alter table public.sensor_results enable row level security;

drop policy if exists sensor_select on public.sensor_results;
create policy sensor_select on public.sensor_results
  for select using (user_id = auth.uid() or public.is_my_student(user_id));

drop policy if exists sensor_insert on public.sensor_results;
create policy sensor_insert on public.sensor_results
  for insert with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Where do I stand? Each classmate's best jump, and nothing else.
-- -----------------------------------------------------------------------------
create or replace function public.class_jump_bests()
returns table (best numeric, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with my_teachers as (
    select l.teacher_id
    from public.teacher_links l
    where l.student_id = auth.uid()
      and l.status = 'accepted'
  ),
  peers as (
    select distinct l.student_id as id
    from public.teacher_links l
    join my_teachers t on t.teacher_id = l.teacher_id
    where l.status = 'accepted'
    union
    select auth.uid()
  ),
  bests as (
    select r.user_id, max(r.value) as best
    from public.sensor_results r
    join peers p on p.id = r.user_id
    join public.profiles pr on pr.id = r.user_id and pr.role = 'student'
    where r.kind = 'jump'
    group by r.user_id
  )
  select b.best, b.user_id = auth.uid() as is_me
  from bests b
  where auth.uid() is not null
  order by b.best;
$$;

revoke all on function public.class_jump_bests() from public;
revoke execute on function public.class_jump_bests() from anon;
grant execute on function public.class_jump_bests() to authenticated;
