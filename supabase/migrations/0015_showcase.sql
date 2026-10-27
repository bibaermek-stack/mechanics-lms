-- =============================================================================
-- Үйдегі тәжірибелер галереясы: a student shows what they built at home
-- =============================================================================
-- Run after 0014. Dashboard → SQL Editor → paste → Run.
--
-- Written for children, so the rules are strict and the surface is small:
--
--   • TEXT ONLY — a title, what was built, which physics it shows, the materials.
--     No photographs and no links: nothing to host, and nothing that can show a face,
--     a home or a stranger's website.
--   • NOTHING IS PUBLIC BY DEFAULT. A post starts "pending"; the client cannot say
--     otherwise (the insert policy requires it). It becomes visible to classmates only
--     when one of the author's own accepted teachers approves it, through
--     review_showcase() — the one place a status changes. There is no UPDATE policy.
--   • THE AUTHOR AND THE TEACHER READ THE TABLE; EVERYONE ELSE READS A FUNCTION.
--     A classmate sees approved posts of their own class through showcase_feed(),
--     which returns the columns a gallery shows (the author's name, like counts) and
--     never a pending or rejected post.
--   • LIKES are single, by classmates, on approved posts of others (a student cannot
--     like their own post, or one they may not see).
--   • AT MOST FIVE posts waiting at once, so the teacher's queue cannot be flooded.
-- =============================================================================

-- Same class: the same student, or two students accepted by one teacher.
create or replace function public.are_classmates(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and (
    a = b or exists (
      select 1
      from public.teacher_links x
      join public.teacher_links y on y.teacher_id = x.teacher_id
      where x.status = 'accepted' and y.status = 'accepted'
        and x.student_id = a and y.student_id = b
    )
  );
$$;

create table if not exists public.showcase_posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  lesson_id   integer not null,
  title       text not null,
  what        text not null,
  physics     text not null,
  materials   text,
  status      text not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint showcase_lesson   check (lesson_id between 1 and 999),
  constraint showcase_title    check (char_length(btrim(title)) between 3 and 80),
  constraint showcase_what     check (char_length(btrim(what)) between 10 and 600),
  constraint showcase_physics  check (char_length(btrim(physics)) between 10 and 400),
  constraint showcase_materials check (materials is null or char_length(materials) <= 200),
  constraint showcase_status   check (status in ('pending', 'approved', 'rejected')),
  -- a decision always says who made it and when; a pending post has none
  constraint showcase_review_consistent check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists showcase_posts_user_idx on public.showcase_posts (user_id, created_at desc);
create index if not exists showcase_posts_status_idx on public.showcase_posts (status, created_at desc);

alter table public.showcase_posts enable row level security;

drop policy if exists showcase_select on public.showcase_posts;
create policy showcase_select on public.showcase_posts
  for select using (user_id = auth.uid() or public.is_my_student(user_id));

drop policy if exists showcase_insert on public.showcase_posts;
create policy showcase_insert on public.showcase_posts
  for insert with check (
    user_id = auth.uid()
    and public.role_of(auth.uid()) = 'student'
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
  );

drop policy if exists showcase_delete on public.showcase_posts;
create policy showcase_delete on public.showcase_posts
  for delete using (user_id = auth.uid());

-- No UPDATE policy: a post's words and its status are never changed from the client.

create or replace function public.limit_pending_showcase()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'pending'
     and (select count(*) from public.showcase_posts p where p.user_id = new.user_id and p.status = 'pending') >= 5 then
    raise exception 'too many posts waiting for review' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists showcase_limit_pending on public.showcase_posts;
create trigger showcase_limit_pending before insert on public.showcase_posts
  for each row execute function public.limit_pending_showcase();

-- -----------------------------------------------------------------------------
-- The one way a post's status changes
-- -----------------------------------------------------------------------------
create or replace function public.review_showcase(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare author uuid;
begin
  select user_id into author from public.showcase_posts where id = p_id;
  if author is null then
    raise exception 'no such post' using errcode = 'no_data_found';
  end if;
  if not public.is_my_student(author) then
    raise exception 'only the author''s teacher may review this' using errcode = 'insufficient_privilege';
  end if;
  update public.showcase_posts
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = p_id;
end;
$$;

revoke all on function public.review_showcase(uuid, boolean) from public;
revoke execute on function public.review_showcase(uuid, boolean) from anon;
grant execute on function public.review_showcase(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Likes
-- -----------------------------------------------------------------------------
create table if not exists public.showcase_likes (
  post_id    uuid not null references public.showcase_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- May this person like this post? Approved, somebody else's, and in their class.
create or replace function public.can_like_showcase(p_post uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.showcase_posts p
    where p.id = p_post
      and p.status = 'approved'
      and p.user_id <> p_user
      and public.are_classmates(p_user, p.user_id)
  );
$$;

alter table public.showcase_likes enable row level security;

drop policy if exists showcase_likes_select on public.showcase_likes;
create policy showcase_likes_select on public.showcase_likes
  for select using (user_id = auth.uid());

drop policy if exists showcase_likes_insert on public.showcase_likes;
create policy showcase_likes_insert on public.showcase_likes
  for insert with check (user_id = auth.uid() and public.can_like_showcase(post_id, auth.uid()));

drop policy if exists showcase_likes_delete on public.showcase_likes;
create policy showcase_likes_delete on public.showcase_likes
  for delete using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- The gallery: approved posts of my class (or of my students, for a teacher)
-- -----------------------------------------------------------------------------
create or replace function public.showcase_feed()
returns table (
  id uuid, user_id uuid, author text, lesson_id integer, title text, what text,
  physics text, materials text, created_at timestamptz,
  likes bigint, liked_by_me boolean, is_mine boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.user_id, pr.full_name, p.lesson_id, p.title, p.what, p.physics, p.materials, p.created_at,
    (select count(*) from public.showcase_likes l where l.post_id = p.id),
    exists (select 1 from public.showcase_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    p.user_id = auth.uid()
  from public.showcase_posts p
  join public.profiles pr on pr.id = p.user_id
  where auth.uid() is not null
    and p.status = 'approved'
    and (public.are_classmates(auth.uid(), p.user_id) or public.is_my_student(p.user_id))
  order by 10 desc, p.created_at desc;
$$;

revoke all on function public.showcase_feed() from public;
revoke execute on function public.showcase_feed() from anon;
grant execute on function public.showcase_feed() to authenticated;
