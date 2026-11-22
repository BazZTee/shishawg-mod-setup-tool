-- Run in the Supabase SQL Editor before deploying channel-api with direct messages.
create table if not exists public.mod_direct_messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null,
  sender_user_id text not null,
  recipient_user_id text not null,
  sender_login text not null,
  recipient_login text not null,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender_user_id <> recipient_user_id)
);

create index if not exists idx_mod_direct_messages_pair
  on public.mod_direct_messages(channel, sender_user_id, recipient_user_id, created_at desc);
create index if not exists idx_mod_direct_messages_received
  on public.mod_direct_messages(channel, recipient_user_id, sender_user_id, created_at desc);

alter table public.mod_direct_messages enable row level security;
revoke all on table public.mod_direct_messages from public, anon, authenticated;
grant select, insert on table public.mod_direct_messages to service_role;

comment on table public.mod_direct_messages is
  'Private moderator messages. Access only through channel-api with a validated Twitch identity.';
