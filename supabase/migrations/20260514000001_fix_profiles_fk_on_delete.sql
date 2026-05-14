-- Fix the self-referential foreign key on profiles.parent_user_id.
-- Previously had no ON DELETE behaviour, which blocked deletion of any parent
-- profile row that still had sub-users pointing to it.
-- Now: deleting a parent profile nulls out sub-users' parent_user_id instead
-- of raising a foreign key violation.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_parent_user_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_parent_user_id_fkey
  FOREIGN KEY (parent_user_id)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;
