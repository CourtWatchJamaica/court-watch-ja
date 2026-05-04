-- Mutable runtime configuration stored in the DB.
-- The application seeds this table from env vars at startup; subsequent changes
-- (e.g. updating the cutoff date from an admin endpoint) are written here, never
-- to the .env file.
CREATE TABLE IF NOT EXISTS system_config (
    key        TEXT      PRIMARY KEY,
    value      TEXT      NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Default judgment cutoff date.  The startup hook overwrites this if
-- JUDGMENT_CUTOFF_DATE is set in the environment.
INSERT INTO system_config (key, value)
VALUES ('judgment_cutoff_date', '2026-01-01')
ON CONFLICT (key) DO NOTHING;
