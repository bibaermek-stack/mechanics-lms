-- =============================================================================
-- Ойын дуэлі — досыңды шақыр, бірдей тақтаны ойна, нәтижені салыстыр
-- =============================================================================
-- Run after 0005. Dashboard → SQL Editor → paste → Run.
--
-- Fairness comes from the seed, not from playing at the same moment. Every
-- board in the app is a pure function of (lesson, game, seed), so storing one
-- integer is enough for the challenger and the opponent to receive the
-- identical crossword, the identical shuffled questions, the identical grid —
-- whenever each of them gets round to it.
--
-- That is deliberately not realtime. A live match needs presence, reconnection
-- and clock sync, all of which fail loudly on a lecture-hall wifi; this fails
-- at nothing, and a student can answer a challenge on the bus.
-- =============================================================================

create table if not exists public.game_duels (
  id              uuid primary key default gen_random_uuid(),
  challenger_id   uuid not null references public.profiles (id) on delete cascade,
  opponent_id     uuid not null references public.profiles (id) on delete cascade,
  module_id       integer not null,
  game_mode       text not null,
  -- The whole point of the row: both boards are rebuilt from this.
  seed            integer not null,
  challenger_score integer,
  opponent_score   integer,
  challenger_played_at timestamptz,
  opponent_played_at   timestamptz,
  created_at      timestamptz not null default now(),
  constraint game_duels_distinct check (challenger_id <> opponent_id),
  constraint game_duels_scores check (
    (challenger_score is null or challenger_score between 0 and 100)
    and (opponent_score is null or opponent_score between 0 and 100)
  )
);

create index if not exists game_duels_challenger_idx on public.game_duels (challenger_id, created_at desc);
create index if not exists game_duels_opponent_idx on public.game_duels (opponent_id, created_at desc);

-- -----------------------------------------------------------------------------
-- You may only challenge somebody you are actually friends with, and only a
-- score of your own may be written. Without the second rule a player could
-- post their opponent's result, which is the one thing a duel must not allow.
-- -----------------------------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friend_links f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

create or replace function public.validate_duel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.are_friends(new.challenger_id, new.opponent_id) then
      raise exception 'duels are between friends';
    end if;
    if new.challenger_score is not null or new.opponent_score is not null then
      raise exception 'a duel starts with no scores';
    end if;
    return new;
  end if;

  -- Immutable once set: the board, the players and any score already recorded.
  new.id := old.id;
  new.challenger_id := old.challenger_id;
  new.opponent_id := old.opponent_id;
  new.module_id := old.module_id;
  new.game_mode := old.game_mode;
  new.seed := old.seed;
  new.created_at := old.created_at;

  if old.challenger_score is not null then
    new.challenger_score := old.challenger_score;
    new.challenger_played_at := old.challenger_played_at;
  elsif new.challenger_score is distinct from old.challenger_score then
    if auth.uid() <> old.challenger_id then
      raise exception 'only the challenger may record their own score';
    end if;
    new.challenger_played_at := now();
  end if;

  if old.opponent_score is not null then
    new.opponent_score := old.opponent_score;
    new.opponent_played_at := old.opponent_played_at;
  elsif new.opponent_score is distinct from old.opponent_score then
    if auth.uid() <> old.opponent_id then
      raise exception 'only the opponent may record their own score';
    end if;
    new.opponent_played_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists game_duels_validate on public.game_duels;
create trigger game_duels_validate
  before insert or update on public.game_duels
  for each row execute function public.validate_duel();

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.game_duels enable row level security;

drop policy if exists duels_select on public.game_duels;
create policy duels_select on public.game_duels
  for select using (challenger_id = auth.uid() or opponent_id = auth.uid());

drop policy if exists duels_insert on public.game_duels;
create policy duels_insert on public.game_duels
  for insert with check (challenger_id = auth.uid());

drop policy if exists duels_update on public.game_duels;
create policy duels_update on public.game_duels
  for update using (challenger_id = auth.uid() or opponent_id = auth.uid())
  with check (challenger_id = auth.uid() or opponent_id = auth.uid());

drop policy if exists duels_delete on public.game_duels;
create policy duels_delete on public.game_duels
  for delete using (challenger_id = auth.uid());
