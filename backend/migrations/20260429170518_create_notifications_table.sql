CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    case_id INT REFERENCES judgments(id),
    type TEXT,
    sent_at TIMESTAMP DEFAULT NOW()
);
