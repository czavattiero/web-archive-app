-- Migration: add sub-user support
-- Run this in your Supabase SQL editor before deploying the sub-user feature.

-- 1. Add parent_user_id to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS parent_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Index for fast sub-user lookups
CREATE INDEX IF NOT EXISTS profiles_parent_user_id_idx ON profiles(parent_user_id);
