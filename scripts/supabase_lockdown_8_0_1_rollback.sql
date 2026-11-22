-- Emergency rollback for supabase_lockdown_8_0_1.sql.
-- Restores the open anon access recorded on 2026-11-22 right before the lockdown ran.
-- Only use this if the lockdown breaks something that cannot be fixed otherwise:
-- afterwards every table is readable and writable with the public app key again.

drop policy if exists "Public read bestrafungen" on public.bestrafungen;
drop policy if exists "Public read qna questions" on public.qna_questions;
drop policy if exists "Public read catalog" on public.shishawg_catalog;
drop policy if exists "Public read stream setups" on public.stream_setups;
drop policy if exists "Public read poll templates" on public.poll_templates;
drop policy if exists "Public read safe qna settings" on public.qna_settings;

grant all on table
  public.bestrafungen, public.giveaway_winners, public.mod_chat, public.mod_watchlist,
  public.poll_templates, public.qna_questions, public.qna_settings, public.shisha_sessions,
  public.shishawg_catalog, public.stream_setups, public.telegram_config
to anon, authenticated;

create policy "Allow anon all on bestrafungen" on public.bestrafungen for all to anon using (true) with check (true);
create policy "Allow anon delete on giveaway_winners" on public.giveaway_winners for delete to anon using (true);
create policy "Allow anon insert on giveaway_winners" on public.giveaway_winners for insert to anon with check (true);
create policy "Allow anon select on giveaway_winners" on public.giveaway_winners for select to anon using (true);
create policy "Allow anon update on giveaway_winners" on public.giveaway_winners for update to anon using (true) with check (true);
create policy "Allow anon all on mod_chat" on public.mod_chat for all to anon using (true) with check (true);
create policy "Allow anon all on mod_watchlist" on public.mod_watchlist for all to anon using (true) with check (true);
create policy "Allow anon all on poll_templates" on public.poll_templates for all to anon using (true) with check (true);
create policy "Allow anon all on qna_questions" on public.qna_questions for all to anon using (true) with check (true);
create policy "Allow anon all on qna_settings" on public.qna_settings for all to anon using (true) with check (true);
create policy "Allow public all on shisha_sessions" on public.shisha_sessions for all to public using (true) with check (true);
create policy "Allow anon all on shishawg_catalog" on public.shishawg_catalog for all to anon using (true) with check (true);
create policy "Allow anon all on stream_setups" on public.stream_setups for all to anon using (true) with check (true);
create policy "Allow anon all on telegram_config" on public.telegram_config for all to anon using (true) with check (true);
