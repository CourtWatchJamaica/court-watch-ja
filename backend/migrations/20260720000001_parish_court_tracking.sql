-- Extend the existing user_cases/notifications tracking system (already used
-- for judgments and court_sittings) to cover Parish Court cases, so lawyers
-- can follow a case and get notified when its status changes (e.g. Mention →
-- Adjourned → Trial).
--
-- case_type = 'parish_court' plumbs through the existing generic
-- /api/user/cases endpoints unchanged; case_id references parish_court_cases(id).
ALTER TABLE user_cases ADD COLUMN IF NOT EXISTS last_status TEXT;
