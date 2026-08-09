-- =============================================================================
-- Google арқылы кіру — рөлді бір рет таңдау
-- =============================================================================
-- Run after 0001. Dashboard → SQL Editor → paste → Run.
--
-- The email signup form asks for the role and passes it as user metadata, so
-- handle_new_user has it at insert time. An OAuth signup has no such form: the
-- person is bounced to Google and comes back already authenticated, and the
-- trigger has nothing to go on.
--
-- Defaulting them to "student" and freezing it would quietly mis-file every
-- teacher who signs in with Google, and the role is deliberately immutable. So
-- an OAuth-created profile is instead marked *unclaimed*: it carries a
-- provisional role that the person may set exactly once, through claim_role().
-- After that it freezes like any other.
-- =============================================================================

alter table public.profiles
  add column if not exists role_locked boolean not null default true;

comment on column public.profiles.role_locked is
  'False only for a profile created by OAuth before its owner picked a role. claim_role() sets it true, permanently.';

-- -----------------------------------------------------------------------------
-- Signup trigger, now distinguishing "role was chosen" from "role is a guess".
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
  chosen    boolean := meta_role in ('student', 'teacher');
  final_role text := case when chosen then meta_role else 'student' end;
begin
  insert into public.profiles (id, role, full_name, email, user_code, study_group, role_locked)
  values (
    new.id,
    final_role,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      -- Google sends the display name as `name`.
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    ),
    new.email,
    public.generate_user_code(final_role),
    nullif(new.raw_user_meta_data ->> 'study_group', ''),
    chosen
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity freeze, with the one-time window for an unclaimed profile.
-- -----------------------------------------------------------------------------
create or replace function public.protect_profile_identity()
returns trigger
language plpgsql
as $$
begin
  -- Once locked, role and code are identity: put back whatever was sent.
  if old.role_locked then
    new.role := old.role;
    new.user_code := old.user_code;
    new.role_locked := true;
  end if;
  new.id := old.id;
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- claim_role — the single chance an OAuth signup gets to say who they are.
--
-- Definer so it can rewrite the code with the right prefix, but it refuses on
-- an already-locked profile, so calling it twice changes nothing.
-- -----------------------------------------------------------------------------
create or replace function public.claim_role(p_role text)
returns public.profiles
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me      uuid := auth.uid();
  current public.profiles;
  result  public.profiles;
begin
  if me is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('student', 'teacher') then
    raise exception 'role must be student or teacher';
  end if;

  select * into current from public.profiles where id = me;
  if not found then
    raise exception 'profile not found';
  end if;
  if current.role_locked then
    raise exception 'role has already been chosen';
  end if;

  update public.profiles
     set role        = p_role,
         -- The code carries the role prefix, so it is reissued with it.
         user_code   = public.generate_user_code(p_role),
         role_locked = true
   where id = me
   returning * into result;

  return result;
end;
$$;

revoke all on function public.claim_role(text) from public;
grant execute on function public.claim_role(text) to authenticated;

-- Tighten 0001: only a signed-in user may search the directory. Anonymous
-- callers already got an empty set (the RPC filters on auth.uid()), but there
-- is no reason to let them call it at all.
revoke execute on function public.search_people(text, text) from anon;
