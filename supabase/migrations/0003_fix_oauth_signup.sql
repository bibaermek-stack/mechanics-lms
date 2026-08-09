-- =============================================================================
-- Fix: "Database error saving new user" on a Google signup
-- =============================================================================
-- Run after 0002. Dashboard → SQL Editor → paste → Run.
--
-- 0002 decided whether a role had been chosen with:
--
--     chosen boolean := meta_role in ('student', 'teacher');
--
-- An email signup carries `role` in its metadata, so meta_role is a string and
-- this is true or false. A Google signup carries no such key, so meta_role is
-- NULL — and `NULL in (...)` is **NULL**, not false. That NULL was written to
-- profiles.role_locked, which is NOT NULL, so the insert raised, the trigger
-- aborted the transaction, and GoTrue reported the failure as the generic
-- "Database error saving new user".
--
-- The role itself was unaffected (`case when NULL then ... else 'student'`
-- takes the else branch), which is why email signups kept working and only
-- OAuth broke.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_role text := new.raw_user_meta_data ->> 'role';
  -- coalesce is the whole fix: an absent key must read as "not chosen",
  -- not as "unknown".
  chosen    boolean := coalesce(meta_role in ('student', 'teacher'), false);
  final_role text := case when chosen then meta_role else 'student' end;
begin
  insert into public.profiles (id, role, full_name, email, user_code, study_group, role_locked)
  values (
    new.id,
    final_role,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      -- Google sends the display name as `name`; some providers use these.
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Қолданушы'
    ),
    coalesce(new.email, ''),
    public.generate_user_code(final_role),
    nullif(new.raw_user_meta_data ->> 'study_group', ''),
    chosen
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Same class of bug, caught while fixing the first: role_of() returns NULL for
-- an id with no profile, and `NULL <> 'teacher'` is NULL, so the guard silently
-- did not fire. The foreign key would still have rejected the row, but the
-- error would have been the wrong one. `is distinct from` treats NULL as a
-- mismatch, which is what was meant.
create or replace function public.validate_teacher_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.role_of(new.teacher_id) is distinct from 'teacher' then
    raise exception 'teacher_id must belong to a teacher';
  end if;
  if public.role_of(new.student_id) is distinct from 'student' then
    raise exception 'student_id must belong to a student';
  end if;
  if new.requested_by not in (new.teacher_id, new.student_id) then
    raise exception 'requested_by must be one of the two parties';
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.responded_at := case when new.status = 'pending' then null else now() end;
    if new.status = 'accepted' and auth.uid() = old.requested_by then
      raise exception 'a request must be accepted by the other party';
    end if;
  end if;

  return new;
end;
$$;

-- Repair: if any account was created while the trigger was failing, it exists
-- in auth.users with no profile and would hit "Профиль табылмады" on every
-- sign-in. Give those accounts a provisional profile so /auth/callback can ask
-- for the role like any other OAuth signup.
insert into public.profiles (id, role, full_name, email, user_code, role_locked)
select
  u.id,
  'student',
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Қолданушы'
  ),
  coalesce(u.email, ''),
  public.generate_user_code('student'),
  false
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
