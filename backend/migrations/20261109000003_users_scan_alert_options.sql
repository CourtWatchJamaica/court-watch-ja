-- Scan-alert delivery options.
--   scan_alert_channel   : 'in_app' (default) | 'both'  — whether the digest is
--                          also emailed (still subject to users.email_notifications).
--   scan_alert_frequency : 'every_scan' | 'daily' (default) | 'weekly' — how
--                          often a digest is generated at all.
ALTER TABLE users ADD COLUMN IF NOT EXISTS scan_alert_channel   TEXT NOT NULL DEFAULT 'in_app';
ALTER TABLE users ADD COLUMN IF NOT EXISTS scan_alert_frequency TEXT NOT NULL DEFAULT 'daily';

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_scan_alert_channel_chk
    CHECK (scan_alert_channel IN ('in_app', 'both'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_scan_alert_frequency_chk
    CHECK (scan_alert_frequency IN ('every_scan', 'daily', 'weekly'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
