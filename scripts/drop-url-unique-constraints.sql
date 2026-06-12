-- Run this script in the Supabase SQL Editor to allow the same URL to be added
-- multiple times (by the same user or different users). Each row gets its own
-- schedule and counts independently towards the monthly quota.
--
-- Per-user uniqueness constraints (same URL blocked per account):
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS unique_user_url;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_user_id_url_unique;
--
-- Global uniqueness constraints (same URL blocked across all users):
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_key;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_unique;
