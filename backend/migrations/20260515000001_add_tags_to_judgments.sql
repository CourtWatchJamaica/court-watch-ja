ALTER TABLE judgments ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- Backfill tax_law tag for existing judgments whose title or summary contains tax keywords
UPDATE judgments
SET tags = array_append(tags, 'tax_law')
WHERE 'tax_law' != ALL(tags)
  AND (
    lower(coalesce(title, '')) ~*
      '(income tax|tax appeal|general consumption tax|\bgct\b|customs duty|customs and excise|'
      'national insurance|property tax|transfer tax|stamp duty|tax authority|taxpayer|'
      'tax assessment|tax liability|tax evasion|commissioner of inland revenue|inland revenue|'
      'tax administration|value added tax|\bvat\b|withholding tax|tax compliance)'
    OR
    lower(coalesce(summary_text, '')) ~*
      '(income tax|tax appeal|general consumption tax|\bgct\b|customs duty|customs and excise|'
      'national insurance|property tax|transfer tax|stamp duty|tax authority|taxpayer|'
      'tax assessment|tax liability|tax evasion|commissioner of inland revenue|inland revenue|'
      'tax administration|value added tax|\bvat\b|withholding tax|tax compliance)'
  );
