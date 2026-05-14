-- Explicit GRANTs for all public schema tables.
-- Required for Supabase's May 30, 2026 change: new projects no longer expose
-- public schema tables to the Data API by default. Existing projects must have
-- explicit grants in place before October 30, 2026.
--
-- service_role: used by all server-side API routes (bypasses RLS but still
--               needs table-level privileges after the policy change).
-- authenticated: used by client-side supabase-js calls (subject to RLS).
-- anon:          not granted on any table — all app access requires auth.

-- profiles
grant select, insert, update
  on public.profiles
  to authenticated;

grant select, insert, update, delete
  on public.profiles
  to service_role;

-- urls
grant select, insert, update, delete
  on public.urls
  to authenticated;

grant select, insert, update, delete
  on public.urls
  to service_role;

-- captures
grant select, insert, update, delete
  on public.captures
  to authenticated;

grant select, insert, update, delete
  on public.captures
  to service_role;

-- subscriptions
grant select, insert, update
  on public.subscriptions
  to authenticated;

grant select, insert, update, delete
  on public.subscriptions
  to service_role;
