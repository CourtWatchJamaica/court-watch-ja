-- Notification email outbox + hardened dedup.
--
-- 1. `emailed_at` marks a notification as dispatched by email.  The dispatcher
--    atomically claims unemailed rows (FOR UPDATE SKIP LOCKED), so overlapping
--    scraper runs can never send the same email twice.
--    All pre-existing rows are backfilled as "already emailed" so this
--    migration does not trigger a burst of emails for the historical backlog.
--
-- 2. Duplicate notification rows (which prevented the unique indexes in
--    20260608000001 from being created on databases that already had dupes)
--    are removed here, keeping the oldest row, and the indexes are then
--    created unconditionally with IF NOT EXISTS.
--
-- 3. `sitting_changed` gains the same once-per-day protection the reminder
--    types already have — previously it relied only on an application-level
--    23-hour window, which concurrent runs could race past.

-- ── 1. Email outbox column ───────────────────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMP;

UPDATE notifications SET emailed_at = sent_at WHERE emailed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unemailed
    ON notifications (sent_at)
    WHERE emailed_at IS NULL;

-- ── 2. Remove duplicates, then activate the unique indexes ───────────────────

-- Once-per-event types: keep the oldest row per (user, case, type).
DELETE FROM notifications a
USING notifications b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.case_id = b.case_id
  AND a.type    = b.type
  AND a.type IN ('new_judgment', 'case_available', 'case_listed')
  AND a.case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_once_per_event
    ON notifications (user_id, case_id, type)
    WHERE type IN ('new_judgment', 'case_available', 'case_listed')
      AND case_id IS NOT NULL;

-- Daily reminder types: keep the oldest row per (user, case, type, day).
DELETE FROM notifications a
USING notifications b
WHERE a.id > b.id
  AND a.user_id = b.user_id
  AND a.case_id = b.case_id
  AND a.type    = b.type
  AND a.sent_at::date = b.sent_at::date
  AND a.type IN ('sitting_reminder_1d', 'sitting_reminder_morning', 'sitting_changed')
  AND a.case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_reminder_1d
    ON notifications (user_id, case_id, type, (sent_at::date))
    WHERE type = 'sitting_reminder_1d' AND case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_reminder_morning
    ON notifications (user_id, case_id, type, (sent_at::date))
    WHERE type = 'sitting_reminder_morning' AND case_id IS NOT NULL;

-- ── 3. sitting_changed: at most one per (user, sitting, day) ─────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_sitting_changed_1d
    ON notifications (user_id, case_id, type, (sent_at::date))
    WHERE type = 'sitting_changed' AND case_id IS NOT NULL;
