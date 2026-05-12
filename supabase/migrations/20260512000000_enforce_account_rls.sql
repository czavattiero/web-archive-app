-- Enforce account ownership boundaries at the DB layer.
-- Users can access only their own account data (or their sub-users where applicable).

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.urls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_or_account ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_record ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own_record ON public.profiles;

CREATE POLICY profiles_select_own_or_account ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR parent_user_id = auth.uid()
  );

CREATE POLICY profiles_update_own_record ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      parent_user_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.profiles parent
        WHERE parent.id = parent_user_id
          AND parent.parent_user_id IS NULL
      )
    )
  );

CREATE POLICY profiles_insert_own_record ON public.profiles
  FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND (
      parent_user_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.profiles parent
        WHERE parent.id = parent_user_id
          AND parent.parent_user_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS urls_select_account_members ON public.urls;
DROP POLICY IF EXISTS urls_insert_self_only ON public.urls;
DROP POLICY IF EXISTS urls_update_account_members ON public.urls;
DROP POLICY IF EXISTS urls_delete_account_members ON public.urls;

CREATE POLICY urls_select_account_members ON public.urls
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.profiles WHERE parent_user_id = auth.uid())
  );

CREATE POLICY urls_insert_self_only ON public.urls
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY urls_update_account_members ON public.urls
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.profiles WHERE parent_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.profiles WHERE parent_user_id = auth.uid())
  );

CREATE POLICY urls_delete_account_members ON public.urls
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.profiles WHERE parent_user_id = auth.uid())
  );

DROP POLICY IF EXISTS captures_select_account_members ON public.captures;
DROP POLICY IF EXISTS captures_insert_self_only ON public.captures;
DROP POLICY IF EXISTS captures_update_account_members ON public.captures;

CREATE POLICY captures_select_account_members ON public.captures
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.profiles WHERE parent_user_id = auth.uid())
  );

CREATE POLICY captures_insert_self_only ON public.captures
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY captures_update_account_members ON public.captures
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.profiles WHERE parent_user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IN (SELECT id FROM public.profiles WHERE parent_user_id = auth.uid())
  );

DROP POLICY IF EXISTS subscriptions_select_self ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_insert_self ON public.subscriptions;
DROP POLICY IF EXISTS subscriptions_update_self ON public.subscriptions;

CREATE POLICY subscriptions_select_self ON public.subscriptions
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY subscriptions_insert_self ON public.subscriptions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY subscriptions_update_self ON public.subscriptions
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
