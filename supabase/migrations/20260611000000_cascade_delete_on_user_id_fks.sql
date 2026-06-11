-- Ensure that deleting an auth user from the Supabase dashboard (or via the
-- admin API) automatically removes all associated rows in urls and captures.
-- Without these CASCADE rules a direct auth.users deletion fails with a
-- foreign-key violation when the app-level cleanup has not run first.

ALTER TABLE public.urls
  DROP CONSTRAINT IF EXISTS urls_user_id_fkey;

ALTER TABLE public.urls
  ADD CONSTRAINT urls_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

ALTER TABLE public.captures
  DROP CONSTRAINT IF EXISTS captures_user_id_fkey;

ALTER TABLE public.captures
  ADD CONSTRAINT captures_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;
