CREATE TABLE judgments (
    id SERIAL PRIMARY KEY,
    case_number TEXT UNIQUE NOT NULL,
    title TEXT,
    judge_name TEXT,
    court TEXT,
    date DATE,
    pdf_url TEXT,
    local_pdf_path TEXT,
    summary_text TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
