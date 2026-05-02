-- Add email column to profiles table so sub-user emails can be stored
-- and displayed on the parent account's dashboard without requiring
-- a live auth.admin.getUserById lookup.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;
