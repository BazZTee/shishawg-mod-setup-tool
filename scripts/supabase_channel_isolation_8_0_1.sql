-- Channel isolation migration for v8.0.1.
-- Existing rows belong to the original #marved workspace.

alter table public.mod_chat add column if not exists channel text;
alter table public.mod_watchlist add column if not exists channel text;
alter table public.bestrafungen add column if not exists channel text;
alter table public.giveaway_winners add column if not exists channel text;

update public.mod_chat set channel = 'marved' where channel is null or btrim(channel) = '';
update public.mod_watchlist set channel = 'marved' where channel is null or btrim(channel) = '';
update public.bestrafungen set channel = 'marved' where channel is null or btrim(channel) = '';
update public.giveaway_winners set channel = 'marved' where channel is null or btrim(channel) = '';

alter table public.mod_chat alter column channel set default 'marved';
alter table public.mod_chat alter column channel set not null;
alter table public.mod_watchlist alter column channel set default 'marved';
alter table public.mod_watchlist alter column channel set not null;
alter table public.bestrafungen alter column channel set default 'marved';
alter table public.bestrafungen alter column channel set not null;
alter table public.giveaway_winners alter column channel set default 'marved';
alter table public.giveaway_winners alter column channel set not null;

create index if not exists idx_mod_chat_channel_created_at on public.mod_chat(channel, created_at);
create index if not exists idx_mod_watchlist_channel_created_at on public.mod_watchlist(channel, created_at);
create index if not exists idx_bestrafungen_channel_created_at on public.bestrafungen(channel, created_at);
create index if not exists idx_giveaway_winners_channel_created_at on public.giveaway_winners(channel, created_at);
