-- Add outreach_complete flag so users can explicitly signal
-- that their outreach tracker is filled in for a niche.
ALTER TABLE niche_user_state
  ADD COLUMN IF NOT EXISTS outreach_complete BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS outreach_complete_at TIMESTAMPTZ;

-- Backfill: any niche with at least one logged channel activity OR
-- whose status indicates progression past outreach is considered complete.
UPDATE niche_user_state
SET
  outreach_complete = TRUE,
  outreach_complete_at = COALESCE(outreach_complete_at, updated_at, NOW())
WHERE
  outreach_complete IS DISTINCT FROM TRUE
  AND (
    coffee_date_completed = TRUE
    OR win_completed = TRUE
    OR client_onboarded = TRUE
    OR (outreach_messages_sent IS NOT NULL AND outreach_messages_sent > 0)
  );
