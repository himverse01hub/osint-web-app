-- Evidence management: integrity (SHA-256), chain-of-custody, malware-scan gate
CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL DEFAULT 'document',
  title TEXT NOT NULL,
  description TEXT,
  sha256 TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  collected_by TEXT,
  file_name TEXT,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  scan_status TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending', 'clean', 'flagged')),
  chain_of_custody JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evidence_case_id_idx ON evidence(case_id);
CREATE INDEX IF NOT EXISTS evidence_sha256_idx ON evidence(sha256);
