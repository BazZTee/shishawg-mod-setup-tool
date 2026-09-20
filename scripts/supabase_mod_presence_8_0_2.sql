-- v8.0.2: channel-scoped moderator presence and login history.
-- Run once in the Supabase SQL Editor before deploying the updated channel-api.

create table if not exists public.mod_presence (
  channel text not null,
  twitch_user_id text not null,
  login text not null,
  display_name text not null,
  avatar_url text not null default '',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (channel, twitch_user_id)
);

create index if not exists idx_mod_presence_channel_last_seen
  on public.mod_presence(channel, last_seen_at desc);

alter table public.mod_presence enable row level security;
revoke all on table public.mod_presence from anon, authenticated;

comment on table public.mod_presence is
  'Channel-scoped Twitch moderator login history. Read/write only through channel-api service role.';
