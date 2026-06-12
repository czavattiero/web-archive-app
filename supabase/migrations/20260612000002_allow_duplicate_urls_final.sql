-- Final comprehensive drop of all URL uniqueness constraints so that the same
-- URL can be added more than once by the same user.  Each row gets its own
-- independent schedule and counts separately towards the monthly quota.
--
-- Covers every constraint name that may exist depending on how the project was
-- originally set up (dashboard auto-name, first migration name, second migration
-- name):
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS unique_user_url;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_user_id_url_unique;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_key;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_unique;
