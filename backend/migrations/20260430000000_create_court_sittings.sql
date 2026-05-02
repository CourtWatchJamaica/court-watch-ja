CREATE TABLE IF NOT EXISTS court_sittings (
    id             SERIAL PRIMARY KEY,
    case_number    TEXT,
    title          TEXT,
    judge_name     TEXT,
    court_division TEXT DEFAULT 'Civil',
    event_type     TEXT,
    event_date     DATE,
    event_time     TIME,
    lawyers        TEXT,
    pdf_source_url TEXT,
    created_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_court_sittings_event_date ON court_sittings (event_date);
CREATE INDEX IF NOT EXISTS idx_court_sittings_pdf_url    ON court_sittings (pdf_source_url);
