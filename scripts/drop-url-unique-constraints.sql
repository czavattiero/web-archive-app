-- Run this script in the Supabase SQL Editor to allow duplicate URLs per user.
-- It drops ALL per-user URL uniqueness constraints regardless of their name,
-- so the same URL can be added more than once by the same user, each entry
-- having its own schedule and counting towards the monthly quota.

ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS unique_user_url;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_user_id_url_unique;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_key;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_unique;
