-- Add co-accused, phone, email, address, any_id columns to cases table
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS co_accused JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS any_id TEXT;