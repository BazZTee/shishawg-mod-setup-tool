-- v8.0.9: mod-chat read receipts ("Gelesen von").
-- Run once in the Supabase SQL Editor BEFORE deploying the updated channel-api
-- (presence.list selects this column and fails until it exists).

alter table public.mod_presence
  add column if not exists chat_read_at timestamptz;

comment on column public.mod_presence.chat_read_at is
  'Newest mod-chat message timestamp this mod has seen in the channel. Written only via channel-api presence.read.';
