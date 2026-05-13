CREATE TABLE legal_news (
    id           SERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT,
    source       TEXT NOT NULL,
    url          TEXT NOT NULL UNIQUE,
    published_at TIMESTAMP,
    category     TEXT NOT NULL DEFAULT 'crime',
    created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX legal_news_published_idx ON legal_news (published_at DESC NULLS LAST);
CREATE INDEX legal_news_category_idx  ON legal_news (category);
