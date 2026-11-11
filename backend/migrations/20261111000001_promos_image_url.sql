-- Optional banner image for promo popups. Stored as a public https URL
-- (pasted by the admin); the app does not host the image itself.
ALTER TABLE promos ADD COLUMN IF NOT EXISTS image_url TEXT;
