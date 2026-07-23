-- Tracks the last time an admin alert email was sent for a given route/error
-- key, so a burst of identical failures (e.g. a broken GITHUB_TOKEN causing
-- every "Add URL" click to fail) sends one email instead of flooding the
-- inbox. See lib/server/alertAdmin.ts.
create table if not exists public.alert_throttle (
  route_key text primary key,
  last_sent_at timestamptz not null default now()
);

alter table public.alert_throttle enable row level security;
