-- v8.0.9: Push notifications for the Android app (Firebase Cloud Messaging).
-- Run once in the Supabase SQL Editor before deploying the updated channel-api.
-- Then set the Supabase secret FCM_SERVICE_ACCOUNT to the Firebase service account JSON.

create table if not exists public.push_devices (
  token text not null,
  channel text not null,
  twitch_user_id text not null,
  login text not null default '',
  platform text not null default 'android',
  updated_at timestamptz not null default now(),
  primary key (token, channel)
);

create index if not exists idx_push_devices_channel_user
  on public.push_devices(channel, twitch_user_id);

alter table public.push_devices enable row level security;
revoke all on table public.push_devices from public, anon, authenticated;

comment on table public.push_devices is
  'FCM device tokens per channel and Twitch user. Read/write only through channel-api (push.register / push.unregister).';
