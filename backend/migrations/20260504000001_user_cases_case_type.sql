-- Allow case_id to reference either judgments or court_sittings depending on case_type.
ALTER TABLE user_cases DROP CONSTRAINT IF EXISTS user_cases_case_id_fkey;

-- Track what kind of item the user is following.
ALTER TABLE user_cases
    ADD COLUMN case_type       TEXT NOT NULL DEFAULT 'judgment',
    ADD COLUMN last_event_date DATE,
    ADD COLUMN last_event_time TIME;

-- Prevent duplicate tracking entries: same user + same id + same type.
ALTER TABLE user_cases
    ADD CONSTRAINT user_cases_unique_tracking UNIQUE (user_id, case_id, case_type);

-- Allow notifications to reference court_sittings IDs as well.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_case_id_fkey;
