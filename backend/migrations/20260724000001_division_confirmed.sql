-- The court-lists eviction sweep (evict_stale_court_list_pdfs) treats any
-- current-or-future court_sittings row with court_division = 'Civil' as a
-- possible parser mislabel and deletes-then-rescrapes it on every run. That
-- heuristic exists because the SC PDF parser silently defaults undetected
-- divisions to 'Civil' (court_lists.rs process_pdf_bytes), so a genuinely
-- confirmed "CIVIL DIVISION" cause list is indistinguishable in the DB from a
-- PDF the parser simply failed to classify.
--
-- Because that lookalike is permanent, every real Civil Division cause list
-- (e.g. ordinary HCV-numbered cases) gets deleted and re-scraped on every
-- court-lists cron pass (up to 3x/day), not just once. If the re-scrape ever
-- fails to immediately replace the deleted rows (source PDF split into new
-- URLs, discovery miss, parse error), the case vanishes from the DB with no
-- automatic recovery — and any user_cases row already upgraded to that
-- sitting's id is left pointing at a deleted row forever, since the
-- case_number rematch only fires while case_id IS NULL.
--
-- division_confirmed distinguishes "parser saw an explicit division header"
-- from "parser found no header and fell back to the Civil default", so the
-- eviction sweep can stop touching data it already confirmed.
ALTER TABLE court_sittings
    ADD COLUMN IF NOT EXISTS division_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing Court of Appeal / Parish Court rows always pass an explicit,
-- non-ambiguous division at scrape time (never the Civil-default fallback),
-- so they're retroactively safe to mark confirmed.
UPDATE court_sittings
SET    division_confirmed = TRUE
WHERE  court_division IN ('Court of Appeal', 'Parish Court');
