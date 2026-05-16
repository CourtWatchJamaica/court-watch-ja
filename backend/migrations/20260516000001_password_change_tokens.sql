ALTER TABLE verification_tokens
<<<<<<< HEAD
  ADD COLUMN IF NOT EXISTS token_type         TEXT NOT NULL DEFAULT 'email_verification',
=======
  ADD COLUMN IF NOT EXISTS token_type          TEXT NOT NULL DEFAULT 'email_verification',
>>>>>>> V4.3----UPDATE-UI-
  ADD COLUMN IF NOT EXISTS pending_password_hash TEXT;
