-- =============================================================================
-- XP — ұпай жинау
-- =============================================================================
-- Run after 0008. Dashboard → SQL Editor → paste → Run.
--
-- profiles.xp has existed since 0001 and has been read the whole time — the
-- leaderboard ranks by it, the dashboard shows it — while nothing ever wrote
-- to it. So the ranking was a list of zeros in a stable order.
--
-- XP is *derived*, not accumulated. It is recomputed from the records a
-- student already has rather than incremented on each event, because an
-- incrementing counter drifts the first time a write is retried, an insert is
-- rolled back, or a row is deleted — and there is no way to audit it back. A
-- recomputation is idempotent: run it twice, get the same number.
--
-- The scoring rule, once, here, so the dashboard and the leaderboard can never
-- disagree about it:
--   quiz      best attempt per lesson,      up to 100 XP
--   game      best result per lesson+type,  up to  50 XP
--   БӨЖ       graded work,                  up to  80 XP
--   duel      a win 30 XP, a draw 10 XP
--   rubric    latest assessment per lesson, up to  40 XP
-- "Best per lesson" throughout: retaking a quiz should improve a score, not
-- farm the counter.
-- =============================================================================

create or replace function public.compute_xp(target uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  with quiz as (
    select coalesce(sum(best), 0) as xp from (
      select max(round(100.0 * score / total)) as best
      from public.quiz_attempts
      where user_id = target
      group by module_id
    ) q
  ),
  games as (
    select coalesce(sum(best), 0) as xp from (
      select max(round(score * 0.5)) as best
      from public.game_results
      where user_id = target
      group by module_id, game_type
    ) g
  ),
  work as (
    select coalesce(sum(round(grade * 0.8)), 0) as xp
    from public.assignment_submissions
    where user_id = target and status = 'reviewed' and grade is not null
  ),
  duels as (
    select coalesce(sum(
      case
        when mine > theirs then 30
        when mine = theirs then 10
        else 0
      end
    ), 0) as xp
    from (
      select
        case when d.challenger_id = target then d.challenger_score else d.opponent_score end as mine,
        case when d.challenger_id = target then d.opponent_score else d.challenger_score end as theirs
      from public.game_duels d
      where (d.challenger_id = target or d.opponent_id = target)
        and d.challenger_score is not null
        and d.opponent_score is not null
    ) x
  ),
  rubric as (
    select coalesce(sum(best), 0) as xp from (
      select max(round(percent * 0.4)) as best
      from public.competency_assessments
      where user_id = target
      group by module_id
    ) r
  )
  select (quiz.xp + games.xp + work.xp + duels.xp + rubric.xp)::integer
  from quiz, games, work, duels, rubric;
$$;

/**
 * Write the recomputed total onto the profile.
 *
 * profiles has a BEFORE UPDATE trigger that freezes role and user_code; xp is
 * not one of the frozen columns, so a plain update is enough.
 */
create or replace function public.refresh_xp(target uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  total integer;
begin
  total := public.compute_xp(target);
  update public.profiles set xp = total where id = target;
  return total;
end;
$$;

/** Recompute my own XP. The only entry point a client needs. */
create or replace function public.refresh_my_xp()
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  select public.refresh_xp(auth.uid());
$$;

revoke all on function public.refresh_xp(uuid) from public, anon, authenticated;
revoke all on function public.compute_xp(uuid) from public, anon;
grant execute on function public.compute_xp(uuid) to authenticated;
grant execute on function public.refresh_my_xp() to authenticated;

-- -----------------------------------------------------------------------------
-- Keep it current without the client having to remember.
--
-- Every table that feeds the total refreshes the owner's XP on write. The
-- student's own actions cover four of the five; the fifth — a teacher grading
-- БӨЖ, or an opponent finishing a duel — is somebody *else's* write changing
-- *your* total, which is exactly the case a client-side call would miss.
-- -----------------------------------------------------------------------------
create or replace function public.touch_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'game_duels' then
    -- Both sides can change on one row, so both are recomputed.
    perform public.refresh_xp(new.challenger_id);
    perform public.refresh_xp(new.opponent_id);
  else
    perform public.refresh_xp(new.user_id);
  end if;
  return null; -- AFTER trigger; the return value is ignored
end;
$$;

drop trigger if exists quiz_xp on public.quiz_attempts;
create trigger quiz_xp after insert on public.quiz_attempts
  for each row execute function public.touch_xp();

drop trigger if exists games_xp on public.game_results;
create trigger games_xp after insert on public.game_results
  for each row execute function public.touch_xp();

drop trigger if exists subs_xp on public.assignment_submissions;
create trigger subs_xp after insert or update on public.assignment_submissions
  for each row execute function public.touch_xp();

drop trigger if exists assess_xp on public.competency_assessments;
create trigger assess_xp after insert on public.competency_assessments
  for each row execute function public.touch_xp();

drop trigger if exists duels_xp on public.game_duels;
create trigger duels_xp after update on public.game_duels
  for each row execute function public.touch_xp();

-- Backfill anyone who already has records from before this migration.
update public.profiles p
   set xp = public.compute_xp(p.id)
 where p.role = 'student';
