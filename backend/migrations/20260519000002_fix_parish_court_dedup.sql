-- Problem 1: Delete duplicate rows created by ON CONFLICT DO NOTHING
-- targeting only the primary key.  Keep the lowest id for each logical case.
DELETE FROM parish_court_cases
WHERE id NOT IN (
    SELECT MIN(id)
    FROM parish_court_cases
    GROUP BY
        parish,
        COALESCE(accused_name,   ''),
        COALESCE(offence,        ''),
        COALESCE(week_of,        '1970-01-01'::date),
        COALESCE(pdf_source_url, '')
);

-- Problem 2: Add case_type column to distinguish civil from criminal rows.
ALTER TABLE parish_court_cases
    ADD COLUMN IF NOT EXISTS case_type TEXT NOT NULL DEFAULT 'criminal';

-- Problem 1 (fix going forward): Create a functional unique index so future
-- inserts with ON CONFLICT (…COALESCE…) DO NOTHING actually deduplicate.
-- NULL values in any column would otherwise compare as unequal to each other,
-- letting duplicates through a plain UNIQUE constraint.
CREATE UNIQUE INDEX IF NOT EXISTS uq_parish_case
    ON parish_court_cases (
        parish,
        COALESCE(accused_name,   ''),
        COALESCE(offence,        ''),
        COALESCE(week_of,        '1970-01-01'::date),
        COALESCE(pdf_source_url, '')
    );
