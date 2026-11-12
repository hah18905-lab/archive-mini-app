-- ARCHIVE 9.1 / Supabase database schema.
-- Run this in Supabase SQL Editor once. No Telegram bot token in SQL or GitHub.
begin;
create table if not exists public.archive_users (
  telegram_id bigint primary key check (telegram_id > 0),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table if not exists public.archive_story_state (
  telegram_id bigint not null references public.archive_users(telegram_id) on delete cascade,
  story_id integer not null check (story_id > 0),
  rating smallint not null default 0 check (rating in (-1, 0, 1)),
  bookmarked boolean not null default false,
  progress_pct smallint not null default 0 check (progress_pct between 0 and 100),
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (telegram_id, story_id)
);
create index if not exists archive_story_state_bookmarks
  on public.archive_story_state (telegram_id, updated_at desc) where bookmarked = true;
create index if not exists archive_story_state_likes
  on public.archive_story_state (telegram_id, rating) where rating <> 0;
alter table public.archive_users enable row level security;
alter table public.archive_story_state enable row level security;
-- Never expose a table or privileged RPC directly through the public REST API.
revoke all on table public.archive_users, public.archive_story_state from public, anon, authenticated;
grant select, insert, update, delete on public.archive_users, public.archive_story_state to service_role;
create or replace function public.archive_write_state(
  p_telegram_id bigint,
  p_story_id integer,
  p_action text,
  p_value integer
)
returns public.archive_story_state
language plpgsql
security invoker
set search_path = public
as $$
declare
  rec public.archive_story_state;
begin
  if p_telegram_id is null or p_telegram_id <= 0 or
     p_story_id is null or p_story_id < 1 or p_story_id > 1000000 then
    raise exception 'Invalid user or story id';
  end if;
  if p_action not in ('rate', 'bookmark', 'progress') or
     (p_action = 'rate' and p_value not in (-1,0,1)) or
     (p_action = 'bookmark' and p_value not in (0,1)) or
     (p_action = 'progress' and (p_value < 0 or p_value > 100)) then
    raise exception 'Invalid action or value';
  end if;
  insert into public.archive_users(telegram_id)
    values(p_telegram_id)
    on conflict(telegram_id) do update set last_seen_at = now();
  insert into public.archive_story_state
    (telegram_id, story_id, rating, bookmarked, progress_pct, last_read_at)
  values
    (p_telegram_id, p_story_id,
     case when p_action='rate' then p_value else 0 end,
     case when p_action='bookmark' then p_value=1 else false end,
     case when p_action='progress' then p_value else 0 end,
     case when p_action='progress' then now() else null end)
  on conflict (telegram_id,story_id) do update
  set rating = case when p_action='rate' then excluded.rating else archive_story_state.rating end,
      bookmarked = case when p_action='bookmark' then excluded.bookmarked else archive_story_state.bookmarked end,
      progress_pct = case when p_action='progress'
        then greatest(archive_story_state.progress_pct,excluded.progress_pct)
        else archive_story_state.progress_pct end,
      last_read_at = case when p_action='progress' then now() else archive_story_state.last_read_at end,
      updated_at = now()
  returning * into rec;
  return rec;
end;
$$;
revoke all on function public.archive_write_state(bigint,integer,text,integer) from public,anon,authenticated;
grant execute on function public.archive_write_state(bigint,integer,text,integer) to service_role;
commit;
