-- Global per-user email opt-out. The Settings page has offered an "Email
-- Notifications" switch for a while, but the backend accepted the value and
-- discarded it, so opted-out users kept receiving alert emails. The email
-- dispatcher now skips users with this flag off; in-app notifications are
-- unaffected.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
