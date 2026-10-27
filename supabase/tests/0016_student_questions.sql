-- student_questions, review_question(), peer_questions(), question_options_ok() (migration 0016).
begin;

select tests.make_user('00000000-0000-0000-0000-00000000000a', 'student', 'Aigerim');
select tests.make_user('00000000-0000-0000-0000-00000000000b', 'student', 'Bauyrzhan');
select tests.make_user('00000000-0000-0000-0000-00000000000d', 'student', 'Dana');
select tests.make_user('00000000-0000-0000-0000-00000000000e', 'student', 'Emil');      -- another class
select tests.make_user('00000000-0000-0000-0000-00000000000f', 'student', 'Fatima');    -- no class at all
select tests.make_user('00000000-0000-0000-0000-000000000011', 'student', 'Gulnara');   -- asked to join, not yet accepted
select tests.make_user('00000000-0000-0000-0000-0000000000c1', 'teacher', 'Teacher One');
select tests.make_user('00000000-0000-0000-0000-0000000000c2', 'teacher', 'Teacher Two');

insert into public.teacher_links (teacher_id, student_id, status, requested_by) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'accepted', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b', 'accepted', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000d', 'accepted', '00000000-0000-0000-0000-00000000000d'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000e', 'accepted', '00000000-0000-0000-0000-00000000000e'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000011', 'pending', '00000000-0000-0000-0000-000000000011');

do $$
declare
  A constant uuid := '00000000-0000-0000-0000-00000000000a';
  B constant uuid := '00000000-0000-0000-0000-00000000000b';
  D constant uuid := '00000000-0000-0000-0000-00000000000d';
  E constant uuid := '00000000-0000-0000-0000-00000000000e';
  F constant uuid := '00000000-0000-0000-0000-00000000000f';
  G constant uuid := '00000000-0000-0000-0000-000000000011';
  C1 constant uuid := '00000000-0000-0000-0000-0000000000c1';
  C2 constant uuid := '00000000-0000-0000-0000-0000000000c2';
  q1 uuid; q2 uuid; q3 uuid; qe uuid; u uuid; n int; r record;
  tpl constant text := $q$insert into public.student_questions (user_id, lesson_id, question, options, correct_index)
    values (%L, %s, %L, %L::text[], %s)$q$;
  good constant text := 'Жеткілікті ұзын сұрақ мәтіні қандай?';
begin
  -- the options rule on its own
  perform tests.expect(public.question_options_ok(array['а', 'ә', 'б', 'в']), 'four different options are fine');
  perform tests.expect(not public.question_options_ok(array['а', 'ә', 'б']), 'three are not');
  perform tests.expect(not public.question_options_ok(array['а', 'ә', 'б', 'в', 'г']), 'nor five');
  perform tests.expect(not public.question_options_ok(array['а', 'а', 'ә', 'б', 'в']), 'nor five of which only four differ');
  perform tests.expect(not public.question_options_ok(array[['а'], ['ә'], ['б'], ['в']]), 'nor a column of four rows: that is not a list');
  perform tests.expect(not public.question_options_ok(array['а', 'А', 'б', 'в']), 'two options that differ only in case are one option');
  perform tests.expect(not public.question_options_ok(array['а', ' а ', 'б', 'в']), 'or in spaces');
  perform tests.expect(not public.question_options_ok(array['а', '', 'б', 'в']), 'an empty option is not an option');
  perform tests.expect(not public.question_options_ok(array['а', '   ', 'б', 'в']), 'nor one of spaces');
  perform tests.expect(not public.question_options_ok(array['а', null, 'б', 'в']), 'nor a null');
  perform tests.expect(not public.question_options_ok(array['а', repeat('ә', 121), 'б', 'в']), 'nor one of 121 letters');
  perform tests.expect(public.question_options_ok(array['а', repeat('ә', 120), 'б', 'в']), 'but 120 is fine');
  perform tests.expect(not public.question_options_ok(array[['а', 'ә'], ['б', 'в']]), 'a two-dimensional array is not a list of options');
  perform tests.expect(not public.question_options_ok(null), 'null is not a list of options');

  -- Aigerim writes
  perform tests.as_user(A);
  insert into public.student_questions (user_id, lesson_id, question, options, correct_index, explanation)
    values (A, 5, 'Қандай энергия көтерілген тасқа тән?', array['Потенциалдық', 'Кинетикалық', 'Жылулық', 'Ядролық'], 0, 'E = mgh: биіктікке байланысты.')
    returning id into q1;
  perform tests.expect((select status from public.student_questions where id = q1) = 'pending', 'a new question is pending');

  perform tests.expect(tests.raises(format(tpl, B, 5, good, '{а,ә,б,в}', 0)), 'a student cannot write in somebody else''s name');
  perform tests.expect(tests.raises($q$insert into public.student_questions (user_id, lesson_id, question, options, correct_index, status, reviewed_by, reviewed_at)
    values ('00000000-0000-0000-0000-00000000000a', 5, 'Жеткілікті ұзын сұрақ мәтіні қандай?', '{а,ә,б,в}', 0, 'approved', '00000000-0000-0000-0000-00000000000a', now())$q$),
    'a question cannot arrive approved');
  perform tests.expect(tests.raises($q$insert into public.student_questions (user_id, lesson_id, question, options, correct_index, status)
    values ('00000000-0000-0000-0000-00000000000a', 5, 'Жеткілікті ұзын сұрақ мәтіні қандай?', '{а,ә,б,в}', 0, 'approved')$q$),
    'nor with a status alone');
  perform tests.expect(tests.raises($q$insert into public.student_questions (user_id, lesson_id, question, options, correct_index, reviewed_by)
    values ('00000000-0000-0000-0000-00000000000a', 5, 'Жеткілікті ұзын сұрақ мәтіні қандай?', '{а,ә,б,в}', 0, '00000000-0000-0000-0000-0000000000c1')$q$),
    'a pending question cannot claim a reviewer');

  perform tests.expect(tests.raises(format(tpl, A, 5, 'Қысқа?', '{а,ә,б,в}', 0)), 'a 6-letter question is refused');
  perform tests.expect(tests.raises(format(tpl, A, 5, '            ', '{а,ә,б,в}', 0)), 'a question of spaces is refused');
  perform tests.expect(tests.raises(format(tpl, A, 5, repeat('а', 301), '{а,ә,б,в}', 0)), 'a 301-letter question is refused');
  perform tests.expect(tests.raises(format(tpl, A, 5, good, '{а,ә,б}', 0)), 'three options are refused');
  perform tests.expect(tests.raises(format(tpl, A, 5, good, '{а,ә,б,в,г}', 0)), 'five options are refused');
  perform tests.expect(tests.raises(format(tpl, A, 5, good, '{а,а,б,в}', 0)), 'two equal options are refused');
  perform tests.expect(tests.raises(format(tpl, A, 5, good, '{а,ә,б,в}', 4)), 'a right answer number 4 (of 0-3) is refused');
  perform tests.expect(tests.raises(format(tpl, A, 5, good, '{а,ә,б,в}', -1)), 'and −1');
  perform tests.expect(tests.raises(format(tpl, A, 0, good, '{а,ә,б,в}', 0)), 'lesson 0 is refused');
  perform tests.expect(tests.raises(format(tpl, A, 1000, good, '{а,ә,б,в}', 0)), 'lesson 1000 is refused');
  perform tests.expect(tests.raises(format($q$insert into public.student_questions (user_id, lesson_id, question, options, correct_index, explanation)
    values (%L, 5, %L, '{а,ә,б,в}', 0, %L)$q$, A, good, repeat('а', 301))), 'a 301-letter explanation is refused');
  perform tests.expect(not tests.raises(format($q$insert into public.student_questions (user_id, lesson_id, question, options, correct_index, explanation)
    values (%L, 999, %L, %L::text[], 3, %L)$q$, A, repeat('а', 300), format('{%s,%s,%s,%s}', repeat('а', 120), repeat('ә', 120), repeat('б', 120), repeat('в', 120)), repeat('а', 300))),
    'the upper bounds themselves are allowed');

  -- at most ten waiting (two are in already)
  for i in 1..8 loop
    insert into public.student_questions (user_id, lesson_id, question, options, correct_index)
      values (A, 2, format('Жеткілікті ұзын сұрақ мәтіні № %s?', i), array['а', 'ә', 'б', 'в'], 1);
  end loop;
  perform tests.expect(tests.raises(format(tpl, A, 2, 'Он бірінші сұрақ мәтіні қандай?', '{а,ә,б,в}', 0)), 'an eleventh waiting question is refused');
  delete from public.student_questions where user_id = A and id <> q1;
  perform tests.expect((select count(*) from public.student_questions) = 1, 'a student can delete their own questions');

  insert into public.student_questions (user_id, lesson_id, question, options, correct_index)
    values (A, 5, 'Жұмыс қандай бірлікпен өлшенеді екен?', array['Джоуль', 'Ньютон', 'Ватт', 'Паскаль'], 0) returning id into q2;
  insert into public.student_questions (user_id, lesson_id, question, options, correct_index)
    values (A, 3, 'Үйкеліс күші қайда бағытталған болады?', array['Қозғалысқа қарсы', 'Қозғалыс жағына', 'Жоғары', 'Төмен'], 0) returning id into q3;

  update public.student_questions set status = 'approved', reviewed_by = A, reviewed_at = now() where id = q1;
  perform tests.expect((select count(*) from public.student_questions where status = 'approved') = 0, 'a student cannot approve their own question by UPDATE');
  update public.student_questions set correct_index = 2 where id = q1;
  perform tests.expect((select correct_index from public.student_questions where id = q1) = 0, 'nor change its right answer');

  perform tests.as_user(C1);
  perform tests.expect(tests.raises(format(tpl, C1, 5, good, '{а,ә,б,в}', 0)), 'a teacher cannot write questions here');
  perform tests.expect((select count(*) from public.student_questions) = 3, 'the author''s teacher reads all three');
  delete from public.student_questions where user_id = A;
  perform tests.expect((select count(*) from public.student_questions) = 3, 'but cannot delete them');
  perform tests.as_user(C2);
  perform tests.expect((select count(*) from public.student_questions) = 0, 'another teacher reads none');
  foreach u in array array[B, F, G] loop
    perform tests.as_user(u);
    perform tests.expect((select count(*) from public.student_questions) = 0, 'a classmate (or a stranger) reads none of the raw rows');
    perform tests.expect((select count(*) from public.peer_questions(5)) = 0, 'and gets none of the pending questions to practise on');
  end loop;

  perform tests.as_admin();
  update public.student_questions set created_at = '2027-01-01' where id = q2;
  perform tests.as_user(A);

  -- review: who may
  perform tests.as_user(B);
  perform tests.expect(tests.raises(format('select public.review_question(%L, true)', q1)), 'a classmate cannot approve');
  perform tests.as_user(A);
  perform tests.expect(tests.raises(format('select public.review_question(%L, true)', q1)), 'nor the author');
  perform tests.as_user(C2);
  perform tests.expect(tests.raises(format('select public.review_question(%L, true)', q1)), 'nor another class''s teacher');
  perform tests.as_nobody();
  perform tests.expect(tests.raises(format('select public.review_question(%L, true)', q1)), 'nor anyone not signed in');
  perform tests.as_user(C1);
  perform tests.expect(tests.raises($q$select public.review_question('00000000-0000-0000-0000-000000000999', true)$q$), 'an unknown question is an error');
  perform public.review_question(q1, true);
  perform public.review_question(q2, true);
  perform public.review_question(q3, false);
  select * into r from public.student_questions where id = q1;
  perform tests.expect(r.status = 'approved' and r.reviewed_by = C1 and r.reviewed_at is not null, 'approval records who and when');
  perform tests.expect((select status from public.student_questions where id = q3) = 'rejected', 'and rejection');

  -- practice: classmates' approved questions, by lesson
  perform tests.as_user(B);
  select count(*) into n from public.peer_questions(5);
  perform tests.expect(n = 2, format('a classmate gets the two approved lesson-5 questions, got %s', n));
  perform tests.expect((select count(*) from public.peer_questions(3)) = 0, 'none for lesson 3: that one was rejected');
  perform tests.expect((select count(*) from public.peer_questions(9)) = 0, 'and none for a lesson nobody wrote for');
  select * into r from public.peer_questions(5) where id = q1;
  perform tests.expect(r.question = 'Қандай энергия көтерілген тасқа тән?' and r.options[1] = 'Потенциалдық' and r.correct_index = 0 and r.explanation like 'E = mgh%', 'with the options, the right answer and the explanation');
  perform tests.expect((select array_agg(id order by ord) from (select id, row_number() over () ord from public.peer_questions(5)) f) = array[q1, q2],
    'the practice order is oldest first, so a class meets the questions in the order they were written');
  perform tests.expect(
    (select count(*) from information_schema.parameters where specific_name like 'peer_questions%' and parameter_mode = 'OUT') = 6,
    'six columns: no author, no status, no timestamps');
  perform tests.as_user(A);
  perform tests.expect((select count(*) from public.peer_questions(5)) = 0, 'a student is not served their own questions');
  perform tests.as_user(D);
  perform tests.expect((select count(*) from public.peer_questions(5)) = 2, 'another classmate gets them too');
  foreach u in array array[E, F, G, C1, C2] loop
    perform tests.as_user(u);
    perform tests.expect((select count(*) from public.peer_questions(5)) = 0, 'a student of another class, one with no class, a pending one, or a teacher gets none');
  end loop;
  perform tests.as_nobody();
  perform tests.expect(tests.raises('select * from public.peer_questions(5)'), 'not for anonymous callers');

  -- another class's questions stay in that class
  perform tests.as_user(E);
  insert into public.student_questions (user_id, lesson_id, question, options, correct_index)
    values (E, 5, 'Эмильдің сұрағы: импульс дегеніміз не?', array['mv', 'ma', 'mg', 'mh'], 0) returning id into qe;
  perform tests.as_user(C2);
  perform public.review_question(qe, true);
  perform tests.as_user(C1);
  perform tests.expect(tests.raises(format('select public.review_question(%L, true)', qe)), 'a teacher cannot review another class''s question');
  perform tests.as_user(B);
  perform tests.expect((select count(*) from public.peer_questions(5)) = 2, 'and it is not served to a student of the first class');

  -- a teacher may change their mind
  perform tests.as_user(C1);
  perform public.review_question(q3, true);
  perform tests.expect((select status from public.student_questions where id = q3) = 'approved', 'a rejected question can be approved later');
  perform public.review_question(q2, false);
  perform tests.as_user(B);
  perform tests.expect((select count(*) from public.peer_questions(5)) = 1, 'and an approved one withdrawn leaves the practice at once');

  -- deleting
  perform tests.as_user(B);
  delete from public.student_questions where id = q1;
  perform tests.as_admin();
  perform tests.expect((select count(*) from public.student_questions where id = q1) = 1, 'a classmate cannot delete my question');
  perform tests.as_user(A);
  delete from public.student_questions where id = q1;
  perform tests.as_admin();
  perform tests.expect((select count(*) from public.student_questions where id = q1) = 0, 'the author can');
end $$;

rollback;
