ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing users are already real accounts; treat them as verified.
<<<<<<< HEAD
UPDATE users SET email_verified = TRUE;
=======
UPDATE users SET email_verified = TRUE WHERE email_verified = FALSE;
>>>>>>> V4.3----UPDATE-UI-

CREATE TABLE IF NOT EXISTS verification_tokens (
    token      TEXT      PRIMARY KEY,
    user_id    INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
