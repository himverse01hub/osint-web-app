-- Migration: real-time / DB-backed data layer
-- Run this in the Neon SQL editor against an existing database created from db/schema.sql.

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'high_risk_activity';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS entity_type TEXT;

ALTER TABLE cases ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS dark_web_mentions (
  id TEXT PRIMARY KEY,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_value TEXT,
  market_place TEXT NOT NULL,
  listing_title TEXT NOT NULL,
  description TEXT NOT NULL,
  price TEXT,
  currency TEXT,
  seller TEXT,
  date_posted TIMESTAMPTZ,
  data_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL DEFAULT 'medium',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open',
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);