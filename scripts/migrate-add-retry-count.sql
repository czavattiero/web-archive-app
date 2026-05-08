-- Migration: add retry_count column to urls table
-- Run this once in the Supabase SQL editor before deploying the retry logic.
ALTER TABLE urls ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0;
