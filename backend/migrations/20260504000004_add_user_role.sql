-- Add role column to users. Existing rows default to 'user'.
-- super_admin is bootstrapped at startup via the ADMIN_EMAIL env var.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
        CHECK (role IN ('user', 'admin', 'super_admin'));

-- Seed additional system_config keys used by the scraper.
INSERT INTO system_config (key, value)
VALUES ('scrape_interval_hours', '24')
ON CONFLICT (key) DO NOTHING;

INSERT INTO system_config (key, value)
VALUES ('max_pdf_failures', '3')
ON CONFLICT (key) DO NOTHING;
