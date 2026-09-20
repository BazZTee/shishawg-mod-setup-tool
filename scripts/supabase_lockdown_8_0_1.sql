-- Run only after the channel-api Edge Function and the matching app build are deployed.
-- Removes anonymous writes and hides internal/token-bearing tables from the Data API.

-- Preserve the original global Telegram configuration as the #marved configuration.
insert into public.telegram_config (id, bot_token, chat_id, claim_url, updated_at)
select 'marved', bot_token, chat_id, claim_url, updated_at
from public.telegram_config
where id = 'default'
on conflict (id) do nothing;

alter table public.bestrafungen enable row level security;
alter table public.giveaway_winners enable row level security;
alter table public.mod_chat enable row level security;
alter table public.mod_watchlist enable row level security;
alter table public.poll_templates enable row level security;
alter table public.qna_questions enable row level security;
alter table public.qna_settings enable row level security;
alter table public.shisha_sessions enable row level security;
alter table public.shishawg_catalog enable row level security;
alter table public.stream_setups enable row level security;
alter table public.telegram_config enable row level security;

drop policy if exists "Allow anon all on bestrafungen" on public.bestrafungen;
drop policy if exists "Allow anon delete on giveaway_winners" on public.giveaway_winners;
drop policy if exists "Allow anon insert on giveaway_winners" on public.giveaway_winners;
drop policy if exists "Allow anon select on giveaway_winners" on public.giveaway_winners;
drop policy if exists "Allow anon update on giveaway_winners" on public.giveaway_winners;
drop policy if exists "Allow anon all on mod_chat" on public.mod_chat;
drop policy if exists "Allow anon all on mod_watchlist" on public.mod_watchlist;
drop policy if exists "Allow anon all on poll_templates" on public.poll_templates;
drop policy if exists "Allow anon all on qna_questions" on public.qna_questions;
drop policy if exists "Allow anon all on qna_settings" on public.qna_settings;
drop policy if exists "Allow public all on shisha_sessions" on public.shisha_sessions;
drop policy if exists "Allow anon all on shishawg_catalog" on public.shishawg_catalog;
drop policy if exists "Allow anon all on stream_setups" on public.stream_setups;
drop policy if exists "Allow anon all on telegram_config" on public.telegram_config;

revoke all on table public.bestrafungen from anon, authenticated;
revoke all on table public.giveaway_winners from anon, authenticated;
revoke all on table public.mod_chat from anon, authenticated;
revoke all on table public.mod_watchlist from anon, authenticated;
revoke all on table public.poll_templates from anon, authenticated;
revoke all on table public.qna_questions from anon, authenticated;
revoke all on table public.qna_settings from anon, authenticated;
revoke all on table public.shisha_sessions from anon, authenticated;
revoke all on table public.shishawg_catalog from anon, authenticated;
revoke all on table public.stream_setups from anon, authenticated;
revoke all on table public.telegram_config from anon, authenticated;

-- Public display data: read-only and without secret columns.
grant select on table public.bestrafungen to anon, authenticated;
grant select on table public.qna_questions to anon, authenticated;
grant select on table public.shishawg_catalog to anon, authenticated;
grant select on table public.stream_setups to anon, authenticated;
grant select on table public.poll_templates to anon, authenticated;
grant select (channel, persons, active_person, wheel_enabled, display_duration, timer_state, updated_at)
  on table public.qna_settings to anon, authenticated;

create policy "Public read bestrafungen" on public.bestrafungen for select to anon, authenticated using (true);
create policy "Public read qna questions" on public.qna_questions for select to anon, authenticated using (true);
create policy "Public read catalog" on public.shishawg_catalog for select to anon, authenticated using (true);
create policy "Public read stream setups" on public.stream_setups for select to anon, authenticated using (true);
create policy "Public read poll templates" on public.poll_templates for select to anon, authenticated using (true);
create policy "Public read safe qna settings" on public.qna_settings for select to anon, authenticated using (true);

-- Internal tables intentionally have no anon/authenticated policy or grant.
-- The channel-api uses the server-side service role after Twitch authorization.
