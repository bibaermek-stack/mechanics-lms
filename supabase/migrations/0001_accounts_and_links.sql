-- =============================================================================
-- Механика AI LMS — accounts, roles and the teacher↔student graph
-- =============================================================================
-- Run this once against a fresh Supabase project:
--   Supabase Dashboard → SQL Editor → paste → Run
-- or, with the CLI:  supabase db push
--
-- Model
--   profiles       one row per auth.users row, carrying the chosen role
--   teacher_links  a friend-request edge between one teacher and one student
--
-- A link is created by *either* side and must be answered by the other, so the
-- same table serves "student applies to a teacher" and "teacher invites a
-- student". `requested_by` is what tells the UI whose turn it is.
--
-- Everything is guarded by RLS. The one place we deliberately step outside it
-- is search: you must be able to find somebody you are not yet linked to, so
-- `search_people` is SECURITY DEFINER and returns a narrow, safe column set.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              text not null check (role in ('student', 'teacher', 'admin')),
  full_name         text not null,
  email             text not null,
  -- Short human-typeable handle, e.g. STU-7K3M2A. This is what people share
  -- when they say "add me": an email is PII and a uuid is unreadable.
  user_code         text not null unique,
  study_group       text,
  avatar_url        text,
  xp                integer not null default 0,
  competency_score  integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
-- Case-insensitive name search: the RPC below filters with ILIKE.
create index if not exists profiles_name_idx on public.profiles (lower(full_name));

comment on column public.profiles.user_code is
  'Short shareable handle (STU-/TCH- prefix). Immutable after signup.';

-- -----------------------------------------------------------------------------
-- teacher_links
-- -----------------------------------------------------------------------------
create table if not exists public.teacher_links (
  id            uuid primary key default gen_random_uuid(),
  teacher_id    uuid not null references public.profiles (id) on delete cascade,
  student_id    uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined')),
  -- Whoever pressed "send". The counterpart is the one who may accept.
  requested_by  uuid not null references public.profiles (id) on delete cascade,
  message       text,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  -- One edge per pair. Re-applying after a decline updates this row rather than
  -- piling up history, which keeps the inbox honest.
  unique (teacher_id, student_id)
);

create index if not exists teacher_links_teacher_idx on public.teacher_links (teacher_id, status);
create index if not exists teacher_links_student_idx on public.teacher_links (student_id, status);

-- -----------------------------------------------------------------------------
-- Helpers
--
-- These are SECURITY DEFINER so that policies can consult profiles/links
-- without re-entering the very policies being evaluated (which would recurse).
-- -----------------------------------------------------------------------------
create or replace function public.role_of(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = uid;
$$;

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
  );
$$;

-- Random shareable handle: STU-XXXXXX. The alphabet drops I/O/0/1 so a code
-- read aloud or off a whiteboard cannot be mistyped.
create or replace function public.generate_user_code(p_role text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  prefix   text := case p_role when 'teacher' then 'TCH' when 'admin' then 'ADM' else 'STU' end;
  body     text;
  attempt  integer := 0;
begin
  loop
    body := '';
    for i in 1..6 loop
      body := body || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.user_code = prefix || '-' || body);
    attempt := attempt + 1;
    if attempt > 20 then
      raise exception 'could not allocate a unique user_code';
    end if;
  end loop;
  return prefix || '-' || body;
end;
$$;

-- -----------------------------------------------------------------------------
-- Signup trigger: mirror the new auth user into profiles, taking the role the
-- person chose on the signup form (passed as user metadata).
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  if chosen_role not in ('student', 'teacher') then
    chosen_role := 'student';
  end if;

  insert into public.profiles (id, role, full_name, email, user_code, study_group)
  values (
    new.id,
    chosen_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    public.generate_user_code(chosen_role),
    nullif(new.raw_user_meta_data ->> 'study_group', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role and user_code are identity, not preferences: freeze them so a student
-- cannot promote themselves to teacher with a PATCH from the browser.
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
as $$
begin
  new.role := old.role;
  new.user_code := old.user_code;
  new.id := old.id;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
  before update on public.profiles
  for each row execute function public.protect_profile_identity();

-- A link only makes sense between one teacher and one student, and only the
-- two parties may appear on it.
create or replace function public.validate_teacher_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.role_of(new.teacher_id) <> 'teacher' then
    raise exception 'teacher_id must belong to a teacher';
  end if;
  if public.role_of(new.student_id) <> 'student' then
    raise exception 'student_id must belong to a student';
  end if;
  if new.requested_by not in (new.teacher_id, new.student_id) then
    raise exception 'requested_by must be one of the two parties';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- Re-applying after a decline resets the clock; answering stops it.
    new.responded_at := case when new.status = 'pending' then null else now() end;
    -- You may withdraw your own request, but you may not accept it yourself.
    if new.status = 'accepted' and auth.uid() = old.requested_by then
      raise exception 'a request must be accepted by the other party';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists teacher_links_validate on public.teacher_links;
create trigger teacher_links_validate
  before insert or update on public.teacher_links
  for each row execute function public.validate_teacher_link();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.teacher_links enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()                       -- always yourself
    or public.is_linked(id, auth.uid())   -- and anyone you share an edge with
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists links_select on public.teacher_links;
create policy links_select on public.teacher_links
  for select using (teacher_id = auth.uid() or student_id = auth.uid());

drop policy if exists links_insert on public.teacher_links;
create policy links_insert on public.teacher_links
  for insert with check (
    requested_by = auth.uid()
    and auth.uid() in (teacher_id, student_id)
    and status = 'pending'
  );

drop policy if exists links_update on public.teacher_links;
create policy links_update on public.teacher_links
  for update using (teacher_id = auth.uid() or student_id = auth.uid())
  with check (teacher_id = auth.uid() or student_id = auth.uid());

drop policy if exists links_delete on public.teacher_links;
create policy links_delete on public.teacher_links
  for delete using (teacher_id = auth.uid() or student_id = auth.uid());

-- -----------------------------------------------------------------------------
-- search_people — the one deliberate hole in RLS.
--
-- Finding somebody you have never met is the whole point of the request flow,
-- so this runs as definer. It returns only what a search result needs, never
-- the email, and it tells the caller whether an edge already exists so the UI
-- can show "Сұраныс жіберілді" instead of a second button.
--
-- Matching: exact user_code (case-insensitive), or a substring of the name.
-- Email is matched only in full — a prefix search over emails would be a
-- directory scrape.
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
    l.status,
    l.requested_by
  from public.profiles p
  left join public.teacher_links l
    on (l.teacher_id = p.id and l.student_id = auth.uid())
    or (l.student_id = p.id and l.teacher_id = auth.uid())
  where p.role = want_role
    and p.id <> auth.uid()
    and length(btrim(term)) >= 2
    and (
      upper(p.user_code) = upper(btrim(term))
      or lower(p.full_name) like '%' || lower(btrim(term)) || '%'
      or lower(p.email) = lower(btrim(term))
    )
  order by
    -- Exact code match first: if somebody typed a code they know who they want.
    (upper(p.user_code) = upper(btrim(term))) desc,
    p.full_name
  limit 20;
$$;

revoke all on function public.search_people(text, text) from public;
grant execute on function public.search_people(text, text) to authenticated;
