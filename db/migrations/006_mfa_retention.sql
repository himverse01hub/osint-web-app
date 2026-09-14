-- 006_mfa_retention.sql
-- Spec §22: MFA-ready architecture + data-retention configuration.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_enrolled_at timestamptz;

-- Short-lived challenge tokens issued when an MFA-enabled user submits
-- valid credentials; completed or expired challenges are worthless.
CREATE TABLE IF NOT EXISTS mfa_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS mfa_challenges_expires_idx ON mfa_challenges(expires_at);

-- Configurable retention periods (days); consumed by db/retention.mjs.
CREATE TABLE IF NOT EXISTS retention_config (
  resource text PRIMARY KEY,
  retain_days integer NOT NULL CHECK (retain_days > 0),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
INSERT INTO retention_config (resource, retain_days) VALUES
  ('audit_logs', 365),
  ('search_runs', 180),
  ('sessions', 30),
  ('mfa_challenges', 1)
ON CONFLICT (resource) DO NOTHING;
