-- showcase_posts, showcase_likes, review_showcase(), showcase_feed(), are_classmates() (migration 0015).
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
  p1 uuid; p2 uuid; p3 uuid; n int; r record;
  ok_insert constant text := $q$insert into public.showcase_posts (user_id, lesson_id, title, what, physics)
    values (%L, %s, %L, %L, %L)$q$;
begin
  -- same class
  perform tests.expect(public.are_classmates(A, B), 'two students of one teacher are classmates');
  perform tests.expect(public.are_classmates(A, A), 'a student is in their own class');
  perform tests.expect(not public.are_classmates(A, E), 'students of different teachers are not');
  perform tests.expect(not public.are_classmates(A, F), 'nor a student with no teacher');
  perform tests.expect(public.are_classmates(F, F), 'who is still in their own class of one');
  perform tests.expect(not public.are_classmates(A, G) and not public.are_classmates(G, A), 'a student whose request is still pending is not in the class yet');
  perform tests.expect(not public.are_classmates(A, C1), 'a teacher is nobody''s classmate');
  perform tests.expect(not public.are_classmates(A, null) and not public.are_classmates(null, A), 'null is nobody''s classmate');

  -- Aigerim posts
  perform tests.as_user(A);
  insert into public.showcase_posts (user_id, lesson_id, title, what, physics, materials)
    values (A, 5, 'Резеңке зымыран', 'Шарды үрлеп, жіпке байлап жібердім, ол алға ұшты.', 'Ньютонның үшінші заңы: ауа артқа, шар алға.', 'шар, жіп, скотч')
    returning id into p1;
  select status into r from public.showcase_posts where id = p1;
  perform tests.expect(r.status = 'pending', 'a new post is pending');

  perform tests.expect(tests.raises(format(ok_insert, B, 5, 'Менің жұмысым', 'Бұл өте ұзақ сипаттама емес пе', 'Бұл физика заңы туралы')),
    'a student cannot post in somebody else''s name');
  perform tests.expect(tests.raises($q$insert into public.showcase_posts (user_id, lesson_id, title, what, physics, status, reviewed_by, reviewed_at)
    values ('00000000-0000-0000-0000-00000000000a', 5, 'Мақұлданған', 'Мен өзім мақұлдадым деп жазамын', 'Бұл физика заңы туралы', 'approved', '00000000-0000-0000-0000-00000000000a', now())$q$),
    'a post cannot arrive already approved');
  perform tests.expect(tests.raises($q$insert into public.showcase_posts (user_id, lesson_id, title, what, physics, status)
    values ('00000000-0000-0000-0000-00000000000a', 5, 'Мақұлданған', 'Мен өзім мақұлдадым деп жазамын', 'Бұл физика заңы туралы', 'approved')$q$),
    'nor with status approved alone (the decision needs a reviewer too)');
  perform tests.expect(tests.raises($q$insert into public.showcase_posts (user_id, lesson_id, title, what, physics, reviewed_by)
    values ('00000000-0000-0000-0000-00000000000a', 5, 'Мақұлданған', 'Мен өзім мақұлдадым деп жазамын', 'Бұл физика заңы туралы', '00000000-0000-0000-0000-0000000000c1')$q$),
    'a pending post cannot claim a reviewer');

  -- the words are limited
  perform tests.expect(tests.raises(format(ok_insert, A, 5, 'Аб', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'a 2-letter title is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 5, repeat('а', 81), 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'an 81-letter title is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 5, '    ', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'a title of spaces is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 5, 'Жақсы атау', 'қысқа', 'Жеткілікті ұзын физика мәтіні')), 'a 5-letter description is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 5, 'Жақсы атау', repeat('а', 601), 'Жеткілікті ұзын физика мәтіні')), 'a 601-letter description is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 5, 'Жақсы атау', 'Жеткілікті ұзын сипаттама мәтіні', 'қысқа')), 'a 5-letter physics note is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 5, 'Жақсы атау', 'Жеткілікті ұзын сипаттама мәтіні', repeat('а', 401))), 'a 401-letter physics note is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 0, 'Жақсы атау', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'lesson 0 is refused');
  perform tests.expect(tests.raises(format(ok_insert, A, 1000, 'Жақсы атау', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'lesson 1000 is refused');
  perform tests.expect(tests.raises(format($q$insert into public.showcase_posts (user_id, lesson_id, title, what, physics, materials)
    values (%L, 5, 'Жақсы атау', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні', %L)$q$, A, repeat('м', 201))), 'a 201-letter materials list is refused');
  perform tests.expect(not tests.raises(format(ok_insert, A, 999, repeat('а', 80), repeat('а', 600), repeat('а', 400))), 'the upper bounds themselves are allowed');

  -- at most five waiting
  perform tests.expect(not tests.raises(format(ok_insert, A, 2, 'Үшінші жұмыс', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'a third waiting post is allowed');
  perform tests.expect(not tests.raises(format(ok_insert, A, 2, 'Төртінші жұмыс', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'a fourth');
  perform tests.expect(not tests.raises(format(ok_insert, A, 2, 'Бесінші жұмыс', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'a fifth');
  perform tests.expect(tests.raises(format(ok_insert, A, 2, 'Алтыншы жұмыс', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'but not a sixth while five wait');
  -- drop the extras so the rest reads simply: keep p1 and make two more we will name
  delete from public.showcase_posts where user_id = A and id <> p1;
  select count(*) into n from public.showcase_posts;
  perform tests.expect(n = 1, 'a student can delete their own posts');
  insert into public.showcase_posts (user_id, lesson_id, title, what, physics, created_at)
    values (A, 3, 'Үйкеліс тәжірибесі', 'Кітапты көлбеу тақтайда сырғыттым, бұрышты өлшедім.', 'Үйкеліс күші және көлбеу жазықтық.', '2027-02-01') returning id into p2;
  insert into public.showcase_posts (user_id, lesson_id, title, what, physics, created_at)
    values (A, 8, 'Маятник жасадым', 'Жіпке тас байлап, тербеліс периодын өлшедім.', 'Маятник периоды T = 2π√(L/g).', '2027-03-01') returning id into p3;

  -- the client cannot change a status
  update public.showcase_posts set status = 'approved', reviewed_by = A, reviewed_at = now() where id = p1;
  perform tests.expect((select count(*) from public.showcase_posts where status = 'approved') = 0, 'a student cannot approve their own post by UPDATE');
  update public.showcase_posts set title = 'Өзгертілген атау' where id = p1;
  perform tests.expect((select title from public.showcase_posts where id = p1) = 'Резеңке зымыран', 'nor edit it');

  -- teachers do not post
  perform tests.as_user(C1);
  perform tests.expect(tests.raises(format(ok_insert, C1, 5, 'Мұғалім жұмысы', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні')), 'a teacher cannot post');

  -- who can read the raw rows
  perform tests.expect((select count(*) from public.showcase_posts) = 3, 'the author''s teacher reads all three, whatever their status');
  perform tests.as_user(C2);
  perform tests.expect((select count(*) from public.showcase_posts) = 0, 'another teacher reads none');
  perform tests.as_user(B);
  perform tests.expect((select count(*) from public.showcase_posts) = 0, 'a classmate reads none of the raw rows');
  perform tests.expect((select count(*) from public.showcase_feed()) = 0, 'and the gallery shows none of the pending posts');
  perform tests.as_user(F);
  perform tests.expect((select count(*) from public.showcase_posts) = 0 and (select count(*) from public.showcase_feed()) = 0, 'a student with no class sees nothing');
  perform tests.as_user(G);
  perform tests.expect((select count(*) from public.showcase_posts) = 0 and (select count(*) from public.showcase_feed()) = 0, 'nor one whose request is still pending');

  -- a teacher moderates; they do not delete
  perform tests.as_user(C1);
  delete from public.showcase_posts where user_id = A;
  perform tests.expect((select count(*) from public.showcase_posts where user_id = A) = 3, 'a teacher cannot delete a student''s post');
  perform tests.as_user(B);

  -- review: who may
  perform tests.expect(tests.raises(format('select public.review_showcase(%L, true)', p1)), 'a classmate cannot approve');
  perform tests.as_user(A);
  perform tests.expect(tests.raises(format('select public.review_showcase(%L, true)', p1)), 'nor can the author');
  perform tests.as_user(C2);
  perform tests.expect(tests.raises(format('select public.review_showcase(%L, true)', p1)), 'nor a teacher of another class');
  perform tests.as_nobody();
  perform tests.expect(tests.raises(format('select public.review_showcase(%L, true)', p1)), 'nor anyone not signed in');
  perform tests.as_user(C1);
  perform tests.expect(tests.raises($q$select public.review_showcase('00000000-0000-0000-0000-000000000999', true)$q$), 'reviewing a post that is not there is an error');
  perform public.review_showcase(p1, true);
  perform public.review_showcase(p2, true);
  perform public.review_showcase(p3, false);
  select * into r from public.showcase_posts where id = p1;
  perform tests.expect(r.status = 'approved' and r.reviewed_by = C1 and r.reviewed_at is not null, 'approval records who and when');
  perform tests.expect((select status from public.showcase_posts where id = p3) = 'rejected', 'a post can be rejected');

  -- the gallery
  perform tests.as_user(B);
  select count(*) into n from public.showcase_feed();
  perform tests.expect(n = 2, format('a classmate sees the two approved posts, not the rejected one, got %s', n));
  select * into r from public.showcase_feed() where id = p1;
  perform tests.expect(r.author = 'Aigerim' and r.likes = 0 and not r.liked_by_me and not r.is_mine and r.title = 'Резеңке зымыран', 'with the author''s name and no likes yet');
  perform tests.as_user(A);
  select count(*) into n from public.showcase_feed();
  perform tests.expect(n = 2, 'the author sees their approved posts');
  perform tests.expect((select bool_and(is_mine) from public.showcase_feed()), 'marked as hers');
  perform tests.expect((select count(*) from public.showcase_posts where status = 'rejected') = 1, 'and still reads her rejected one in the table');
  perform tests.as_user(E);
  perform tests.expect((select count(*) from public.showcase_feed()) = 0, 'a student of another class sees none');
  perform tests.as_user(F);
  perform tests.expect((select count(*) from public.showcase_feed()) = 0, 'nor one without a class');
  perform tests.as_user(C1);
  perform tests.expect((select count(*) from public.showcase_feed()) = 2, 'the teacher sees their students'' approved posts');
  perform tests.as_user(C2);
  perform tests.expect((select count(*) from public.showcase_feed()) = 0, 'another teacher sees none');
  perform tests.as_nobody();
  perform tests.expect(tests.raises('select * from public.showcase_feed()'), 'the gallery is not for anonymous callers');

  -- a teacher may change their mind
  perform tests.as_user(C1);
  perform public.review_showcase(p3, true);
  perform tests.expect((select status from public.showcase_posts where id = p3) = 'approved', 'a rejected post can be approved later');
  perform public.review_showcase(p3, false);
  perform tests.expect((select status from public.showcase_posts where id = p3) = 'rejected', 'and an approved one withdrawn');

  -- likes
  perform tests.as_user(B);
  insert into public.showcase_likes (post_id, user_id) values (p1, B);
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p1, B)), 'a second like by the same student is refused');
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id, created_at) values (%L, %L, now() + interval ''1 hour'')', p1, B)),
    'even stamped at another time');
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p3, B)), 'a rejected post cannot be liked');
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p2, A)), 'nor in somebody else''s name');
  perform tests.as_user(A);
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p1, A)), 'a student cannot like their own post');
  perform tests.as_user(D);
  insert into public.showcase_likes (post_id, user_id) values (p1, D);
  perform tests.as_user(E);
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p1, E)), 'a student of another class cannot like');
  perform tests.as_user(F);
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p1, F)), 'nor one with no class');
  perform tests.as_user(G);
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p1, G)), 'nor one still waiting to be accepted');
  perform tests.as_user(C1);
  perform tests.expect(tests.raises(format('insert into public.showcase_likes (post_id, user_id) values (%L, %L)', p1, C1)), 'nor a teacher');

  perform tests.as_user(B);
  select * into r from public.showcase_feed() where id = p1;
  perform tests.expect(r.likes = 2 and r.liked_by_me, 'the gallery counts both likes and knows which is mine');
  perform tests.expect((select count(*) from public.showcase_likes) = 1, 'a student reads only their own likes');
  perform tests.as_user(A);
  select * into r from public.showcase_feed() where id = p1;
  perform tests.expect(r.likes = 2 and not r.liked_by_me, 'the author sees the count, not who');
  perform tests.expect((select array_agg(id order by ord) from (select id, row_number() over () ord from public.showcase_feed()) f) = array[p1, p2],
    'the liked post comes first, though the other is newer');
  -- equal likes: the newer comes first
  perform tests.as_admin();
  insert into public.showcase_posts (id, user_id, lesson_id, title, what, physics, status, reviewed_by, reviewed_at, created_at)
    values ('00000000-0000-0000-0000-0000000004a4', D, 4, 'Төртінші жұмыс', 'Жеткілікті ұзын сипаттама мәтіні', 'Жеткілікті ұзын физика мәтіні', 'approved', C1, now(), '2027-04-01');
  perform tests.as_user(A);
  perform tests.expect((select array_agg(id order by ord) from (select id, row_number() over () ord from public.showcase_feed()) f)
                       = array[p1, '00000000-0000-0000-0000-0000000004a4'::uuid, p2], 'posts with equal likes come newest first');

  perform tests.as_user(B);
  delete from public.showcase_likes where user_id = D;
  perform tests.as_user(D);
  perform tests.expect((select count(*) from public.showcase_likes) = 1, 'a student cannot remove somebody else''s like');
  perform tests.as_user(B);
  delete from public.showcase_likes where user_id = B;
  select * into r from public.showcase_feed() where id = p1;
  perform tests.expect(r.likes = 1 and not r.liked_by_me, 'but can take back their own');

  -- deleting
  perform tests.as_user(B);
  delete from public.showcase_posts where id = p1;
  perform tests.as_admin();
  perform tests.expect((select count(*) from public.showcase_posts where id = p1) = 1, 'a classmate cannot delete my post');
  perform tests.as_user(A);
  delete from public.showcase_posts where id = p1;
  perform tests.as_admin();
  perform tests.expect((select count(*) from public.showcase_posts where id = p1) = 0, 'the author can');
  perform tests.expect((select count(*) from public.showcase_likes where post_id = p1) = 0, 'and its likes go with it');
end $$;

rollback;
