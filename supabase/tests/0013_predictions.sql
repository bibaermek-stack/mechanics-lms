-- prediction_attempts (migration 0013): who sees what, and what cannot be undone.
begin;

select tests.make_user('00000000-0000-0000-0000-00000000000a', 'student', 'Aigerim');
select tests.make_user('00000000-0000-0000-0000-00000000000b', 'student', 'Bauyrzhan');
select tests.make_user('00000000-0000-0000-0000-0000000000c1', 'teacher', 'Teacher One');
select tests.make_user('00000000-0000-0000-0000-0000000000c2', 'teacher', 'Teacher Two');
insert into public.teacher_links (teacher_id, student_id, status, requested_by)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'accepted',
        '00000000-0000-0000-0000-00000000000a');

insert into public.prediction_attempts (user_id, item_id, option_id, correct, misconception, confidence) values
  ('00000000-0000-0000-0000-00000000000a', 'heavy-light', 'heavy', false, 'heavy-falls-faster', 3),
  ('00000000-0000-0000-0000-00000000000b', 'heavy-light', 'same',  true,  null, 2);

do $$
declare n int;
begin
  perform tests.as_user('00000000-0000-0000-0000-00000000000a');

  select count(*) into n from public.prediction_attempts;
  perform tests.expect(n = 1, 'a student reads only their own predictions');

  perform tests.expect(
    not tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                        values ('00000000-0000-0000-0000-00000000000a', 'truck-car', 'equal', true, 1)$q$),
    'a student can record their own prediction');
  perform tests.expect(
    tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                    values ('00000000-0000-0000-0000-00000000000b', 'truck-car', 'equal', true, 1)$q$),
    'but not in somebody else''s name');

  -- retaking an item is a new row, never an overwrite
  perform tests.expect(
    not tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                        values ('00000000-0000-0000-0000-00000000000a', 'heavy-light', 'same', true, 3)$q$),
    'a student may retake an item: it is a second row');
  select count(*) into n from public.prediction_attempts where item_id = 'heavy-light';
  perform tests.expect(n = 2, 'both attempts are kept');

  -- what was first believed cannot be rewritten or removed
  update public.prediction_attempts set correct = true, misconception = null
    where item_id = 'heavy-light' and option_id = 'heavy';
  perform tests.expect(
    (select correct from public.prediction_attempts where item_id = 'heavy-light' and option_id = 'heavy') = false,
    'a student cannot edit a prediction after seeing the answer (no UPDATE policy)');
  delete from public.prediction_attempts where item_id = 'heavy-light' and option_id = 'heavy';
  perform tests.expect(
    (select count(*) from public.prediction_attempts where item_id = 'heavy-light' and option_id = 'heavy') = 1,
    'nor delete it');

  -- the table's own rules
  perform tests.expect(
    tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                    values ('00000000-0000-0000-0000-00000000000a', 'x', 'y', true, 4)$q$),
    'a confidence above 3 is refused');
  perform tests.expect(
    tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                    values ('00000000-0000-0000-0000-00000000000a', 'x', 'y', true, 0)$q$),
    'a confidence of 0 is refused');
  perform tests.expect(
    tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, misconception, confidence)
                    values ('00000000-0000-0000-0000-00000000000a', 'x', 'y', true, 'heavy-falls-faster', 2)$q$),
    'a right answer cannot carry a misconception');
  perform tests.expect(
    not tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, misconception, confidence)
                        values ('00000000-0000-0000-0000-00000000000a', 'x', 'y', false, 'heavy-falls-faster', 2)$q$),
    'a wrong answer can');
  perform tests.expect(
    tests.raises(format($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                    values ('00000000-0000-0000-0000-00000000000a', %L, 'y', true, 1)$q$, repeat('x', 81))),
    'an item id of 81 characters is refused');
  perform tests.expect(
    tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                    values ('00000000-0000-0000-0000-00000000000a', '', 'y', true, 1)$q$),
    'an empty item id is refused');

  -- a teacher sees the students they accepted, and only them
  perform tests.as_user('00000000-0000-0000-0000-0000000000c1');
  select count(*) into n from public.prediction_attempts;
  perform tests.expect(n = 4, format('the teacher sees Aigerim''s four rows (and not Bauyrzhan''s), got %s', n));
  perform tests.expect(
    tests.raises($q$insert into public.prediction_attempts (user_id, item_id, option_id, correct, confidence)
                    values ('00000000-0000-0000-0000-00000000000a', 'z', 'y', true, 1)$q$),
    'a teacher cannot write a prediction for a student');

  perform tests.as_user('00000000-0000-0000-0000-0000000000c2');
  select count(*) into n from public.prediction_attempts;
  perform tests.expect(n = 0, 'a teacher with no accepted students sees nothing');

  perform tests.as_nobody();
  select count(*) into n from public.prediction_attempts;
  perform tests.expect(n = 0, 'an anonymous caller sees nothing');
end $$;

rollback;
