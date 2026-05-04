-- One-time data-quality cleanup (1d).
--
-- Strips residual title prefixes from judges.name, normalises case, removes
-- empty sitting rows that leaked through the PDF parser, and deduplicates
-- judges whose names differ only in casing or whitespace.

-- Pass 1: "The Honourable [Mr./Mrs./Ms.] Justice X" → "X"
UPDATE judges
SET    name = trim(regexp_replace(name,
               '^(The\s+Honou?rable\s+)(Mr\.|Mrs\.|Ms\.|Miss\s+)?\s*Justice\s+',
               '', 'i'))
WHERE  name ~* '^The\s+Hon';

-- Pass 2: "Hon. Justice X" → "X"
UPDATE judges
SET    name = trim(regexp_replace(name, '^Hon\.\s+Justice\s+', '', 'i'))
WHERE  name ~* '^Hon\.\s+Justice\s';

-- Pass 3: "[Mr./Mrs./Ms.] Justice X" → "X"
UPDATE judges
SET    name = trim(regexp_replace(name,
               '^(Mr\.|Mrs\.|Ms\.|Miss)\s+Justice\s+',
               '', 'i'))
WHERE  name ~* '^(Mr\.|Mrs\.|Ms\.|Miss)\s+Justice\s';

-- Pass 4: "Justice X" → "X"
UPDATE judges
SET    name = trim(regexp_replace(name, '^Justice\s+', '', 'i'))
WHERE  name ~* '^Justice\s';

-- Normalise to title case ("JACKSON-HAISLEY" → "Jackson-Haisley").
-- PostgreSQL's initcap capitalises after any non-alphanumeric character,
-- so hyphens and spaces are both handled correctly.
UPDATE judges
SET    name = initcap(name)
WHERE  name <> initcap(name);

-- Remove sitting entries with no useful data (pure noise rows emitted by the
-- PDF parser on section-header lines that slipped past the filter).
DELETE FROM court_sittings
WHERE  case_number IS NULL
  AND  title       IS NULL;

-- Deduplicate judges: keep the row with the lowest id for each normalised name.
DELETE FROM judges a
USING       judges b
WHERE       a.id > b.id
  AND       lower(trim(a.name)) = lower(trim(b.name));
