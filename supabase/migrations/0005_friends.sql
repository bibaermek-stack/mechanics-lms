-- =============================================================================
-- Студент ↔ студент достығы
-- =============================================================================
-- Run after 0004. Dashboard → SQL Editor → paste → Run.
--
-- teacher_links models a hierarchy: one teacher, many students, and the two
-- sides are not interchangeable. Friendship is symmetric, so it gets its own
-- table rather than a `kind` column on the existing one — otherwise every
-- query would have to keep asking which flavour of edge it was looking at.
--
-- The pair is deduplicated on the *unordered* pair: A→B and B→A are the same
-- friendship, and without that a mutual request would create two rows and two
-- inbox entries for the same thing.
-- =============================================================================

create table if not exists public.friend_links (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles (id) on delete cascade,
  addressee_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint friend_links_no_self check (requester_id <> addressee_id)
);

-- One row per unordered pair, whichever direction it was opened from.
create unique index if not exists friend_links_pair_idx
  on public.friend_links (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friend_links_requester_idx on public.friend_links (requester_id, status);
create index if not exists friend_links_addressee_idx on public.friend_links (addressee_id, status);

-- -----------------------------------------------------------------------------
-- Reading a friend's profile
--
-- is_linked() decides whether two people may see each other's profile row. It
-- only knew about teacher_links, so an accepted friend was invisible — the
-- friends list would render rows with no names.
-- -----------------------------------------------------------------------------
create or replace function public.is_linked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teacher_links l
    where (l.teacher_id = a and l.student_id = b)
       or (l.teacher_id = b and l.student_id = a)
  ) or exists (
    select 1 from public.friend_links f
    where (f.requester_id = a and f.addressee_id = b)
       or (f.requester_id = b and f.addressee_id = a)
  );
$$;

-- -----------------------------------------------------------------------------
-- Friendship is between students. A teacher attaches to a student through
-- teacher_links, which carries the roles that page needs; letting the two
-- mechanisms overlap would make "my students" and "my friends" mean the same
-- thing for a teacher, which is not what either list is for.
-- -----------------------------------------------------------------------------
create or replace function public.validate_friend_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.role_of(new.requester_id) is distinct from 'student'
     or public.role_of(new.addressee_id) is distinct from 'student' then
    raise exception 'friendship is between students';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.responded_at := case when new.status = 'pending' then null else now() end;
    if new.status = 'accepted' and auth.uid() = old.requester_id then
      raise exception 'a request must be accepted by the other party';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists friend_links_validate on public.friend_links;
create trigger friend_links_validate
  before insert or update on public.friend_links
  for each row execute function public.validate_friend_link();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.friend_links enable row level security;

drop policy if exists friends_select on public.friend_links;
create policy friends_select on public.friend_links
  for select using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friends_insert on public.friend_links;
create policy friends_insert on public.friend_links
  for insert with check (requester_id = auth.uid() and status = 'pending');

drop policy if exists friends_update on public.friend_links;
create policy friends_update on public.friend_links
  for update using (requester_id = auth.uid() or addressee_id = auth.uid())
  with check (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists friends_delete on public.friend_links;
create policy friends_delete on public.friend_links
  for delete using (requester_id = auth.uid() or addressee_id = auth.uid());

-- -----------------------------------------------------------------------------
-- search_people, now aware of both edge types.
--
-- A student searching for classmates needs to see "already a friend" or
-- "request sent" on the result, exactly as they do when looking for a teacher,
-- or they will send a second request to somebody they already asked.
-- -----------------------------------------------------------------------------
create or replace function public.search_people(term text, want_role text)
returns table (
  id           uuid,
  full_name    text,
  user_code    text,
  role         text,
  study_group  text,
  avatar_url   text,
  link_status  text,
  requested_by uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.user_code,
    p.role,
    p.study_group,
    p.avatar_url,
    coalesce(tl.status, fl.status)          as link_status,
    coalesce(tl.requested_by, fl.requester_id) as requested_by
  from public.profiles p
  left join public.teacher_links tl
    on (tl.teacher_id = p.id and tl.student_id = auth.uid())
    or (tl.student_id = p.id and tl.teacher_id = auth.uid())
  left join public.friend_links fl
    on (fl.requester_id = p.id and fl.addressee_id = auth.uid())
    or (fl.addressee_id = p.id and fl.requester_id = auth.uid())
  where p.role = want_role
    and p.id <> auth.uid()
    and length(btrim(term)) >= 2
    and (
      upper(p.user_code) = upper(btrim(term))
      or lower(p.full_name) like '%' || lower(btrim(term)) || '%'
      or lower(p.email) = lower(btrim(term))
    )
  order by
    (upper(p.user_code) = upper(btrim(term))) desc,
    p.full_name
  limit 20;
$$;

revoke all on function public.search_people(text, text) from public;
revoke execute on function public.search_people(text, text) from anon;
grant execute on function public.search_people(text, text) to authenticated;
