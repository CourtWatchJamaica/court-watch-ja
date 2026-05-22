-- Remove duplicate court sittings inserted by the scraper on every run.
-- The dedup key is (case_number, event_date, event_type, event_time); when all
-- four are NULL we keep only one row.  We keep the oldest id in each group.
DELETE FROM court_sittings
WHERE id NOT IN (
    SELECT MIN(id)
    FROM court_sittings
    GROUP BY
        COALESCE(case_number, ''),
        COALESCE(event_date::text, 'null'),
        COALESCE(event_type, ''),
        COALESCE(event_time::text, '')
);

-- Prevent future duplicates.
-- Two partial indexes are used because PostgreSQL requires index expressions
-- to be IMMUTABLE; the cast-to-text approach is not.

-- Sittings without an event_type (common for Gun Court / bare cause-list entries).
CREATE UNIQUE INDEX IF NOT EXISTS uq_court_sittings_untyped
ON court_sittings (case_number, event_date)
WHERE case_number IS NOT NULL
  AND event_date  IS NOT NULL
  AND event_type  IS NULL
  AND event_time  IS NULL;

-- Sittings that carry an explicit event_type.
CREATE UNIQUE INDEX IF NOT EXISTS uq_court_sittings_typed
ON court_sittings (case_number, event_date, event_type)
WHERE case_number IS NOT NULL
  AND event_date  IS NOT NULL
  AND event_type  IS NOT NULL;
