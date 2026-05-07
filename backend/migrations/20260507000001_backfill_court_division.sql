-- Backfill court_division for existing rows where the column was hardcoded to
-- 'Civil' by the scraper regardless of actual division.  We infer the correct
-- division from the case_number, which encodes the division code in a well-known
-- position for both Jamaican case-number formats:
--
--   Civil format:      YYYY/DIVCODE/serial   e.g. 2024/HCV/00123
--   Commercial format: PREFIXYYYYDIVserial   e.g. SU2022CD00537
--
-- Updates are ordered from most-specific to least-specific so that a case
-- number matching multiple patterns settles on the correct division.
-- Rows that remain 'Civil' after this migration are genuinely civil matters
-- (HCV = High Court Civil, or no recognisable division code).

-- Commercial Division: civil format 2024/CD/nnn or commercial SU2022CDnnn
UPDATE court_sittings
   SET court_division = 'Commercial'
 WHERE court_division = 'Civil'
   AND (
         case_number ~ '\d{4}/CD/\d'
      OR case_number ~ '[A-Z]{1,4}\d{4}CD\d{3,6}'
   );

-- Criminal Division: /CR/ or /CRIM/ in civil-format numbers; SCCA prefix
UPDATE court_sittings
   SET court_division = 'Criminal'
 WHERE court_division = 'Civil'
   AND (
         case_number ~ '\d{4}/CR/\d'
      OR case_number ~ '\d{4}/CRIM/'
      OR case_number ~* '^SCCA/'
      OR case_number ~ '\d{4}/RMCA/'
   );

-- Gun Court: GC prefix (civil or standalone format)
UPDATE court_sittings
   SET court_division = 'Gun Court'
 WHERE court_division = 'Civil'
   AND case_number ~* '^GC[/ \-]';

-- Probate Division: /PRO or /PROB division code
UPDATE court_sittings
   SET court_division = 'Probate'
 WHERE court_division = 'Civil'
   AND case_number ~ '\d{4}/PRO[A-Z]*/\d';

-- Family Division: /HCF/ (High Court Family) or /FAM/
UPDATE court_sittings
   SET court_division = 'Family'
 WHERE court_division = 'Civil'
   AND (
         case_number ~ '\d{4}/HCF/\d'
      OR case_number ~ '\d{4}/FAM/\d'
   );
