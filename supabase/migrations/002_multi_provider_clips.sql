-- Migration: multi-provider clip support
-- Adds provider tracking to clips table and job metadata column.
-- Keeps kling_task_id for backward compatibility.
--
-- Apply: supabase db push  OR  run manually in Supabase SQL editor

-- 1. Add provider column to clips (defaults to 'kling' for all existing rows)
ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'kling'
    CHECK (provider IN ('kling', 'seedance'));

-- 2. Add unified task_id column (mirrors kling_task_id for existing clips)
--    New code writes to both task_id and kling_task_id during migration period.
ALTER TABLE clips
  ADD COLUMN IF NOT EXISTS task_id TEXT;

-- Backfill task_id from kling_task_id for existing rows
UPDATE clips SET task_id = kling_task_id WHERE task_id IS NULL AND kling_task_id IS NOT NULL;

-- 3. Add metadata JSONB column to jobs (already used by paper sub_type)
--    If the column already exists from a manual add, this is a no-op.
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- 4. Add kling_element_id and kling_element_voice_id to influencers
--    For Kling 3.0 Subject Library support (stores registered element IDs)
ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS kling_element_id TEXT,
  ADD COLUMN IF NOT EXISTS kling_element_voice_id TEXT;

-- 5. Index for provider-based queries (recovery scripts, monitoring)
CREATE INDEX IF NOT EXISTS clips_provider_status_idx ON clips(provider, status);
