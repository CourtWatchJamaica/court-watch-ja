CREATE TABLE parish_court_cases (
    id SERIAL PRIMARY KEY,
    parish TEXT NOT NULL,
    accused_name TEXT,
    offence TEXT,
    status TEXT,
    week_of DATE,
    pdf_source_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pcc_parish  ON parish_court_cases (parish);
CREATE INDEX idx_pcc_week_of ON parish_court_cases (week_of DESC NULLS LAST);
