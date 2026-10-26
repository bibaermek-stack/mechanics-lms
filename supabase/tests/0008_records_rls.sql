-- Who can read and write the learning records (migration 0008).
begin;

select tests.make_user('00000000-0000-0000-0000-00000000000a', 'student', 'Aigerim');
select tests.make_user('00000000-0000-0000-0000-00000000000b', 'student', 'Bauyrzhan');
select tests.make_user('00000000-0000-0000-0000-0000000000c1', 'teacher', 'Teacher One');
select tests.make_user('00000000-0000-0000-0000-0000000000c2', 'teacher', 'Teacher Two');

-- Teacher One has accepted Aigerim only.
insert into public.teacher_links (teacher_id, student_id, status, requested_by)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'accepted',
        '00000000-0000-0000-0000-00000000000a');

insert into public.quiz_attempts (user_id, module_id, score, total) values
  ('00000000-0000-0000-0000-00000000000a', 1, 8, 10),
  ('00000000-0000-0000-0000-00000000000b', 1, 3, 10);
insert into public.game_results (user_id, module_id, game_type, score) values
  ('00000000-0000-0000-0000-00000000000a', 1, 'blitz', 70),
  ('00000000-0000-0000-0000-00000000000b', 1, 'blitz', 20);

do $$
declare n int;
begin
  -- a student sees only their own rows
  perform tests.as_user('00000000-0000-0000-0000-00000000000a');
  select count(*) into n from public.quiz_attempts;
  perform tests.expect(n = 1, 'a student reads only their own quiz attempts');
  select count(*) into n from public.game_results;
  perform tests.expect(n = 1, 'a student reads only their own game results');

  -- and may not write for somebody else
  perform tests.expect(
    tests.raises($q$insert into public.game_results (user_id, module_id, game_type, score)
                    values ('00000000-0000-0000-0000-00000000000b', 1, 'memory', 100)$q$),
    'a student cannot insert a result for another student');
  perform tests.expect(
    not tests.raises($q$insert into public.game_results (user_id, module_id, game_type, score)
                    values ('00000000-0000-0000-0000-00000000000a', 0, 'daily', 80)$q$),
    'a student can insert their own result, including the daily challenge (lesson 0)');

  -- scores outside 0..100 are refused by the table itself
  perform tests.expect(
    tests.raises($q$insert into public.game_results (user_id, module_id, game_type, score)
                    values ('00000000-0000-0000-0000-00000000000a', 1, 'memory', 101)$q$),
    'a game score above 100 is refused');
  perform tests.expect(
    tests.raises($q$insert into public.quiz_attempts (user_id, module_id, score, total)
                    values ('00000000-0000-0000-0000-00000000000a', 1, 11, 10)$q$),
    'a quiz score above its total is refused');

  -- a teacher sees the students they accepted, and only those
  perform tests.as_user('00000000-0000-0000-0000-0000000000c1');
  select count(*) into n from public.quiz_attempts;
  perform tests.expect(n = 1, 'a teacher reads the accepted student''s quiz attempts, not the other student''s');
  select count(*) into n from public.game_results where user_id = '00000000-0000-0000-0000-00000000000b';
  perform tests.expect(n = 0, 'a teacher cannot read a student who has not accepted them');

  perform tests.as_user('00000000-0000-0000-0000-0000000000c2');
  select count(*) into n from public.quiz_attempts;
  perform tests.expect(n = 0, 'a teacher with no students reads nothing');

  -- a stranger with no session reads nothing
  perform tests.as_nobody();
  select count(*) into n from public.quiz_attempts;
  perform tests.expect(n = 0, 'an anonymous caller reads nothing');
end $$;

rollback;
