CREATE TABLE broadcast_emails (
    id              SERIAL PRIMARY KEY,
    subject         TEXT NOT NULL,
    body_html       TEXT NOT NULL,
    sent_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    recipient_count INT NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'sending'
);
