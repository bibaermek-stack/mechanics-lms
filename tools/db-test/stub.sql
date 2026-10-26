-- A stand-in for the parts of Supabase that the migrations lean on, so they can
-- be run against a plain PostgreSQL. Not for production: Supabase provides all
-- of this itself.
--
--   auth.users   the table the signup trigger hangs off
--   auth.uid()   who is calling, read from the same setting PostgREST fills in
--   anon / authenticated / service_role   the three API roles

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- Supabase hands every API role the table privileges up front and lets RLS decide.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Test helpers: act as a given user, with RLS in force.
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.as_user(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end $$;

create or replace function tests.as_nobody() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claim.role', 'anon', true);
  execute 'set local role anon';
end $$;

create or replace function tests.as_admin() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- Make a user the way Supabase Auth would: a row in auth.users, which the signup
-- trigger mirrors into profiles.
create or replace function tests.make_user(uid uuid, role text, full_name text, grp text default null)
returns uuid
language plpgsql as $$
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (uid, full_name || '@test.kz',
          jsonb_build_object('role', role, 'full_name', full_name, 'study_group', grp));
  return uid;
end $$;

create or replace function tests.expect(ok boolean, what text) returns void
language plpgsql as $$
begin
  if ok is not true then raise exception 'FAILED: %', what; end if;
  raise notice 'ok - %', what;
end $$;

-- Run a statement as the caller and report whether it raised.
create or replace function tests.raises(stmt text) returns boolean
language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  return true;
end $$;
