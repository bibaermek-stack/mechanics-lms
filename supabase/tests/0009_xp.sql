-- The XP rule (migration 0009) against a total worked out by hand.
--
-- src/lib/xp.test.ts runs the very same records through the TypeScript copy of the
-- rule and expects the very same number. If you change the rule, change both.
begin;

select tests.make_user('00000000-0000-0000-0000-00000000000a', 'student', 'Aigerim');
select tests.make_user('00000000-0000-0000-0000-0000000000c1', 'teacher', 'Teacher One');

-- Quizzes: best attempt per lesson.  Lesson 1: 6/10 and 9/10 -> 90.  Lesson 2: 10/10 -> 100.
insert into public.quiz_attempts (user_id, module_id, score, total) values
  ('00000000-0000-0000-0000-00000000000a', 1, 6, 10),
  ('00000000-0000-0000-0000-00000000000a', 1, 9, 10),
  ('00000000-0000-0000-0000-00000000000a', 2, 10, 10);
-- Games: best per (lesson, game) x 0.5.  memory: 50, 70 -> 35.  blitz 100 -> 50.  daily (lesson 0) 80 -> 40.
insert into public.game_results (user_id, module_id, game_type, score) values
  ('00000000-0000-0000-0000-00000000000a', 1, 'memory', 50),
  ('00000000-0000-0000-0000-00000000000a', 1, 'memory', 70),
  ('00000000-0000-0000-0000-00000000000a', 1, 'blitz', 100),
  ('00000000-0000-0000-0000-00000000000a', 0, 'daily', 80);
-- БӨЖ: reviewed grade x 0.8, every one counts.  85 -> 68, 50 -> 40; the pending one counts for nothing, even with a grade on it.
insert into public.assignment_submissions (user_id, module_id, type, content, status, grade) values
  ('00000000-0000-0000-0000-00000000000a', 1, 'text', 'a', 'reviewed', 85),
  ('00000000-0000-0000-0000-00000000000a', 2, 'text', 'b', 'reviewed', 50),
  ('00000000-0000-0000-0000-00000000000a', 3, 'text', 'c', 'pending', 100);
-- Rubric: best per lesson x 0.4.  Lesson 1: 60, 80 -> 32.  Lesson 2: 70 -> 28.
insert into public.competency_assessments (user_id, module_id, average_level, percent, assessor_type) values
  ('00000000-0000-0000-0000-00000000000a', 1, 3.0, 60, 'self'),
  ('00000000-0000-0000-0000-00000000000a', 1, 4.0, 80, 'self'),
  ('00000000-0000-0000-0000-00000000000a', 2, 3.5, 70, 'self');

do $$
declare total int;
begin
  -- 190 (quizzes) + 125 (games) + 108 (БӨЖ) + 60 (rubric) = 483
  select public.compute_xp('00000000-0000-0000-0000-00000000000a') into total;
  perform tests.expect(total = 483, format('compute_xp is 483 (190 + 125 + 108 + 60), got %s', total));

  -- the triggers keep the stored figure current without anyone calling anything
  perform tests.expect(
    (select xp from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 483,
    'profiles.xp followed the writes by itself');

  -- a lower score does not take XP away
  insert into public.game_results (user_id, module_id, game_type, score)
  values ('00000000-0000-0000-0000-00000000000a', 1, 'memory', 10);
  perform tests.expect(
    (select xp from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 483,
    'a worse replay does not lower XP (best per lesson and game counts)');

  -- a better one raises it by exactly the difference: memory 70 -> 100 is 35 -> 50
  insert into public.game_results (user_id, module_id, game_type, score)
  values ('00000000-0000-0000-0000-00000000000a', 1, 'memory', 100);
  perform tests.expect(
    (select xp from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 498,
    'a better replay adds only the difference (483 + 15 = 498)');

  -- half-points round up, the same way Math.round does for these positive numbers:
  -- 75 x 0.5 = 37.5 -> 38; 1 of 8 = 12.5 % -> 13
  insert into public.game_results (user_id, module_id, game_type, score)
  values ('00000000-0000-0000-0000-00000000000a', 5, 'order', 75);
  perform tests.expect(
    (select xp from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 498 + 38,
    'x.5 rounds up (75 -> 38)');
  insert into public.quiz_attempts (user_id, module_id, score, total)
  values ('00000000-0000-0000-0000-00000000000a', 7, 1, 8);
  perform tests.expect(
    (select xp from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 498 + 38 + 13,
    '12.5 % rounds up to 13');
end $$;

rollback;
