-- =============================================================================
-- Апталық топтар лигасы: league_week()
-- =============================================================================
-- Run after 0011. Dashboard → SQL Editor → paste → Run.
--
-- A weekly league between the study groups of one teacher's students needs to add
-- up what each classmate did this week. RLS rightly forbids a student reading
-- another student's records, so — like classmates() before it — this is a narrow
-- SECURITY DEFINER window, and it is narrower still than it could be:
--
--   • only the people who study under one of the caller's teachers (the same rule
--     as classmates()), and the caller;
--   • no marks, no record contents: a record earns a FIXED number of points
--     whatever the score on it, so what comes out is "how much did they take
--     part", which is nothing a classmate could not see in a classroom;
--   • the one extra column is study_group, which classmates() leaves out because
--     a ranking did not need it and a league between groups does.
--
-- THE RULE LIVES IN TWO PLACES: here, and in src/lib/league.ts (the demo path).
-- supabase/tests/0012_league.sql and src/lib/league.test.ts give both the same
-- records and expect the same numbers. If you change a figure, change both.
--
--   quiz attempt 10 · game 5 · daily challenge 10 · БӨЖ submission 15
--   competency assessment 5 · diagnostic test 10
--   at most 40 a day; a "day" is a 24-hour block counted from week_start
--
-- week_start is the viewer's own Monday 00:00 (the client sends it as a
-- timestamp), so the week is the viewer's week whatever the server's zone.
-- =============================================================================

create or replace function public.league_week(week_start timestamptz)
returns table (
  id          uuid,
  full_name   text,
  study_group text,
  is_me       boolean,
  points      integer,
  active_days integer
)
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
  events as (
    select user_id, taken_at as at, 10 as pts from public.quiz_attempts
    union all
    select user_id, completed_at, case when game_type = 'daily' then 10 else 5 end from public.game_results
    union all
    select user_id, submitted_at, 15 from public.assignment_submissions
    union all
    select user_id, assessed_at, 5 from public.competency_assessments
    union all
    select user_id, taken_at, 10 from public.diagnostic_attempts
  ),
  per_day as (
    select
      e.user_id,
      floor(extract(epoch from (e.at - week_start)) / 86400)::integer as day,
      least(40, sum(e.pts))::integer as pts
    from events e
    join peers p on p.id = e.user_id
    where e.at >= week_start
      and e.at <  week_start + interval '168 hours'
    group by e.user_id, floor(extract(epoch from (e.at - week_start)) / 86400)
  ),
  totals as (
    select user_id, sum(pts)::integer as points, count(*)::integer as active_days
    from per_day
    group by user_id
  )
  select
    p.id,
    p.full_name,
    p.study_group,
    p.id = auth.uid() as is_me,
    coalesce(t.points, 0),
    coalesce(t.active_days, 0)
  from peers
  join public.profiles p on p.id = peers.id
  left join totals t on t.user_id = p.id
  where auth.uid() is not null
    and p.role = 'student'
  order by coalesce(t.points, 0) desc, p.full_name;
$$;

revoke all on function public.league_week(timestamptz) from public;
revoke execute on function public.league_week(timestamptz) from anon;
grant execute on function public.league_week(timestamptz) to authenticated;
