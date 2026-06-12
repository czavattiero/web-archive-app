-- Allow the same URL to be added multiple times by the same user (each as a separate row)
ALTER TABLE public.urls DROP CONSTRAINT IF EXISTS urls_user_id_url_unique;
