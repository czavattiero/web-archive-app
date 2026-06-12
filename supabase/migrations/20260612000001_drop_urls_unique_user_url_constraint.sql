-- Drop the per-user unique constraint so the same URL can be added multiple times
-- by the same user as independent rows with their own schedules.
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS unique_user_url;
