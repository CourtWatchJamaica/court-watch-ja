-- Tracks which locally saved court-list PDFs have been parsed, with what
-- content hash and parser version.  The startup backfill uses this to re-parse
-- a PDF only when its bytes changed or the parser improved, making the
-- re-ingest idempotent and cheap on every boot (important for hosts that spin
-- the service down and back up).
CREATE TABLE IF NOT EXISTS pdf_ingest_state (
    filename         TEXT PRIMARY KEY,
    pdf_hash         TEXT NOT NULL,
    parser_version   INT  NOT NULL,
    entries_inserted BIGINT NOT NULL DEFAULT 0,
    processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
