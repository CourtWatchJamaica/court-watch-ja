-- user_cases rows tracked by case_id resolve their case number through a live
-- join to judgments/court_sittings, so any id churn in those tables (judgments
-- delete-reinsert before 2026-07-25, court_sittings eviction/restore cycles)
-- orphans the tracking row and blanks it out of the docket. Snapshot the case
-- number onto the tracking row so it survives id churn. Rows whose case_id no
-- longer resolves cannot be repaired here and stay NULL.
UPDATE user_cases uc
SET case_number = j.case_number
FROM judgments j
WHERE uc.case_number IS NULL
  AND uc.case_type = 'judgment'
  AND j.id = uc.case_id;

UPDATE user_cases uc
SET case_number = cs.case_number
FROM court_sittings cs
WHERE uc.case_number IS NULL
  AND uc.case_type = 'sitting'
  AND cs.id = uc.case_id;
