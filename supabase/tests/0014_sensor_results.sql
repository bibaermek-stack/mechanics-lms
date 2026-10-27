-- sensor_results and class_jump_bests() (migration 0014).
begin;

select tests.make_user('00000000-0000-0000-0000-00000000000a', 'student', 'Aigerim');
select tests.make_user('00000000-0000-0000-0000-00000000000b', 'student', 'Bauyrzhan');
select tests.make_user('00000000-0000-0000-0000-00000000000d', 'student', 'Dana');
select tests.make_user('00000000-0000-0000-0000-00000000000f', 'student', 'Fatima');   -- no teacher
select tests.make_user('00000000-0000-0000-0000-0000000000c1', 'teacher', 'Teacher One');
select tests.make_user('00000000-0000-0000-0000-0000000000c2', 'teacher', 'Teacher Two');

insert into public.teacher_links (teacher_id, student_id, status, requested_by)
select '00000000-0000-0000-0000-0000000000c1', s, 'accepted', s
from unnest(array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
                  '00000000-0000-0000-0000-00000000000d']::uuid[]) s;

insert into public.sensor_results (user_id, kind, value, unit) values
  ('00000000-0000-0000-0000-00000000000a', 'jump', 0.30, 'м'),
  ('00000000-0000-0000-0000-00000000000a', 'jump', 0.42, 'м'),     -- her best
  ('00000000-0000-0000-0000-00000000000a', 'rest-g', 9.78, 'м/с²'),
  ('00000000-0000-0000-0000-00000000000b', 'jump', 0.25, 'м'),
  ('00000000-0000-0000-0000-00000000000d', 'jump', 0.55, 'м'),
  ('00000000-0000-0000-0000-00000000000d', 'pendulum', 2.0, 'с'),  -- not a jump
  ('00000000-0000-0000-0000-00000000000f', 'jump', 0.90, 'м'),     -- outside the class
  ('00000000-0000-0000-0000-0000000000c2', 'jump', 0.70, 'м');     -- a teacher, trying it out

do $$
declare n int; r record;
begin
  perform tests.as_user('00000000-0000-0000-0000-00000000000a');

  -- ownership
  select count(*) into n from public.sensor_results;
  perform tests.expect(n = 3, format('a student reads only their own results, got %s', n));
  perform tests.expect(
    tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
                    values ('00000000-0000-0000-0000-00000000000b', 'jump', 0.3, 'м')$q$),
    'a student cannot save a result in somebody else''s name');
  perform tests.expect(
    not tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit, details)
                        values ('00000000-0000-0000-0000-00000000000a', 'pendulum', 1.99, 'с', '{"length": 0.99}')$q$),
    'a student can save their own');

  -- nothing a phone could not have measured
  perform tests.expect(tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'jump', 40, 'м')$q$), 'a 40 m jump is refused');
  perform tests.expect(tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'jump', 0, 'м')$q$), 'a jump of 0 is refused');
  perform tests.expect(tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'rest-g', 90, 'м/с²')$q$), 'a g of 90 is refused');
  perform tests.expect(tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'rest-g', 1, 'м/с²')$q$), 'a g of 1 is refused');
  perform tests.expect(tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'pendulum', 60, 'с')$q$), 'a one-minute pendulum period is refused');
  perform tests.expect(tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'elevator', 25, 'м/с²')$q$), 'a lift accelerating at 2.5 g is refused');
  perform tests.expect(tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'mood', 5, 'x')$q$), 'an unknown kind is refused');
  perform tests.expect(tests.raises(format($q$insert into public.sensor_results (user_id, kind, value, unit, details)
    values ('00000000-0000-0000-0000-00000000000a', 'jump', 0.3, 'м', %L::jsonb)$q$, json_build_object('x', repeat('y', 5000))::text)),
    'a huge details blob is refused');
  perform tests.expect(not tests.raises($q$insert into public.sensor_results (user_id, kind, value, unit)
    values ('00000000-0000-0000-0000-00000000000a', 'jump', 1.2, 'м')$q$), 'the upper bound itself is allowed');

  -- append-only
  update public.sensor_results set value = 1.1 where kind = 'jump' and value = 0.30;
  perform tests.expect((select count(*) from public.sensor_results where value = 0.30) = 1, 'a result cannot be edited');
  delete from public.sensor_results where kind = 'jump' and value = 0.30;
  perform tests.expect((select count(*) from public.sensor_results where value = 0.30) = 1, 'nor deleted');

  -- the class distribution: bare numbers, one best per classmate, mine marked
  select count(*) into n from public.class_jump_bests();
  perform tests.expect(n = 3, format('three classmates have jumped (Fatima is not one of them), got %s', n));
  perform tests.expect(
    (select array_agg(best) from public.class_jump_bests()) = array[0.25, 0.55, 1.2]::numeric[],
    'each classmate counts once, by their best, and the list comes back in ascending order (0.25, 0.55, 1.2)');
  select * into r from public.class_jump_bests() where is_me;
  perform tests.expect(r.best = 1.2, 'mine is marked, and is my best (1.2, saved just now)');
  perform tests.expect(
    (select count(*) from information_schema.parameters where specific_name like 'class_jump_bests%' and parameter_mode = 'OUT') = 2,
    'the function returns exactly two columns: no id, no name');
  perform tests.expect(
    (select count(*) from public.class_jump_bests() where is_me) = 1, 'only one row is mine');

  -- Bauyrzhan, same class: sees the same distribution, his own row marked
  perform tests.as_user('00000000-0000-0000-0000-00000000000b');
  select count(*) into n from public.sensor_results;
  perform tests.expect(n = 1, 'a classmate cannot read my results, only the distribution');
  select * into r from public.class_jump_bests() where is_me;
  perform tests.expect(r.best = 0.25, 'his own best is the one marked for him');

  -- Fatima has no teacher: only herself
  perform tests.as_user('00000000-0000-0000-0000-00000000000f');
  select count(*) into n from public.class_jump_bests();
  perform tests.expect(n = 1, 'a student with no class sees only their own best');

  -- teachers
  perform tests.as_user('00000000-0000-0000-0000-0000000000c1');
  select count(*) into n from public.sensor_results;
  perform tests.expect(n = 8, format('the teacher reads the accepted students'' 8 rows (Aigerim 5, Bauyrzhan 1, Dana 2), not Fatima''s, got %s', n));
  perform tests.expect((select count(*) from public.sensor_results where user_id = '00000000-0000-0000-0000-00000000000f') = 0,
    'but not an unaccepted student''s');
  select count(*) into n from public.class_jump_bests();
  perform tests.expect(n = 0, 'a teacher has no class distribution: they read the rows');
  perform tests.as_user('00000000-0000-0000-0000-0000000000c2');
  select count(*) into n from public.sensor_results;
  perform tests.expect(n = 1, 'a teacher with no students reads only their own');
  select count(*) into n from public.class_jump_bests();
  perform tests.expect(n = 0, 'and their own jump does not make them a member of a class distribution');

  perform tests.as_nobody();
  perform tests.expect(tests.raises($q$select * from public.class_jump_bests()$q$), 'an anonymous caller may not call the distribution');
  select count(*) into n from public.sensor_results;
  perform tests.expect(n = 0, 'nor read results');
end $$;

rollback;
