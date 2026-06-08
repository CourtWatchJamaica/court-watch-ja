-- Enforce notification idempotency at the database level.
--
-- Each DO block catches errors so the migration succeeds on databases that
-- already have duplicate notification rows; the application-level query fixes
-- in check_notifications() remain the primary guard in that case.  Once
-- existing duplicates are cleaned up, re-running the relevant CREATE UNIQUE
-- INDEX statement directly will activate the constraint.

-- Once-per-event: new_judgment, case_available, case_listed
-- Fire exactly once per (user, event-row, type) — regardless of re-deploys or
-- concurrent scraper runs.
DO $$
BEGIN
    CREATE UNIQUE INDEX uq_notifications_once_per_event
        ON notifications (user_id, case_id, type)
        WHERE type IN ('new_judgment', 'case_available', 'case_listed')
          AND case_id IS NOT NULL;
    RAISE NOTICE 'uq_notifications_once_per_event created';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'uq_notifications_once_per_event skipped — pre-existing duplicate rows detected. Application-level dedup is still active.';
END $$;

-- Daily reminders: fire at most once per (user, sitting, type, calendar-day).
-- The functional index on sent_at::date keeps the key stable and small.
DO $$
BEGIN
    CREATE UNIQUE INDEX uq_notifications_reminder_1d
        ON notifications (user_id, case_id, type, (sent_at::date))
        WHERE type = 'sitting_reminder_1d' AND case_id IS NOT NULL;
    RAISE NOTICE 'uq_notifications_reminder_1d created';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'uq_notifications_reminder_1d skipped.';
END $$;

DO $$
BEGIN
    CREATE UNIQUE INDEX uq_notifications_reminder_morning
        ON notifications (user_id, case_id, type, (sent_at::date))
        WHERE type = 'sitting_reminder_morning' AND case_id IS NOT NULL;
    RAISE NOTICE 'uq_notifications_reminder_morning created';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'uq_notifications_reminder_morning skipped.';
END $$;
