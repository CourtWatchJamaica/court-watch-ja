-- Task 5a: Allow tracking by case number without a known case_id.
ALTER TABLE user_cases ADD COLUMN IF NOT EXISTS case_number TEXT;
ALTER TABLE user_cases ALTER COLUMN case_id DROP NOT NULL;

-- Drop the old single unique constraint so we can replace with partial indexes.
DO $$ BEGIN
  ALTER TABLE user_cases DROP CONSTRAINT user_cases_user_id_case_id_case_type_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Partial unique index for ID-based tracking (existing rows unaffected).
CREATE UNIQUE INDEX IF NOT EXISTS user_cases_by_id
  ON user_cases (user_id, case_id, case_type)
  WHERE case_id IS NOT NULL;

-- Partial unique index for case_number-only tracking (case_id IS NULL).
CREATE UNIQUE INDEX IF NOT EXISTS user_cases_by_number
  ON user_cases (user_id, case_number, case_type)
  WHERE case_number IS NOT NULL AND case_id IS NULL;

-- Task 5b: Per-tracked-case notification timing preferences.
CREATE TABLE IF NOT EXISTS user_case_settings (
  id                 SERIAL PRIMARY KEY,
  user_case_id       INTEGER NOT NULL REFERENCES user_cases(id) ON DELETE CASCADE,
  notify_immediately BOOLEAN NOT NULL DEFAULT TRUE,
  notify_day_before  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_morning_of  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_case_id)
);
