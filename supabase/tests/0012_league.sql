-- league_week() (migration 0012): the same week as "the same rule as the database" in
-- src/lib/league.test.ts, and who is allowed to see whom.
begin;

select tests.make_user('00000000-0000-0000-0000-00000000000a', 'student', 'Aigerim',   'МТ-21');
select tests.make_user('00000000-0000-0000-0000-00000000000b', 'student', 'Bauyrzhan', 'МТ-21');
select tests.make_user('00000000-0000-0000-0000-00000000000d', 'student', 'Dana',      'МТ-22');
select tests.make_user('00000000-0000-0000-0000-00000000000e', 'student', 'Ernar',     'МТ-22');
select tests.make_user('00000000-0000-0000-0000-00000000000f', 'student', 'Fatima',    'МТ-21');  -- no teacher
select tests.make_user('00000000-0000-0000-0000-0000000000c1', 'teacher', 'Teacher One');
select tests.make_user('00000000-0000-0000-0000-0000000000a1', 'student', 'Pending', 'МТ-21');

insert into public.teacher_links (teacher_id, student_id, status, requested_by)
select '00000000-0000-0000-0000-0000000000c1', s, 'accepted', s
from unnest(array[
  '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
  '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e']::uuid[]) s;
insert into public.teacher_links (teacher_id, student_id, status, requested_by)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'pending',
        '00000000-0000-0000-0000-0000000000a1');

-- Monday 26 October 2026, 00:00 UTC is the start of the week.
create temp table wk as select timestamptz '2026-10-26 00:00:00+00' as t;

-- Aigerim: Mon 5 quizzes (50, capped at 40) · Thu quiz 10 + game 5 + daily 10 · Sat БӨЖ 15 · Sun game 5
insert into public.quiz_attempts (user_id, module_id, score, total, taken_at)
select '00000000-0000-0000-0000-00000000000a', 1, 5, 10, (select t from wk) + h * interval '1 hour'
from unnest(array[9, 10, 11, 12, 13]) h;
insert into public.quiz_attempts (user_id, module_id, score, total, taken_at)
values ('00000000-0000-0000-0000-00000000000a', 2, 5, 10, (select t from wk) + interval '3 days 9 hours');
insert into public.game_results (user_id, module_id, game_type, score, completed_at) values
  ('00000000-0000-0000-0000-00000000000a', 1, 'memory', 50, (select t from wk) + interval '3 days 10 hours'),
  ('00000000-0000-0000-0000-00000000000a', 0, 'daily',  50, (select t from wk) + interval '3 days 11 hours'),
  ('00000000-0000-0000-0000-00000000000a', 1, 'blitz',  50, (select t from wk) + interval '6 days 22 hours');
insert into public.assignment_submissions (user_id, module_id, type, content, submitted_at)
values ('00000000-0000-0000-0000-00000000000a', 1, 'text', 'x', (select t from wk) + interval '5 days 8 hours');

-- Bauyrzhan: one game, Tuesday at 23:59
insert into public.game_results (user_id, module_id, game_type, score, completed_at)
values ('00000000-0000-0000-0000-00000000000b', 1, 'memory', 50, (select t from wk) + interval '1 day 23 hours 59 minutes');

-- Dana: a quiz at the very first instant, then Wednesday an assessment and a diagnostic
insert into public.quiz_attempts (user_id, module_id, score, total, taken_at)
values ('00000000-0000-0000-0000-00000000000d', 1, 5, 10, (select t from wk));
insert into public.competency_assessments (user_id, module_id, average_level, percent, assessor_type, assessed_at)
values ('00000000-0000-0000-0000-00000000000d', 1, 3, 60, 'self', (select t from wk) + interval '2 days 12 hours');
insert into public.diagnostic_attempts (user_id, phase, score, total, taken_at)
values ('00000000-0000-0000-0000-00000000000d', 'pre', 10, 20, (select t from wk) + interval '2 days 13 hours');

-- Ernar: one record an hour before the week, one at the first instant of the next
insert into public.quiz_attempts (user_id, module_id, score, total, taken_at) values
  ('00000000-0000-0000-0000-00000000000e', 1, 5, 10, (select t from wk) - interval '1 hour'),
  ('00000000-0000-0000-0000-00000000000e', 1, 5, 10, (select t from wk) + interval '168 hours');

-- Fatima has no teacher, but studied hard; nobody should see it.
insert into public.quiz_attempts (user_id, module_id, score, total, taken_at)
values ('00000000-0000-0000-0000-00000000000f', 1, 5, 10, (select t from wk) + interval '1 day');

grant select on wk to authenticated, anon;

do $$
declare
  w timestamptz := (select t from wk);
  r record; n int;
begin
  perform tests.as_user('00000000-0000-0000-0000-00000000000a');

  select count(*) into n from public.league_week(w);
  perform tests.expect(n = 4, format('Aigerim sees her three classmates and herself (4), got %s', n));
  perform tests.expect(
    not exists (select 1 from public.league_week(w) where full_name in ('Fatima', 'Teacher One', 'Pending')),
    'a student with no teacher, the teacher and a not-yet-accepted student are not in the league');

  select * into r from public.league_week(w) where full_name = 'Aigerim';
  perform tests.expect(r.points = 85 and r.active_days = 4,
    format('Aigerim: 40 (capped Monday) + 25 + 15 + 5 = 85 over 4 days, got %s over %s', r.points, r.active_days));
  perform tests.expect(r.is_me and r.study_group = 'МТ-21', 'she is flagged as me, with her group');

  select * into r from public.league_week(w) where full_name = 'Bauyrzhan';
  perform tests.expect(r.points = 5 and r.active_days = 1 and not r.is_me, 'Bauyrzhan: 5 over 1 day (23:59 Tuesday is still Tuesday)');

  select * into r from public.league_week(w) where full_name = 'Dana';
  perform tests.expect(r.points = 25 and r.active_days = 2 and r.study_group = 'МТ-22',
    format('Dana: Monday 00:00 sharp counts (10) + Wednesday 15 = 25 over 2 days, got %s over %s', r.points, r.active_days));

  select * into r from public.league_week(w) where full_name = 'Ernar';
  perform tests.expect(r.points = 0 and r.active_days = 0, 'Ernar: a minute before and the first instant of next week both fall outside');

  -- no marks leave the function: only these six columns
  perform tests.expect(
    (select count(*) from information_schema.parameters where specific_name like 'league_week%' and parameter_mode = 'OUT') = 6,
    'the function returns exactly six columns — no scores, no emails');

  -- the records that fell outside this week belong to the weeks either side of it
  select count(*) into n from public.league_week(w - interval '7 days') where points > 0;
  perform tests.expect(n = 1 and (select points from public.league_week(w - interval '7 days') where full_name = 'Ernar') = 10,
    'last week holds only Ernar''s record from the hour before this one');
  select count(*) into n from public.league_week(w + interval '7 days') where points > 0;
  perform tests.expect(n = 1 and (select points from public.league_week(w + interval '7 days') where full_name = 'Ernar') = 10,
    'next week holds only his record from the first instant after this one');

  -- Fatima: alone, sees only herself
  perform tests.as_user('00000000-0000-0000-0000-00000000000f');
  select count(*) into n from public.league_week(w);
  perform tests.expect(n = 1, 'a student nobody has accepted sees only themselves');
  select points into n from public.league_week(w);
  perform tests.expect(n = 10, 'and her own 10 points (one quiz)');

  -- a pending applicant sees only themselves too
  perform tests.as_user('00000000-0000-0000-0000-0000000000a1');
  select count(*) into n from public.league_week(w);
  perform tests.expect(n = 1, 'a student whose request is still pending sees only themselves');

  -- the teacher is not a student: nothing comes back
  perform tests.as_user('00000000-0000-0000-0000-0000000000c1');
  select count(*) into n from public.league_week(w);
  perform tests.expect(n = 0, 'a teacher gets no rows (the league is between students)');

  -- and an anonymous caller may not call it at all
  perform tests.as_nobody();
  perform tests.expect(tests.raises($q$select * from public.league_week(now())$q$), 'an anonymous caller is refused');
end $$;

rollback;
