-- Adds a unique index on judges.name so that ON CONFLICT (name) works.
-- IF NOT EXISTS makes this safe to re-run (e.g. if the index already exists
-- from a manual fix or a previous partial migration).
CREATE UNIQUE INDEX IF NOT EXISTS idx_judges_name ON judges (name);
