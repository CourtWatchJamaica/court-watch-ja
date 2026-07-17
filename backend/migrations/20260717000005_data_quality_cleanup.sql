-- Data-quality cleanup: dateless sittings and duplicate judgments.
-- Safe to run on any database; every step is a no-op when there is nothing
-- to fix.

-- ── 1. Dateless sittings that duplicate a DATED row from the same PDF ────────
-- These are parser artifacts from continuation sections ("CONT'D") where the
-- date header was missed but the same case was also captured with its date.
DELETE FROM court_sittings cs
WHERE cs.event_date IS NULL
  AND cs.case_number IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM court_sittings x
      WHERE x.case_number    = cs.case_number
        AND x.pdf_source_url = cs.pdf_source_url
        AND x.event_date IS NOT NULL
  );

-- ── 2. Exact duplicates among the remaining dateless rows ────────────────────
-- (Same case, type, and source PDF — the unique indexes don't cover NULL
-- event_date, so these accumulated freely.)
DELETE FROM court_sittings a
USING court_sittings b
WHERE a.id > b.id
  AND a.event_date IS NULL
  AND b.event_date IS NULL
  AND a.case_number    IS NOT DISTINCT FROM b.case_number
  AND a.event_type     IS NOT DISTINCT FROM b.event_type
  AND a.pdf_source_url IS NOT DISTINCT FROM b.pdf_source_url;

-- ── 3. Backfill dates that are unambiguous ───────────────────────────────────
-- When every dated row from the same source PDF shares one single date, a
-- dateless row from that PDF can safely inherit it.  Row-by-row with a
-- unique-violation handler: a collision means the row duplicates an existing
-- dated sitting, so it is deleted instead.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT cs.id,
               (SELECT MIN(x.event_date) FROM court_sittings x
                WHERE x.pdf_source_url = cs.pdf_source_url
                  AND x.event_date IS NOT NULL) AS the_date
        FROM court_sittings cs
        WHERE cs.event_date IS NULL
          AND cs.pdf_source_url IS NOT NULL
          AND (SELECT COUNT(DISTINCT x.event_date) FROM court_sittings x
               WHERE x.pdf_source_url = cs.pdf_source_url
                 AND x.event_date IS NOT NULL) = 1
    LOOP
        BEGIN
            UPDATE court_sittings SET event_date = r.the_date WHERE id = r.id;
        EXCEPTION WHEN unique_violation THEN
            DELETE FROM court_sittings WHERE id = r.id;
        END;
    END LOOP;
END $$;

-- ── 4. Duplicate judgment case numbers ───────────────────────────────────────
-- Keep the most complete row (local PDF > pdf link > judge name > oldest id),
-- re-point tracked cases and judgment-type notifications to the keeper, then
-- delete the losers.  notifications.case_id is only compared for judgment
-- types — the same numeric id space is shared with court_sittings.
DO $$
DECLARE
    loser RECORD;
    keeper_id INT;
BEGIN
    FOR loser IN
        SELECT j.id, j.case_number
        FROM judgments j
        WHERE j.id <> (
            SELECT k.id FROM judgments k
            WHERE k.case_number = j.case_number
            ORDER BY (k.local_pdf_path IS NOT NULL) DESC,
                     (k.pdf_url        IS NOT NULL) DESC,
                     (k.judge_name     IS NOT NULL) DESC,
                     k.id ASC
            LIMIT 1
        )
    LOOP
        SELECT k.id INTO keeper_id FROM judgments k
        WHERE k.case_number = loser.case_number
        ORDER BY (k.local_pdf_path IS NOT NULL) DESC,
                 (k.pdf_url        IS NOT NULL) DESC,
                 (k.judge_name     IS NOT NULL) DESC,
                 k.id ASC
        LIMIT 1;

        -- Tracked cases: drop the loser link when the user already tracks the
        -- keeper, otherwise re-point it.
        DELETE FROM user_cases uc
        WHERE uc.case_id = loser.id AND uc.case_type = 'judgment'
          AND EXISTS (
              SELECT 1 FROM user_cases k
              WHERE k.user_id = uc.user_id
                AND k.case_id = keeper_id
                AND k.case_type = 'judgment'
          );
        UPDATE user_cases SET case_id = keeper_id
        WHERE case_id = loser.id AND case_type = 'judgment';

        -- Judgment-type notifications: same dedupe-then-repoint dance.
        DELETE FROM notifications n
        WHERE n.case_id = loser.id
          AND n.type IN ('new_judgment', 'case_available')
          AND EXISTS (
              SELECT 1 FROM notifications k
              WHERE k.user_id = n.user_id
                AND k.case_id = keeper_id
                AND k.type    = n.type
          );
        BEGIN
            UPDATE notifications SET case_id = keeper_id
            WHERE case_id = loser.id
              AND type IN ('new_judgment', 'case_available');
        EXCEPTION WHEN unique_violation THEN
            DELETE FROM notifications
            WHERE case_id = loser.id
              AND type IN ('new_judgment', 'case_available');
        END;

        DELETE FROM judgments WHERE id = loser.id;
    END LOOP;
END $$;
