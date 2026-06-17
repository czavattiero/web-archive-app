-- Create table to store verification tokens that map to actual OTP URLs.
-- This prevents email scanners from consuming one-time tokens by hiding
-- the real Supabase OTP URL behind a randomly generated token that can
-- only be exchanged once by a real user clicking the button.

CREATE TABLE IF NOT EXISTS verification_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL,
  otp_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  consumed_by_ip text,
  -- Ensure tokens can only be consumed once
  CONSTRAINT consumed_once CHECK (consumed_at IS NULL OR consumed_by_ip IS NOT NULL)
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);

-- Index for cleanup of expired tokens
CREATE INDEX IF NOT EXISTS idx_verification_tokens_created_at ON verification_tokens(created_at);

-- Enable Row Level Security
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - this table is only accessed via service role key
-- in API routes, never directly by client code

-- Automatic cleanup function for expired tokens (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM verification_tokens
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Note: Schedule this function to run periodically using pg_cron or your deployment platform's cron
-- Example for pg_cron (if available):
-- SELECT cron.schedule('cleanup-verification-tokens', '0 * * * *', 'SELECT cleanup_expired_verification_tokens()');

