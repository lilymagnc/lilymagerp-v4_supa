
CREATE TABLE IF NOT EXISTS daily_settlements (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  branch_name TEXT,
  date TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  settlement_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster lookup
CREATE INDEX IF NOT EXISTS idx_daily_settlements_branch_date ON daily_settlements(branch_id, date);
