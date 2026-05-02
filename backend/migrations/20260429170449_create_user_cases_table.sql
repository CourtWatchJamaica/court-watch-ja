CREATE TABLE user_cases (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    case_id INT REFERENCES judgments(id),
    created_at TIMESTAMP DEFAULT NOW()
);
