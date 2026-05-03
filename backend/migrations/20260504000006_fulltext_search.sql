-- Add generated tsvector columns and GIN indexes for full-text search.
-- search_vector is GENERATED ALWAYS AS ... STORED so it is always in sync
-- but is never included in explicit SELECT lists (sqlx cannot decode tsvector).

ALTER TABLE judgments
    ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english',
                COALESCE(title, '')        || ' ' ||
                COALESCE(case_number, '')  || ' ' ||
                COALESCE(judge_name, '')   || ' ' ||
                COALESCE(summary_text, '')
            )
        ) STORED;

CREATE INDEX IF NOT EXISTS idx_judgments_fts ON judgments USING GIN(search_vector);

ALTER TABLE court_sittings
    ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
            to_tsvector('english',
                COALESCE(title, '')       || ' ' ||
                COALESCE(case_number, '') || ' ' ||
                COALESCE(judge_name, '')  || ' ' ||
                COALESCE(lawyers, '')
            )
        ) STORED;

CREATE INDEX IF NOT EXISTS idx_court_sittings_fts ON court_sittings USING GIN(search_vector);
