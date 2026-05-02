CREATE TABLE judges (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    court TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
