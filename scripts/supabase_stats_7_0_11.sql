-- Optional stats enrichment for ShishaWG Mod Setup Tool 7.0.11.
-- Run once in the Supabase SQL editor. Existing rows remain valid.

alter table public.shisha_sessions
  add column if not exists tobacco_items jsonb not null default '[]'::jsonb,
  add column if not exists electric_device text not null default '',
  add column if not exists is_electric boolean not null default false;

comment on column public.shisha_sessions.tobacco_items is
  'Individual tobacco varieties used in this session; the tobacco column remains the display mix.';
comment on column public.shisha_sessions.electric_device is
  'Selected electric head or all-in-one device, stored separately from bowls and HMDs.';
comment on column public.shisha_sessions.is_electric is
  'True when the session uses an electric device and the timer uses an 8-minute preheat phase.';
