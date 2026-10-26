-- The three rules the pre/post design depends on (migration 0011).
begin;

select tests.make_user('00000000-0000-0000-0000-00000000000a', 'student', 'Aigerim');
select tests.make_user('00000000-0000-0000-0000-00000000000b', 'student', 'Bauyrzhan');
select tests.make_user('00000000-0000-0000-0000-0000000000c1', 'teacher', 'Teacher One');
insert into public.teacher_links (teacher_id, student_id, status, requested_by)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'accepted',
        '00000000-0000-0000-0000-00000000000a');

do $$
begin
  perform tests.as_user('00000000-0000-0000-0000-00000000000a');

  perform tests.expect(
    tests.raises($q$insert into public.diagnostic_attempts (user_id, phase, score, total)
                    values ('00000000-0000-0000-0000-00000000000a', 'post', 15, 20)$q$),
    'a post-test cannot exist without a pre-test');

  perform tests.expect(
    not tests.raises($q$insert into public.diagnostic_attempts (user_id, phase, score, total)
                    values ('00000000-0000-0000-0000-00000000000a', 'pre', 9, 20)$q$),
    'the pre-test can be taken');
  perform tests.expect(
    tests.raises($q$insert into public.diagnostic_attempts (user_id, phase, score, total)
                    values ('00000000-0000-0000-0000-00000000000a', 'pre', 20, 20)$q$),
    'a second pre-test is refused: one sitting per phase');

  perform tests.expect(
    not tests.raises($q$insert into public.diagnostic_attempts (user_id, phase, score, total)
                    values ('00000000-0000-0000-0000-00000000000a', 'post', 15, 20)$q$),
    'with a pre-test on file, the post-test can be taken');

  -- append-only: nobody can quietly improve a score
  update public.diagnostic_attempts set score = 20 where phase = 'pre';
  perform tests.expect(
    (select score from public.diagnostic_attempts where phase = 'pre') = 9,
    'a student cannot edit the pre-test score (no UPDATE policy: zero rows change)');
  delete from public.diagnostic_attempts where phase = 'pre';
  perform tests.expect(
    (select count(*) from public.diagnostic_attempts where phase = 'pre') = 1,
    'a student cannot delete the pre-test');

  perform tests.expect(
    tests.raises($q$insert into public.diagnostic_attempts (user_id, phase, score, total)
                    values ('00000000-0000-0000-0000-00000000000b', 'pre', 5, 20)$q$),
    'a student cannot sit the test in somebody else''s name');
  -- (as the other student, who has no pre-test yet, so only the constraint can refuse)
  perform tests.as_user('00000000-0000-0000-0000-00000000000b');
  perform tests.expect(
    tests.raises($q$insert into public.diagnostic_attempts (user_id, phase, score, total)
                    values ('00000000-0000-0000-0000-00000000000b', 'pre', 25, 20)$q$),
    'a score beyond the total is refused by the table');
  perform tests.expect(
    tests.raises($q$insert into public.diagnostic_attempts (user_id, phase, score, total)
                    values ('00000000-0000-0000-0000-00000000000b', 'pre', 5, 0)$q$),
    'a test with no questions is refused');
  perform tests.as_user('00000000-0000-0000-0000-00000000000a');

  -- the teacher reads their accepted student's results
  perform tests.as_user('00000000-0000-0000-0000-0000000000c1');
  perform tests.expect(
    (select count(*) from public.diagnostic_attempts) = 2,
    'the teacher sees both sittings of an accepted student');
  perform tests.as_user('00000000-0000-0000-0000-00000000000b');
  perform tests.expect(
    (select count(*) from public.diagnostic_attempts) = 0,
    'another student sees none of it');
end $$;

rollback;
