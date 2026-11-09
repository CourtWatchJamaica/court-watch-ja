-- Opt-in "scan alert": after every notification pass (each scraper run and the
-- weekend reminder pass) the user gets an in-app notification saying how many
-- of their tracked cases were checked and how many had updates — a positive
-- confirmation that the courts were scanned even when nothing changed.
-- Off by default; several passes run per weekday.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_scan BOOLEAN NOT NULL DEFAULT FALSE;
