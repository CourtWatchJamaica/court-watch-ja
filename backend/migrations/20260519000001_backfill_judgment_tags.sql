-- Backfill tags for all existing judgments.
-- summary_text is NULL for all rows, so we match on title keywords first,
-- then also infer from case_number division codes (e.g. "JMCA Crim", "FD",
-- "CV", "HCV", "RV") to achieve meaningful coverage across the 365 CoA rows.
--
-- Reset first so the migration is fully idempotent on re-run.
UPDATE judgments SET tags = '{}';

-- ── Title keyword matching ────────────────────────────────────────────────────

UPDATE judgments
SET tags = array_append(tags, 'tax_law')
WHERE 'tax_law' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%tax%','%revenue%','%gct%','%customs%','%duty%','%assessment%','%income tax%'])
    OR summary_text ILIKE ANY(ARRAY['%tax%','%revenue%','%gct%','%customs%','%duty%','%assessment%','%income tax%'])
  );

UPDATE judgments
SET tags = array_append(tags, 'criminal')
WHERE 'criminal' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%murder%','%rape%','%robbery%','%manslaughter%','%criminal%','%assault%','%wounding%','%shooting%','%firearm%','%illegal%','%indecent%'])
    OR summary_text ILIKE ANY(ARRAY['%murder%','%rape%','%robbery%','%manslaughter%','%criminal%','%assault%','%wounding%','%shooting%','%firearm%','%illegal%','%indecent%'])
  );

UPDATE judgments
SET tags = array_append(tags, 'civil')
WHERE 'civil' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%negligence%','%contract%','%damages%','%injunction%','%civil%','%debt%','%breach%','%liability%'])
    OR summary_text ILIKE ANY(ARRAY['%negligence%','%contract%','%damages%','%injunction%','%civil%','%debt%','%breach%','%liability%'])
  );

UPDATE judgments
SET tags = array_append(tags, 'constitutional')
WHERE 'constitutional' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%constitutional%','%fundamental rights%','%charter%'])
    OR summary_text ILIKE ANY(ARRAY['%constitutional%','%fundamental rights%','%charter%'])
  );

UPDATE judgments
SET tags = array_append(tags, 'family')
WHERE 'family' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%divorce%','%custody%','%maintenance%','%family%','%matrimonial%'])
    OR summary_text ILIKE ANY(ARRAY['%divorce%','%custody%','%maintenance%','%family%','%matrimonial%'])
  );

UPDATE judgments
SET tags = array_append(tags, 'commercial')
WHERE 'commercial' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%commercial%','%company%','%insolvency%','%winding up%','%banking%'])
    OR summary_text ILIKE ANY(ARRAY['%commercial%','%company%','%insolvency%','%winding up%','%banking%'])
  );

UPDATE judgments
SET tags = array_append(tags, 'probate')
WHERE 'probate' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%probate%','%estate%','%will%','%administrator%','%executor%','%succession%'])
    OR summary_text ILIKE ANY(ARRAY['%probate%','%estate%','%will%','%administrator%','%executor%','%succession%'])
  );

UPDATE judgments
SET tags = array_append(tags, 'labour')
WHERE 'labour' != ALL(tags)
  AND (
       title ILIKE ANY(ARRAY['%labour%','%employment%','%dismissal%','%redundancy%','%worker%'])
    OR summary_text ILIKE ANY(ARRAY['%labour%','%employment%','%dismissal%','%redundancy%','%worker%'])
  );

-- ── Case-number division codes ────────────────────────────────────────────────
-- summary_text is NULL for all current rows; titles are party names with no
-- legal-topic keywords. The case_number encodes the division, giving ~82%
-- coverage vs ~6% from title-only matching.

-- criminal: JMCA Crim (273 rows), COACR, SCCA, COAPCCR
UPDATE judgments
SET tags = array_append(tags, 'criminal')
WHERE 'criminal' != ALL(tags)
  AND (
       case_number ILIKE '%CRIM%'
    OR case_number ILIKE '%COACR%'
    OR case_number ILIKE '%SCCA%'
    OR case_number ILIKE '%PCCR%'
  );

-- civil: CV-suffixed/prefixed patterns (SUCV, COACV, HCV, SUHCV, PCCV)
UPDATE judgments
SET tags = array_append(tags, 'civil')
WHERE 'civil' != ALL(tags)
  AND (
       case_number ILIKE '%CV%'
    OR case_number ILIKE '%HCV%'
  );

-- family: FD = Family Division
UPDATE judgments
SET tags = array_append(tags, 'family')
WHERE 'family' != ALL(tags)
  AND case_number ILIKE '%FD%';

-- tax_law: RV = Revenue court
UPDATE judgments
SET tags = array_append(tags, 'tax_law')
WHERE 'tax_law' != ALL(tags)
  AND case_number ILIKE '%RV%';
