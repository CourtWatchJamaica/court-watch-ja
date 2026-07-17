-- Per-run scraper telemetry, powering the /admin/health dashboard and the
-- stale-source alert emails.  One row per (source, run).
CREATE TABLE IF NOT EXISTS scraper_runs (
    id          SERIAL PRIMARY KEY,
    source      TEXT NOT NULL,
    started_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    rows_added  BIGINT NOT NULL DEFAULT 0,
    success     BOOLEAN NOT NULL DEFAULT TRUE,
    error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_source_time
    ON scraper_runs (source, started_at DESC);
