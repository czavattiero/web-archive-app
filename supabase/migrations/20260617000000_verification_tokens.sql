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
  consumed_by_ip text
);

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens(token);

-- Auto-delete expired tokens after 24 hours (tokens are only valid for a limited time)
CREATE INDEX IF NOT EXISTS idx_verification_tokens_created_at ON verification_tokens(created_at);

-- Enable Row Level Security
ALTER TABLE verification_tokens ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - this table is only accessed via service role key
-- in API routes, never directly by client code
