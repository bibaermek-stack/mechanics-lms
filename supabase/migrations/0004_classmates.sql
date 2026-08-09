-- =============================================================================
-- classmates() — the leaderboard's data source
-- =============================================================================
-- Run after 0003. Dashboard → SQL Editor → paste → Run.
--
-- The leaderboard was a hardcoded list of five names, so a new account saw
-- strangers ranked above them and could not find themselves. A real one needs
-- to read other students' profiles, which RLS correctly forbids: a student may
-- only see people they share an edge with, and two students share no edge.
--
-- So, like search_people, this is a narrow SECURITY DEFINER window: it returns
-- only the people who study under the same teacher as the caller, and only the
-- columns a ranking needs. No email, no group, nothing that is not already
-- visible in a classroom.
-- =============================================================================

create or replace function public.classmates()
returns table (
  id               uuid,
  full_name        text,
  avatar_url       text,
  xp               integer,
  competency_score integer,
  is_me            boolean
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
    -- Everyone accepted by any of my teachers…
    select distinct l.student_id as id
    from public.teacher_links l
    join my_teachers t on t.teacher_id = l.teacher_id
    where l.status = 'accepted'
    union
    -- …and myself, so the list is never empty and I can always find my row.
    select auth.uid()
  )
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.xp,
    p.competency_score,
    p.id = auth.uid() as is_me
  from peers
  join public.profiles p on p.id = peers.id
  where auth.uid() is not null
    and p.role = 'student'
  order by p.xp desc, p.full_name;
$$;

revoke all on function public.classmates() from public;
revoke all on function public.classmates() from anon;
grant execute on function public.classmates() to authenticated;
