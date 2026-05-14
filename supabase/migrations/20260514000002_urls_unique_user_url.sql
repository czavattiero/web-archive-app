-- Drop the old single-column unique constraint on url (created by Supabase dashboard)
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_key;
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_url_unique;

-- Add per-user unique constraint so each user can have their own row per URL
ALTER TABLE public.urls ADD CONSTRAINT urls_user_id_url_unique UNIQUE (user_id, url);
