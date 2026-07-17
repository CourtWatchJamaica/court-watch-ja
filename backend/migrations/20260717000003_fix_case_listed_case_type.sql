-- Repair rows corrupted by the old case_listed upgrade path.
--
-- When a case_number-only tracked row got its first sitting, the code set
-- case_id = <court_sittings.id> but left case_type as 'judgment' (the
-- default).  Those rows (a) never matched the sitting-reminder queries, which
-- filter on case_type = 'sitting', and (b) could join against an unrelated
-- judgment that happens to share the numeric id.
--
-- A row is provably in this state when its case_id points at a court_sitting
-- whose case_number matches the tracked number, while no judgment with that
-- id matches it.
UPDATE user_cases uc
SET    case_type = 'sitting'
WHERE  uc.case_type   = 'judgment'
  AND  uc.case_number IS NOT NULL
  AND  uc.case_id     IS NOT NULL
  AND  EXISTS (
         SELECT 1 FROM court_sittings cs
         WHERE  cs.id = uc.case_id AND cs.case_number = uc.case_number
       )
  AND  NOT EXISTS (
         SELECT 1 FROM judgments j
         WHERE  j.id = uc.case_id AND j.case_number = uc.case_number
       );
