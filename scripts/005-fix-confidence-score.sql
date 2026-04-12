-- Fix confidence_score to be text enum instead of integer
-- Add is_active flag for soft deletes

ALTER TABLE offers 
  DROP COLUMN IF EXISTS confidence_score,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS industry;

ALTER TABLE offers
  ADD COLUMN confidence_score TEXT 
    CHECK (confidence_score IN ('strong', 'needs_work', 'weak')) NOT NULL DEFAULT 'needs_work',
  ADD COLUMN is_active BOOLEAN DEFAULT true;
